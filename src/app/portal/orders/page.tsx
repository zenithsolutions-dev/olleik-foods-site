import Link from "next/link";
import { requireCustomer } from "@/lib/portal/require-customer";
import { fetchMyOrders } from "@/lib/portal/portal-data";
import { formatMoney } from "@/lib/portal/format";
import { StatusChip } from "./status-chip";

export const dynamic = "force-dynamic";

// CP-3a: the customer's own order history (RLS SELECT-own; immutable to them —
// there are no edit affordances because no edit capability exists).

export default async function PortalOrdersPage() {
  await requireCustomer();
  const orders = await fetchMyOrders();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          My orders
        </h1>
        <p className="mt-2 text-sm text-muted">
          Orders can&apos;t be edited after submission — call your Olleik rep for any change.
        </p>
      </div>

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] bg-surface p-10 text-center text-sm text-muted">
          No orders yet.{" "}
          <Link href="/portal/catalog" className="font-medium text-brand hover:text-accent">
            Browse your catalog →
          </Link>
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/portal/orders/${o.id}`}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 transition last:border-b-0 hover:bg-brand-mist/30"
            >
              <div>
                <p className="font-mono text-sm font-semibold text-brand-deep">
                  #{o.id.slice(0, 8)}
                </p>
                <p className="text-xs text-muted">
                  {new Date(o.createdAt).toLocaleDateString("en-CA", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · {o.itemCount} {o.itemCount === 1 ? "item" : "items"} · {o.fulfillment}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusChip status={o.status} />
                <p className="font-mono text-sm font-semibold text-brand-deep">
                  {formatMoney(o.totalCents)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
