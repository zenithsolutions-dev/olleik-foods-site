import type { PricingRule, PricingRuleScope } from "./types";

// PURE cost/profit pricing engine — no I/O, no clock, fully unit-testable.
// ADMIN-ONLY: this module must NEVER be imported by portal or public code
// (enforced by the ESLint portal zone + scripts/guard-portal.mjs). The portal
// only ever sees the final materialized customer_products.price_cents.
//
// Margin semantics: MARKUP ON COST — price = round(cost * (1 + margin/100)),
// half-up to whole cents. margin 0 ⇒ sell exactly at cost.
//
// WATERFALL (most specific wins; D8 final ordering):
//   1. manual per-customer-product price          -> 'manual'
//   2. PRIORITY category rule (child beats parent) -> 'category-margin' (priority)
//   3. per-customer margin                         -> 'customer-margin'
//   4. category rule, non-priority (child first)   -> 'category-margin'
//   5. global default margin                       -> 'global-margin'
//   6. list price (no cost recorded, or no rules)  -> 'list'
// A rule with is_active=false is treated as absent (filter before calling).
// No cost recorded ⇒ NO margin can apply; manual still wins, else list.

export type MarginSource =
  | "manual"
  | "customer-margin"
  | "category-margin"
  | "global-margin"
  | "list";

export type ResolvedPrice = {
  priceCents: number;
  source: MarginSource;
  marginPercent: number | null; // the margin used when a rule priced it
  priority: boolean; // true when a priority category rule won
};

export function marginPriceCents(costCents: number, marginPercent: number): number {
  return Math.round(costCents * (1 + marginPercent / 100));
}

export type ResolveInput = {
  costCents: number | null; // null = no cost recorded
  listPriceCents: number;
  manualPriceCents: number | null; // non-null = admin-set manual price (always wins)
  customerMargin: number | null; // active customer-scope rule margin, else null
  // Category chain, own category first then parent (each null when no rule):
  categoryMargin: { percent: number; priority: boolean } | null;
  parentCategoryMargin: { percent: number; priority: boolean } | null;
  globalMargin: number | null;
};

export function resolveCustomerPriceCents(input: ResolveInput): ResolvedPrice {
  if (input.manualPriceCents != null) {
    return {
      priceCents: input.manualPriceCents,
      source: "manual",
      marginPercent: null,
      priority: false,
    };
  }

  if (input.costCents == null) {
    return { priceCents: input.listPriceCents, source: "list", marginPercent: null, priority: false };
  }
  const cost = input.costCents;

  // Nearest category rule wins within each tier: own category, then parent.
  const chain = [input.categoryMargin, input.parentCategoryMargin];
  const priorityCat = chain.find((c) => c != null && c.priority) ?? null;
  const anyCat = chain.find((c) => c != null) ?? null;

  if (priorityCat) {
    return {
      priceCents: marginPriceCents(cost, priorityCat.percent),
      source: "category-margin",
      marginPercent: priorityCat.percent,
      priority: true,
    };
  }
  if (input.customerMargin != null) {
    return {
      priceCents: marginPriceCents(cost, input.customerMargin),
      source: "customer-margin",
      marginPercent: input.customerMargin,
      priority: false,
    };
  }
  if (anyCat) {
    return {
      priceCents: marginPriceCents(cost, anyCat.percent),
      source: "category-margin",
      marginPercent: anyCat.percent,
      priority: false,
    };
  }
  if (input.globalMargin != null) {
    return {
      priceCents: marginPriceCents(cost, input.globalMargin),
      source: "global-margin",
      marginPercent: input.globalMargin,
      priority: false,
    };
  }
  return { priceCents: input.listPriceCents, source: "list", marginPercent: null, priority: false };
}

// ---------- Rule lookup helpers (pure; build once, resolve many) ----------

export type RuleIndex = {
  globalMargin: number | null;
  byCategory: Map<string, { percent: number; priority: boolean }>;
  byCustomer: Map<string, number>;
};

// Index ACTIVE rules for fast lookups. Inactive rules are dropped here — the
// engine never sees them (deactivated behaves exactly like absent).
export function indexRules(rules: PricingRule[]): RuleIndex {
  const idx: RuleIndex = { globalMargin: null, byCategory: new Map(), byCustomer: new Map() };
  for (const r of rules) {
    if (!r.isActive) continue;
    if (r.scope === "global") idx.globalMargin = r.marginPercent;
    else if (r.scope === "category" && r.categoryId)
      idx.byCategory.set(r.categoryId, { percent: r.marginPercent, priority: r.isPriority });
    else if (r.scope === "customer" && r.customerId)
      idx.byCustomer.set(r.customerId, r.marginPercent);
  }
  return idx;
}

// Resolve one (customer, product) through the waterfall using the index.
// categoryId/parentCategoryId describe the product's category chain (depth ≤ 1).
export function resolveWithIndex(args: {
  idx: RuleIndex;
  customerId: string;
  categoryId: string | null;
  parentCategoryId: string | null;
  costCents: number | null;
  listPriceCents: number;
  manualPriceCents: number | null;
}): ResolvedPrice {
  const { idx } = args;
  return resolveCustomerPriceCents({
    costCents: args.costCents,
    listPriceCents: args.listPriceCents,
    manualPriceCents: args.manualPriceCents,
    customerMargin: idx.byCustomer.get(args.customerId) ?? null,
    categoryMargin: args.categoryId ? (idx.byCategory.get(args.categoryId) ?? null) : null,
    parentCategoryMargin: args.parentCategoryId
      ? (idx.byCategory.get(args.parentCategoryId) ?? null)
      : null,
    globalMargin: idx.globalMargin,
  });
}

// Validation shared by rule actions/UI: 0–500, at most 2 decimals.
export function validMarginPercent(value: number): boolean {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 500 &&
    Math.round(value * 100) === value * 100
  );
}

// Human label for the price-source chip, e.g. "Cat 40% (priority)".
export function marginSourceLabel(r: {
  source: MarginSource;
  marginPercent: number | null;
  priority: boolean;
}): string {
  const pct = r.marginPercent != null ? `${r.marginPercent}%` : "";
  switch (r.source) {
    case "manual":
      return "Manual";
    case "customer-margin":
      return `Cust ${pct}`;
    case "category-margin":
      return r.priority ? `Cat ${pct} (priority)` : `Cat ${pct}`;
    case "global-margin":
      return `Global ${pct}`;
    case "list":
      return "List";
  }
}

export type { PricingRuleScope };
