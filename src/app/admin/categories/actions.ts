"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/require-admin";

// Category mutations via the service-role client. Same guard/result contract as
// the product actions. Deleting a category is BLOCKED while products still
// reference it (products.category_id is ON DELETE SET NULL, so an unguarded
// delete would silently orphan products to "uncategorized").

export type ActionResult = { ok: true } | { ok: false; message: string };

export type CategoryInput = { name: string; description?: string };

function revalidate() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products"); // category dropdown + names
  revalidatePath("/admin");
}

export async function createCategory(input: CategoryInput): Promise<ActionResult> {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Name is required." };

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { error } = await admin
    .from("categories")
    .insert({ name, description: input.description?.trim() || null });
  if (error) {
    if (error.code === "23505")
      return { ok: false, message: "A category with that name already exists." };
    console.error("[admin] create category failed:", error.message);
    return { ok: false, message: "Could not create the category. Please try again." };
  }
  revalidate();
  return { ok: true };
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<ActionResult> {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Name is required." };

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { error } = await admin
    .from("categories")
    .update({ name, description: input.description?.trim() || null })
    .eq("id", id);
  if (error) {
    if (error.code === "23505")
      return { ok: false, message: "A category with that name already exists." };
    console.error("[admin] update category failed:", error.message);
    return { ok: false, message: "Could not update the category. Please try again." };
  }
  revalidate();
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  // Guard: block while products still reference this category.
  const { count, error: countErr } = await admin
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);
  if (countErr) {
    console.error("[admin] category usage check failed:", countErr.message);
    return { ok: false, message: "Could not verify category usage. Please try again." };
  }
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message: `${count} product${count === 1 ? "" : "s"} still use this category — reassign them first.`,
    };
  }

  const { error } = await admin.from("categories").delete().eq("id", id);
  if (error) {
    console.error("[admin] delete category failed:", error.message);
    return { ok: false, message: "Could not delete the category. Please try again." };
  }
  revalidate();
  return { ok: true };
}
