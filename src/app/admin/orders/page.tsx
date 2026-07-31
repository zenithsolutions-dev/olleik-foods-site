import { fetchAdminOrders } from "@/lib/admin/orders-data";
import { OrdersClient } from "./orders-client";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const { orders, countsByStatus, migrationApplied } = await fetchAdminOrders();

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

  return <OrdersClient orders={orders} countsByStatus={countsByStatus} />;
}
