// CP-6 pure product-statement models — NO imports, NO IO. ADMIN-ONLY
// documents; the cost gate is STRUCTURAL: with includeCosts=false the built
// model contains no cost/profit keys at all (not hidden — absent), which the
// test suite proves by scanning the serialized model. Unit-tested from
// scripts/test-documents.mjs.

export type StatementProductInput = {
  sku: string;
  name: string;
  categoryLabel: string | null;
  unit: string;
  unitSize: string;
  listPriceCents: number;
  isActive: boolean;
  isAvailable: boolean;
  stockQty: number | null; // null = untracked
  lowStockThreshold: number | null;
  costCents: number | null; // consumed ONLY when includeCosts is true
};

export type StatementLineBase = {
  sku: string;
  name: string;
  categoryLabel: string | null;
  unitLabel: string; // "25 lb / case"
  listPriceCents: number;
  active: boolean;
  // Black-and-white-legible severity TEXT (never colour alone): "OVERSOLD BY
  // N" / "OUT" / "LOW" / "" — printed as words next to the number.
  stockLabel: string;
};

export type StatementLineWithCosts = StatementLineBase & {
  costCents: number | null;
  profitAtListCents: number | null;
};

export type ProductStatementModel =
  | {
      internal: false; // safe to hand to anyone
      title: string;
      periodLabel: string;
      lines: StatementLineBase[];
    }
  | {
      internal: true; // renderer stamps INTERNAL prominently on every page
      title: string;
      periodLabel: string;
      lines: StatementLineWithCosts[];
    };

function stockLabel(p: StatementProductInput): string {
  if (p.stockQty == null) return "not tracked";
  if (p.stockQty < 0) return `${p.stockQty} — OVERSOLD BY ${-p.stockQty}`;
  if (p.stockQty === 0) return "0 — OUT";
  if (p.lowStockThreshold != null && p.stockQty <= p.lowStockThreshold)
    return `${p.stockQty} — LOW (alert at ${p.lowStockThreshold})`;
  return String(p.stockQty);
}

function baseLine(p: StatementProductInput): StatementLineBase {
  return {
    sku: p.sku,
    name: p.name,
    categoryLabel: p.categoryLabel,
    unitLabel: `${p.unitSize} / ${p.unit}`,
    listPriceCents: p.listPriceCents,
    active: p.isActive,
    stockLabel: stockLabel(p),
  };
}

// Full product list (approved D-C6: defaults to All time; the caller passes
// the CP-5 range label and pre-filters by created date where requested).
export function buildProductStatementModel(
  products: StatementProductInput[],
  opts: { includeCosts: boolean; periodLabel: string },
): ProductStatementModel {
  const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name));
  if (!opts.includeCosts) {
    return {
      internal: false,
      title: "Product list",
      periodLabel: opts.periodLabel,
      lines: sorted.map(baseLine),
    };
  }
  return {
    internal: true,
    title: "Product list — INTERNAL (includes cost data)",
    periodLabel: opts.periodLabel,
    lines: sorted.map((p) => ({
      ...baseLine(p),
      costCents: p.costCents,
      profitAtListCents: p.costCents != null ? p.listPriceCents - p.costCents : null,
    })),
  };
}

// Low-stock statement: EXACTLY the shared fetchLowStock set (tracked, active,
// stock <= threshold), oversold first — the caller passes that function's
// output through; this model only shapes it. "As of" documents carry a
// timestamp instead of a period (approved D-C6).
export type LowStockLineInput = {
  sku: string;
  name: string;
  stockQty: number;
  lowStockThreshold: number;
};

export type StockStatementModel = {
  internal: false;
  title: string;
  asOfISO: string;
  lines: { sku: string; name: string; severity: string; detail: string }[];
};

export function buildLowStockStatementModel(
  items: LowStockLineInput[],
  asOf: Date,
): StockStatementModel {
  // fetchLowStock already sorts stock ascending → oversold first; keep order.
  return {
    internal: false,
    title: "Low stock",
    asOfISO: asOf.toISOString(),
    lines: items.map((i) => ({
      sku: i.sku,
      name: i.name,
      severity:
        i.stockQty < 0 ? `OVERSOLD BY ${-i.stockQty}` : i.stockQty === 0 ? "OUT OF STOCK" : "LOW",
      detail:
        i.stockQty < 0
          ? `${i.stockQty} on ledger — ${-i.stockQty} unit${-i.stockQty === 1 ? "" : "s"} owed to customers`
          : `${i.stockQty} left (alert at ${i.lowStockThreshold})`,
    })),
  };
}

export function buildUnavailableStatementModel(
  products: StatementProductInput[],
  asOf: Date,
): StockStatementModel {
  const out = products
    .filter((p) => p.isActive && !p.isAvailable)
    .sort((a, b) => (a.stockQty ?? 0) - (b.stockQty ?? 0));
  return {
    internal: false,
    title: "Unavailable products",
    asOfISO: asOf.toISOString(),
    lines: out.map((p) => ({
      sku: p.sku,
      name: p.name,
      severity: p.stockQty != null && p.stockQty < 0 ? `OVERSOLD BY ${-p.stockQty}` : "UNAVAILABLE",
      detail:
        p.stockQty == null
          ? "marked unavailable"
          : p.stockQty < 0
            ? `${p.stockQty} on ledger`
            : `stock ${p.stockQty}`,
    })),
  };
}
