import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  indexRules,
  resolveWithIndex,
  type ResolvedPrice,
} from "@/lib/admin/pricing-engine";
import { fetchPricingRules, isManualPrice } from "@/lib/admin/pricing-data";

// Recompute core — shared by the manual Recompute tool (preview/apply) and the
// CP-1 autopilot that runs inside every cost/rule/product mutation.
// ADMIN-ONLY data layer: touches the deny-all pricing tables via the
// service-role client passed in by the calling action. Pure math stays in
// pricing-engine.ts; this module is orchestration + I/O only.

const CHUNK = 500; // batch size for bulk upserts

export type RecomputeScope =
  | { kind: "customer"; customerId: string }
  | { kind: "category"; categoryId: string }
  | { kind: "product"; productId: string }
  | { kind: "all" };

export type RecomputeRow = {
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  costCents: number | null;
  oldPriceCents: number; // effective (stored ?? list)
  newPriceCents: number; // effective after recompute
  // D4: what actually gets stored — NULL for list-sourced rows so they track
  // the list price automatically from then on.
  newStoredCents: number | null;
  sourceLabelData: { source: ResolvedPrice["source"]; marginPercent: number | null; priority: boolean };
  isManual: boolean; // protected unless includeManual
  willChange: boolean;
};

type AffectedRow = {
  customer_id: string;
  product_id: string;
  price_cents: number | null;
  customers: { business_name: string } | null;
  products: {
    name: string;
    list_price_cents: number;
    category_id: string | null;
  } | null;
};

// Shared core: resolve every affected (customer, product) through the waterfall.
export async function computeRecomputeRows(
  admin: SupabaseClient,
  scope: RecomputeScope,
  includeManual: boolean,
): Promise<{ rows: RecomputeRow[] } | { error: string }> {
  // Category scope needs the product-id set first (own + children).
  let productFilter: string[] | null = null;
  if (scope.kind === "category") {
    const { data: cats, error: catErr } = await admin
      .from("categories")
      .select("id")
      .or(`id.eq.${scope.categoryId},parent_id.eq.${scope.categoryId}`);
    if (catErr) return { error: "Could not resolve the category." };
    const catIds = (cats ?? []).map((c: { id: string }) => c.id);
    const { data: prods, error: prodErr } = await admin
      .from("products")
      .select("id")
      .in("category_id", catIds);
    if (prodErr) return { error: "Could not resolve the category's products." };
    productFilter = (prods ?? []).map((p: { id: string }) => p.id);
    if (productFilter.length === 0) return { rows: [] };
  }
  if (scope.kind === "product") productFilter = [scope.productId];

  let query = admin
    .from("customer_products")
    .select(
      "customer_id, product_id, price_cents, customers(business_name), products(name, list_price_cents, category_id)",
    );
  if (scope.kind === "customer") query = query.eq("customer_id", scope.customerId);
  if (productFilter) query = query.in("product_id", productFilter);
  const { data: cpRows, error: cpErr } = await query;
  if (cpErr) {
    console.error("[admin] recompute read failed:", cpErr.code ?? cpErr.message);
    return { error: "Could not read the assignments to recompute." };
  }

  const [{ data: costRows }, { rules }, { data: catRows }, { data: metaRows }] = await Promise.all([
    admin.from("product_costs").select("product_id, cost_cents"),
    fetchPricingRules(),
    admin.from("categories").select("id, parent_id"),
    admin.from("customer_product_pricing_meta").select("customer_id, product_id, price_source"),
  ]);

  const costs = new Map(
    ((costRows as { product_id: string; cost_cents: number }[]) ?? []).map((r) => [
      r.product_id,
      r.cost_cents,
    ]),
  );
  const parentOf = new Map(
    ((catRows as { id: string; parent_id: string | null }[]) ?? []).map((c) => [c.id, c.parent_id]),
  );
  const metaKey = (c: string, p: string) => `${c}:${p}`;
  const metaMap = new Map(
    ((metaRows as { customer_id: string; product_id: string; price_source: "manual" | "computed" }[]) ?? []).map(
      (m) => [metaKey(m.customer_id, m.product_id), m.price_source],
    ),
  );
  const idx = indexRules(rules);

  const rows: RecomputeRow[] = [];
  for (const r of (cpRows as unknown as AffectedRow[]) ?? []) {
    if (!r.products) continue;
    const metaSource = metaMap.get(metaKey(r.customer_id, r.product_id));
    const manual = metaSource
      ? metaSource === "manual"
      : isManualPrice(undefined, r.price_cents);
    const costCents = costs.get(r.product_id) ?? null;
    const categoryId = r.products.category_id;
    const resolved = resolveWithIndex({
      idx,
      customerId: r.customer_id,
      productId: r.product_id,
      categoryId,
      parentCategoryId: categoryId ? (parentOf.get(categoryId) ?? null) : null,
      costCents,
      listPriceCents: r.products.list_price_cents,
      manualPriceCents: null, // recompute asks: what WOULD the rules produce?
    });
    const oldPrice = r.price_cents ?? r.products.list_price_cents;
    // D4: list-sourced rows store NULL so they follow the list price forever.
    const newStored = resolved.source === "list" ? null : resolved.priceCents;
    const protectedManual = manual && !includeManual;
    rows.push({
      customerId: r.customer_id,
      customerName: r.customers?.business_name ?? "?",
      productId: r.product_id,
      productName: r.products.name,
      costCents,
      oldPriceCents: oldPrice,
      newPriceCents: resolved.priceCents,
      newStoredCents: newStored,
      sourceLabelData: {
        source: resolved.source,
        marginPercent: resolved.marginPercent,
        priority: resolved.priority,
      },
      isManual: manual,
      // Storage comparison (not effective-price comparison): a concrete
      // list-price snapshot normalizing to NULL is a real write even though
      // the customer-facing price is unchanged.
      willChange: !protectedManual && newStored !== r.price_cents,
    });
  }
  return { rows };
}

