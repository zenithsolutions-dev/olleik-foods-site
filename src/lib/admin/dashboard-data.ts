import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  aggregateDay,
  aggregateProfit,
  zonedDayStartUTC,
  zonedPreviousDayStartUTC,
  REVENUE_STATUSES,
  type DayAggregates,
  type DayOrderRow,
  type OrderStatusName,
  type ProfitAggregates,
} from "./dashboard-math";

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
  today: DayAggregates;
  todayProfit: ProfitAggregates;
  yesterday: { totalOrders: number; revenueCents: number };
  activeOffers: DashboardOffer[];
  dayStartISO: string; // for display/debug — the exact boundary used
};

const EXPIRING_SOON_MS = 72 * 60 * 60 * 1000;

const EMPTY_DAY: DayAggregates = aggregateDay([]);
const EMPTY_STATS: DashboardStats = {
  today: EMPTY_DAY,
  todayProfit: { profitCents: null, costedLines: 0, linesWithoutCost: 0 },
  yesterday: { totalOrders: 0, revenueCents: 0 },
  activeOffers: [],
  dayStartISO: "",
};

type OrderRow = {
  id: string;
  status: OrderStatusName;
  fulfillment: "pickup" | "delivery";
  total_cents: number;
};

export async function fetchDashboardStats(now = new Date()): Promise<DashboardStats> {
  const admin = getAdminClient();
  if (!admin) return EMPTY_STATS;

  const todayStart = zonedDayStartUTC(now);
  const yesterdayStart = zonedPreviousDayStartUTC(now);

  const [todayRes, yesterdayRes, offersRes] = await Promise.all([
    admin
      .from("orders")
      .select("id, status, fulfillment, total_cents")
      .gte("created_at", todayStart.toISOString()),
    admin
      .from("orders")
      .select("status, fulfillment, total_cents")
      .gte("created_at", yesterdayStart.toISOString())
      .lt("created_at", todayStart.toISOString()),
    admin
      .from("customer_offers")
      .select("id, title, ends_at")
      .eq("is_active", true)
      .order("ends_at", { ascending: true, nullsFirst: false }),
  ]);

  if (todayRes.error) {
    if (todayRes.error.code !== "42P01")
      console.error("[admin] dashboard today read failed:", todayRes.error.message);
    return { ...EMPTY_STATS, dayStartISO: todayStart.toISOString() };
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

  const soonCutoff = now.getTime() + EXPIRING_SOON_MS;
  const activeOffers: DashboardOffer[] = (((offersRes.data as {
    id: string;
    title: string;
    ends_at: string | null;
  }[]) ?? [])).map((o) => ({
    id: o.id,
    title: o.title,
    endsAt: o.ends_at,
    expiringSoon:
      o.ends_at != null &&
      new Date(o.ends_at).getTime() <= soonCutoff &&
      new Date(o.ends_at).getTime() > now.getTime(),
  }));

  return {
    today,
    todayProfit,
    yesterday: { totalOrders: yAgg.totalOrders, revenueCents: yAgg.revenueCents },
    activeOffers,
    dayStartISO: todayStart.toISOString(),
  };
}
