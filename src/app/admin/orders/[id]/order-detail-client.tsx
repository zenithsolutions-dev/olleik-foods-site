"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, PackageCheck, Truck, X } from "lucide-react";
import { formatMoney } from "@/lib/admin/store";
import type { AdminOrderDetail } from "@/lib/admin/orders-data";
import { cancelOrder, completeOrder, confirmOrder, markOrderPrepared } from "../actions";

// CP-3a admin order detail: lines with charged price + COST + PROFIT (derived
// from the deny-all snapshots — this screen is the only place profit exists),
// plus the guarded lifecycle buttons. Every transition confirms first.

const STATUS_CHIP: Record<string, string> = {
  new: "bg-accent text-white",
  confirmed: "bg-brand/15 text-brand-deep",
  prepared: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-zinc-100 text-zinc-500",
};

export function OrderDetailClient({ order }: { order: AdminOrderDetail }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cancelPrompt, setCancelPrompt] = useState(false);
  const [cancelNote, setCancelNote] = useState("");

  async function run(fn: () => Promise<{ ok: boolean; assigned?: number; message?: string }>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? "Something went wrong.");
      return;
    }
    if (res.assigned && res.assigned > 0) {
      setNotice(
        `Confirmed. ${res.assigned} newly ordered ${res.assigned === 1 ? "product was" : "products were"} added to this customer's catalog at waterfall pricing.`,
      );
    }
    router.refresh();
  }

  const profitPct =
    order.totalProfitCents != null && order.totalCostCents != null && order.totalCostCents > 0
      ? ((order.totalProfitCents / order.totalCostCents) * 100).toFixed(1)
      : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1 text-sm text-brand hover:text-accent"
          >
            <ArrowLeft size={14} /> All orders
          </Link>
          <h1 className="mt-1 font-display text-2xl font-semibold text-brand-deep">
            Order <span className="font-mono">#{order.id.slice(0, 8)}</span>
          </h1>
          <p className="text-xs text-muted">
            Placed{" "}
            {new Date(order.createdAt).toLocaleString("en-CA", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            · {order.fulfillment} · terms: {order.paymentTerms}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${STATUS_CHIP[order.status]}`}
        >
          {order.status}
        </span>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      {/* Lifecycle controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-surface p-4">
        {order.status === "new" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Confirm this order? Newly ordered products will be added to the customer's catalog at waterfall pricing.")) {
                void run(() => confirmOrder(order.id));
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-50"
          >
            <Check size={15} /> Confirm order
          </button>
        )}
        {order.status === "confirmed" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Mark this order as prepared (packed and ready)?")) {
                void run(() => markOrderPrepared(order.id));
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-50"
          >
            <PackageCheck size={15} /> Mark prepared
          </button>
        )}
        {order.status === "prepared" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Complete this order (picked up / delivered)?")) {
                void run(() => completeOrder(order.id));
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Truck size={15} /> Complete order
          </button>
        )}
        {["new", "confirmed", "prepared"].includes(order.status) && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setCancelPrompt(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <X size={15} /> Cancel order
          </button>
        )}
        {["completed", "cancelled"].includes(order.status) && (
          <p className="text-sm text-muted">
            This order is {order.status} — no further actions.
            {order.adminNote ? ` Note: “${order.adminNote}”` : ""}
          </p>
        )}
      </div>

      {cancelPrompt && (
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4">
          <p className="text-sm font-medium text-red-700">Cancel this order?</p>
          <input
            value={cancelNote}
            onChange={(e) => setCancelNote(e.target.value.slice(0, 1000))}
            placeholder="Reason (optional, kept on the order)"
            className="mt-2 w-full rounded-xl border border-[var(--border-strong)] bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setCancelPrompt(false);
                void run(() => cancelOrder(order.id, cancelNote));
              }}
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              Yes, cancel it
            </button>
            <button
              type="button"
              onClick={() => setCancelPrompt(false)}
              className="rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium"
            >
              Keep the order
            </button>
          </div>
        </div>
      )}

      {/* Customer */}
      <div className="rounded-2xl border border-[var(--border)] bg-surface p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Customer</p>
        {order.customer ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <Link
                href={`/admin/customers/${order.customer.id}`}
                className="font-medium text-brand hover:text-accent"
              >
                {order.customer.businessName}
              </Link>
              <p className="text-xs text-muted">
                {order.customer.contactName} · {order.customer.email} · {order.customer.phone}
              </p>
            </div>
            {order.customer.status !== "active" && (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                Customer is {order.customer.status}
              </span>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Customer record unavailable.</p>
        )}
        {order.notes && (
          <p className="mt-3 rounded-xl bg-brand-mist/40 p-3 text-sm italic text-brand-deep">
            “{order.notes}”
          </p>
        )}
      </div>

      {/* Lines with cost + profit (admin-only) */}
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-5 py-3">Product</th>
              <th className="px-3 py-3 text-right">Qty</th>
              <th className="px-3 py-3 text-right">Price</th>
              <th className="px-3 py-3 text-right">Line total</th>
              <th className="px-3 py-3 text-right">Cost</th>
              <th className="px-5 py-3 text-right">Profit</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l) => {
              const profit = l.costCents != null ? l.lineTotalCents - l.qty * l.costCents : null;
              return (
                <tr key={l.productId} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="px-5 py-3">
                    <p className="font-medium text-foreground">
                      {l.name}
                      {!l.productIsActive && (
                        <span className="ml-2 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-zinc-500">
                          inactive
                        </span>
                      )}
                      {!l.wasAssigned && (
                        <span className="ml-2 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-sky-700">
                          new item
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {l.sku} · {l.unitSize} / {l.unit}
                      {l.appliedOfferTitle ? ` · ${l.appliedOfferTitle}` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right font-mono">{l.qty}</td>
                  <td className="px-3 py-3 text-right font-mono">
                    {formatMoney(l.unitPriceCents)}
                    {l.unitPriceCents !== l.basePriceCents && (
                      <span className="block text-[10px] text-muted line-through">
                        {formatMoney(l.basePriceCents)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold">
                    {formatMoney(l.lineTotalCents)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-muted">
                    {l.costCents != null ? formatMoney(l.qty * l.costCents) : "—"}
                  </td>
                  <td
                    className={`px-5 py-3 text-right font-mono font-semibold ${
                      profit == null
                        ? "text-muted"
                        : profit >= 0
                          ? "text-emerald-700"
                          : "text-red-600"
                    }`}
                  >
                    {profit != null ? formatMoney(profit) : "no cost"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-brand-mist/30 font-semibold">
              <td className="px-5 py-3">Totals</td>
              <td className="px-3 py-3 text-right font-mono">
                {order.lines.reduce((n, l) => n + l.qty, 0)}
              </td>
              <td />
              <td className="px-3 py-3 text-right font-mono">{formatMoney(order.totalCents)}</td>
              <td className="px-3 py-3 text-right font-mono text-muted">
                {order.totalCostCents != null ? formatMoney(order.totalCostCents) : "—"}
              </td>
              <td className="px-5 py-3 text-right font-mono text-emerald-700">
                {order.totalProfitCents != null ? (
                  <>
                    {formatMoney(order.totalProfitCents)}
                    {profitPct && <span className="ml-1 text-[10px]">({profitPct}%)</span>}
                  </>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {order.linesWithoutCost > 0 && (
        <p className="text-xs text-muted-soft">
          {order.linesWithoutCost} {order.linesWithoutCost === 1 ? "line has" : "lines have"} no
          cost snapshot (no purchase cost was recorded when the order was placed) — profit
          totals cover the costed lines only.
        </p>
      )}
    </div>
  );
}
