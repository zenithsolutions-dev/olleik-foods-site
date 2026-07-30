"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/require-admin";
import { guardAction } from "@/lib/admin/action-guard";
import { computeVisibleCount } from "@/lib/admin/visibility-data";
import type { VisibilityMode } from "@/lib/admin/types";

// CP-2 visibility writes. ADMIN-ONLY, service-role. Enforcement itself lives in
// the products RLS policy (0008) — these actions only edit the configuration
// the policy reads. Both replace their list ATOMICALLY from the UI's point of
// view: delete-then-insert of the full new set, then a fresh visible count.
//
// NOTE: only declared `export type X = ...` in this "use server" file — never
// `export type { X }` re-exports (Turbopack server-actions loader emits a
// runtime export for the erased identifier and every action here would 500).

export type VisibilityActionResult =
  | { ok: true; visibleCount: number; hiddenAssignedCount?: number }
  | { ok: false; message: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LIST = 500;
const MODES: VisibilityMode[] = ["assigned", "all", "categories"];

function invalidIds(ids: string[]): boolean {
  return ids.some((id) => !UUID_RE.test(id));
}

function revalidate(customerId: string) {
  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/customers");
  revalidatePath("/portal");
  revalidatePath("/portal/catalog");
}

export async function setCustomerVisibility(input: {
  customerId: string;
  mode: VisibilityMode;
  categoryIds: string[];
}): Promise<VisibilityActionResult> {
  await requireAdmin();
  return guardAction("setCustomerVisibility", async () => {
    if (!UUID_RE.test(input.customerId)) {
      return { ok: false, message: "Invalid customer id." };
    }
    if (!MODES.includes(input.mode)) {
      return { ok: false, message: "Unknown visibility mode." };
    }
    if (input.mode !== "categories" && input.categoryIds.length > 0) {
      return {
        ok: false,
        message: "Category selections only apply to the 'Selected categories' mode.",
      };
    }
    if (input.categoryIds.length > MAX_LIST) {
      return { ok: false, message: `Too many categories (max ${MAX_LIST}).` };
    }
    if (invalidIds(input.categoryIds)) {
      return { ok: false, message: "Invalid category id in the selection." };
    }

    const admin = getAdminClient();
    if (!admin) return { ok: false, message: "Supabase is not configured." };

    const { error: modeErr } = await admin
      .from("customers")
      .update({ visibility_mode: input.mode })
      .eq("id", input.customerId);
    if (modeErr) {
      if (modeErr.code === "42703") {
        return { ok: false, message: "Visibility is not enabled yet — run migration 0008 first." };
      }
      console.error("[admin] set visibility mode failed:", modeErr.message);
      return { ok: false, message: "Could not save the visibility mode. Please try again." };
    }

    // Mode-flap edge case (spec §7): category selections are only REPLACED when
    // saving 'categories' mode. Saving 'assigned'/'all' leaves the stored
    // selection untouched — it is inert under those modes (the RLS policy's
    // category arm only fires when visibility_mode = 'categories'), so an
    // admin can flip away and back without losing their picks.
    if (input.mode === "categories") {
      // Delete-then-insert; a failed insert leaves an empty selection
      // (fail-CLOSED: the customer sees less, never more) with a retryable error.
      const { error: delErr } = await admin
        .from("customer_visible_categories")
        .delete()
        .eq("customer_id", input.customerId);
      if (delErr) {
        console.error("[admin] clear visible categories failed:", delErr.message);
        return { ok: false, message: "Could not update the category selection. Please try again." };
      }
      if (input.categoryIds.length > 0) {
        const { error: insErr } = await admin.from("customer_visible_categories").insert(
          input.categoryIds.map((category_id) => ({
            customer_id: input.customerId,
            category_id,
          })),
        );
        if (insErr) {
          console.error("[admin] save visible categories failed:", insErr.message);
          return {
            ok: false,
            message: "Could not save the category selection — no categories are selected. Please retry.",
          };
        }
      }
    }

    const { data: hidRows } = await admin
      .from("customer_hidden_products")
      .select("product_id")
      .eq("customer_id", input.customerId);
    const visibleCount = await computeVisibleCount(admin, input.customerId, {
      mode: input.mode,
      categoryIds: input.categoryIds, // [] under 'assigned'/'all' — inert there anyway
      hiddenProductIds: (((hidRows as { product_id: string }[]) ?? [])).map(
        (r) => r.product_id,
      ),
    });

    revalidate(input.customerId);
    return { ok: true, visibleCount };
  });
}

export async function setHiddenProducts(input: {
  customerId: string;
  productIds: string[];
}): Promise<VisibilityActionResult> {
  await requireAdmin();
  return guardAction("setHiddenProducts", async () => {
    if (!UUID_RE.test(input.customerId)) {
      return { ok: false, message: "Invalid customer id." };
    }
    if (input.productIds.length > MAX_LIST) {
      return { ok: false, message: `Too many hidden products (max ${MAX_LIST}).` };
    }
    if (invalidIds(input.productIds)) {
      return { ok: false, message: "Invalid product id in the hidden list." };
    }

    const admin = getAdminClient();
    if (!admin) return { ok: false, message: "Supabase is not configured." };

    const { error: delErr } = await admin
      .from("customer_hidden_products")
      .delete()
      .eq("customer_id", input.customerId);
    if (delErr) {
      if (delErr.code === "42P01") {
        return { ok: false, message: "Visibility is not enabled yet — run migration 0008 first." };
      }
      console.error("[admin] clear hidden products failed:", delErr.message);
      return { ok: false, message: "Could not update the hidden list. Please try again." };
    }
    if (input.productIds.length > 0) {
      const { error: insErr } = await admin.from("customer_hidden_products").insert(
        input.productIds.map((product_id) => ({
          customer_id: input.customerId,
          product_id,
        })),
      );
      if (insErr) {
        console.error("[admin] save hidden products failed:", insErr.message);
        return {
          ok: false,
          message: "Could not save the hidden list — nothing is hidden right now. Please retry.",
        };
      }
    }

    // Fresh config for the count + the assigned∩hidden conflict warning.
    const [{ data: custRow }, { data: catRows }, { data: cpRows }] = await Promise.all([
      admin.from("customers").select("visibility_mode").eq("id", input.customerId).maybeSingle(),
      admin
        .from("customer_visible_categories")
        .select("category_id")
        .eq("customer_id", input.customerId),
      admin
        .from("customer_products")
        .select("product_id")
        .eq("customer_id", input.customerId),
    ]);
    const mode = ((custRow?.visibility_mode as VisibilityMode | undefined) ?? "assigned");
    const visibleCount = await computeVisibleCount(admin, input.customerId, {
      mode,
      categoryIds: (((catRows as { category_id: string }[]) ?? [])).map((r) => r.category_id),
      hiddenProductIds: input.productIds,
    });
    const assignedSet = new Set(
      (((cpRows as { product_id: string }[]) ?? [])).map((r) => r.product_id),
    );
    const hiddenAssignedCount = input.productIds.filter((id) => assignedSet.has(id)).length;

    revalidate(input.customerId);
    return { ok: true, visibleCount, hiddenAssignedCount };
  });
}
