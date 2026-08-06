// CP-8b pure analytics logic — no IO; callers pass `now`. Ranking, ties,
// slow movers, and the inactive/never-ordered split live here so
// scripts/test-analytics.mjs unit-tests the exact shipped logic (the engine
// pattern). Which orders COUNT is not decided here — the data layer's
// aggregates (SQL and the pre-0014 fallback alike) filter by REVENUE_STATUSES
// imported from dashboard-math, and the non-divergence test asserts analytics
// equal aggregateDay for the same period.
//
// Relative .ts specifiers: node --experimental-strip-types imports this
// directly — the tested module is the shipped module.

// ---------- product sales / best sellers (approved D-N2) ----------

export type ProductSales = {
  productId: string;
  name: string;
  sku: string;
  units: number;
  revenueCents: number;
  // null when NO line for this product carries a cost snapshot.
  costCents: number | null;
  costedLines: number;
  totalLines: number;
};

export type ProductRankRow = ProductSales & {
  profitCents: number | null; // over costed lines only — the UI must say so
  profitIncomplete: boolean; // some lines lack a cost → the figure is partial
};

export type ProductSortKey = "units" | "revenue" | "profit";

export function rankProducts(rows: ProductSales[], sort: ProductSortKey): ProductRankRow[] {
  const enriched: ProductRankRow[] = rows.map((r) => ({
    ...r,
    profitCents: r.costCents == null ? null : r.revenueCents - r.costCents,
    profitIncomplete: r.costedLines < r.totalLines,
  }));
  const key = (r: ProductRankRow): number => {
    if (sort === "units") return r.units;
    if (sort === "revenue") return r.revenueCents;
    // Profit sort: null (no cost at all) sinks below any number — a figure we
    // don't have cannot outrank one we do.
    return r.profitCents ?? Number.NEGATIVE_INFINITY;
  };
  // Ties: stable secondary sort by name (approved ruling); values are always
  // displayed, so equal ranks are self-evident.
  return enriched.sort((a, b) => key(b) - key(a) || a.name.localeCompare(b.name));
}

// ---------- slow movers ----------
//
// LEFT JOIN against the FULL active catalogue: the products ABSENT from sales
// are exactly the point. Ascending by units; ties by name. Product age is
// carried so something added yesterday isn't mislabelled stale.

export type CatalogueProduct = {
  productId: string;
  name: string;
  sku: string;
  isActive: boolean;
  createdAt: string;
};

export type SlowMoverRow = {
  productId: string;
  name: string;
  sku: string;
  units: number;
  revenueCents: number;
  ageDays: number;
  newInPeriod: boolean; // added after the period started — judge accordingly
};

export function buildSlowMovers(
  catalogue: CatalogueProduct[],
  sales: ProductSales[],
  opts: { periodStartUTC: Date | null; now: Date },
): SlowMoverRow[] {
  const salesById = new Map(sales.map((s) => [s.productId, s]));
  return catalogue
    .filter((p) => p.isActive)
    .map((p) => {
      const s = salesById.get(p.productId);
      const created = new Date(p.createdAt);
      return {
        productId: p.productId,
        name: p.name,
        sku: p.sku,
        units: s?.units ?? 0,
        revenueCents: s?.revenueCents ?? 0,
        ageDays: Math.max(0, Math.floor((opts.now.getTime() - created.getTime()) / 86400_000)),
        newInPeriod:
          opts.periodStartUTC != null && created.getTime() >= opts.periodStartUTC.getTime(),
      };
    })
    .sort((a, b) => a.units - b.units || a.revenueCents - b.revenueCents || a.name.localeCompare(b.name));
}

// ---------- top customers ----------

export type CustomerSales = {
  customerId: string;
  ordersCount: number;
  revenueCents: number;
  lastOrderAt: string | null;
};

export type CustomerSortKey = "revenue" | "orders";

export function rankCustomers<T extends CustomerSales & { businessName: string }>(
  rows: T[],
  sort: CustomerSortKey,
): T[] {
  const key = (r: T) => (sort === "revenue" ? r.revenueCents : r.ordersCount);
  return [...rows].sort((a, b) => key(b) - key(a) || a.businessName.localeCompare(b.businessName));
}

// ---------- inactive vs never-ordered (approved D-N3) ----------
//
// Inactive = ordered at least once EVER, silent >= threshold. Never-ordered is
// a SEPARATE list: those need onboarding, not win-back.

export const INACTIVE_THRESHOLDS = [30, 60, 90] as const;
export type InactiveThreshold = (typeof INACTIVE_THRESHOLDS)[number];

export type ActivitySplit<T> = {
  inactive: (T & { daysSilent: number })[]; // longest-silent first
  neverOrdered: T[];
  activeRecently: number; // ordered within the threshold — for the summary line
};

export function splitByActivity<T extends { businessName: string; lastOrderAt: string | null }>(
  customers: T[],
  thresholdDays: InactiveThreshold,
  now: Date,
): ActivitySplit<T> {
  const cutoff = now.getTime() - thresholdDays * 86400_000;
  const inactive: (T & { daysSilent: number })[] = [];
  const neverOrdered: T[] = [];
  let activeRecently = 0;
  for (const c of customers) {
    if (c.lastOrderAt == null) {
      neverOrdered.push(c);
    } else if (new Date(c.lastOrderAt).getTime() < cutoff) {
      inactive.push({
        ...c,
        daysSilent: Math.floor((now.getTime() - new Date(c.lastOrderAt).getTime()) / 86400_000),
      });
    } else {
      activeRecently += 1;
    }
  }
  inactive.sort((a, b) => b.daysSilent - a.daysSilent || a.businessName.localeCompare(b.businessName));
  neverOrdered.sort((a, b) => a.businessName.localeCompare(b.businessName));
  return { inactive, neverOrdered, activeRecently };
}
