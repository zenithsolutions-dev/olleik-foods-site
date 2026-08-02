// CP-7 pure customer-statement model — no IO. A statement is a PERIOD-BOUNDED
// VIEW of one customer's orders. It is NOT an account ledger: there are no
// payments, no balance, no "amount owed" anywhere in these types, because
// money is settled outside this system and an invented balance would be a lie
// printed on paper.
//
// TWO DOCUMENTS, ONE CALCULATION (approved D-S5 + the owner's ruling):
//   * buildCustomerStatement  -> the copy handed to the customer. Its line
//     type is InvoiceLineInput, REUSED from CP-6 — a shape that cannot accept
//     a cost field. Lines are also projected FIELD BY FIELD (never spread),
//     so even a caller passing fat objects cannot leak a cost value at
//     runtime.
//   * buildInternalStatement  -> CALLS buildCustomerStatement and extends its
//     output. Every shared figure is literally the SAME VALUE, not a second
//     calculation that has to agree. Divergence is impossible by construction;
//     the test suite's field-by-field equality check is only a backstop.
//
// Which orders count is NOT decided here: REVENUE_STATUSES is imported from
// the CP-4 dashboard math and never redefined (owner's explicit ruling), so a
// statement and the dashboard can never disagree about the same customer and
// the same period. Cancelled and 'new' orders are NOT omitted — they are
// listed in separate labelled sections contributing zero (approved D-S3),
// because silent omission causes exactly the phone call the document exists
// to prevent.
//
// The explicit .ts specifier below is what lets scripts/test-statements.mjs
// import this module under `node --experimental-strip-types`: the module the
// suite tests is byte-identical to the module Next ships.
import { REVENUE_STATUSES, type OrderStatusName } from "../admin/dashboard-math.ts";
import type { InvoiceBusiness, InvoiceLineInput, InvoiceParty } from "./invoice-model";

// Approved D-S7: a hard, VISIBLE cap. A truncated statement that doesn't say
// so reads exactly like a complete one.
export const MAX_STATEMENT_ORDERS = 500;

// ---------- inputs ----------

// The customer-facing input: lines are CP-6's cost-free InvoiceLineInput.
export type StatementOrderInput = {
  orderId: string;
  status: OrderStatusName;
  createdAt: string; // ISO — the SUBMISSION date (approved D-S2)
  fulfillment: string;
  totalCents: number; // the charged total, verbatim from the order row
  lines: InvoiceLineInput[];
};

// The internal input carries costs alongside the same snapshot lines. It is
// assignable to StatementOrderInput, which is exactly how the internal builder
// hands its orders to the customer builder.
export type InternalLineInput = InvoiceLineInput & { costCents: number | null };
export type InternalOrderInput = Omit<StatementOrderInput, "lines"> & {
  lines: InternalLineInput[];
};

// ---------- customer-copy output ----------

export type StatementLine = InvoiceLineInput;

export type StatementOrder = {
  orderId: string;
  documentNumber: string; // "Order #ab12cd34" — same convention as the invoice
  createdAt: string;
  status: OrderStatusName;
  fulfillment: string;
  totalCents: number;
  lines: StatementLine[];
};

// Orders shown for context only, contributing zero to every total.
export type StatementAside = {
  orderId: string;
  documentNumber: string;
  createdAt: string;
  status: OrderStatusName;
  totalCents: number;
  marker: string; // WORDS, not colour — legible in black and white
};

export type ProductRollupLine = {
  sku: string;
  name: string;
  qty: number;
  amountCents: number;
};

export type CustomerStatementModel = {
  internal: false; // safe to hand to anyone
  title: string;
  business: InvoiceBusiness;
  statementFor: InvoiceParty;
  periodLabel: string;
  periodNotice: string | null; // CP-5 swap/fallback notice, never swallowed
  generatedAtISO: string;
  orders: StatementOrder[]; // counted orders only, oldest first
  orderCount: number;
  totalCents: number;
  products: ProductRollupLine[]; // "what they took", biggest first
  awaiting: StatementAside[]; // status 'new' — not yet accepted
  cancelled: StatementAside[]; // excluded from every figure
  truncationNotice: string | null;
  isEmpty: boolean;
  emptyNotice: string | null;
};

// ---------- internal-copy output ----------

export type InternalStatementLine = StatementLine & {
  costCents: number | null; // unit cost snapshot; null = none recorded
  lineCostCents: number | null;
  lineProfitCents: number | null;
};

