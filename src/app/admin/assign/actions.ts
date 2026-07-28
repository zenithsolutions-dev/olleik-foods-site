"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/require-admin";
import { indexRules, resolveWithIndex } from "@/lib/admin/pricing-engine";
import { fetchPricingRules } from "@/lib/admin/pricing-data";

// Reverse bulk assignment: products -> many customers, priced through the
// waterfall at assign time (meta 'computed'). MERGE-ONLY (D6): existing
// assignments and their prices are never touched — they are skipped. ADMIN-ONLY,
// service-role.

export type BulkAssignResult =
  | { ok: true; assigned: number; skippedExisting: number }
  | { ok: false; message: string };

const CHUNK = 500;

export async function bulkAssignToCustomers(input: {
  customerIds: string[];
  productIds: string[];
  // Preview-row unticks: productIds to skip for a specific customer.
  perCustomerExclusions?: Record<string, string[]>;
}): Promise<BulkAssignResult> {
  await requireAdmin();
  if (input.customerIds.length === 0 || input.productIds.length === 0) {
    return { ok: false, message: "Pick at least one product and one customer." };
  }
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  // Everything needed to price: products (list + category), category parents,
  // costs, rules, and the existing assignments to skip.
  const [
    { data: prodRows, error: prodErr },
    { data: catRows },
    { data: costRows },
    { rules },
    { data: existingRows, error: exErr },
  ] = await Promise.all([
    admin.from("products").select("id, list_price_cents, category_id").in("id", input.productIds),
    admin.from("categories").select("id, parent_id"),
    admin.from("product_costs").select("product_id, cost_cents"),
    fetchPricingRules(),
    admin
      .from("customer_products")
      .select("customer_id, product_id")
      .in("customer_id", input.customerIds)
      .in("product_id", input.productIds),
  ]);
  if (prodErr || exErr) {
    console.error("[admin] bulk assign read failed:", prodErr?.message ?? exErr?.message);
    return { ok: false, message: "Could not load the data to assign. Please try again." };
  }

  const products = (prodRows as { id: string; list_price_cents: number; category_id: string | null }[]) ?? [];
  const parentOf = new Map(
    ((catRows as { id: string; parent_id: string | null }[]) ?? []).map((c) => [c.id, c.parent_id]),
  );
  const costs = new Map(
    ((costRows as { product_id: string; cost_cents: number }[]) ?? []).map((r) => [r.product_id, r.cost_cents]),
  );
  const existing = new Set(
    ((existingRows as { customer_id: string; product_id: string }[]) ?? []).map(
      (r) => `${r.customer_id}:${r.product_id}`,
    ),
  );
  const idx = indexRules(rules);
  const nowIso = new Date().toISOString();

  type Row = { customer_id: string; product_id: string; price_cents: number | null };
  type MetaRow = {
    customer_id: string;
    product_id: string;
    price_source: "computed";
    margin_percent: number | null;
    rule_scope: "global" | "category" | "customer" | "product" | null;
    is_priority: boolean;
    computed_at: string;
  };
  const rows: Row[] = [];
  const metaRows: MetaRow[] = [];
  let skippedExisting = 0;

  for (const customerId of input.customerIds) {
    const excluded = new Set(input.perCustomerExclusions?.[customerId] ?? []);
    for (const p of products) {
      if (excluded.has(p.id)) continue;
      if (existing.has(`${customerId}:${p.id}`)) {
        skippedExisting++;
        continue;
      }
      const resolved = resolveWithIndex({
        idx,
        customerId,
        productId: p.id,
        categoryId: p.category_id,
        parentCategoryId: p.category_id ? (parentOf.get(p.category_id) ?? null) : null,
        costCents: costs.get(p.id) ?? null,
        listPriceCents: p.list_price_cents,
        manualPriceCents: null,
      });
      // 'list' resolution stores NULL (inherit list price) — same meaning as the
      // classic picker; a concrete number is stored only when a rule priced it.
      rows.push({
        customer_id: customerId,
        product_id: p.id,
        price_cents: resolved.source === "list" ? null : resolved.priceCents,
      });
      metaRows.push({
        customer_id: customerId,
        product_id: p.id,
        price_source: "computed",
        margin_percent: resolved.marginPercent,
        rule_scope:
          resolved.source === "product-margin"
            ? "product"
            : resolved.source === "customer-margin"
              ? "customer"
              : resolved.source === "category-margin"
                ? "category"
                : resolved.source === "global-margin"
                  ? "global"
                  : null,
        is_priority: resolved.priority,
        computed_at: nowIso,
      });
    }
  }

  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await admin
      .from("customer_products")
      .upsert(rows.slice(i, i + CHUNK), {
        onConflict: "customer_id,product_id",
        ignoreDuplicates: true, // merge-only backstop against races
      });
    if (error) {
      console.error("[admin] bulk assign write failed:", error.message);
      return { ok: false, message: `Write failed after ${i} rows — please retry.` };
    }
    const { error: metaErr } = await admin
      .from("customer_product_pricing_meta")
      .upsert(metaRows.slice(i, i + CHUNK), {
        onConflict: "customer_id,product_id",
        ignoreDuplicates: true,
      });
    if (metaErr) console.error("[admin] bulk assign meta write failed:", metaErr.message);
  }

  revalidatePath("/admin/customers");
  revalidatePath("/admin/assign");
  for (const id of input.customerIds) revalidatePath(`/admin/customers/${id}`);
  return { ok: true, assigned: rows.length, skippedExisting };
}
