"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/admin/store";
import { marginSourceLabel } from "@/lib/admin/pricing-engine";
import {
  previewRecompute,
  applyRecompute,
  type RecomputePreview,
} from "../../pricing/actions";

// Recompute this customer's prices from the current costs + margin rules, with
// a MANDATORY before/after preview (nothing is written until Apply). Manual
// prices are skipped unless the admin explicitly opts in (default OFF).
export function RecomputeModal({
  customerId,
  customerName,
  onClose,
  onApplied,
}: {
  customerId: string;
  customerName: string;
  onClose: () => void;
  onApplied: (updated: number) => void;
}) {
  const [includeManual, setIncludeManual] = useState(false);
  const [preview, setPreview] = useState<RecomputePreview | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadPreview(nextIncludeManual: boolean) {
    setBusy(true);
    const p = await previewRecompute({ kind: "customer", customerId }, nextIncludeManual);
    setBusy(false);
    setPreview(p);
  }

  async function apply() {
    if (!preview || !preview.ok) return;
    setBusy(true);
    const res = await applyRecompute(
      { kind: "customer", customerId },
      includeManual,
      preview.willChange,
    );
    setBusy(false);
    if (!res.ok) {
      window.alert(res.message);
      setPreview(null); // stale — force a fresh preview
      return;
    }
    onApplied(res.updated);
  }

  const ok = preview?.ok ? preview : null;
  const changed = ok ? ok.rows.filter((r) => r.willChange) : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-deep/40 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="my-10 w-full max-w-3xl rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-2xl"
      >
        <h3 className="font-display text-xl font-semibold text-brand-deep">
          Recompute prices — {customerName}
        </h3>
        <p className="mt-1 text-xs text-muted">
          Re-runs the margin waterfall (costs + current rules) over this customer&apos;s assigned
          products. Nothing is written until you apply. Manual prices are kept unless you opt in.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={includeManual}
              onChange={(e) => {
                setIncludeManual(e.target.checked);
                setPreview(null);
              }}
              className="accent-accent"
            />
            Also reset manual prices
            <span className="text-xs text-muted-soft">(off = manual prices are protected)</span>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => loadPreview(includeManual)}
            className="rounded-full border border-[var(--border-strong)] px-4 py-1.5 text-sm font-medium text-foreground/80 hover:border-accent disabled:opacity-50"
          >
            {busy && !preview ? "Previewing…" : "Preview changes"}
          </button>
        </div>

        {preview && !preview.ok && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{preview.message}</p>
        )}

        {ok && (
          <>
            <div className="mt-5 grid gap-3 rounded-xl border border-[var(--border)] bg-brand-mist/30 p-4 sm:grid-cols-4">
              <Stat label="Will change" value={String(ok.willChange)} />
              <Stat label="Skipped (manual)" value={String(ok.skippedManual)} />
              <Stat
                label="Revenue Δ"
                value={`${ok.newTotalCents - ok.oldTotalCents >= 0 ? "+" : "−"}${formatMoney(Math.abs(ok.newTotalCents - ok.oldTotalCents))}`}
              />
              <Stat
                label="Profit Δ"
                value={`${ok.newProfitCents - ok.oldProfitCents >= 0 ? "+" : "−"}${formatMoney(Math.abs(ok.newProfitCents - ok.oldProfitCents))}`}
                accent={ok.newProfitCents - ok.oldProfitCents >= 0 ? "green" : "red"}
              />
            </div>

            {changed.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-muted">
                Everything is already at the rule-computed price — nothing to change.
              </p>
            ) : (
              <div className="mt-4 max-h-[320px] overflow-y-auto rounded-xl border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-brand-mist/40 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">
                      <th className="px-4 py-2">Product</th>
                      <th className="px-4 py-2 text-right">Old price</th>
                      <th className="px-4 py-2 text-right">New price</th>
                      <th className="px-4 py-2">Rule</th>
                      <th className="px-4 py-2 text-right">Profit Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changed.map((r) => {
                      const profitDelta =
                        r.costCents != null
                          ? r.newPriceCents - r.oldPriceCents // same cost cancels out
                          : null;
                      return (
                        <tr key={`${r.customerId}:${r.productId}`} className="border-t border-[var(--border)]">
                          <td className="px-4 py-2">{r.productName}</td>
                          <td className="px-4 py-2 text-right font-mono text-muted line-through">
                            {formatMoney(r.oldPriceCents)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono font-semibold">
                            {formatMoney(r.newPriceCents)}
                          </td>
                          <td className="px-4 py-2 text-xs text-muted">
                            {marginSourceLabel(r.sourceLabelData)}
                          </td>
                          <td
                            className={`px-4 py-2 text-right font-mono ${
                              profitDelta == null
                                ? "text-muted-soft"
                                : profitDelta >= 0
                                  ? "text-emerald-700"
                                  : "text-red-700"
                            }`}
                          >
                            {profitDelta != null
                              ? `${profitDelta >= 0 ? "+" : "−"}${formatMoney(Math.abs(profitDelta))}`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {ok.totalRows > ok.rows.length && (
                  <p className="border-t border-[var(--border)] px-4 py-2 text-xs text-muted">
                    Showing the first {ok.rows.length} of {ok.totalRows} rows — totals cover everything.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium text-foreground/80 hover:border-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !ok || ok.willChange === 0}
            onClick={apply}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
          >
            {busy && preview ? "Applying…" : `Apply ${ok?.willChange ?? 0} change${(ok?.willChange ?? 0) === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "green" | "red" }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p
        className={`mt-0.5 font-mono text-base font-semibold ${
          accent === "green" ? "text-emerald-700" : accent === "red" ? "text-red-700" : "text-brand-deep"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
