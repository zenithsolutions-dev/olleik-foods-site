"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { BUSINESS_TIME_ZONE } from "@/lib/dates";
import { parseSpecialForm } from "@/lib/specials";
import { getAdminClient } from "@/lib/supabase/admin";

// Specials are managed entirely from here: publish, edit or remove one and the public site changes at once.

export type SpecialFormValues = Record<
  "id" | "product_id" | "title" | "description" | "unit_label" | "image_url" | "price" | "quantity_total" | "start_date" | "end_date",
  string
> & { is_published: boolean; show_price_to_guests: boolean };
export type SpecialFormState = { ok: boolean; message: string; values: SpecialFormValues } | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function refresh() {
  revalidatePath("/admin/specials");
  revalidatePath("/specials", "layout");
  revalidatePath("/");
  revalidatePath("/portal");
}

// Turns a database refusal into words the admin can act on.
function explain(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "Another special for this product is already published. Unpublish that one first.";
  if (error.message.includes("specials_sold_range")) return "The quantity cannot be lower than what has already been sold.";
  if (error.code === "23503") return "That product no longer exists.";
  if (error.code === "42P01" || error.code === "PGRST205") return "Specials are not set up yet (migration 0019).";
  return "Could not save. Please try again.";
}

export async function saveSpecial(_prev: SpecialFormState, formData: FormData): Promise<SpecialFormState> {
  await requireAdmin();
  const text = (name: string) => String(formData.get(name) ?? "");
  const values: SpecialFormValues = {
    id: text("id"),
    product_id: text("product_id"),
    title: text("title"),
    description: text("description"),
    unit_label: text("unit_label"),
    image_url: text("image_url"),
    price: text("price"),
    quantity_total: text("quantity_total"),
    start_date: text("start_date"),
    end_date: text("end_date"),
    is_published: formData.get("is_published") !== null,
    show_price_to_guests: formData.get("show_price_to_guests") !== null,
  };
  const parsed = parseSpecialForm(
    {
      ...values,
      is_published: values.is_published ? "on" : undefined,
      show_price_to_guests: values.show_price_to_guests ? "on" : undefined,
    },
    BUSINESS_TIME_ZONE,
  );
  if (!parsed.ok) return { ok: false, message: parsed.error, values };
  if (values.id && !UUID.test(values.id)) return { ok: false, message: "Unknown special.", values };

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Demo mode: no database is connected, nothing was saved.", values };

  const row = { ...parsed.row, updated_at: new Date().toISOString() };
  if (values.id) {
    // Once units are sold, the orders that took them are for THIS product: changing it would leave the
    // count and the orders describing different things.
    const { data: current } = await admin.from("specials").select("product_id, quantity_sold").eq("id", values.id).maybeSingle();
    if (!current) return { ok: false, message: "This special no longer exists.", values };
    if (current.quantity_sold > 0 && current.product_id !== row.product_id) {
      return { ok: false, message: "Units of this special are already ordered, so its product cannot be changed. Create a new special instead.", values };
    }
  }
  const { data: saved, error } = values.id
    ? await admin.from("specials").update(row).eq("id", values.id).select("id")
    : await admin.from("specials").insert(row).select("id");
  if (error) {
    console.error("[admin] saveSpecial failed:", error.message);
    return { ok: false, message: explain(error), values };
  }
  if (!saved || saved.length === 0) return { ok: false, message: "This special no longer exists.", values };
  refresh();
  return { ok: true, message: values.id ? "Saved." : parsed.row.is_published ? "Published." : "Saved as a draft.", values };
}

export async function setSpecialPublished(id: string, isPublished: boolean): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin || !UUID.test(id)) return { ok: false, message: "Could not update." };
  const { error } = await admin
    .from("specials")
    .update({ is_published: isPublished, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[admin] setSpecialPublished failed:", error.message);
    return { ok: false, message: explain(error) };
  }
  refresh();
  return { ok: true, message: isPublished ? "Published." : "Taken off the site." };
}

export async function deleteSpecial(id: string): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin || !UUID.test(id)) return { ok: false, message: "Could not delete." };
  // Orders that used it keep their lines and prices; only their link to the special is cleared (0019).
  const { error } = await admin.from("specials").delete().eq("id", id);
  if (error) {
    console.error("[admin] deleteSpecial failed:", error.message);
    return { ok: false, message: "Could not delete. Please try again." };
  }
  refresh();
  return { ok: true, message: "Deleted." };
}
