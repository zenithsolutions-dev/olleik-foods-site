"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, FileText } from "lucide-react";
import { formatMoney } from "@/lib/admin/store";
import {
  rankProducts,
  rankCustomers,
  INACTIVE_THRESHOLDS,
  type CustomerSortKey,
  type InactiveThreshold,
  type ProductSales,
  type ProductSortKey,
  type SlowMoverRow,
} from "@/lib/admin/analytics-math";
import type { AnalyticsSource, CustomerSalesRow } from "@/lib/admin/analytics-data";

// CP-8b analytics UI. Every section's heading carries the period label (CP-5
// rule) — a screenshot is never ambiguous about what it covers. Sorting is
// ephemeral client state; the shipped ranking logic is the imported pure
// module, so what the tests rank is what the screen shows.

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { dateStyle: "medium", timeZone: "America/Toronto" });

function SortHeader({
  label,
  active,
  onClick,
  right = true,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  right?: boolean;
}) {
  return (
    <th className={`px-4 py-2.5 ${right ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider ${
          active ? "text-accent-deep" : "text-muted hover:text-foreground"
        }`}
      >
        {label}
        {active && <ArrowDown size={11} />}
      </button>
    </th>
  );
}

function Card({
  title,
  period,
  blurb,
  children,
}: {
  title: string;
  period: string;
  blurb: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface">
      <header className="border-b border-[var(--border)] px-5 py-4">
        <h2 className="font-display text-lg font-semibold text-brand-deep">
          {title} <span className="text-sm font-normal text-muted">— {period}</span>
        </h2>
        <p className="mt-0.5 text-xs text-muted">{blurb}</p>
      </header>
      {children}
    </section>
  );
}

