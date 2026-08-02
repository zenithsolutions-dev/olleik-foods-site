"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { PRESET_LABELS, RANGE_PRESETS, type RangePreset, type ResolvedRange } from "@/lib/dates";

// CP-5 shared date-range control — the ONE implementation used by every
// filtered surface (admin lists, dashboard, customer portal). Plain GET form
// (the portal-catalog pattern): the range lives in the URL, so it's
// shareable, bookmarkable, and survives the CP-3d live refreshes untouched.
//
// Owner requirements baked in:
//   * the active period is unmistakable — the "Showing: …" chip is part of
//     the control, and callers also put range.label in their figures/titles;
//   * corrected input is REPORTED (swap/invalid notices from resolveDateRange
//     render right here, never silently);
//   * "Clear" is a working affordance whenever a non-default range is active.

export function DateRangeFilter({
  basePath,
  range,
  keepParams = {},
  defaultPreset = "all",
}: {
  basePath: string; // e.g. "/admin/orders"
  range: ResolvedRange; // resolved server-side by resolveDateRange
  keepParams?: Record<string, string | undefined>; // other filters to preserve
  defaultPreset?: RangePreset; // what "no range in the URL" means on this page
}) {
  const [preset, setPreset] = useState<RangePreset>(range.preset);
  const formRef = useRef<HTMLFormElement | null>(null);

  const kept = Object.entries(keepParams).filter(([, v]) => v != null && v !== "");
  const clearHref = (() => {
    const sp = new URLSearchParams();
    for (const [k, v] of kept) sp.set(k, v as string);
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  })();

  const toInputDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

  return (
    <div className="space-y-1.5">
      <form
        ref={formRef}
        method="get"
        action={basePath}
        className="flex flex-wrap items-center gap-2"
      >
        {kept.map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <label className="flex items-center gap-2 text-xs font-medium text-muted">
          Period
          <select
            name="range"
            value={preset}
            onChange={(e) => {
              const next = e.target.value as RangePreset;
              setPreset(next);
              // Presets apply immediately; Custom waits for dates + Apply.
              if (next !== "custom") formRef.current?.requestSubmit();
            }}
            className="rounded-full border border-[var(--border-strong)] bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand"
          >
            {RANGE_PRESETS.map((p) => (
              <option key={p} value={p}>
                {PRESET_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        {preset === "custom" && (
          <>
            <input
              type="date"
              name="from"
              defaultValue={range.preset === "custom" ? toInputDate(range.startUTC) : ""}
              aria-label="From date"
              className="rounded-full border border-[var(--border-strong)] bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand"
            />
            <span className="text-xs text-muted">to</span>
            <input
              type="date"
              name="to"
              defaultValue={
                range.preset === "custom" && range.endUTC
                  ? // endUTC is the exclusive next-midnight; show the inclusive day.
                    new Date(range.endUTC.getTime() - 12 * 60 * 60 * 1000)
                      .toISOString()
                      .slice(0, 10)
                  : ""
              }
              aria-label="To date"
              className="rounded-full border border-[var(--border-strong)] bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand"
            />
            <button
              type="submit"
              className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-deep"
            >
              Apply
            </button>
          </>
        )}
        {/* The at-a-glance period chip: any screenshot of a filtered figure
            includes what period it covers. */}
        <span className="rounded-full bg-brand-mist/60 px-3 py-1 text-xs font-semibold text-brand-deep">
          Showing: {range.label}
        </span>
        {range.preset !== defaultPreset && (
          <Link href={clearHref} className="text-xs font-medium text-brand hover:text-accent">
            Clear range
          </Link>
        )}
      </form>
      {range.notice && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
          {range.notice}
        </p>
      )}
    </div>
  );
}
