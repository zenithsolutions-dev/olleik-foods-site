import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  aggregateDay,
  aggregateProfit,
  REVENUE_STATUSES,
  type DayAggregates,
  type DayOrderRow,
  type OrderStatusName,
  type ProfitAggregates,
} from "./dashboard-math";
import {
  zonedDayStartUTC,
  zonedPreviousDayStartUTC,
  type ResolvedRange,
} from "@/lib/dates";
import { offerIsActiveNow } from "@/lib/pricing";
import { offerEndsWithin, EXPIRING_SOON_HOURS } from "./offers-overview";

// CP-4 dashboard reads (approved spec). READ-ONLY over what CP-1..CP-3 built:
// no new tables, no new policies, NO migration. Cost/profit stay on the
// service-role admin path — nothing here is reachable from the portal.
// Tolerant of missing migrations (42P01 -> zeros) like every admin read.

export type DashboardOffer = {
  id: string;
  title: string;
  endsAt: string | null;
  expiringSoon: boolean; // ends within 72h (approved D-D3)
};

export type DashboardStats = {
  today: DayAggregates; // the SELECTED period's aggregates (name kept from CP-4)
  todayProfit: ProfitAggregates;
  yesterday: { totalOrders: number; revenueCents: number };
  activeOffers: DashboardOffer[];
  dayStartISO: string; // for display/debug — the exact boundary used
  // CP-5: what period the aggregates cover — surfaced in every card title so
  // no figure is ever ambiguous about its period.
  periodLabel: string;
  periodPreset: string;
};

// CP-5: the LIVE operational figures (never period-scoped): orders waiting
// right now. Cheap — 'new' orders are few by nature.
export async function fetchPendingNow(): Promise<{ count: number; cents: number }> {
  const admin = getAdminClient();
  if (!admin) return { count: 0, cents: 0 };
  const { data, error } = await admin
    .from("orders")
    .select("total_cents")
    .eq("status", "new");
  if (error) {
    if (error.code !== "42P01") console.error("[admin] pending-now read failed:", error.message);
    return { count: 0, cents: 0 };
  }
  const rows = (data as { total_cents: number }[]) ?? [];
  return { count: rows.length, cents: rows.reduce((n, r) => n + r.total_cents, 0) };
}

const EMPTY_DAY: DayAggregates = aggregateDay([]);
const EMPTY_STATS: DashboardStats = {
  today: EMPTY_DAY,
  todayProfit: { profitCents: null, costedLines: 0, linesWithoutCost: 0 },
  yesterday: { totalOrders: 0, revenueCents: 0 },
  activeOffers: [],
  dayStartISO: "",
  periodLabel: "Today",
  periodPreset: "today",
};

type OrderRow = {
  id: string;
  status: OrderStatusName;
  fulfillment: "pickup" | "delivery";
  total_cents: number;
};