export type InternalStatementOrder = Omit<StatementOrder, "lines"> & {
  lines: InternalStatementLine[];
  costCents: number | null;
  profitCents: number | null;
};

export type InternalProductRollupLine = ProductRollupLine & {
  costCents: number | null;
  profitCents: number | null;
};

export type InternalStatementModel = Omit<
  CustomerStatementModel,
  "internal" | "orders" | "products"
> & {
  internal: true; // renderer stamps INTERNAL banner AND watermark
  orders: InternalStatementOrder[];
  products: InternalProductRollupLine[];
  totalCostCents: number | null;
  totalProfitCents: number | null;
  // Revenue of the lines that actually HAVE a cost — the honest denominator
  // for margin when some costs are missing.
  costedRevenueCents: number;
  marginPct: number | null;
  linesTotal: number;
  linesWithoutCost: number;
  // Prominent (never a footnote): profit over missing costs is a false number.
  costWarning: string | null;
};

// ---------- builders ----------

function documentNumber(orderId: string): string {
  return `Order #${orderId.slice(0, 8)}`;
}

// FIELD-BY-FIELD, deliberately not a spread: this is the runtime half of the
// structural cost guarantee. A caller handing over InternalLineInput objects
// gets a clean customer line back — the cost value physically does not survive.
function projectLine(l: InvoiceLineInput): StatementLine {
  return {
    name: l.name,
    sku: l.sku,
    unit: l.unit,
    unitSize: l.unitSize,
    qty: l.qty,
    unitPriceCents: l.unitPriceCents,
    lineTotalCents: l.lineTotalCents,
    appliedOfferTitle: l.appliedOfferTitle,
  };
}

function counts(status: OrderStatusName): boolean {
  return REVENUE_STATUSES.includes(status);
}

function aside(o: StatementOrderInput, marker: string): StatementAside {
  return {
    orderId: o.orderId,
    documentNumber: documentNumber(o.orderId),
    createdAt: o.createdAt,
    status: o.status,
    totalCents: o.totalCents,
    marker,
  };
}

