// CP-4 pure dashboard math — no IO; its ONLY import is the shared pure date
// module. Used by the dashboard data layer AND unit-tested directly from
// scripts/test-dashboard.mjs (the engine pattern), so the tested aggregation
// is the shipped aggregation.
//
// CP-5: the America/Toronto day-boundary helpers were MOVED to src/lib/dates
// (the portal needs them too). Import them from there — this module keeps NO
// second time-boundary implementation.

// ---------- order aggregation (approved D-D1) ----------

export type OrderStatusName = "new" | "confirmed" | "prepared" | "completed" | "cancelled";

export type DayOrderRow = {
  status: OrderStatusName;
  fulfillment: "pickup" | "delivery";
  totalCents: number;
};

// Revenue = ACCEPTED money only: confirmed + prepared + completed. 'new' is
// customer intent the merchant hasn't accepted (shown separately as
// "awaiting confirmation" — never conflated); 'cancelled' is money that
// didn't happen. A trustworthy figure never shrinks when an order is
// declined before acceptance.
export const REVENUE_STATUSES: readonly OrderStatusName[] = [
  "confirmed",
  "prepared",
  "completed",
];

export type DayAggregates = {
  byStatus: Record<OrderStatusName, number>;
  totalOrders: number;
  revenueCents: number; // accepted statuses only
  pendingCount: number; // status 'new'
  pendingCents: number;
  pickupCount: number; // accepted statuses only — what the day's ops must plan for
  deliveryCount: number;
};

export function aggregateDay(rows: DayOrderRow[]): DayAggregates {
  const byStatus: Record<OrderStatusName, number> = {
    new: 0,
    confirmed: 0,
    prepared: 0,
    completed: 0,
    cancelled: 0,
  };
  let revenueCents = 0;
  let pendingCount = 0;
  let pendingCents = 0;
  let pickupCount = 0;
  let deliveryCount = 0;
  for (const r of rows) {
    byStatus[r.status] += 1;
    if (REVENUE_STATUSES.includes(r.status)) {
      revenueCents += r.totalCents;
      if (r.fulfillment === "pickup") pickupCount += 1;
      else deliveryCount += 1;
    } else if (r.status === "new") {
      pendingCount += 1;
      pendingCents += r.totalCents;
    }
  }
  return {
    byStatus,
    totalOrders: rows.length,
    revenueCents,
    pendingCount,
    pendingCents,
    pickupCount,
    deliveryCount,
  };
}

// ---------- profit derivation (accepted orders' lines + cost snapshots) ----------

export type ProfitLineRow = {
  qty: number;
  lineTotalCents: number;
  costCents: number | null; // snapshot; null = no cost recorded at order time
};

export type ProfitAggregates = {
  // null when NO line has a cost snapshot (nothing to derive from).
  profitCents: number | null;
  costedLines: number;
  linesWithoutCost: number;
};

// Profit is always DERIVED (line_total - qty*cost) and never stored — the
// same rule as the order-detail screen.
export function aggregateProfit(lines: ProfitLineRow[]): ProfitAggregates {
  let profit = 0;
  let costed = 0;
  for (const l of lines) {
    if (l.costCents == null) continue;
    costed += 1;
    profit += l.lineTotalCents - l.qty * l.costCents;
  }
  return {
    profitCents: costed > 0 ? profit : null,
    costedLines: costed,
    linesWithoutCost: lines.length - costed,
  };
}