// CP-5: the dashboard's aggregates can cover ANY resolved range (default
// Today — nothing changes for someone who never touches the filter). The
// yesterday comparison only exists on the Today preset (approved D-R3).
export async function fetchDashboardStats(
  now = new Date(),
  range?: ResolvedRange,
): Promise<DashboardStats> {
  const admin = getAdminClient();
  const isTodayEarly = !range || range.preset === "today";
  if (!admin)
    return {
      ...EMPTY_STATS,
      periodLabel: isTodayEarly ? "Today" : range.label,
      periodPreset: isTodayEarly ? "today" : range.preset,
    };

  const todayStart = zonedDayStartUTC(now);
  const yesterdayStart = zonedPreviousDayStartUTC(now);
  const isToday = isTodayEarly;
  const periodStart = isToday ? todayStart : range.startUTC;
  const periodEnd = isToday ? null : range.endUTC;
  const periodLabel = isToday ? "Today" : range.label;
  const periodPreset = isToday ? "today" : range.preset;

  let periodQuery = admin.from("orders").select("id, status, fulfillment, total_cents");
  if (periodStart) periodQuery = periodQuery.gte("created_at", periodStart.toISOString());
  if (periodEnd) periodQuery = periodQuery.lt("created_at", periodEnd.toISOString());

  const [todayRes, yesterdayRes, offersRes] = await Promise.all([
    periodQuery,
    isToday
      ? admin
          .from("orders")
          .select("status, fulfillment, total_cents")
          .gte("created_at", yesterdayStart.toISOString())
          .lt("created_at", todayStart.toISOString())
      : Promise.resolve({ data: [], error: null } as {
          data: OrderRow[] | null;
          error: null;
        }),
    admin
      .from("customer_offers")
      .select("id, title, starts_at, ends_at")
      .eq("is_active", true)
      .order("ends_at", { ascending: true, nullsFirst: false }),
  ]);

  if (todayRes.error) {
    if (todayRes.error.code !== "42P01")
      console.error("[admin] dashboard today read failed:", todayRes.error.message);
    return { ...EMPTY_STATS, dayStartISO: todayStart.toISOString(), periodLabel, periodPreset };
  }

  const toRow = (r: OrderRow): DayOrderRow => ({
    status: r.status,
    fulfillment: r.fulfillment,
    totalCents: r.total_cents,
  });
  const todayRows = ((todayRes.data as OrderRow[]) ?? []);
  const today = aggregateDay(todayRows.map(toRow));
  const yAgg = aggregateDay((((yesterdayRes.data as OrderRow[]) ?? [])).map(toRow));

  // Profit: the ACCEPTED orders' lines joined to their deny-all cost
  // snapshots — bounded by one business day by construction.
  let todayProfit: ProfitAggregates = { profitCents: null, costedLines: 0, linesWithoutCost: 0 };
  const acceptedIds = todayRows
    .filter((r) => (REVENUE_STATUSES as readonly string[]).includes(r.status))
    .map((r) => r.id);
  if (acceptedIds.length > 0) {
    const [itemsRes, costsRes] = await Promise.all([
      admin
        .from("order_items")
        .select("order_id, product_id, qty, line_total_cents")
        .in("order_id", acceptedIds),
      admin
        .from("order_item_costs")
        .select("order_id, product_id, cost_cents")
        .in("order_id", acceptedIds),
    ]);
    if (itemsRes.error) {
      console.error("[admin] dashboard items read failed:", itemsRes.error.message);
    } else {
      const costKey = (o: string, p: string) => `${o}:${p}`;
      const costs = new Map(
        (((costsRes.data as { order_id: string; product_id: string; cost_cents: number | null }[]) ?? [])).map(
          (c) => [costKey(c.order_id, c.product_id), c.cost_cents],
        ),
      );
      todayProfit = aggregateProfit(
        (((itemsRes.data as {
          order_id: string;
          product_id: string;
          qty: number;
          line_total_cents: number;
        }[]) ?? [])).map((i) => ({
          qty: i.qty,
          lineTotalCents: i.line_total_cents,
          costCents: costs.get(costKey(i.order_id, i.product_id)) ?? null,
        })),
      );
    }
  }

  // CP-8a fix (gap F-class): "active" now means the SAME thing pricing means —
  // offerIsActiveNow (flag AND date window). Previously an expired-window offer
  // still counted here while pricing rightly ignored it, so the dashboard and
  // customer prices disagreed. The 72h flag now goes through the ONE shared
  // time-to-expiry helper (offers-overview) — no second threshold to diverge.
  const activeOffers: DashboardOffer[] = (((offersRes.data as {
    id: string;
    title: string;
    starts_at: string | null;
    ends_at: string | null;
  }[]) ?? []))
    .filter((o) =>
      offerIsActiveNow({ isActive: true, startsAt: o.starts_at, endsAt: o.ends_at }, now),
    )
    .map((o) => ({
      id: o.id,
      title: o.title,
      endsAt: o.ends_at,
      expiringSoon: offerEndsWithin({ endsAt: o.ends_at }, now, EXPIRING_SOON_HOURS),
    }));

  return {
    today,
    todayProfit,
    yesterday: { totalOrders: yAgg.totalOrders, revenueCents: yAgg.revenueCents },
    activeOffers,
    dayStartISO: (periodStart ?? todayStart).toISOString(),
    periodLabel,
    periodPreset,
  };
}