export function buildCustomerStatement(args: {
  orders: StatementOrderInput[];
  business: InvoiceBusiness;
  statementFor: InvoiceParty;
  periodLabel: string;
  periodNotice?: string | null;
  generatedAt: Date;
  truncated?: boolean;
  // False when the period is already unbounded ("All time") — offering to
  // widen an unwidenable period would be nonsense on a printed page.
  canWiden?: boolean;
}): CustomerStatementModel {
  const { business, statementFor, periodLabel, generatedAt } = args;

  // Oldest first: a statement reads as a period unfolding, not a feed.
  const sorted = [...args.orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const counted = sorted.filter((o) => counts(o.status));
  const awaiting = sorted.filter((o) => o.status === "new").map((o) => aside(o, "AWAITING CONFIRMATION"));
  const cancelled = sorted.filter((o) => o.status === "cancelled").map((o) => aside(o, "CANCELLED"));

  const orders: StatementOrder[] = counted.map((o) => ({
    orderId: o.orderId,
    documentNumber: documentNumber(o.orderId),
    createdAt: o.createdAt,
    status: o.status,
    fulfillment: o.fulfillment,
    totalCents: o.totalCents,
    lines: [...o.lines].sort((a, b) => a.name.localeCompare(b.name)).map(projectLine),
  }));

  const totalCents = orders.reduce((n, o) => n + o.totalCents, 0);

  // "What did they take" — one row per product across the whole period.
  const rollup = new Map<string, ProductRollupLine>();
  for (const o of orders) {
    for (const l of o.lines) {
      const cur = rollup.get(l.sku);
      if (cur) {
        cur.qty += l.qty;
        cur.amountCents += l.lineTotalCents;
      } else {
        rollup.set(l.sku, { sku: l.sku, name: l.name, qty: l.qty, amountCents: l.lineTotalCents });
      }
    }
  }
  const products = [...rollup.values()].sort(
    (a, b) => b.amountCents - a.amountCents || a.name.localeCompare(b.name),
  );

  const isEmpty = orders.length === 0 && awaiting.length === 0 && cancelled.length === 0;

  return {
    internal: false,
    title: "Customer statement",
    business,
    statementFor,
    periodLabel,
    periodNotice: args.periodNotice ?? null,
    generatedAtISO: generatedAt.toISOString(),
    orders,
    orderCount: orders.length,
    totalCents,
    products,
    awaiting,
    cancelled,
    truncationNotice: args.truncated
      ? `Only the ${MAX_STATEMENT_ORDERS} most recent orders in this period are shown, and the totals below cover those orders only — this customer has more. Narrow the period for a complete statement.`
      : null,
    isEmpty,
    emptyNotice: isEmpty
      ? args.canWiden === false
        ? `No orders on record for ${statementFor.businessName}.`
        : `No orders were placed in this period (${periodLabel}). Try a wider period — for example Last month, This year, or All time.`
      : null,
  };
}

export function buildInternalStatement(args: {
  orders: InternalOrderInput[];
  business: InvoiceBusiness;
  statementFor: InvoiceParty;
  periodLabel: string;
  periodNotice?: string | null;
  generatedAt: Date;
  truncated?: boolean;
  canWiden?: boolean;
}): InternalStatementModel {
  // THE agreement guarantee: the customer copy is built first, and every
  // shared figure below is read back off it rather than recomputed.
  const base = buildCustomerStatement({ ...args, orders: args.orders });

  // orderId -> sku -> unit cost, taken from the internal input only.
  const costIndex = new Map<string, Map<string, number | null>>();
  for (const o of args.orders) {
    const m = new Map<string, number | null>();
    for (const l of o.lines) m.set(l.sku, l.costCents ?? null);
    costIndex.set(o.orderId, m);
  }

  let linesTotal = 0;
  let linesWithoutCost = 0;
  let totalCostCents = 0;
  let totalProfitCents = 0;
  let costedRevenueCents = 0;
  let costedLines = 0;
  const bySku = new Map<string, { cost: number; profit: number; costed: boolean }>();

  const orders: InternalStatementOrder[] = base.orders.map((o) => {
    const m = costIndex.get(o.orderId);
    let orderCost = 0;
    let orderProfit = 0;
    let orderCosted = 0;

    const lines: InternalStatementLine[] = o.lines.map((l) => {
      linesTotal += 1;
      const unitCost = m?.get(l.sku) ?? null;
      const agg = bySku.get(l.sku) ?? { cost: 0, profit: 0, costed: false };
      if (unitCost == null) {
        linesWithoutCost += 1;
        bySku.set(l.sku, agg);
        return { ...l, costCents: null, lineCostCents: null, lineProfitCents: null };
      }
      // Derived from the CUSTOMER copy's qty and line total — the internal
      // numbers can never describe a different sale than the printed one.
      const lineCost = l.qty * unitCost;
      const lineProfit = l.lineTotalCents - lineCost;
      orderCost += lineCost;
      orderProfit += lineProfit;
      orderCosted += 1;
      totalCostCents += lineCost;
      totalProfitCents += lineProfit;
      costedRevenueCents += l.lineTotalCents;
      costedLines += 1;
      agg.cost += lineCost;
      agg.profit += lineProfit;
      agg.costed = true;
      bySku.set(l.sku, agg);
      return { ...l, costCents: unitCost, lineCostCents: lineCost, lineProfitCents: lineProfit };
    });

    return {
      ...o,
      lines,
      costCents: orderCosted > 0 ? orderCost : null,
      profitCents: orderCosted > 0 ? orderProfit : null,
    };
  });

  // Same qty/amount values as the customer rollup, with cost attached.
  const products: InternalProductRollupLine[] = base.products.map((p) => {
    const agg = bySku.get(p.sku);
    return {
      ...p,
      costCents: agg?.costed ? agg.cost : null,
      profitCents: agg?.costed ? agg.profit : null,
    };
  });

  const anyCost = costedLines > 0;
  const marginPct =
    anyCost && costedRevenueCents > 0 ? (totalProfitCents / costedRevenueCents) * 100 : null;

  return {
    ...base,
    internal: true,
    title: "Customer statement — INTERNAL (includes cost and profit)",
    orders,
    products,
    totalCostCents: anyCost ? totalCostCents : null,
    totalProfitCents: anyCost ? totalProfitCents : null,
    costedRevenueCents,
    marginPct,
    linesTotal,
    linesWithoutCost,
    costWarning:
      linesWithoutCost === 0
        ? null
        : `${linesWithoutCost} of ${linesTotal} lines have NO recorded purchase cost. Cost, profit and margin below cover only the ${linesTotal - linesWithoutCost} costed line${linesTotal - linesWithoutCost === 1 ? "" : "s"} — treat them as partial, not as this customer's profitability.`,
  };
}
