"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/admin/store";
import { BUCKET_LABELS, type BucketSize, type RevenueBucket } from "@/lib/admin/analytics-buckets";

// CP-8 charts follow-on — SCREEN ONLY (print:hidden; documents stay tables,
// per CP-6). Exactly two charts, as ruled:
//   1. Revenue over the period — the "am I growing?" trend a table can't show.
//   2. Best sellers — fast visual comparison of the top products.
//
// ANIMATION CONTRACT (the requirement that matters more than the animation):
// the entry animation runs on first render and when the PERIOD changes — the
// parent keys this component on `${periodLabel}:${bucket}`, so a new period
// remounts and re-animates. The CP-3d 30s refresh does NOT remount (stable
// key, same tree position), so recharts interpolates changed values smoothly
// in place — no re-entry animation while the owner is reading.
//
// Honesty rules: Y axes pinned to 0 (no truncated-axis growth illusions),
// the bucket size is stated ON the chart, currency via the shared formatMoney.

const AXIS_TICK = { fontSize: 11, fill: "var(--muted, #6b7280)" } as const;
const money = (cents: number) => formatMoney(cents);
const moneyAxis = (cents: number) =>
  cents >= 100_000 ? `$${Math.round(cents / 100_000) / 10}k` : `$${Math.round(cents / 100)}`;

function ChartCard({
  title,
  period,
  note,
  children,
}: {
  title: string;
  period: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-surface p-5 print:hidden">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-brand-deep">
          {title} <span className="text-sm font-normal text-muted">— {period}</span>
        </h2>
        {/* The bucket/basis stated on the chart itself — screenshots are
            never ambiguous (CP-5 rule). */}
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted">{note}</span>
      </div>
      {children}
    </section>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <p className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm text-muted">
      {message}
    </p>
  );
}

export function RevenueTrendChart({
  series,
  bucket,
  periodLabel,
}: {
  series: RevenueBucket[];
  bucket: BucketSize;
  periodLabel: string;
}) {
  const hasRevenue = series.some((b) => b.revenueCents > 0);
  return (
    <ChartCard
      title="Revenue trend"
      period={periodLabel}
      note={`${BUCKET_LABELS[bucket]} · America/Toronto · accepted orders`}
    >
      {series.length === 0 || !hasRevenue ? (
        <EmptyChart message={`No counted revenue in this period (${periodLabel}).`} />
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent, #c87a2a)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--accent, #c87a2a)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e5e7eb)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
              {/* domain floor pinned to 0 — never a truncated axis */}
              <YAxis tickFormatter={moneyAxis} tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} domain={[0, "auto"]} allowDataOverflow={false} />
              <Tooltip
                formatter={(v) => [money(Number(v)), "Revenue"]}
                labelFormatter={(l) => `${l} · ${BUCKET_LABELS[bucket]}`}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Area
                type="monotone"
                dataKey="revenueCents"
                stroke="var(--accent, #c87a2a)"
                strokeWidth={2}
                fill="url(#revFill)"
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export function BestSellersChart({
  rows,
  periodLabel,
}: {
  rows: { productId: string; name: string; revenueCents: number; units: number }[];
  periodLabel: string;
}) {
  const top = useMemo(() => rows.slice(0, 8), [rows]);
  return (
    <ChartCard
      title="Best sellers"
      period={periodLabel}
      note="Top 8 by revenue · accepted orders"
    >
      {top.length === 0 ? (
        <EmptyChart message={`No counted sales in this period (${periodLabel}).`} />
      ) : (
        <div className="w-full" style={{ height: Math.max(160, top.length * 34 + 40) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e5e7eb)" horizontal={false} />
              {/* domain floor pinned to 0 — bars compare honestly */}
              <XAxis type="number" tickFormatter={moneyAxis} tick={AXIS_TICK} tickLine={false} axisLine={false} domain={[0, "auto"]} />
              <YAxis type="category" dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={false} width={140} />
              <Tooltip
                formatter={(v) => [money(Number(v)), "Revenue"]}
                labelFormatter={(l, payload) => {
                  const p = (payload?.[0]?.payload ?? {}) as { units?: number };
                  return p.units != null ? `${l} · ${p.units} units` : String(l);
                }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar
                dataKey="revenueCents"
                fill="var(--accent, #c87a2a)"
                radius={[0, 4, 4, 0]}
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