export function AnalyticsClient({
  periodLabel,
  periodNotice,
  quiet,
  quietQuery,
  productSales,
  analyticsSource,
  truncated,
  customerSales,
  slowMovers,
  inactive,
  neverOrdered,
  activeRecently,
  rangeFilter,
}: {
  periodLabel: string;
  periodNotice: string | null;
  quiet: InactiveThreshold;
  quietQuery: { range?: string; from?: string; to?: string };
  productSales: ProductSales[];
  analyticsSource: AnalyticsSource;
  truncated: boolean;
  customerSales: CustomerSalesRow[];
  slowMovers: SlowMoverRow[];
  inactive: { customerId: string; businessName: string; lastOrderAt: string | null; daysSilent: number }[];
  neverOrdered: { customerId: string; businessName: string }[];
  activeRecently: number;
  rangeFilter: ReactNode;
}) {
  const [productSort, setProductSort] = useState<ProductSortKey>("revenue");
  const [customerSort, setCustomerSort] = useState<CustomerSortKey>("revenue");
  const [showAllSlow, setShowAllSlow] = useState(false);

  const rankedProducts = useMemo(
    () => rankProducts(productSales, productSort),
    [productSales, productSort],
  );
  const rankedCustomers = useMemo(
    () => rankCustomers(customerSales, customerSort),
    [customerSales, customerSort],
  );
  const anyProfitIncomplete = rankedProducts.some((r) => r.profitIncomplete || r.profitCents == null);
  const slowShown = showAllSlow ? slowMovers : slowMovers.slice(0, 15);

  const quietHref = (d: number) => {
    const spx = new URLSearchParams();
    if (quietQuery.range) spx.set("range", quietQuery.range);
    if (quietQuery.from) spx.set("from", quietQuery.from);
    if (quietQuery.to) spx.set("to", quietQuery.to);
    spx.set("quiet", String(d));
    return `/admin/analytics?${spx.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
          Analytics
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          What actually sells
        </h1>
        <p className="mt-2 text-sm text-muted">
          Counted the same way as the dashboard and statements: confirmed, prepared and completed
          orders only — one family of numbers.
        </p>
        <div className="mt-4">{rangeFilter}</div>
        {periodNotice && (
          <p className="mt-2 text-xs font-medium text-amber-800">{periodNotice}</p>
        )}
        {analyticsSource === "fallback" && (
          <p className="mt-2 rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            Aggregating in the app — migration 0014 (server-side aggregation) isn&apos;t applied
            yet. Figures are correct{truncated ? ", but the period was CAPPED at 20,000 orders — narrow it" : ""}; applying 0014 makes this scale.
          </p>
        )}
        {analyticsSource === "rpc" && truncated && (
          <p className="mt-2 text-xs font-medium text-amber-800">Some figures were truncated.</p>
        )}
      </header>

      {/* Best sellers (approved D-N2) */}
      <Card
        title="Best sellers"
        period={periodLabel}
        blurb="Units, revenue and profit side by side — a cheap high-volume item and an expensive rare one are both worth knowing about. Click a column to re-rank."
      >
        {anyProfitIncomplete && (
          <p className="border-b border-[var(--border)] bg-amber-50 px-5 py-2 text-xs font-medium text-amber-800">
            Some lines have no recorded purchase cost — the Profit column covers costed lines only
            and understates true profit. Treat it as partial, not as ranking truth.
          </p>
        )}
        {rankedProducts.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            No counted sales in this period ({periodLabel}). Widen the range above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left">
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted">
                    Product
                  </th>
                  <SortHeader label="Units" active={productSort === "units"} onClick={() => setProductSort("units")} />
                  <SortHeader label="Revenue" active={productSort === "revenue"} onClick={() => setProductSort("revenue")} />
                  <SortHeader label="Profit" active={productSort === "profit"} onClick={() => setProductSort("profit")} />
                </tr>
              </thead>
              <tbody>
                {rankedProducts.map((r, i) => (
                  <tr key={r.productId} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-4 py-2.5">
                      <span className="mr-2 font-mono text-xs text-muted">{i + 1}.</span>
                      <span className="font-medium">{r.name}</span>
                      <span className="ml-2 font-mono text-xs text-muted">{r.sku}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{r.units}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatMoney(r.revenueCents)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {r.profitCents == null ? (
                        <span className="text-muted" title="No line has a recorded cost">
                          no cost data
                        </span>
                      ) : (
                        <>
                          {formatMoney(r.profitCents)}
                          {r.profitIncomplete && (
                            <span className="ml-1 text-[10px] font-bold uppercase text-amber-700" title={`${r.costedLines} of ${r.totalLines} lines costed`}>
                              partial
                            </span>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Slow movers */}
      <Card
        title="Slow & non-movers"
        period={periodLabel}
        blurb="Every ACTIVE product with its movement in the period, INCLUDING zero — what to stop stocking or discount. Age shown so a new product isn't mislabelled stale."
      >
        {slowMovers.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">No active products.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-wider text-muted">
                    <th className="px-4 py-2.5">Product</th>
                    <th className="px-4 py-2.5 text-right">Units sold</th>
                    <th className="px-4 py-2.5 text-right">Revenue</th>
                    <th className="px-4 py-2.5 text-right">Product age</th>
                  </tr>
                </thead>
                <tbody>
                  {slowShown.map((r) => (
                    <tr key={r.productId} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{r.name}</span>
                        <span className="ml-2 font-mono text-xs text-muted">{r.sku}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {r.units === 0 ? <span className="font-bold">0 — NO MOVEMENT</span> : r.units}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{formatMoney(r.revenueCents)}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-muted">
                        {r.ageDays}d{r.newInPeriod && (
                          <span className="ml-1 font-bold uppercase text-brand-deep">new in period</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {slowMovers.length > 15 && (
              <button
                type="button"
                onClick={() => setShowAllSlow((v) => !v)}
                className="block w-full border-t border-[var(--border)] px-5 py-2.5 text-center text-xs font-medium text-brand hover:text-accent"
              >
                {showAllSlow ? "Show slowest 15 only" : `Show all ${slowMovers.length} active products`}
              </button>
            )}
          </>
        )}
      </Card>

      {/* Top customers */}
      <Card
        title="Top customers"
        period={periodLabel}
        blurb="Who orders most, by value and by count. Each row links straight to their printable statement."
      >
        {rankedCustomers.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            No counted orders in this period ({periodLabel}).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left">
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted">
                    Customer
                  </th>
                  <SortHeader label="Orders" active={customerSort === "orders"} onClick={() => setCustomerSort("orders")} />
                  <SortHeader label="Revenue" active={customerSort === "revenue"} onClick={() => setCustomerSort("revenue")} />
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted">
                    Statement
                  </th>
                </tr>
              </thead>
              <tbody>
                {rankedCustomers.map((r, i) => (
                  <tr key={r.customerId} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-4 py-2.5">
                      <span className="mr-2 font-mono text-xs text-muted">{i + 1}.</span>
                      <Link href={`/admin/customers/${r.customerId}`} className="font-medium text-brand hover:text-accent">
                        {r.businessName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{r.ordersCount}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatMoney(r.revenueCents)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/admin/customers/${r.customerId}/statement`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-accent"
                      >
                        <FileText size={12} /> Statement
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Inactive (approved D-N3) — all-time facts, threshold in the URL */}
      <Card
        title="Gone quiet"
        period={`silent ≥ ${quiet} days (all-time view)`}
        blurb={`Customers who used to order and have stopped — win-back targets. ${activeRecently} active customer${activeRecently === 1 ? "" : "s"} ordered within ${quiet} days.`}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-2.5 text-xs">
          <span className="font-semibold uppercase tracking-wider text-muted">Quiet for:</span>
          {INACTIVE_THRESHOLDS.map((d) => (
            <Link
              key={d}
              href={quietHref(d)}
              className={`rounded-full px-3 py-1 font-medium ${
                quiet === d ? "bg-accent text-white" : "border border-[var(--border-strong)] text-muted hover:text-foreground"
              }`}
            >
              {d}+ days
            </Link>
          ))}
        </div>
        {inactive.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">
            Nobody has gone quiet — every customer who ever ordered has ordered within {quiet} days.
          </p>
        ) : (
          inactive.map((c) => (
            <div key={c.customerId} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-2.5 text-sm last:border-b-0">
              <Link href={`/admin/customers/${c.customerId}`} className="font-medium text-brand hover:text-accent">
                {c.businessName}
              </Link>
              <span className="text-xs text-muted">
                last order {c.lastOrderAt ? fmtDay(c.lastOrderAt) : "—"} ·{" "}
                <strong>{c.daysSilent} days silent</strong>
              </span>
            </div>
          ))
        )}
        {neverOrdered.length > 0 && (
          <div className="border-t-2 border-[var(--border)] bg-brand-mist/20 px-5 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">
              Not yet activated ({neverOrdered.length}) — never placed an order; needs onboarding,
              not win-back
            </p>
            <p className="mt-1 text-sm">
              {neverOrdered.map((c, i) => (
                <span key={c.customerId}>
                  {i > 0 && " · "}
                  <Link href={`/admin/customers/${c.customerId}`} className="text-brand hover:text-accent">
                    {c.businessName}
                  </Link>
                </span>
              ))}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
