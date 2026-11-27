"use client";

import { Printer } from "lucide-react";

// "Save as PDF" is the browser's own print dialog, as on every other document in the system.
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-deep"
    >
      <Printer size={15} aria-hidden /> Print / Save as PDF
    </button>
  );
}
