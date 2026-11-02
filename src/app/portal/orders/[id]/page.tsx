import Link from "next/link";
import { formatBusinessTime } from "@/lib/dates";
import { ProductThumb } from "@/components/product-thumb";
import { requireCustomer } from "@/lib/portal/require-customer";
import { fetchMyOrder } from "@/lib/portal/portal-data";
import { formatMoney } from "@/lib/portal/format";
import { StatusChip } from "../status-chip";
import { PortalOrdersLive } from "../../orders-live";

export const dynamic = "force-dynamic";

// CP-3a: one order, read-only. RLS returns it only to its owner; anyone else's
// order id yields "not found" (indistinguishable from nonexistent by design).

export default async function PortalOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  await requireCustomer();
  const { id } = await params;
  const { placed } = await searchParams;
  const order = await fetchMyOrder(id);

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/portal/orders" className="text-sm text-brand hover:text-accent">
          ← My orders
        </Link>
        <p className="mt-6 rounded-2xl border border-dashed border-[var(--border)] bg-surface p-10 text-center text-sm text-muted">
          Order not found.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PortalOrdersLive />
      {placed && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Order received — thank you! We&apos;ll confirm it shortly.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/portal/orders" className="text-sm text-brand hover:text-accent">
            ← My orders
          </Link>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-brand-deep">
            Order <span className="font-mono">#{order.id.slice(0, 8)}</span>
            {/* CP-6 (D-C3): the customer's own invoice — same session-scoped
                data this page already shows. */}
            <Link
              href={`/portal/orders/${order.id}/invoice`}
              className="ml-3 inline-flex items-center gap-1 rounded-full border border-[var(--border-strong)] px-3 py-1 text-xs font-semibold text-foreground/80 hover:border-brand hover:text-brand"
            >
              Invoice
            </Link>
          </h1>
          <p className="text-xs text-muted">
            {formatBusinessTime(order.createdAt, {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            · {order.fulfillment} · settlement: {order.paymentTerms}
          </p>
        </div>
        <StatusChip status={order.status} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface">
        {order.lines.map((l) => (
          <div
            key={l.productId}
            data-testid="order-line"
            className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-b-0 sm:px-5"
          >
            <ProductThumb src={l.imageUrl} name={l.name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug text-foreground">
                {l.name} <span className="whitespace-nowrap text-muted">× {l.qty}</span>
              </p>
              <p className="text-xs text-muted">
                {l.sku} · {formatMoney(l.unitPriceCents)} each
                {l.appliedOfferTitle ? ` · ${l.appliedOfferTitle}` : ""}
              </p>
            </div>
            <p className="shrink-0 font-mono text-sm font-semibold text-brand-deep">
              {formatMoney(l.lineTotalCents)}
            </p>
          </div>
        ))}
        <div className="flex items-center justify-between bg-brand-mist/30 px-5 py-4">
          <p className="text-sm font-medium text-muted">Order total</p>
          <p className="font-mono text-lg font-semibold text-brand-deep">
            {formatMoney(order.totalCents)}
          </p>
        </div>
      </div>

      {order.notes && (
        <p className="rounded-xl border border-[var(--border)] bg-brand-mist/40 p-4 text-sm italic text-brand-deep">
          “{order.notes}”
        </p>
      )}

      <p className="text-xs text-muted-soft">
        Orders can&apos;t be edited after submission. Need a change? Call your Olleik rep.
      </p>
    </div>
  );
}
