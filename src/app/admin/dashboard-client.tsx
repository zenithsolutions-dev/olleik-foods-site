"use client";

import Link from "next/link";
import { useAdmin, formatMoney } from "@/lib/admin/store";
import type { Customer, Lead, LeadStatus, Product } from "@/lib/admin/types";
import type { LowStockItem } from "@/lib/admin/inventory-data";
import type { DashboardStats } from "@/lib/admin/dashboard-data";
import type { ProductRankRow } from "@/lib/admin/analytics-math";
import type { CustomerSalesRow } from "@/lib/admin/analytics-data";

// CP-4 command center (approved spec): the merchant opens /admin each morning
// and understands the day at a glance. Priority order:
//   1. TODAY — orders by status (new loudest), accepted revenue + derived
//      profit (D-D1: confirmed+prepared+completed only; 'new' shown as an
//      explicit separate "awaiting confirmation" line), pickup vs delivery,
//      a one-line yesterday comparison (D-D2).
//   2. NEEDS ATTENTION — only cards with a value > 0; a fully clean morning
//      shows one deliberate "Nothing needs attention" state.
//   3. Context & access — active offers (72h expiring flag, D-D3), recent
//      leads, quick links into every module.
// The "Avg. list price" vanity card is deleted (approved D-D4).

export function DashboardClient({
  leads,
  products,
  customers,
  live,
  lowStock,
  stats,
  pendingNow,
  missingCostCount,
  pendingActivationCount,
  topProducts,
  topCustomers,
  inactiveCount,
}: {
  leads: Lead[];
  products: Product[];
  customers: Customer[];
  live: boolean;
  lowStock: LowStockItem[];
  stats: DashboardStats;
  pendingNow: { count: number; cents: number }; // LIVE right-now figures (never period-scoped)
  missingCostCount: number; // active products without a purchase cost (existing warning logic)
  pendingActivationCount: number; // invited customers who never signed in
  // CP-8b: period-scoped top-3s (same reads + ranking as /admin/analytics)
  // and the 30-day inactive count for the attention row.
  topProducts: ProductRankRow[];
  topCustomers: CustomerSalesRow[];
  inactiveCount: number;
}) {
  const { reset } = useAdmin();

  const activeProducts = products.filter((p) => p.isActive).length;
  const visibleCustomers = customers.filter((c) => c.status !== "archived");
  const activeCustomers = visibleCustomers.filter((c) => c.status === "active").length;
  const newLeads = leads.filter((l) => l.status === "new").length;

  const t = stats.today;
  const isToday = stats.periodPreset === "today";
  const expiringSoon = stats.activeOffers.filter((o) => o.expiringSoon);
  const attentionEmpty =
    lowStock.length === 0 &&
    pendingActivationCount === 0 &&
    missingCostCount === 0 &&
    expiringSoon.length === 0 &&
    inactiveCount === 0;

  return (
    <div className="space-y-8">
      {/* ---------- Row 1: the selected period (default Today) ---------- */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
          {isToday ? "Today" : stats.periodLabel}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* LIVE figure — never period-scoped (approved D-R3): what's waiting
              RIGHT NOW, regardless of the range being viewed. */}
          <Stat
            label="New orders · right now"
            value={`${pendingNow.count}`}
            sub={pendingNow.count > 0 ? "waiting for you in the inbox" : "none waiting — all clear"}
            href="/admin/orders"
            highlight={pendingNow.count > 0}
          />
          <Stat
            label={isToday ? "Today's revenue" : `Revenue (${stats.periodLabel})`}
            value={formatMoney(t.revenueCents)}
            sub={
              isToday
                ? `accepted orders · yesterday ${formatMoney(stats.yesterday.revenueCents)}`
                : "accepted orders in this period"
            }
            href="/admin/orders"
          />
          <Stat
            label={isToday ? "Today's profit" : `Profit (${stats.periodLabel})`}
            value={stats.todayProfit.profitCents != null ? formatMoney(stats.todayProfit.profitCents) : "—"}
            sub={
              stats.todayProfit.profitCents == null
                ? t.revenueCents > 0
                  ? "no cost snapshots on these lines"
                  : "derived from cost snapshots"
                : stats.todayProfit.linesWithoutCost > 0
                  ? `${stats.todayProfit.linesWithoutCost} line${stats.todayProfit.linesWithoutCost === 1 ? "" : "s"} without cost excluded`
                  : "all lines costed"
            }
          />
          <Stat
            label={`Pickup / Delivery (${isToday ? "today" : stats.periodLabel})`}
            value={`${t.pickupCount} / ${t.deliveryCount}`}
            sub="accepted orders in this period"
            href="/admin/orders"
          />
        </div>

        {/* LIVE banner (right now): 'new' money is REAL but not accepted —
            its own explicit line, never conflated with revenue (D-D1). */}
        {pendingNow.count > 0 && (
          <Link
            href="/admin/orders"
            className="mt-3 flex items-center justify-between rounded-xl border border-accent/50 bg-accent-soft/40 px-4 py-2.5 text-sm hover:border-accent"
          >
            <span className="font-medium text-accent-deep">
              Awaiting confirmation right now: {pendingNow.count} order
              {pendingNow.count === 1 ? "" : "s"} · {formatMoney(pendingNow.cents)}
            </span>
            <span className="text-xs font-semibold text-accent-deep">Review →</span>
          </Link>
        )}

        <p className="mt-3 text-xs text-muted">
          {t.totalOrders === 0 ? (
            isToday ? (
              <>No orders yet today — they&apos;ll appear here the moment a customer submits.</>
            ) : (
              <>No orders in this period ({stats.periodLabel}).</>
            )
          ) : (
            <>
              {stats.periodLabel}: {t.byStatus.new} new · {t.byStatus.confirmed} confirmed ·{" "}
              {t.byStatus.prepared} prepared · {t.byStatus.completed} completed
              {t.byStatus.cancelled > 0 ? ` · ${t.byStatus.cancelled} cancelled` : ""}
              {isToday
                ? ` · yesterday ${stats.yesterday.totalOrders} order${stats.yesterday.totalOrders === 1 ? "" : "s"}`
                : ""}
            </>
          )}
          <span className="text-muted-soft"> · business days in America/Toronto</span>
        </p>

        {/* CP-8b: period-scoped top-3s — the same figures /admin/analytics
            ranks, truncated to three. Full tables stay one click away. */}
        {(topProducts.length > 0 || topCustomers.length > 0) && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Top products · {stats.periodLabel}
              </p>
              {topProducts.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No counted sales in this period.</p>
              ) : (
                <ul className="mt-2 space-y-1.5 text-sm">
                  {topProducts.map((p, i) => (
                    <li key={p.productId} className="flex items-center justify-between gap-2">
                      <span>
                        <span className="mr-1.5 font-mono text-xs text-muted">{i + 1}.</span>
                        {p.name}
                      </span>
                      <span className="font-mono text-xs">
                        {p.units} units · {formatMoney(p.revenueCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/admin/analytics" className="mt-2 inline-block text-xs font-medium text-brand hover:text-accent">
                Full analytics →
              </Link>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Top customers · {stats.periodLabel}
              </p>
              {topCustomers.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No counted orders in this period.</p>
              ) : (
                <ul className="mt-2 space-y-1.5 text-sm">
                  {topCustomers.map((c, i) => (
                    <li key={c.customerId} className="flex items-center justify-between gap-2">
                      <span>
                        <span className="mr-1.5 font-mono text-xs text-muted">{i + 1}.</span>
                        <Link href={`/admin/customers/${c.customerId}`} className="text-brand hover:text-accent">
                          {c.businessName}
                        </Link>
                      </span>
                      <span className="font-mono text-xs">
                        {c.ordersCount} orders · {formatMoney(c.revenueCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/admin/analytics" className="mt-2 inline-block text-xs font-medium text-brand hover:text-accent">
                Full analytics →
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ---------- Row 2: NEEDS ATTENTION ---------- */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
          Needs your attention
        </h2>
        {attentionEmpty ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-5 py-4 text-sm font-medium text-emerald-800">
            ✓ Nothing needs attention — stock is healthy, every active product has a cost, all
            invited customers are signed in, no offer is about to expire, and nobody has gone quiet.
          </p>
        ) : (
          <div className="space-y-4">
            {/* CP-3c low-stock/oversold card — same data, same severity rules
                (oversold first, solid red), rendered by the shared block below. */}
            {lowStock.length > 0 && <LowStockCard lowStock={lowStock} />}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pendingActivationCount > 0 && (
                <AttentionCard
                  label="Invited, never signed in"
                  value={`${pendingActivationCount}`}
                  blurb="Customers with portal invites who haven't logged in — a call may unblock them."
                  href="/admin/customers"
                />
              )}
              {missingCostCount > 0 && (
                <AttentionCard
                  label="Products without cost"
                  value={`${missingCostCount}`}
                  blurb="Margin rules can't price these and their profit shows as “—”."
                  href="/admin/products"
                />
              )}
              {/* CP-8b: win-back signal — one line, >0 only, full list one
                  click away on the analytics page. */}
              {inactiveCount > 0 && (
                <AttentionCard
                  label="Customers gone quiet"
                  value={`${inactiveCount}`}
                  blurb="Ordered before, silent 30+ days — win-back targets. Full list in Analytics."
                  href="/admin/analytics"
                />
              )}
              {expiringSoon.length > 0 && (
                <AttentionCard
                  label="Offers expiring soon"
                  value={`${expiringSoon.length}`}
                  blurb={`Within 72h: ${expiringSoon
                    .slice(0, 3)
                    .map((o) => o.title)
                    .join(", ")}${expiringSoon.length > 3 ? "…" : ""}`}
                  href="/admin/offers"
                />
              )}
            </div>
          </div>
        )}
      </section>

      {/* ---------- Row 3: context & access ---------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--border)] bg-surface p-6">
          <h2 className="font-display text-lg font-semibold text-brand-deep">Active offers</h2>
          <p className="mt-1 text-xs text-muted">What your customers currently see.</p>
          {stats.activeOffers.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              No offers running. Create one from the offer library when you want to move a
              product.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--border)]">
              {stats.activeOffers.slice(0, 6).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate font-medium text-foreground">{o.title}</span>
                  {o.expiringSoon ? (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                      ends soon
                    </span>
                  ) : o.endsAt ? (
                    <span className="shrink-0 text-xs text-muted">
                      until{" "}
                      {new Date(o.endsAt).toLocaleDateString("en-CA", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-soft">no end date</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/offers"
            className="mt-4 inline-block text-sm font-medium text-brand hover:text-accent"
          >
            Offer library →
          </Link>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-surface p-6">
          <h2 className="font-display text-lg font-semibold text-brand-deep">Recent leads</h2>
          <p className="mt-1 text-xs text-muted">From the public /apply form.</p>
          {leads.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No leads yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--border)]">
              {leads.slice(0, 5).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{l.businessName}</p>
                    <p className="truncate text-xs text-muted">
                      {l.contactName} · {l.email}
                    </p>
                  </div>
                  <LeadStatusBadge status={l.status} />
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/leads"
            className="mt-4 inline-block text-sm font-medium text-brand hover:text-accent"
          >
            View all{newLeads > 0 ? ` (${newLeads} new)` : ""} →
          </Link>
        </section>
      </div>

      {/* Quick links into every module, with the counts that used to live in
          the old stat cards. */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
          Modules
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <QuickLink href="/admin/orders" label="Orders" sub="inbox & lifecycle" />
          <QuickLink
            href="/admin/products"
            label="Products"
            sub={`${activeProducts} active of ${products.length}`}
          />
          <QuickLink
            href="/admin/customers"
            label="Customers"
            sub={`${activeCustomers} active of ${visibleCustomers.length}`}
          />
          <QuickLink href="/admin/assign" label="Assign products" sub="catalogs & pricing" />
          <QuickLink href="/admin/pricing" label="Pricing" sub="rules & autopilot" />
          <QuickLink href="/admin/offers" label="Offers" sub={`${stats.activeOffers.length} running`} />
          <QuickLink href="/admin/analytics" label="Analytics" sub="best sellers & quiet customers" />
          <QuickLink href="/admin/reports" label="Reports" sub="build & print any period" />
          <QuickLink href="/admin/categories" label="Categories" sub="catalog structure" />
          <QuickLink href="/admin/leads" label="Leads" sub={`${newLeads} new`} />
        </div>
      </section>

      {!live && (
        <section className="rounded-2xl border border-[var(--border)] bg-surface p-6">
          <h2 className="font-display text-lg font-semibold text-brand-deep">Demo controls</h2>
          <p className="mt-1 text-xs text-muted">
            Supabase isn&apos;t configured, so catalog, customers, and leads are local demo data.
            Use the reset button to restore the seed sample after experimenting.
          </p>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Reset all admin data to the seed sample? This wipes any changes.")) {
                reset();
              }
            }}
            className="mt-4 rounded-full border border-[var(--border-strong)] bg-background px-4 py-2 text-xs font-medium text-foreground/80 hover:border-accent hover:text-accent-deep"
          >
            Reset demo data
          </button>
        </section>
      )}
    </div>
  );
}

// CP-3c low-stock/oversold block (moved intact into a named component when the
// attention row was built — same data source, same severity ladder).
function LowStockCard({ lowStock }: { lowStock: LowStockItem[] }) {
  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50/50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-amber-900">Low stock</h2>
          <p className="mt-1 text-xs text-amber-800">
            {lowStock.length} tracked product{lowStock.length === 1 ? " is" : "s are"} at or
            below the alert level
            {lowStock.some((i) => i.stockQty < 0)
              ? ` — ${lowStock.filter((i) => i.stockQty < 0).length} OVERSOLD (units owed).`
              : "."}
          </p>
        </div>
        <Link
          href="/admin/products?stock=low"
          className="rounded-full border border-amber-400 bg-white/70 px-4 py-2 text-xs font-semibold text-amber-900 hover:border-amber-600"
        >
          Manage stock →
        </Link>
      </div>
      <ul className="mt-4 divide-y divide-amber-200/70">
        {lowStock.slice(0, 5).map((i) => (
          <li key={i.productId} className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{i.name}</p>
              <p className="text-xs text-muted">{i.sku}</p>
            </div>
            {i.stockQty < 0 ? (
              <span className="rounded-full bg-red-600 px-2.5 py-1 font-sans text-xs font-bold uppercase tracking-wide text-white">
                Oversold by {-i.stockQty}
              </span>
            ) : (
              <span
                className={`font-mono text-sm font-semibold ${
                  i.stockQty === 0 ? "text-red-700" : "text-amber-800"
                }`}
              >
                {i.stockQty === 0 ? "out of stock" : `${i.stockQty} left`}
                <span className="ml-1 font-sans text-[10px] font-normal text-muted">
                  (alert at {i.lowStockThreshold})
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>
      {lowStock.length > 5 && (
        <p className="mt-2 text-xs text-amber-800">
          + {lowStock.length - 5} more in the filtered view.
        </p>
      )}
    </section>
  );
}

function AttentionCard({
  label,
  value,
  blurb,
  href,
}: {
  label: string;
  value: string;
  blurb: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 transition hover:border-amber-400"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-amber-900">{label}</p>
      <p className="font-display mt-2 text-3xl font-semibold tracking-tight text-amber-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-amber-800">{blurb}</p>
    </Link>
  );
}

function QuickLink({ href, label, sub }: { href: string; label: string; sub: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-[var(--border)] bg-surface px-4 py-3 transition hover:border-[var(--border-strong)]"
    >
      <p className="text-sm font-semibold text-brand-deep">{label}</p>
      <p className="mt-0.5 text-xs text-muted">{sub}</p>
    </Link>
  );
}

function Stat({
  label,
  value,
  sub,
  href,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  href?: string;
  highlight?: boolean;
}) {
  const inner = (
    <div
      className={`h-full rounded-2xl border bg-surface p-5 transition ${
        highlight
          ? "border-accent shadow-[0_8px_30px_-12px_rgba(200,122,42,0.4)]"
          : "border-[var(--border)] hover:border-[var(--border-strong)]"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="font-display mt-2 text-3xl font-semibold tracking-tight text-brand-deep">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-soft">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const cls =
    status === "new"
      ? "bg-accent-soft text-accent-deep"
      : status === "contacted"
        ? "bg-brand-mist text-brand-deep"
        : status === "approved"
          ? "bg-brand text-white"
          : status === "converted"
            ? "bg-brand/15 text-brand-deep"
            : "bg-zinc-200 text-zinc-600";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {status}
    </span>
  );
}
