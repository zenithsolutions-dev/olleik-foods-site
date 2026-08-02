"use client";

import { useState } from "react";
import type { BusinessIdentity } from "@/lib/business";
import {
  buildProductStatementModel,
  type StatementProductInput,
} from "@/lib/documents/statement-models";
import { DocumentShell, DocTable, docCell, docCellRight } from "@/components/documents/document-shell";

// CP-6 full product statement. The INTERNAL cost toggle is deliberately
// session-only React state: default OFF on EVERY page load, never persisted,
// never in the URL — an accidental print is always the safe version. When ON,
// the model itself becomes internal and the document is stamped with a
// prominent INTERNAL banner (top of page, bold black band — unmistakable in
// black and white).

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function ProductStatementClient({
  business,
  products,
  periodLabel,
}: {
  business: BusinessIdentity;
  products: StatementProductInput[];
  periodLabel: string;
}) {
  const [includeCosts, setIncludeCosts] = useState(false); // ALWAYS starts off
  const model = buildProductStatementModel(products, { includeCosts, periodLabel });

  return (
    <div>
      <div className="doc-chrome-hidden mx-auto mt-2 flex max-w-3xl items-center justify-end print:hidden">
        <label className="flex items-center gap-2 rounded-full border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
          <input
            type="checkbox"
            checked={includeCosts}
            onChange={(e) => setIncludeCosts(e.target.checked)}
          />
          Include cost &amp; profit columns (INTERNAL — resets on every visit)
        </label>
      </div>

      <DocumentShell
        business={business}
        title={model.internal ? "Product list — internal" : "Product list"}
        subtitle={`Period: ${model.periodLabel}`}
        internalBanner={
          model.internal ? "INTERNAL DOCUMENT — INCLUDES COST DATA — DO NOT HAND OUT" : null
        }
      >
        {model.lines.length === 0 ? (
          <p className="border border-neutral-400 p-6 text-center text-[12px]">
            No products match this period — widen or clear the date range.
          </p>
        ) : (
          <DocTable
            head={
              <>
                <th className="px-2 py-1.5">SKU</th>
                <th className="px-2 py-1.5">Product</th>
                <th className="px-2 py-1.5">Category</th>
                <th className="px-2 py-1.5">Unit</th>
                <th className="px-2 py-1.5 text-right">List price</th>
                {model.internal && (
                  <>
                    <th className="px-2 py-1.5 text-right">Cost</th>
                    <th className="px-2 py-1.5 text-right">Profit @ list</th>
                  </>
                )}
                <th className="px-2 py-1.5">Stock</th>
              </>
            }
          >
            {model.lines.map((l) => (
              <tr key={l.sku}>
                <td className={`${docCell} font-mono text-[11px]`}>{l.sku}</td>
                <td className={docCell}>
                  {l.name}
                  {!l.active && <span className="ml-1 font-bold"> (INACTIVE)</span>}
                </td>
                <td className={docCell}>{l.categoryLabel ?? "—"}</td>
                <td className={docCell}>{l.unitLabel}</td>
                <td className={docCellRight}>{money(l.listPriceCents)}</td>
                {model.internal && "costCents" in l && (
                  <>
                    <td className={docCellRight}>
                      {l.costCents != null ? money(l.costCents) : "—"}
                    </td>
                    <td className={docCellRight}>
                      {l.profitAtListCents != null ? money(l.profitAtListCents) : "—"}
                    </td>
                  </>
                )}
                <td className={docCell}>{l.stockLabel}</td>
              </tr>
            ))}
          </DocTable>
        )}
        <p className="mt-4 text-[10px] text-neutral-600">
          {model.lines.length} product{model.lines.length === 1 ? "" : "s"} · period:{" "}
          {model.periodLabel}
        </p>
      </DocumentShell>
    </div>
  );
}
