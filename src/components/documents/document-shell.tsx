// The minimal identity shape a document needs — satisfied by both the full
// BusinessIdentity config and the invoice model's embedded business block.
export type DocBusiness = {
  displayName: string;
  legalName: string;
  address: string;
  phone: string;
  email: string;
  taxEnabled: boolean;
  taxNumber: string | null;
};

// CP-6 document layer — the reusable shell every printable document composes
// (invoice, statements; CP-7 customer statements and CP-8 reports compose the
// same pieces without touching print CSS again). Pure presentational: NOTHING
// here imports data code, and no cost value can enter except through an
// explicitly-internal statement model.
//
// On screen: a paper-like sheet with a print:hidden toolbar. In print: the
// app chrome disappears (print:hidden + .doc-chrome-hidden), the sheet
// flattens to the page, tables repeat headers and never split rows
// (globals.css .doc-table), and a fixed watermark repeats on every page.

export function DocumentShell({
  business,
  title,
  subtitle,
  watermark,
  internalBanner,
  children,
  footerNote,
}: {
  business: DocBusiness;
  title: string;
  subtitle?: string;
  watermark?: string | null; // e.g. "CANCELLED" — repeats on every printed page
  internalBanner?: string | null; // e.g. INTERNAL marking — prominent, top of page
  children: React.ReactNode;
  footerNote?: string;
}) {
  return (
    <div className="doc-sheet mx-auto my-6 max-w-3xl rounded-xl border border-[var(--border)] bg-white p-10 text-[13px] leading-relaxed text-black shadow-lg print:my-0">
      {watermark && (
        <div className="doc-watermark" aria-hidden>
          <span>{watermark}</span>
        </div>
      )}
      {internalBanner && <div className="doc-internal-banner mb-6">{internalBanner}</div>}

      {/* Brand header — Olleik identity on every document. */}
      <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-4">
        <div>
          <p className="font-display text-2xl font-bold tracking-tight">
            {business.displayName}
          </p>
          <p className="mt-1 whitespace-pre-line text-[11px] text-neutral-700">
            {business.legalName}
            {"\n"}
            {business.address}
            {"\n"}
            {business.phone} · {business.email}
          </p>
          {/* Tax number renders here ONLY once tax is enabled (dormant now). */}
          {business.taxEnabled && business.taxNumber && (
            <p className="mt-1 text-[11px] text-neutral-700">Tax #: {business.taxNumber}</p>
          )}
        </div>
        <div className="text-right">
          <h1 className="text-xl font-bold uppercase tracking-widest">{title}</h1>
          {subtitle && <p className="mt-1 text-[11px] text-neutral-700">{subtitle}</p>}
        </div>
      </header>

      <div className="pt-5">{children}</div>

      <footer className="mt-8 border-t border-neutral-300 pt-3 text-[10px] text-neutral-600">
        {footerNote ?? `${business.displayName} — generated ${new Date().toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" })}`}
      </footer>
    </div>
  );
}

// The shared table: .doc-table gets the repeating-header / no-split-row print
// behaviour from globals.css. Black borders — fully legible in B&W.
export function DocTable({
  head,
  children,
  foot,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
  foot?: React.ReactNode;
}) {
  return (
    <table className="doc-table w-full border-collapse text-[12px]">
      <thead>
        <tr className="border-b-2 border-black text-left text-[10px] font-bold uppercase tracking-wider">
          {head}
        </tr>
      </thead>
      <tbody>{children}</tbody>
      {foot && <tfoot>{foot}</tfoot>}
    </table>
  );
}

export const docCell = "border-b border-neutral-300 px-2 py-1.5 align-top";
export const docCellRight = `${docCell} text-right font-mono`;
