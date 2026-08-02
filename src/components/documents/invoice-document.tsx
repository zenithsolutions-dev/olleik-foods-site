import type { InvoiceModel } from "@/lib/documents/invoice-model";
import { DocumentShell, DocTable, docCell, docCellRight } from "./document-shell";

// CP-6: the ONE invoice renderer — the admin order page and the customer
// portal render the SAME component from the SAME cost-free model. Pure
// presentational; figures arrive frozen from the order snapshot.

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function InvoiceDocument({ model }: { model: InvoiceModel }) {
  return (
    <DocumentShell
      business={model.business}
      title="Invoice"
      subtitle={`${model.documentNumber} · ${new Date(model.issuedAt).toLocaleDateString("en-CA", { dateStyle: "long", timeZone: "America/Toronto" })}`}
      watermark={model.cancelled ? "Cancelled" : null}
      footerNote={`${model.business.displayName} · ${model.documentNumber} · full reference ${model.orderIdFull}`}
    >
      {model.integrityWarning && (
        <p className="doc-internal-banner mb-4 text-[11px]">{model.integrityWarning}</p>
      )}

      {/* Parties + order meta */}
      <div className="mb-6 grid grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
            Billed to
          </p>
          <p className="mt-1 font-semibold">{model.billTo.businessName}</p>
          <p className="text-[11px] text-neutral-700">
            {model.billTo.contactName}
            <br />
            {model.billTo.address ? (
              <>
                {model.billTo.address}
                <br />
              </>
            ) : null}
            {model.billTo.phone} · {model.billTo.email}
          </p>
        </div>
        <div className="text-right text-[11px]">
          <p>
            <span className="font-bold uppercase tracking-wider text-neutral-600">Status: </span>
            <span className="font-semibold uppercase">{model.status}</span>
          </p>
          <p className="mt-0.5">
            <span className="font-bold uppercase tracking-wider text-neutral-600">
              Fulfillment:{" "}
            </span>
            {model.fulfillment}
          </p>
          <p className="mt-0.5">
            <span className="font-bold uppercase tracking-wider text-neutral-600">
              Payment terms:{" "}
            </span>
            {model.paymentTerms}
          </p>
        </div>
      </div>

      <DocTable
        head={
          <>
            <th className="px-2 py-1.5">Item</th>
            <th className="px-2 py-1.5">SKU</th>
            <th className="px-2 py-1.5 text-right">Qty</th>
            <th className="px-2 py-1.5 text-right">Unit price</th>
            <th className="px-2 py-1.5 text-right">Line total</th>
          </>
        }
        foot={
          <>
            {/* Tax rows are DORMANT: while taxCents is null a single Total row
                renders. When tax is enabled, Subtotal/Tax/Total appear — the
                document layer itself needs no change (approved design). */}
            {model.taxCents != null && (
              <>
                <tr>
                  <td colSpan={4} className="px-2 py-1.5 text-right font-semibold">
                    Subtotal
                  </td>
                  <td className={docCellRight}>{money(model.subtotalCents)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-2 py-1.5 text-right font-semibold">
                    Tax
                  </td>
                  <td className={docCellRight}>{money(model.taxCents)}</td>
                </tr>
              </>
            )}
            <tr className="border-t-2 border-black">
              <td colSpan={4} className="px-2 py-2 text-right text-sm font-bold">
                Total
              </td>
              <td className="px-2 py-2 text-right font-mono text-sm font-bold">
                {money(model.totalCents)}
              </td>
            </tr>
          </>
        }
      >
        {model.lines.map((l) => (
          <tr key={`${l.sku}-${l.name}`}>
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
          </tr>
        ))}
      </DocTable>

      {model.notes && (
        <p className="mt-5 text-[11px]">
          <span className="font-bold uppercase tracking-wider text-neutral-600">Notes: </span>
          {model.notes}
        </p>
      )}
      {model.cancelled && (
        <p className="mt-5 border border-black p-2 text-center text-[11px] font-bold uppercase tracking-wider">
          This order was cancelled — document kept for record only.
        </p>
      )}
    </DocumentShell>
  );
}
