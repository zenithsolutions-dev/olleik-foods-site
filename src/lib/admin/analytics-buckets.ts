// CP-8 charts follow-on — pure time-bucketing logic, no IO. Everything here
// is unit-tested from scripts/test-analytics.mjs: the bucket-size choice, the
// Toronto-day fallback bucketing (pre-0015), and the gap zero-filling that
// keeps the trend line honest (a missing bucket IS a zero-revenue bucket —
// omitting it would fake a smoother trend).
//
// Relative .ts specifiers: node --experimental-strip-types imports this
// directly — the tested module is the shipped module.
import { BUSINESS_TIME_ZONE } from "../dates.ts";

export type BucketSize = "day" | "week" | "month";

// Approved requirement: choose the bucket FROM the range so a year never
// renders 365 unreadable points. Thresholds (stated on the chart itself):
//   <= 31 days  -> daily   (a month reads day by day)
//   <= 140 days -> weekly  (a quarter reads week by week, <= 20 points)
//   longer/all  -> monthly (a year is 12 points; all-time stays readable)
export function chooseBucket(startUTC: Date | null, endUTC: Date | null): BucketSize {
  if (!startUTC || !endUTC) return "month"; // unbounded (All time)
  const days = (endUTC.getTime() - startUTC.getTime()) / 86400_000;
  if (days <= 31) return "day";
  if (days <= 140) return "week";
  return "month";
}

export const BUCKET_LABELS: Record<BucketSize, string> = {
  day: "Daily buckets",
  week: "Weekly buckets (Mon start)",
  month: "Monthly buckets",
};

export type RevenueBucket = {
  bucketKey: string; // sortable key: "2026-08-03" / "2026-08" (month)
  label: string; // axis label: "Aug 3" / "Wk of Aug 3" / "Aug 2026"
  revenueCents: number;
  ordersCount: number;
};

// ---------- Toronto-local calendar helpers (fallback + labels) ----------

function torontoYmd(d: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

function ymdKey(ymd: { y: number; m: number; d: number }): string {
  return `${ymd.y}-${String(ymd.m).padStart(2, "0")}-${String(ymd.d).padStart(2, "0")}`;
}

// Monday of the ISO week containing the given calendar date (CP-5 D-R2).
function mondayOf(ymd: { y: number; m: number; d: number }): { y: number; m: number; d: number } {
  const noonUTC = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d, 12));
  const shift = (noonUTC.getUTCDay() + 6) % 7;
  const monday = new Date(noonUTC.getTime() - shift * 86400_000);
  return { y: monday.getUTCFullYear(), m: monday.getUTCMonth() + 1, d: monday.getUTCDate() };
}

export function bucketKeyFor(createdAtISO: string, bucket: BucketSize): string {
  const ymd = torontoYmd(new Date(createdAtISO));
  if (bucket === "day") return ymdKey(ymd);
  if (bucket === "week") return ymdKey(mondayOf(ymd));
  return `${ymd.y}-${String(ymd.m).padStart(2, "0")}`;
}

function labelFor(bucketKey: string, bucket: BucketSize): string {
  if (bucket === "month") {
    const [y, m] = bucketKey.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-CA", {
      month: "short",
      year: "numeric",
    });
  }
  const [y, m, d] = bucketKey.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
  return bucket === "week" ? `Wk of ${day}` : day;
}

function nextKey(bucketKey: string, bucket: BucketSize): string {
  if (bucket === "month") {
    const [y, m] = bucketKey.split("-").map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  const [y, m, d] = bucketKey.split("-").map(Number);
  const step = bucket === "week" ? 7 : 1;
  const next = new Date(Date.UTC(y, m - 1, d, 12) + step * 86400_000);
  return ymdKey({ y: next.getUTCFullYear(), m: next.getUTCMonth() + 1, d: next.getUTCDate() });
}

// ---------- series assembly ----------
//
// Takes bucketed sums (from the 0015 RPC or the fallback below), zero-fills
// every gap between the first and last bucket (bounded ranges fill from the
// range start to its end so a quiet opening week shows as zero, not as
// absence), and attaches axis labels.
export function buildRevenueSeries(args: {
  sums: { bucketKey: string; revenueCents: number; ordersCount: number }[];
  bucket: BucketSize;
  // Bounded ranges pass their Toronto-local first/last day so the series
  // covers the WHOLE selected period; null = derive from the data (All time).
  rangeStartISO: string | null;
  rangeEndISO: string | null; // EXCLUSIVE end instant
}): RevenueBucket[] {
  const byKey = new Map(args.sums.map((s) => [s.bucketKey, s]));
  const keys = [...byKey.keys()].sort();
  if (keys.length === 0 && !args.rangeStartISO) return [];

  const firstKey = args.rangeStartISO
    ? bucketKeyFor(args.rangeStartISO, args.bucket)
    : keys[0];
  // The exclusive end instant belongs to the NEXT period; step back 1ms so
  // "to midnight Aug 1" ends the series at July's last bucket.
  const lastKey = args.rangeEndISO
    ? bucketKeyFor(new Date(new Date(args.rangeEndISO).getTime() - 1).toISOString(), args.bucket)
    : keys[keys.length - 1];
  if (!firstKey || !lastKey || firstKey > lastKey) return [];

  const out: RevenueBucket[] = [];
  let k = firstKey;
  let guard = 0;
  while (k <= lastKey && guard < 1000) {
    const s = byKey.get(k);
    out.push({
      bucketKey: k,
      label: labelFor(k, args.bucket),
      revenueCents: s?.revenueCents ?? 0,
      ordersCount: s?.ordersCount ?? 0,
    });
    k = nextKey(k, args.bucket);
    guard++;
  }
  return out;
}

// Fallback (pre-0015): bucket raw order rows in the app — same Toronto
// boundaries, same statuses (the caller filters by REVENUE_STATUSES).
export function bucketOrdersFallback(
  orders: { createdAt: string; totalCents: number }[],
  bucket: BucketSize,
): { bucketKey: string; revenueCents: number; ordersCount: number }[] {
  const byKey = new Map<string, { revenueCents: number; ordersCount: number }>();
  for (const o of orders) {
    const k = bucketKeyFor(o.createdAt, bucket);
    const cur = byKey.get(k) ?? { revenueCents: 0, ordersCount: 0 };
    cur.revenueCents += o.totalCents;
    cur.ordersCount += 1;
    byKey.set(k, cur);
  }
  return [...byKey.entries()]
    .map(([bucketKey, v]) => ({ bucketKey, ...v }))
    .sort((a, b) => a.bucketKey.localeCompare(b.bucketKey));
}
