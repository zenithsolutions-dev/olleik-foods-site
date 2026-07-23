"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/require-admin";
import {
  indexRules,
  resolveWithIndex,
  validMarginPercent,
  type ResolvedPrice,
} from "@/lib/admin/pricing-engine";
import { fetchPricingRules, isManualPrice } from "@/lib/admin/pricing-data";
import type { PricingRuleScope } from "@/lib/admin/types";

// Cost & margin-rule mutations + recompute. ADMIN-ONLY: every action re-checks
// requireAdmin() and uses the service-role client on the deny-all tables
// (product_costs / pricing_rules / customer_product_pricing_meta). Nothing here
// is ever reachable from portal code.

export type ActionResult = { ok: true } | { ok: false; message: string };

const CHUNK = 500; // batch size for bulk upserts

function revalidatePricing(customerId?: string) {
  revalidatePath("/admin/pricing");
  revalidatePath("/admin/products");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/assign");
  if (customerId) revalidatePath(`/admin/customers/${customerId}`);
}

// ---------------- Product cost ----------------

export async function setProductCost(
  productId: string,
  costCents: number | null,
): Promise<ActionResult> {
  await requireAdmin();
  if (costCents != null && (!Number.isInteger(costCents) || costCents < 0)) {
    return { ok: false, message: "Cost must be a valid non-negative amount." };
  }
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  if (costCents == null) {
    const { error } = await admin.from("product_costs").delete().eq("product_id", productId);
    if (error) {
      console.error("[admin] remove product cost failed:", error.message);
      return { ok: false, message: "Could not remove the cost. Please try again." };
    }
  } else {
    const { error } = await admin
      .from("product_costs")
      .upsert(
        { product_id: productId, cost_cents: costCents, updated_at: new Date().toISOString() },
        { onConflict: "product_id" },
      );
    if (error) {
      console.error("[admin] set product cost failed:", error.message);
      return { ok: false, message: "Could not save the cost. Please try again." };
    }
  }
  revalidatePricing();
  return { ok: true };
}

// ---------------- Pricing rules ----------------

export type PricingRuleInput = {
  scope: PricingRuleScope;
  categoryId?: string | null;
  customerId?: string | null;
  marginPercent: number;
  isPriority?: boolean; // category scope only: "Overrides customer margins"
  isActive?: boolean;
};

function validateRuleInput(input: PricingRuleInput): string | null {
  if (!validMarginPercent(input.marginPercent)) {
    return "Margin must be between 0 and 500 with at most 2 decimals.";
  }
  if (input.scope === "category" && !input.categoryId) return "Choose a category for this rule.";
  if (input.scope === "customer" && !input.customerId) return "Choose a customer for this rule.";
  if (input.isPriority && input.scope !== "category") {
    return "Only category rules can override customer margins.";
  }
  return null;
}

export async function upsertPricingRule(input: PricingRuleInput): Promise<ActionResult> {
  await requireAdmin();
  const invalid = validateRuleInput(input);
  if (invalid) return { ok: false, message: invalid };

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  // One rule per target (partial unique indexes): update-if-exists, else insert.
  let existingQuery = admin.from("pricing_rules").select("id").eq("scope", input.scope);
  if (input.scope === "category") existingQuery = existingQuery.eq("category_id", input.categoryId!);
  if (input.scope === "customer") existingQuery = existingQuery.eq("customer_id", input.customerId!);
  const { data: existing, error: exErr } = await existingQuery.maybeSingle();
  if (exErr) {
    console.error("[admin] rule lookup failed:", exErr.message);
    return { ok: false, message: "Could not check existing rules. Please try again." };
  }

  const row = {
    scope: input.scope,
    category_id: input.scope === "category" ? input.categoryId : null,
    customer_id: input.scope === "customer" ? input.customerId : null,
    margin_percent: input.marginPercent,
    is_priority: input.scope === "category" ? (input.isPriority ?? false) : false,
    is_active: input.isActive ?? true,
    updated_at: new Date().toISOString(),
  };

  const { error } = existing
    ? await admin.from("pricing_rules").update(row).eq("id", existing.id)
    : await admin.from("pricing_rules").insert(row);
  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "A rule for that target already exists — edit it instead." };
    }
    console.error("[admin] save pricing rule failed:", error.message);
    return { ok: false, message: "Could not save the rule. Please try again." };
  }
  revalidatePricing(input.customerId ?? undefined);
  return { ok: true };
}

export async function togglePricingRule(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { error } = await admin
    .from("pricing_rules")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[admin] toggle pricing rule failed:", error.message);
    return { ok: false, message: "Could not update the rule. Please try again." };
  }
  revalidatePricing();
  return { ok: true };
}

export async function deletePricingRule(id: string): Promise<ActionResult> {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { error } = await admin.from("pricing_rules").delete().eq("id", id);
  if (error) {
    console.error("[admin] delete pricing rule failed:", error.message);
    return { ok: false, message: "Could not delete the rule. Please try again." };
  }
  revalidatePricing();
  return { ok: true };
}

// ---------------- Recompute ----------------

export type RecomputeScope =
  | { kind: "customer"; customerId: string }
  | { kind: "category"; categoryId: string }
  | { kind: "all" };

