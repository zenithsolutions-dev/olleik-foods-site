import Link from "next/link";
import { fetchAdminOrder } from "@/lib/admin/orders-data";
import { OrderDetailClient } from "./order-detail-client";

export const dynamic = "force-dynamic";
// Confirmation triggers waterfall-priced assignments (D6-class work happens
// from this page's actions, so the budget lives here — never on action files).
export const maxDuration = 60;

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await fetchAdminOrder(id);

  if (!order) {
    return (
      <div>
        <Link href="/admin/orders" className="text-sm text-brand hover:text-accent">
          ← All orders
        </Link>
        <p className="mt-6 rounded-2xl border border-dashed border-[var(--border)] bg-surface p-10 text-center text-sm text-muted">
          Order not found.
        </p>
      </div>
    );
  }

  return <OrderDetailClient order={order} />;
}
