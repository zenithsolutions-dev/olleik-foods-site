import type { BusinessIdentity } from "@/lib/business";
import type { StockStatementModel } from "@/lib/documents/statement-models";
import { DocumentShell, DocTable, docCell } from "./document-shell";

// CP-6: renderer for the "as of now" stock statements (low stock /
// unavailable). Severity is TEXT (OVERSOLD BY N / OUT OF STOCK / LOW) — fully
// legible in black and white, never colour-coded alone.

export function StockStatementDocument({
  business,
  model,
}: {
  business: BusinessIdentity;
  model: StockStatementModel;
}) {
  return (
    <DocumentShell
      business={business}
      title={model.title}
      subtitle={`As of ${new Date(model.asOfISO).toLocaleString("en-CA", { dateStyle: "long", timeStyle: "short", timeZone: "America/Toronto" })}`}
    >
      {model.lines.length === 0 ? (
        <p className="border border-neutral-400 p-6 text-center text-[12px]">
          Nothing to report — no products match this statement right now.
        </p>
      ) : (
        <DocTable
          head={
            <>
              <th className="px-2 py-1.5">SKU</th>
              <th className="px-2 py-1.5">Product</th>
              <th className="px-2 py-1.5">Severity</th>
              <th className="px-2 py-1.5">Detail</th>
            </>
          }
        >
          {model.lines.map((l) => (
            <tr key={l.sku}>
              <td className={`${docCell} font-mono text-[11px]`}>{l.sku}</td>
              <td className={docCell}>{l.name}</td>
              <td className={`${docCell} font-bold`}>{l.severity}</td>
              <td className={docCell}>{l.detail}</td>
            </tr>
          ))}
        </DocTable>
      )}
      <p className="mt-4 text-[10px] text-neutral-600">
        {model.lines.length} item{model.lines.length === 1 ? "" : "s"} · oversold items are listed
        first and marked in words for black-and-white printing.
      </p>
    </DocumentShell>
  );
}