export type RecomputeRow = {
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  costCents: number | null;
  oldPriceCents: number; // effective (stored ?? list)
  newPriceCents: number;
  sourceLabelData: { source: ResolvedPrice["source"]; marginPercent: number | null; priority: boolean };
  isManual: boolean; // protected unless includeManual
  willChange: boolean;
};

export type RecomputePreview =
  | {
      ok: true;
      rows: RecomputeRow[]; // capped at PREVIEW_CAP for transport; totals cover ALL rows
      totalRows: number;
      willChange: number;
      skippedManual: number;
      oldTotalCents: number;
      newTotalCents: number;
      oldProfitCents: number; // only rows with a cost
      newProfitCents: number;
    }
  | { ok: false; message: string };

const PREVIEW_CAP = 400;

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
async function computeRecomputeRows(
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

  let query = admin
    .from("customer_products")
    .select(
      "customer_id, product_id, price_cents, customers(business_name), products(name, list_price_cents, category_id)",
    );
  if (scope.kind === "customer") query = query.eq("customer_id", scope.customerId);
  if (productFilter) query = query.in("product_id", productFilter);
  const { data: cpRows, error: cpErr } = await query;
  if (cpErr) {
    console.error("[admin] recompute read failed:", cpErr.message);
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
      categoryId,
      parentCategoryId: categoryId ? (parentOf.get(categoryId) ?? null) : null,
      costCents,
      listPriceCents: r.products.list_price_cents,
      manualPriceCents: null, // recompute asks: what WOULD the rules produce?
    });
    const oldPrice = r.price_cents ?? r.products.list_price_cents;
    const protectedManual = manual && !includeManual;
    rows.push({
      customerId: r.customer_id,
      customerName: r.customers?.business_name ?? "?",
      productId: r.product_id,
      productName: r.products.name,
      costCents,
      oldPriceCents: oldPrice,
      newPriceCents: resolved.priceCents,
      sourceLabelData: {
        source: resolved.source,
        marginPercent: resolved.marginPercent,
        priority: resolved.priority,
      },
      isManual: manual,
      willChange: !protectedManual && resolved.priceCents !== oldPrice,
    });
  }
  return { rows };
}

export async function previewRecompute(
  scope: RecomputeScope,
  includeManual: boolean,
): Promise<RecomputePreview> {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const result = await computeRecomputeRows(admin, scope, includeManual);
  if ("error" in result) return { ok: false, message: result.error };

  const { rows } = result;
  let oldTotal = 0,
    newTotal = 0,
    oldProfit = 0,
    newProfit = 0,
    willChange = 0,
    skippedManual = 0;
  for (const r of rows) {
    const effectiveNew = r.isManual && !includeManual ? r.oldPriceCents : r.newPriceCents;
    oldTotal += r.oldPriceCents;
    newTotal += effectiveNew;
    if (r.costCents != null) {
      oldProfit += r.oldPriceCents - r.costCents;
      newProfit += effectiveNew - r.costCents;
    }
    if (r.willChange) willChange++;
    if (r.isManual && !includeManual) skippedManual++;
  }
  return {
    ok: true,
    rows: rows.slice(0, PREVIEW_CAP),
    totalRows: rows.length,
    willChange,
    skippedManual,
    oldTotalCents: oldTotal,
    newTotalCents: newTotal,
    oldProfitCents: oldProfit,
    newProfitCents: newProfit,
  };
}

export async function applyRecompute(
  scope: RecomputeScope,
  includeManual: boolean,
  expectedChanges: number,
): Promise<{ ok: true; updated: number } | { ok: false; message: string }> {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const result = await computeRecomputeRows(admin, scope, includeManual);
  if ("error" in result) return { ok: false, message: result.error };

  const toWrite = result.rows.filter((r) => r.willChange);
  // Stale-preview guard: rules/costs changed between preview and apply.
  if (toWrite.length !== expectedChanges) {
    return {
      ok: false,
      message: `The data changed since the preview (${toWrite.length} rows would now change, preview said ${expectedChanges}). Please re-preview.`,
    };
  }

  const nowIso = new Date().toISOString();
  for (let i = 0; i < toWrite.length; i += CHUNK) {
    const chunk = toWrite.slice(i, i + CHUNK);
    const { error: cpErr } = await admin.from("customer_products").upsert(
      chunk.map((r) => ({
        customer_id: r.customerId,
        product_id: r.productId,
        price_cents: r.newPriceCents,
      })),
      { onConflict: "customer_id,product_id" },
    );
    if (cpErr) {
      console.error("[admin] recompute write failed:", cpErr.message);
      return { ok: false, message: `Write failed after ${i} rows — re-preview and retry.` };
    }
    const { error: metaErr } = await admin.from("customer_product_pricing_meta").upsert(
      chunk.map((r) => ({
        customer_id: r.customerId,
        product_id: r.productId,
        price_source: "computed",
        margin_percent: r.sourceLabelData.marginPercent,
        rule_scope:
          r.sourceLabelData.source === "customer-margin"
            ? "customer"
            : r.sourceLabelData.source === "category-margin"
              ? "category"
              : r.sourceLabelData.source === "global-margin"
                ? "global"
                : null,
        computed_at: nowIso,
      })),
      { onConflict: "customer_id,product_id" },
    );
    if (metaErr) console.error("[admin] recompute meta write failed:", metaErr.message);
  }

  revalidatePricing(scope.kind === "customer" ? scope.customerId : undefined);
  return { ok: true, updated: toWrite.length };
}
