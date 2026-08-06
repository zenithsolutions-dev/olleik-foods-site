import type { ReportModel, ReportSection } from "@/lib/documents/report-model";
import { DocumentShell, DocTable, docCell, docCellRight } from "./document-shell";

// CP-8c: the ONE report renderer, composing CP-6's DocumentShell/DocTable —
// no print CSS touched. The INTERNAL banner + watermark are driven by
// model.internal, which the pure builder DERIVES from section content — this
// component cannot be handed a profit-bearing model without the marking,
// because no such model can exist.
//
// Every section heading carries the period label (CP-5 rule). Black-and-white
// legible throughout: severity and status are words, never colour alone.

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { dateStyle: "medium", timeZone: "America/Toronto" });

function SectionHeading({ title, period }: { title: string; period: string }) {
  return (
    <h2 className="mb-2 mt-7 border-b-2 border-black pb-1 text-[12px] font-bold uppercase tracking-wider first:mt-0">
      {title} <span className="font-normal normal-case text-neutral-600">— {period}</span>
    </h2>
  );
}

function Section({ section, period }: { section: ReportSection; period: string }) {
  switch (section.key) {
    case "revenue-summary": {
      const a = section.aggregates;
      return (
        <section>
          <SectionHeading title="Revenue summary" period={period} />
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[12px] sm:grid-cols-4">
            <p>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                Revenue (accepted)
              </span>
              <span className="font-mono text-base font-bold">{money(a.revenueCents)}</span>
            </p>
            <p>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                Orders counted
              </span>
              <span className="font-mono text-base font-bold">
                {a.byStatus.confirmed + a.byStatus.prepared + a.byStatus.completed}
              </span>
            </p>
            <p>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                Awaiting confirmation
              </span>
              <span className="font-mono text-base">{a.byStatus.new}</span>
            </p>
            <p>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                Cancelled
              </span>
              <span className="font-mono text-base">{a.byStatus.cancelled}</span>
            </p>
          </div>
          <p className="mt-1.5 text-[10px] text-neutral-600">
            Revenue counts confirmed, prepared and completed orders only — the same rule as the
            dashboard and statements.
          </p>
        </section>
      );
    }
    case "best-sellers":
      return (
        <section>
          <SectionHeading title="Best sellers" period={period} />
          {section.rows.length === 0 ? (
            <p className="border border-black p-4 text-center text-[11px]">
              No counted sales in this period.
            </p>
          ) : (
            <DocTable
              head={
                <>
                  <th className="px-2 py-1.5">#</th>
                  <th className="px-2 py-1.5">Product</th>
                  <th className="px-2 py-1.5">SKU</th>
                  <th className="px-2 py-1.5 text-right">Units</th>
                  <th className="px-2 py-1.5 text-right">Revenue</th>
                </>
              }
            >
              {section.rows.map((r, i) => (
                <tr key={r.productId}>
                  <td className={`${docCell} font-mono text-[11px]`}>{i + 1}</td>
                  <td className={docCell}>{r.name}</td>
                  <td className={`${docCell} font-mono text-[11px]`}>{r.sku}</td>
                  <td className={docCellRight}>{r.units}</td>
                  <td className={docCellRight}>{money(r.revenueCents)}</td>
                </tr>
              ))}
            </DocTable>
          )}
        </section>
      );
    case "slow-movers":
      return (
        <section>
          <SectionHeading title="Slow & non-movers" period={period} />
          <p className="mb-2 text-[10px] text-neutral-600">
            Every active product including zero movement — candidates to discount or stop
            stocking. Age shown so a new product isn&apos;t misread as stale.
          </p>
          {section.rows.length === 0 ? (
            <p className="border border-black p-4 text-center text-[11px]">No active products.</p>
          ) : (
            <DocTable
              head={
                <>
                  <th className="px-2 py-1.5">Product</th>
                  <th className="px-2 py-1.5">SKU</th>
                  <th className="px-2 py-1.5 text-right">Units sold</th>
                  <th className="px-2 py-1.5 text-right">Revenue</th>
                  <th className="px-2 py-1.5 text-right">Age</th>
                </>
              }
            >
              {section.rows.map((r) => (
                <tr key={r.productId}>
                  <td className={docCell}>{r.name}</td>
                  <td className={`${docCell} font-mono text-[11px]`}>{r.sku}</td>
                  <td className={docCellRight}>
                    {r.units === 0 ? <strong>0 — NO MOVEMENT</strong> : r.units}
                  </td>
                  <td className={docCellRight}>{money(r.revenueCents)}</td>
                  <td className={`${docCell} text-right text-[11px]`}>
                    {r.ageDays}d{r.newInPeriod ? " — NEW IN PERIOD" : ""}
                  </td>
                </tr>
              ))}
            </DocTable>
          )}
        </section>
      );
    case "top-customers":
      return (
        <section>
          <SectionHeading title="Top customers" period={period} />
          {section.rows.length === 0 ? (
            <p className="border border-black p-4 text-center text-[11px]">
              No counted orders in this period.
            </p>
          ) : (
            <DocTable
              head={
                <>
                  <th className="px-2 py-1.5">#</th>
                  <th className="px-2 py-1.5">Customer</th>
                  <th className="px-2 py-1.5 text-right">Orders</th>
                  <th className="px-2 py-1.5 text-right">Revenue</th>
                </>
              }
            >
              {section.rows.map((r, i) => (
                <tr key={r.customerId}>
                  <td className={`${docCell} font-mono text-[11px]`}>{i + 1}</td>
                  <td className={docCell}>{r.businessName}</td>
                  <td className={docCellRight}>{r.ordersCount}</td>
                  <td className={docCellRight}>{money(r.revenueCents)}</td>
                </tr>
              ))}
            </DocTable>
          )}
        </section>
      );
    case "inactive-customers":
      return (
        <section>
          <SectionHeading
            title={`Inactive customers (silent ≥ ${section.thresholdDays} days)`}
            period="all-time view"
          />
          {section.rows.length === 0 ? (
            <p className="border border-black p-4 text-center text-[11px]">
              Nobody has gone quiet — every customer who ever ordered has ordered within{" "}
              {section.thresholdDays} days.
            </p>
          ) : (
            <DocTable
              head={
                <>
                  <th className="px-2 py-1.5">Customer</th>
                  <th className="px-2 py-1.5 text-right">Last order</th>
                  <th className="px-2 py-1.5 text-right">Days silent</th>
                </>
              }
            >
              {section.rows.map((r) => (
                <tr key={r.customerId}>
                  <td className={docCell}>{r.businessName}</td>
                  <td className={`${docCell} text-right text-[11px]`}>
                    {r.lastOrderAt ? day(r.lastOrderAt) : "—"}
                  </td>
                  <td className={docCellRight}>{r.daysSilent}</td>
                </tr>
              ))}
            </DocTable>
          )}
          {section.neverOrdered.length > 0 && (
            <p className="mt-2 text-[10px] text-neutral-700">
              <span className="font-bold uppercase tracking-wider">
                Not yet activated ({section.neverOrdered.length}):
              </span>{" "}
              {section.neverOrdered.join(" · ")} — never placed an order; onboarding, not
              win-back.
            </p>
          )}
        </section>
      );
    case "orders":
      return (
        <section>
          <SectionHeading title="Orders in the period" period={period} />
          {section.rows.length === 0 ? (
            <p className="border border-black p-4 text-center text-[11px]">
              No orders in this period.
            </p>
          ) : (
            <DocTable
              head={
                <>
                  <th className="px-2 py-1.5">Order</th>
                  <th className="px-2 py-1.5">Customer</th>
                  <th className="px-2 py-1.5">Date</th>
                  <th className="px-2 py-1.5">Status</th>
                  <th className="px-2 py-1.5 text-right">Total</th>
                </>
              }
              foot={
                <tr className="border-t-2 border-black">
                  <td colSpan={4} className="px-2 py-2 text-right text-sm font-bold">
                    Counted total (accepted orders)
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-sm font-bold">
                    {money(section.countedTotalCents)}
                  </td>
                </tr>
              }
            >
              {section.rows.map((r) => (
                <tr key={r.orderId}>
                  <td className={`${docCell} font-mono text-[11px]`}>#{r.orderId.slice(0, 8)}</td>
                  <td className={docCell}>{r.customerName}</td>
                  <td className={`${docCell} text-[11px]`}>{day(r.createdAt)}</td>
                  <td className={`${docCell} text-[10px] font-bold uppercase tracking-wider`}>
                    {r.status}
                  </td>
                  <td className={docCellRight}>{money(r.totalCents)}</td>
                </tr>
              ))}
            </DocTable>
          )}
        </section>
      );
    case "profit":
      return (
        <section>
          <SectionHeading title="Cost & profit — INTERNAL" period={period} />
          {section.costWarning && (
            <p className="doc-internal-banner mb-3 text-[11px]">{section.costWarning}</p>
          )}
          <div className="mb-3 grid grid-cols-2 gap-x-8 gap-y-1 text-[12px] sm:grid-cols-4">
            <p>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                Revenue
              </span>
              <span className="font-mono text-base font-bold">{money(section.revenueCents)}</span>
            </p>
            <p>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                Cost
              </span>
              <span className="font-mono text-base">
                {section.costCents == null ? "—" : money(section.costCents)}
              </span>
            </p>
            <p>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                Profit
              </span>
              <span className="font-mono text-base font-bold">
                {section.profitCents == null ? "—" : money(section.profitCents)}
              </span>
            </p>
            <p>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                Margin (costed)
              </span>
              <span className="font-mono text-base">
                {section.marginPct == null ? "—" : `${section.marginPct.toFixed(1)}%`}
              </span>
            </p>
          </div>
          {section.perProduct.length > 0 && (
            <DocTable
              head={
                <>
                  <th className="px-2 py-1.5">Product</th>
                  <th className="px-2 py-1.5">SKU</th>
                  <th className="px-2 py-1.5 text-right">Revenue</th>
                  <th className="px-2 py-1.5 text-right">Cost</th>
                  <th className="px-2 py-1.5 text-right">Profit</th>
                </>
              }
            >
              {section.perProduct.map((r) => (
                <tr key={r.sku}>
                  <td className={docCell}>{r.name}</td>
                  <td className={`${docCell} font-mono text-[11px]`}>{r.sku}</td>
                  <td className={docCellRight}>{money(r.revenueCents)}</td>
                  <td className={docCellRight}>{r.costCents == null ? "—" : money(r.costCents)}</td>
                  <td className={docCellRight}>
                    {r.profitCents == null ? "—" : money(r.profitCents)}
                  </td>
                </tr>
              ))}
            </DocTable>
          )}
        </section>
      );
  }
}

export function ReportDocument({ model }: { model: ReportModel }) {
  return (
    <DocumentShell
      business={model.business}
      title={model.internal ? "Report (internal)" : "Report"}
      subtitle={model.periodLabel}
      watermark={model.internal ? "Internal" : null}
      internalBanner={
        model.internal
          ? "INTERNAL DOCUMENT — INCLUDES COST AND PROFIT — DO NOT HAND OUT"
          : null
      }
      footerNote={`${model.business.displayName} · business report · ${model.periodLabel}${model.internal ? " · INTERNAL" : ""}`}
    >
      {model.periodNotice && (
        <p className="mb-4 border border-black p-2 text-[11px] font-medium">{model.periodNotice}</p>
      )}
      {model.isEmpty ? (
        <p className="border border-black p-6 text-center text-[12px] font-medium">
          No sections selected ({model.periodLabel}). Tick at least one section on the left to
          build a report.
        </p>
      ) : (
        model.sections.map((s) => <Section key={s.key} section={s} period={model.periodLabel} />)
      )}
    </DocumentShell>
  );
}
