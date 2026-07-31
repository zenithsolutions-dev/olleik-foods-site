"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { formatMoney } from "@/lib/admin/store";
import type { AdminOrderSummary } from "@/lib/admin/orders-data";
import type { OrderStatus } from "@/lib/portal/portal-data";

// CP-3a admin orders inbox: status filter tabs with counts; NEW orders are the
// loud ones (accent ring + bold) — they're revenue waiting for a click.

const TABS: { key: OrderStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "confirmed", label: "Confirmed" },
  { key: "prepared", label: "Prepared" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_CHIP: Record<OrderStatus, string> = {
  new: "bg-accent text-white",
  confirmed: "bg-brand/15 text-brand-deep",
  prepared: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-zinc-100 text-zinc-500",
};

export function OrdersClient({
  orders,
  countsByStatus,
}: {
  orders: AdminOrderSummary[];
  countsByStatus: Record<OrderStatus, number>;
}) {
  const [tab, setTab] = useState<OrderStatus | "all">("all");
  const visible = useMemo(
    () => (tab === "all" ? orders : orders.filter((o) => o.status === tab)),
    [orders, tab],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-brand-deep">Orders</h1>
          <p className="text-sm text-muted">
            {countsByStatus.new > 0
              ? `${countsByStatus.new} new ${countsByStatus.new === 1 ? "order" : "orders"} waiting for confirmation.`
              : "No new orders waiting."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const count = t.key === "all" ? orders.length : countsByStatus[t.key];
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                tab === t.key
                  ? "bg-brand text-white"
                  : "border border-[var(--border-strong)] bg-surface text-foreground/75 hover:border-accent"
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className={`ml-1.5 text-xs ${tab === t.key ? "text-white/80" : "text-muted"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--border)] bg-surface p-14 text-center">
          <Inbox className="text-muted-soft" size={28} />
          <p className="mt-2 text-sm text-muted">No orders here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface">
          {visible.map((o) => (
            <Link
              key={o.id}
              href={`/admin/orders/${o.id}`}
              className={`flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 transition last:border-b-0 hover:bg-brand-mist/30 ${
                o.status === "new" ? "bg-accent/5" : ""
              }`}
            >
              <div className="min-w-0">
                <p
                  className={`truncate text-sm text-foreground ${
                    o.status === "new" ? "font-semibold" : "font-medium"
                  }`}
                >
                  {o.customerName}
                  <span className="ml-2 font-mono text-xs text-muted">#{o.id.slice(0, 8)}</span>
                </p>
                <p className="text-xs text-muted">
                  {new Date(o.createdAt).toLocaleString("en-CA", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}{" "}
                  · {o.itemCount} {o.itemCount === 1 ? "item" : "items"} · {o.fulfillment}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_CHIP[o.status]}`}
                >
                  {o.status}
                </span>
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
