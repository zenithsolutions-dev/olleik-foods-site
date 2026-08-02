"use client";

import Link from "next/link";
import { Printer, ArrowLeft } from "lucide-react";

// CP-6: the on-screen toolbar above a document preview. Never prints
// (print:hidden). "Print / Save as PDF" opens the browser dialog — Save as
// PDF is the approved download path (D-C1).

export function PrintToolbar({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <div className="doc-chrome-hidden mx-auto flex max-w-3xl items-center justify-between gap-3 pt-6 print:hidden">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-accent"
      >
        <ArrowLeft size={15} /> {backLabel}
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-deep"
      >
        <Printer size={15} /> Print / Save as PDF
      </button>
    </div>
  );
}
