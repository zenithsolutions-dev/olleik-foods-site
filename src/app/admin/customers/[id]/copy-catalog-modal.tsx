"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { CopySource } from "./page";

// Copy another customer's assignments (and optionally their custom prices) onto
// this customer. Mode + prices are runtime choices. Overwrite is DESTRUCTIVE —
// it requires an explicit window.confirm spelling out exactly what is lost
// BEFORE the parent action deletes anything.
export function CopyCatalogModal({
  targetName,
  targetAssignedCount,
  sources,
  busy,
  onClose,
  onCopy,
}: {
  targetName: string;
  targetAssignedCount: number;
  sources: CopySource[];
  busy: boolean;
  onClose: () => void;
  onCopy: (sourceId: string, mode: "merge" | "overwrite", prices: "copy" | "list") => void;
}) {
  const [sourceId, setSourceId] = useState<string>(sources[0]?.id ?? "");
  const [mode, setMode] = useState<"merge" | "overwrite">("merge");
  const [prices, setPrices] = useState<"copy" | "list">("copy");

  const source = sources.find((s) => s.id === sourceId);
  const sourceCount = source?.assignedCount ?? 0;

  function submit() {
    if (!source) return;
    if (mode === "overwrite") {
      const ok = window.confirm(
        `Overwrite ${targetName}'s entire catalog?\n\n` +
          `This permanently DELETES all ${targetAssignedCount} of their current product ` +
          `assignment(s) and any custom prices, then replaces them with ${source.businessName}'s ` +
          `catalog. This cannot be undone.`,
      );
      if (!ok) return;
    }
    onCopy(source.id, mode, prices);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-deep/40 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="my-10 w-full max-w-lg rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-2xl"
      >
        <h3 className="font-display text-xl font-semibold text-brand-deep">Copy catalog from another customer</h3>
        <p className="mt-1 text-xs text-muted">
          Copies product assignments (and optionally custom prices) onto {targetName}. Inactive or
          removed products are skipped.
        </p>

        {sources.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-muted">
            No other customers to copy from yet.
          </p>
        ) : (
          <div className="mt-5 space-y-5">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
              <span className="uppercase tracking-wider">Copy from</span>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.businessName} ({s.assignedCount} product{s.assignedCount === 1 ? "" : "s"})
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium uppercase tracking-wider text-muted">When this customer already has products</legend>
              <Radio name="mode" checked={mode === "merge"} onChange={() => setMode("merge")} label="Merge — add only products they don't already have (keep their existing assignments and prices)" />
              <Radio name="mode" checked={mode === "overwrite"} onChange={() => setMode("overwrite")} label="Overwrite — replace their entire catalog" />
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium uppercase tracking-wider text-muted">Prices</legend>
              <Radio name="prices" checked={prices === "copy"} onChange={() => setPrices("copy")} label="Copy custom prices as-is" />
              <Radio name="prices" checked={prices === "list"} onChange={() => setPrices("list")} label="Assign at list price (no custom prices)" />
            </fieldset>

            {mode === "overwrite" ? (
              <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>
                  This deletes {targetName}&apos;s current {targetAssignedCount} assignment
                  {targetAssignedCount === 1 ? "" : "s"} and custom prices, replacing them with{" "}
                  {sourceCount} from {source?.businessName ?? "the selected customer"}. You&apos;ll
                  be asked to confirm.
                </span>
              </p>
            ) : (
              <p className="rounded-lg border border-[var(--border)] bg-brand-mist/40 px-3 py-2.5 text-xs text-muted">
                Adds up to {sourceCount} product{sourceCount === 1 ? "" : "s"} this customer doesn&apos;t
                already have. Existing assignments and prices are kept.
              </p>
            )}
          </div>
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
            disabled={busy || !source}
            onClick={submit}
            className={`rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              mode === "overwrite" ? "bg-red-600 hover:bg-red-700" : "bg-accent hover:bg-accent-deep"
            }`}
          >
            {busy ? "Copying…" : mode === "overwrite" ? "Overwrite catalog" : "Copy products"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Radio({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="mt-0.5 accent-accent" />
      <span>{label}</span>
    </label>
  );
}
