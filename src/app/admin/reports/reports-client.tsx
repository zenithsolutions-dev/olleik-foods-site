"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import type { InvoiceBusiness } from "@/lib/documents/invoice-model";
import {
  buildReportModel,
  PRESET_DEFS,
  REPORT_PRESETS,
  REPORT_SECTIONS,
  SECTION_LABELS,
  type ReportInputs,
  type ReportPreset,
  type ReportSectionKey,
} from "@/lib/documents/report-model";
import { ReportDocument } from "@/components/documents/report-document";
import type { AnalyticsSource } from "@/lib/admin/analytics-data";
import type { ReactNode } from "react";

// CP-8c report builder UI: tick sections on the left, watch the LIVE preview
// on the right, print via the CP-6 layer. Ticks sync into the URL
// (history.replaceState — no refetch needed; the inputs for this range are
// already here), so a configured report is a bookmark. The INTERNAL state is
// read off the BUILT MODEL, never computed here — the pure builder is the
// only authority.

export function ReportsClient({
  business,
  inputs,
  initialTicked,
  activePreset,
  periodLabel,
  periodNotice,
  analyticsSource,
  rangeFilter,
}: {
  business: InvoiceBusiness;
  inputs: ReportInputs;
  initialTicked: ReportSectionKey[];
  activePreset: ReportPreset | null;
  periodLabel: string;
  periodNotice: string | null;
  analyticsSource: AnalyticsSource;
  rangeFilter: ReactNode;
}) {
  const [ticked, setTicked] = useState<Set<ReportSectionKey>>(new Set(initialTicked));

  // Keep the URL a bookmark of the current configuration.
  useEffect(() => {
    const spx = new URLSearchParams(window.location.search);
    spx.set("sections", [...ticked].join(","));
    if (ticked.size === 0) spx.set("sections", "");
    window.history.replaceState(null, "", `/admin/reports?${spx.toString()}`);
  }, [ticked]);

  const model = useMemo(
    () =>
      buildReportModel({
        ticked: [...ticked],
        inputs,
        business,
        periodLabel,
        periodNotice,
        generatedAt: new Date(),
      }),
    [ticked, inputs, business, periodLabel, periodNotice],
  );

  const presetHref = (p: ReportPreset) => {
    // A preset link RESETS sections + range to its definition (that's what a
    // preset is); the current custom range is deliberately not carried.
    return `/admin/reports?preset=${p}`;
  };

  return (
    <div>
      <header className="doc-chrome-hidden mb-6 print:hidden">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
          Reports
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          Report builder
        </h1>
        <p className="mt-2 text-sm text-muted">
          Tick what goes in, check the preview, print. Same figures as Analytics and the dashboard
          — one family of numbers.
        </p>
        {analyticsSource === "fallback" && (
          <p className="mt-3 rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            Aggregating in the app — migration 0014 isn&apos;t applied yet. Figures are correct.
          </p>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* ---------- builder column (never prints) ---------- */}
        <div className="doc-chrome-hidden space-y-5 print:hidden">
          <section className="rounded-2xl border border-[var(--border)] bg-surface p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Presets</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {REPORT_PRESETS.map((p) => (
                <Link
                  key={p}
                  href={presetHref(p)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${
                    activePreset === p
                      ? "bg-accent text-white"
                      : "border border-[var(--border-strong)] text-muted hover:text-foreground"
                  }`}
                >
                  {PRESET_DEFS[p].label}
                </Link>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted">
              A preset pre-ticks its sections and period — adjust anything before printing. For
              buying decisions, the as-of-now{" "}
              <Link href="/admin/documents/low-stock" className="font-medium text-brand hover:text-accent">
                low-stock statement
              </Link>{" "}
              prints separately.
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-surface p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Period</h2>
            <div className="mt-2">{rangeFilter}</div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-surface p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Sections</h2>
            <div className="mt-2 space-y-1.5">
              {REPORT_SECTIONS.map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-brand-mist/20"
                >
                  <input
                    type="checkbox"
                    checked={ticked.has(key)}
                    onChange={() =>
                      setTicked((s) => {
                        const n = new Set(s);
                        if (n.has(key)) n.delete(key);
                        else n.add(key);
                        return n;
                      })
                    }
                  />
                  <span className={key === "profit" ? "font-semibold" : ""}>
                    {SECTION_LABELS[key]}
                  </span>
                </label>
              ))}
            </div>
            {model.internal && (
              <p className="mt-3 rounded-lg border-2 border-black bg-neutral-900 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white">
                Internal report — includes cost &amp; profit. Banner and watermark are automatic
                and cannot be removed while the section is in.
              </p>
            )}
          </section>

          <button
            type="button"
            onClick={() => window.print()}
            disabled={model.isEmpty}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-50"
          >
            <Printer size={15} /> {model.isEmpty ? "Tick a section to print" : "Print / Save as PDF"}
          </button>
        </div>

        {/* ---------- live preview = the document ---------- */}
        <div className="min-w-0">
          <ReportDocument model={model} />
        </div>
      </div>
    </div>
  );
}
