import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/supabase/admin";
import type { VisibilityMode } from "./types";

// CP-2 admin reads: a customer's visibility configuration plus the visible-
// product COUNT the admin UI shows ("this customer can browse N products").
// The count mirrors the products RLS policy from 0008 exactly:
//   visible = active AND not hidden AND (assigned OR mode='all' OR
//             (mode='categories' AND category selected-or-child-of-selected))
// Service-role reads (admin page); the portal never imports this file.

export type CustomerVisibility = {
  mode: VisibilityMode;
  categoryIds: string[]; // selected categories ('categories' mode config)
  hiddenProductIds: string[];
  visibleCount: number;
  // false until migration 0008 is applied — the UI shows a "run migration"
  // state instead of a broken card (same tolerance pattern as the offers read).
  migrationApplied: boolean;
};

const DEFAULT_VISIBILITY: CustomerVisibility = {
  mode: "assigned",
  categoryIds: [],
  hiddenProductIds: [],
  visibleCount: 0,
  migrationApplied: false,
};

export async function fetchCustomerVisibility(
  customerId: string,
): Promise<CustomerVisibility> {
  const admin = getAdminClient();
  if (!admin) return { ...DEFAULT_VISIBILITY, migrationApplied: true }; // mock mode

  const { data: row, error } = await admin
    .from("customers")
    .select("visibility_mode")
    .eq("id", customerId)
    .maybeSingle();
  if (error) {
    // 42703 = column missing -> 0008 not applied yet. Anything else is logged
    // and degrades to the safe default rather than breaking the page.
    if (error.code !== "42703") {
      console.error("[admin] visibility read failed:", error.message);
    }
    return DEFAULT_VISIBILITY;
  }
  const mode = (row?.visibility_mode as VisibilityMode | undefined) ?? "assigned";

  const [{ data: catRows, error: catErr }, { data: hidRows, error: hidErr }] =
    await Promise.all([
      admin
        .from("customer_visible_categories")
        .select("category_id")
        .eq("customer_id", customerId),
      admin
        .from("customer_hidden_products")
        .select("product_id")
        .eq("customer_id", customerId),
    ]);
  // 42P01 = table missing (column exists but tables don't — a partial 0008).
  // Surface loudly in logs; treat config as empty so the page still renders.
  if (catErr) console.error("[admin] visible-categories read failed:", catErr.message);
  if (hidErr) console.error("[admin] hidden-products read failed:", hidErr.message);

  const categoryIds = ((catRows as { category_id: string }[]) ?? []).map(
    (r) => r.category_id,
  );
  const hiddenProductIds = ((hidRows as { product_id: string }[]) ?? []).map(
    (r) => r.product_id,
  );

  const visibleCount = await computeVisibleCount(admin, customerId, {
    mode,
    categoryIds,
    hiddenProductIds,
  });

  return { mode, categoryIds, hiddenProductIds, visibleCount, migrationApplied: true };
}

// Shared by the page read and both visibility actions (so the card's count
// refreshes from the same math after every save).
export async function computeVisibleCount(
  admin: SupabaseClient,
  customerId: string,
  cfg: { mode: VisibilityMode; categoryIds: string[]; hiddenProductIds: string[] },
): Promise<number> {
  const [{ data: prodRows, error: pErr }, { data: cpRows }, { data: allCats }] =
    await Promise.all([
      admin.from("products").select("id, category_id").eq("is_active", true),
      admin.from("customer_products").select("product_id").eq("customer_id", customerId),
      admin.from("categories").select("id, parent_id"),
    ]);
  if (pErr) {
    console.error("[admin] visible-count products read failed:", pErr.message);
    return 0;
  }

  const products = (prodRows as { id: string; category_id: string | null }[]) ?? [];
  const assigned = new Set(
    (((cpRows as { product_id: string }[]) ?? []).map((r) => r.product_id)),
  );
  const hidden = new Set(cfg.hiddenProductIds);

  // Read-time parent expansion, same as the RLS policy: a selected parent
  // includes all its (current) children.
  const selected = new Set(cfg.categoryIds);
  if (cfg.mode === "categories") {
    for (const c of ((allCats as { id: string; parent_id: string | null }[]) ?? [])) {
      if (c.parent_id && selected.has(c.parent_id)) selected.add(c.id);
    }
  }

  let count = 0;
  for (const p of products) {
    if (hidden.has(p.id)) continue;
    const visible =
      assigned.has(p.id) ||
      cfg.mode === "all" ||
      (cfg.mode === "categories" && p.category_id != null && selected.has(p.category_id));
    if (visible) count++;
  }
  return count;
}
