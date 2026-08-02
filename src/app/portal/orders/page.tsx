import Link from "next/link";
import { requireCustomer } from "@/lib/portal/require-customer";
import { fetchMyOrders } from "@/lib/portal/portal-data";
import { formatMoney } from "@/lib/portal/format";
import { StatusChip } from "./status-chip";
import { PortalOrdersLive } from "../orders-live";
import { resolveDateRange, type RangeSearchParams } from "@/lib/dates";
import { DateRangeFilter } from "@/components/date-range-filter";

export const dynamic = "force-dynamic";

// CP-3a: the customer's own order history (RLS SELECT-own; immutable to them —
// there are no edit affordances because no edit capability exists).
// CP-5: date-filterable (D-R6) — the filter narrows the RLS-scoped set and
// can never widen it; session client throughout.

export default async function PortalOrdersPage({
  searchParams,
}: {
  searchParams: Promise<RangeSearchParams>;
}) {
  await requireCustomer();
  const range = resolveDateRange(await searchParams);
  const orders = await fetchMyOrders({
    startISO: range.startUTC?.toISOString() ?? null,
    endISO: range.endUTC?.toISOString() ?? null,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          My orders
        </h1>
        <p className="mt-2 text-sm text-muted">
          Orders can&apos;t be edited after submission — call your Olleik rep for any change.
        </p>
        {/* CP-3d: status changes appear here on their own (30s poll). */}
        <PortalOrdersLive />
        <div className="mt-3">
          <DateRangeFilter basePath="/portal/orders" range={range} />
        </div>
      </div>

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] bg-surface p-10 text-center text-sm text-muted">
          {range.preset !== "all" ? (
            <>No orders in this period ({range.label}) — widen the range or clear it above.</>
          ) : (
            <>
              No orders yet.{" "}
              <Link href="/portal/catalog" className="font-medium text-brand hover:text-accent">
                Browse your catalog →
              </Link>
            </>
          )}
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
