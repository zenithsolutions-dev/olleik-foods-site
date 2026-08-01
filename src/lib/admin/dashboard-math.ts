// CP-4 pure dashboard math — NO imports, NO IO. Used by the dashboard data
// layer AND unit-tested directly from scripts/test-dashboard.mjs (the engine
// pattern), so the tested aggregation is the shipped aggregation.

// ---------- "today" boundary (approved D-D0: America/Toronto) ----------

// Every figure on the dashboard describes the client's business day in
// Ottawa. The DB stores UTC; this converts "now" to the UTC instant at which
// the CURRENT Toronto day started. Two-pass correction handles both DST
// transitions (unit-tested for the spring-forward and fall-back edges).
export const DASHBOARD_TIME_ZONE = "America/Toronto";

export function zonedDayStartUTC(now: Date, timeZone: string = DASHBOARD_TIME_ZONE): Date {
  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, d] = dateFmt.format(now).split("-").map(Number);

  const wallFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const target = Date.UTC(y, m - 1, d, 0, 0, 0);
  let ts = target;
  for (let i = 0; i < 2; i++) {
    const parts = wallFmt.formatToParts(new Date(ts));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    // Some engines render midnight as "24" with hour12:false — normalize.
    const wall = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") % 24,
      get("minute"),
      get("second"),
    );
    ts += target - wall;
  }
  return new Date(ts);
}

// Start of the PREVIOUS Toronto day (for the approved yesterday comparison):
// take an instant safely inside yesterday (12h before today's start — immune
// to the 23/25-hour DST days) and find ITS day start.
export function zonedPreviousDayStartUTC(
  now: Date,
  timeZone: string = DASHBOARD_TIME_ZONE,
): Date {
  const todayStart = zonedDayStartUTC(now, timeZone);
  return zonedDayStartUTC(new Date(todayStart.getTime() - 12 * 60 * 60 * 1000), timeZone);
}

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
