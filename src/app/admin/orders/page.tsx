import { fetchAdminOrders } from "@/lib/admin/orders-data";
import { resolveDateRange, type RangeSearchParams } from "@/lib/dates";
import { DateRangeFilter } from "@/components/date-range-filter";
import { OrdersClient } from "./orders-client";

export const dynamic = "force-dynamic";

// CP-5: the inbox can be bounded by an order-date range (URL-borne, default
// All time — nothing changes for anyone who never touches it). The status
// tabs stay client-side ON TOP of the date-bounded set: both filters are
// active together.

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<RangeSearchParams>;
}) {
  const range = resolveDateRange(await searchParams);
  const { orders, countsByStatus, migrationApplied } = await fetchAdminOrders({
    startISO: range.startUTC?.toISOString() ?? null,
    endISO: range.endUTC?.toISOString() ?? null,
  });

  if (!migrationApplied) {
    return (
      <div>
        <h1 className="font-display text-2xl font-semibold text-brand-deep">Orders</h1>
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Run migration <code className="font-mono">0009_orders.sql</code> to enable ordering.
          Until then customers can browse but not order, and this inbox stays empty.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DateRangeFilter basePath="/admin/orders" range={range} />
      <OrdersClient
        orders={orders}
        countsByStatus={countsByStatus}
        periodLabel={range.label}
        rangeActive={range.preset !== "all"}
      />
    </div>
  );
}