// Shared writer: chunked upserts of price + meta snapshot. Meta failures never
// lose the price write, but they DO surface as a warning (they weaken manual
// protection); only error codes are logged, never values.
export async function writeRecomputeRows(
  admin: SupabaseClient,
  toWrite: RecomputeRow[],
): Promise<{ updated: number; customers: number; warning?: string } | { error: string }> {
  const nowIso = new Date().toISOString();
  let metaFailures = 0;
  for (let i = 0; i < toWrite.length; i += CHUNK) {
    const chunk = toWrite.slice(i, i + CHUNK);
    const { error: cpErr } = await admin.from("customer_products").upsert(
      chunk.map((r) => ({
        customer_id: r.customerId,
        product_id: r.productId,
        price_cents: r.newStoredCents,
      })),
      { onConflict: "customer_id,product_id" },
    );
    if (cpErr) {
      console.error("[admin] recompute write failed:", cpErr.code ?? cpErr.message);
      return { error: `Write failed after ${i} rows — please retry.` };
    }
    const { error: metaErr } = await admin.from("customer_product_pricing_meta").upsert(
      chunk.map((r) => ({
        customer_id: r.customerId,
        product_id: r.productId,
        price_source: "computed",
        margin_percent: r.sourceLabelData.marginPercent,
        rule_scope:
          r.sourceLabelData.source === "product-margin"
            ? "product"
            : r.sourceLabelData.source === "customer-margin"
              ? "customer"
              : r.sourceLabelData.source === "category-margin"
                ? "category"
                : r.sourceLabelData.source === "global-margin"
                  ? "global"
                  : null,
        is_priority: r.sourceLabelData.priority,
        computed_at: nowIso,
      })),
      { onConflict: "customer_id,product_id" },
    );
    if (metaErr) {
      metaFailures += chunk.length;
      console.error("[admin] recompute meta write failed:", metaErr.code ?? metaErr.message);
    }
  }
  const customers = new Set(toWrite.map((r) => r.customerId)).size;
  return {
    updated: toWrite.length,
    customers,
    warning:
      metaFailures > 0
        ? `${metaFailures} price-source labels could not be updated (prices are correct).`
        : undefined,
  };
}

// CP-1 autopilot: recompute the affected COMPUTED rows inside the mutating
// action itself. Never touches manual prices (includeManual is always false).
export async function autoRecomputeForScope(
  admin: SupabaseClient,
  scope: RecomputeScope,
): Promise<{ updated: number; customers: number; warning?: string } | { error: string }> {
  const result = await computeRecomputeRows(admin, scope, false);
  if ("error" in result) return { error: result.error };
  const toWrite = result.rows.filter((r) => r.willChange);
  if (toWrite.length === 0) return { updated: 0, customers: 0 };
  return writeRecomputeRows(admin, toWrite);
}
