import type {
  CustomerStatementModel,
  InternalProductRollupLine,
  InternalStatementLine,
  InternalStatementModel,
  InternalStatementOrder,
  ProductRollupLine,
  StatementAside,
  StatementLine,
  StatementOrder,
} from "@/lib/documents/customer-statement-model";
import { DocumentShell, DocTable, docCell, docCellRight } from "./document-shell";

// CP-7: the ONE statement renderer. The admin's customer copy, the admin's
// internal copy and the customer's own portal statement all render through
// here — so the paper the owner hands over and the paper the customer prints
// are the same document.
//
// Composes CP-6's DocumentShell / DocTable ONLY: no print CSS was added or
// touched for this phase. Repeating headers, unsplit rows, page margins and
// the repeating watermark all come from the CP-6 layer as designed.
//
// The internal copy is unmistakable at a glance: a bold banner at the top AND
// a watermark repeating on every page, because it will get printed next to a
// customer copy. Everything is legible in black and white — statuses, markers
// and warnings are WORDS, never colour alone.

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { dateStyle: "medium", timeZone: "America/Toronto" });

function AsideSection({
  heading,
  note,
  rows,
}: {
  heading: string;
  note: string;
  rows: StatementAside[];
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-7">
      <h2 className="text-[11px] font-bold uppercase tracking-wider">{heading}</h2>
      <p className="mt-0.5 text-[10px] text-neutral-700">{note}</p>
      <table className="doc-table mt-2 w-full border-collapse text-[12px]">
        <tbody>
          {rows.map((r) => (
            <tr key={r.orderId}>
              <td className={docCell}>
                <span className="font-medium">{r.documentNumber}</span>
                <span className="ml-2 text-[10px] font-bold uppercase tracking-wider">
                  [{r.marker}]
                </span>
              </td>
              <td className={`${docCell} text-[11px]`}>{day(r.createdAt)}</td>
              <td className={docCellRight}>{money(r.totalCents)}</td>
              <td className={`${docCell} text-[10px] uppercase tracking-wider`}>not counted</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// One order = a bold header row, its snapshot lines, then its own total. All
// inside the single flat table so ONE header repeats across every page.
function OrderBlock({
  order,
  internal,
  cols,
}: {
  order: StatementOrder | InternalStatementOrder;
  internal: boolean;
  cols: number;
}) {
  const lines: (StatementLine | InternalStatementLine)[] = order.lines;
  const orderCost = "costCents" in order ? order.costCents : null;
  const orderProfit = "profitCents" in order ? order.profitCents : null;

  return (
    <>
      <tr className="border-t-2 border-black">
        <td colSpan={cols} className="px-2 pb-1 pt-3 text-[11px]">
          <span className="font-bold uppercase tracking-wider">{order.documentNumber}</span>
          <span className="text-neutral-700">
            {" "}
            · {day(order.createdAt)} · {order.fulfillment} · {order.status.toUpperCase()}
          </span>
        </td>
      </tr>
      {lines.map((l) => (
        <tr key={`${order.orderId}-${l.sku}`}>
          <td className={docCell}>
            <span className="font-medium">{l.name}</span>
            <span className="block text-[10px] text-neutral-600">
              {l.unitSize} / {l.unit}
              {l.appliedOfferTitle ? ` · ${l.appliedOfferTitle}` : ""}
            </span>
          </td>
          <td className={`${docCell} font-mono text-[11px]`}>{l.sku}</td>
          <td className={docCellRight}>{l.qty}</td>
          <td className={docCellRight}>{money(l.unitPriceCents)}</td>
          <td className={docCellRight}>{money(l.lineTotalCents)}</td>
          {internal && (
            <td className={docCellRight}>
              {"costCents" in l && l.costCents != null ? money(l.costCents) : "—"}
            </td>
          )}
          {internal && (
            <td className={docCellRight}>
              {"lineProfitCents" in l && l.lineProfitCents != null ? money(l.lineProfitCents) : "—"}
            </td>
          )}
        </tr>
      ))}
      <tr>
        <td colSpan={4} className="px-2 py-1.5 text-right text-[11px] font-semibold">
          Order total
        </td>
        <td className={`${docCellRight} font-semibold`}>{money(order.totalCents)}</td>
        {internal && (
          <td className={docCellRight}>{orderCost == null ? "—" : money(orderCost)}</td>
        )}
        {internal && (
          <td className={`${docCellRight} font-semibold`}>
            {orderProfit == null ? "—" : money(orderProfit)}
          </td>
        )}
      </tr>
    </>
  );
}

export function CustomerStatementDocument({
  model,
}: {
  model: CustomerStatementModel | InternalStatementModel;
}) {
  const internal = model.internal;
  const cols = internal ? 7 : 5;
  const orders: (StatementOrder | InternalStatementOrder)[] = model.orders;
  const products: (ProductRollupLine | InternalProductRollupLine)[] = model.products;

  return (
    <DocumentShell
      business={model.business}
      title={internal ? "Statement (internal)" : "Statement"}
      subtitle={`${model.statementFor.businessName} · ${model.periodLabel}`}
      watermark={internal ? "Internal" : null}
      internalBanner={
        internal
          ? "INTERNAL DOCUMENT — INCLUDES COST AND PROFIT — DO NOT HAND TO THE CUSTOMER"
          : null
      }
      footerNote={`${model.business.displayName} · statement for ${model.statementFor.businessName} · ${model.periodLabel}${internal ? " · INTERNAL COPY" : ""}`}
    >
      {/* Corrected input is always reported, never swallowed (CP-5 rule). */}
      {model.periodNotice && (
        <p className="mb-4 border border-black p-2 text-[11px] font-medium">{model.periodNotice}</p>
      )}
      {model.truncationNotice && (
        <p className="doc-internal-banner mb-4 text-[11px]">{model.truncationNotice}</p>
      )}
      {model.internal && model.costWarning && (
        <p className="doc-internal-banner mb-4 text-[11px]">{model.costWarning}</p>
      )}

      {/* Who / when */}
      <div className="mb-6 grid grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
            Statement for
          </p>
          <p className="mt-1 font-semibold">{model.statementFor.businessName}</p>
          <p className="text-[11px] text-neutral-700">
            {model.statementFor.contactName}
            <br />
            {model.statementFor.address ? (
              <>
                {model.statementFor.address}
                <br />
              </>
            ) : null}
            {model.statementFor.phone} · {model.statementFor.email}
          </p>
        </div>
        <div className="text-right text-[11px]">
          <p>
            <span className="font-bold uppercase tracking-wider text-neutral-600">Period: </span>
            <span className="font-semibold">{model.periodLabel}</span>
          </p>
          <p className="mt-0.5">
            <span className="font-bold uppercase tracking-wider text-neutral-600">
              Orders counted:{" "}
            </span>
            {model.orderCount}
          </p>
          <p className="mt-0.5 text-[10px] text-neutral-600">
            Generated {day(model.generatedAtISO)}
          </p>
        </div>
      </div>

      {model.isEmpty ? (
        <p className="border border-black p-6 text-center text-[12px] font-medium">
          {model.emptyNotice}
        </p>
      ) : (
        <>
          {/* Period summary — the figures, before the detail. */}
          <section className="mb-6 border-y-2 border-black py-3">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                  Total for the period
                </p>
                <p className="font-mono text-2xl font-bold">{money(model.totalCents)}</p>
                <p className="text-[10px] text-neutral-700">
                  {model.orderCount} order{model.orderCount === 1 ? "" : "s"} · confirmed, prepared
                  and completed only
                </p>
              </div>
              {model.internal && (
                <div className="text-right text-[11px]">
                  <p>
                    <span className="font-bold uppercase tracking-wider text-neutral-600">
                      Cost:{" "}
                    </span>
                    <span className="font-mono">
                      {model.totalCostCents == null ? "—" : money(model.totalCostCents)}
                    </span>
                  </p>
                  <p className="mt-0.5">
                    <span className="font-bold uppercase tracking-wider text-neutral-600">
                      Profit:{" "}
                    </span>
                    <span className="font-mono font-bold">
                      {model.totalProfitCents == null ? "—" : money(model.totalProfitCents)}
                    </span>
                  </p>
                  <p className="mt-0.5">
                    <span className="font-bold uppercase tracking-wider text-neutral-600">
                      Margin:{" "}
                    </span>
                    <span className="font-mono">
                      {model.marginPct == null ? "—" : `${model.marginPct.toFixed(1)}%`}
                    </span>
                    {model.linesWithoutCost > 0 && (
                      <span className="text-[10px]"> (costed lines only)</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* WHAT THEY TOOK — the product rollup answers the owner's actual
              question; the order-by-order detail below answers "when". */}
          <section className="mb-7">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider">
              Products taken in this period
            </h2>
            <DocTable
              head={
                <>
                  <th className="px-2 py-1.5">Product</th>
                  <th className="px-2 py-1.5">SKU</th>
                  <th className="px-2 py-1.5 text-right">Total qty</th>
                  <th className="px-2 py-1.5 text-right">Total amount</th>
                  {internal && <th className="px-2 py-1.5 text-right">Cost</th>}
                  {internal && <th className="px-2 py-1.5 text-right">Profit</th>}
                </>
              }
            >
              {products.map((p) => {
                const cost = "costCents" in p ? p.costCents : null;
                const profit = "profitCents" in p ? p.profitCents : null;
                return (
                  <tr key={p.sku}>
                    <td className={docCell}>{p.name}</td>
                    <td className={`${docCell} font-mono text-[11px]`}>{p.sku}</td>
                    <td className={docCellRight}>{p.qty}</td>
                    <td className={docCellRight}>{money(p.amountCents)}</td>
                    {internal && (
                      <td className={docCellRight}>{cost == null ? "—" : money(cost)}</td>
                    )}
                    {internal && (
                      <td className={docCellRight}>{profit == null ? "—" : money(profit)}</td>
                    )}
                  </tr>
                );
              })}
            </DocTable>
          </section>

          {/* Order-by-order detail — ONE flat table so a single header repeats
              across every printed page (approved D-S7). */}
          <section>
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider">
              Orders in this period
            </h2>
            <DocTable
              head={
                <>
                  <th className="px-2 py-1.5">Item</th>
                  <th className="px-2 py-1.5">SKU</th>
                  <th className="px-2 py-1.5 text-right">Qty</th>
                  <th className="px-2 py-1.5 text-right">Unit price</th>
                  <th className="px-2 py-1.5 text-right">Line total</th>
                  {internal && <th className="px-2 py-1.5 text-right">Unit cost</th>}
                  {internal && <th className="px-2 py-1.5 text-right">Line profit</th>}
                </>
              }
              foot={
                <tr className="border-t-2 border-black">
                  <td colSpan={4} className="px-2 py-2 text-right text-sm font-bold">
                    Total for the period
                  </td>
                  {/* Sits under "Line total" on BOTH copies — a money figure
                      parked under a "Line profit" heading is misreading bait. */}
                  <td className="px-2 py-2 text-right font-mono text-sm font-bold">
                    {money(model.totalCents)}
                  </td>
                  {internal && <td className="px-2 py-2" />}
                  {internal && <td className="px-2 py-2" />}
                </tr>
              }
            >
              {orders.map((o) => (
                <OrderBlock key={o.orderId} order={o} internal={internal} cols={cols} />
              ))}
            </DocTable>
          </section>
        </>
      )}

      {/* Context sections — listed, never counted (approved D-S3). */}
      <AsideSection
        heading="Awaiting confirmation"
        note="Placed in this period but not yet accepted — NOT included in the total above."
        rows={model.awaiting}
      />
      <AsideSection
        heading="Cancelled orders"
        note="Cancelled in this period — listed for reference only, contributing nothing to the total above."
        rows={model.cancelled}
      />

      <p className="mt-8 text-[10px] text-neutral-600">
        This statement lists orders placed in the period shown. It is not an account ledger: it
        records no payments and shows no balance.
      </p>
    </DocumentShell>
  );
}
