import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import type { PriceSource, PricingRule, PricingRuleScope } from "./types";

// ADMIN-ONLY reads of the deny-all pricing tables (product_costs,
// pricing_rules, customer_product_pricing_meta) via the service-role client.
// This module must NEVER be imported by portal or public code — enforced by
// the ESLint portal zone + scripts/guard-portal.mjs. All readers are tolerant
// of the tables not existing yet ("run migration 0006?") so admin pages still
// render before the migration.

export type CostsMap = Record<string, number>; // productId -> cost_cents

export async function fetchProductCosts(): Promise<{ costs: CostsMap; live: boolean }> {
  const admin = getAdminClient();
  if (!admin) return { costs: {}, live: false };

  const { data, error } = await admin.from("product_costs").select("product_id, cost_cents");
  if (error) {
    console.error("[admin] failed to load product costs (run migration 0006?):", error.message);
    return { costs: {}, live: true };
  }
  const costs: CostsMap = {};
  for (const r of (data as { product_id: string; cost_cents: number }[]) ?? []) {
    costs[r.product_id] = r.cost_cents;
  }
  return { costs, live: true };
}

type RuleRow = {
  id: string;
  scope: PricingRuleScope;
  category_id: string | null;
  customer_id: string | null;
  product_id: string | null;
  margin_percent: number | string; // numeric can arrive as string
  is_priority: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function toRule(r: RuleRow): PricingRule {
  return {
    id: r.id,
    scope: r.scope,
    categoryId: r.category_id,
    customerId: r.customer_id,
    productId: r.product_id,
    marginPercent: typeof r.margin_percent === "string" ? parseFloat(r.margin_percent) : r.margin_percent,
    isPriority: r.is_priority,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function fetchPricingRules(): Promise<{ rules: PricingRule[]; live: boolean }> {
  const admin = getAdminClient();
  if (!admin) return { rules: [], live: false };

  const { data, error } = await admin
    .from("pricing_rules")
    .select(
      "id, scope, category_id, customer_id, product_id, margin_percent, is_priority, is_active, created_at, updated_at",
    )
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[admin] failed to load pricing rules (run migration 0007?):", error.message);
    return { rules: [], live: true };
  }
  return { rules: (data as RuleRow[]).map(toRule), live: true };
}

export type PricingMeta = {
  priceSource: PriceSource;
  marginPercent: number | null;
  ruleScope: PricingRuleScope | null;
  isPriority: boolean; // 0007: snapshot of the winning rule's priority flag
  computedAt: string;
};

// productId -> meta, for one customer. Rows with no meta (pre-0006 data) are
// simply absent — callers apply the rollout default: non-null price = manual.
export async function fetchPricingMeta(
  customerId: string,
): Promise<Record<string, PricingMeta>> {
  const admin = getAdminClient();
  if (!admin) return {};

  const { data, error } = await admin
    .from("customer_product_pricing_meta")
    .select("product_id, price_source, margin_percent, rule_scope, is_priority, computed_at")
    .eq("customer_id", customerId);
  if (error) {
    console.error("[admin] failed to load pricing meta (run migration 0007?):", error.message);
    return {};
  }
  const map: Record<string, PricingMeta> = {};
  for (const r of (data as {
    product_id: string;
    price_source: PriceSource;
    margin_percent: number | string | null;
    rule_scope: PricingRuleScope | null;
    is_priority: boolean | null;
    computed_at: string;
  }[]) ?? []) {
    map[r.product_id] = {
      priceSource: r.price_source,
      marginPercent:
        r.margin_percent == null
          ? null
          : typeof r.margin_percent === "string"
            ? parseFloat(r.margin_percent)
            : r.margin_percent,
      ruleScope: r.rule_scope,
      isPriority: r.is_priority ?? false,
      computedAt: r.computed_at,
    };
  }
  return map;
}

// The rollout default (0006): is a stored assignment row "manual" (protected
// from recompute)? Meta wins when present; otherwise any pre-existing non-null
// price_cents is treated as manual.
export function isManualPrice(
  meta: PricingMeta | undefined,
  priceCents: number | null,
): boolean {
  if (meta) return meta.priceSource === "manual";
  return priceCents != null;
}
