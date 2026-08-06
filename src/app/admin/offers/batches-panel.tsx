"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { undoConfirmationText, type BatchSummary } from "@/lib/admin/bulk-offers";
import { undoOfferBatch } from "./actions";

// CP-8a-2 "Applied batches": one-click undo, treated as MORE important than
// the apply. The confirmation is unmistakable about scope by construction —
// undoConfirmationText names the one offer, the exact remaining count, what
// was already removed individually, and that nothing else is touched. The
// DELETE is scoped by batch identity, so touching an outside row is
// structurally impossible.

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { dateStyle: "medium", timeZone: "America/Toronto" });

export function BatchesPanel({ batches }: { batches: BatchSummary[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (batches.length === 0 && !notice) return null;

  async function undo(b: BatchSummary) {
    if (!window.confirm(undoConfirmationText(b))) return;
    setBusy(true);
    const res = await undoOfferBatch(b.batchId);
    setBusy(false);
    if (!res.ok) {
      window.alert(res.message);
      return;
    }
    setNotice(
      res.alreadyUndone
        ? "This batch was already undone — nothing left to remove."
        : `Removed "${b.title}" from ${res.removed} customer${res.removed === 1 ? "" : "s"}. No other offer was touched.`,
    );
    router.refresh();
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface">
      <header className="border-b border-[var(--border)] bg-brand-mist/30 px-5 py-3">
        <h2 className="font-display text-sm font-semibold text-brand-deep">
          Applied batches ({batches.length})
        </h2>
        <p className="text-xs text-muted">
          Bulk applications, derived from the offer rows themselves. Undo removes exactly one
          batch — never anything else.
        </p>
      </header>
      {notice && (
        <p className="border-b border-[var(--border)] bg-brand-mist/20 px-5 py-2.5 text-xs font-medium text-brand-deep">
          {notice}
        </p>
      )}
      {batches.map((b) => (
        <div
          key={b.batchId}
          className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3 last:border-b-0"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-deep">
              {b.title}
              {!b.live && (
                <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  NO LONGER LIVE
                </span>
              )}
            </p>
            <p className="text-xs text-muted">
              applied {fmtDay(b.appliedAt)} to {b.originalSize} customer
              {b.originalSize === 1 ? "" : "s"}
              {b.removedIndividually > 0 &&
                ` · ${b.remaining} remain (${b.removedIndividually} removed individually)`}
              {b.endsAt ? ` · ends ${fmtDay(b.endsAt)}` : " · no end date"}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => undo(b)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-surface px-4 py-1.5 text-xs font-semibold text-foreground/80 hover:border-red-400 hover:text-red-700 disabled:opacity-50"
          >
            <Undo2 size={13} /> Undo batch ({b.remaining})
          </button>
        </div>
      ))}
    </section>
  );
}
