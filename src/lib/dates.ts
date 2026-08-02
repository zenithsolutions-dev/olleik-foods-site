// CP-5 shared date logic — pure, IO-free, safe for BOTH the admin zone and
// the customer portal (which is why it lives here and not under lib/admin).
//
// The America/Toronto day-boundary helpers were MOVED here from
// lib/admin/dashboard-math.ts (CP-4) — this is the ONLY time-boundary
// implementation in the codebase; dashboard-math and every other caller
// import from here.
//
// Range semantics: a resolved range is [startUTC, endUTC) — endUTC is the
// Toronto midnight AFTER the last included day, so the end day is inclusive
// in full and queries stay clean (`gte start`, `lt end`). null bounds = All
// time. Reversed custom ranges are SWAPPED and the swap is REPORTED via
// `notice` (approved D-R5 amendment: never silently rewrite input); invalid
// input falls back to All time WITH a notice saying what is actually shown.

export const BUSINESS_TIME_ZONE = "America/Toronto";
/** @deprecated alias kept for CP-4 call sites; same value. */
export const DASHBOARD_TIME_ZONE = BUSINESS_TIME_ZONE;

// ---------- day boundaries (moved verbatim from dashboard-math) ----------

type Ymd = { y: number; m: number; d: number };

function ymdInZone(now: Date, timeZone: string): Ymd {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, d] = fmt.format(now).split("-").map(Number);
  return { y, m, d };
}

// UTC instant of the given calendar date's midnight in `timeZone`. Two-pass
// correction handles both DST transitions (unit-tested for both edges).
export function zonedMidnightUTC(ymd: Ymd, timeZone: string = BUSINESS_TIME_ZONE): Date {
  const wallFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const target = Date.UTC(ymd.y, ymd.m - 1, ymd.d, 0, 0, 0);
  let ts = target;
  for (let i = 0; i < 2; i++) {
    const parts = wallFmt.formatToParts(new Date(ts));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const wall = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") % 24, // some engines render midnight as "24" with hour12:false
      get("minute"),
      get("second"),
    );
    ts += target - wall;
  }
  return new Date(ts);
}

export function zonedDayStartUTC(now: Date, timeZone: string = BUSINESS_TIME_ZONE): Date {
  return zonedMidnightUTC(ymdInZone(now, timeZone), timeZone);
}

// Start of the PREVIOUS zone-day: an instant safely inside yesterday (12h
// before today's start — immune to 23/25-hour DST days), then its day start.
export function zonedPreviousDayStartUTC(
  now: Date,
  timeZone: string = BUSINESS_TIME_ZONE,
): Date {
  const todayStart = zonedDayStartUTC(now, timeZone);
  return zonedDayStartUTC(new Date(todayStart.getTime() - 12 * 60 * 60 * 1000), timeZone);
}

// Calendar arithmetic on a Ymd, done at NOON UTC so day-shifts can never be
// perturbed by zone offsets.
function shiftYmd(ymd: Ymd, days: number): Ymd {
  const d = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + days, 12));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

// ---------- range presets (approved D-R1/D-R2) ----------

export const RANGE_PRESETS = [
  "all",
  "today",
  "yesterday",
  "this-week",
  "this-month",
  "last-month",
  "this-year",
  "custom",
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const PRESET_LABELS: Record<RangePreset, string> = {
  all: "All time",
  today: "Today",
  yesterday: "Yesterday",
  "this-week": "This week",
  "this-month": "This month",
  "last-month": "Last month",
  "this-year": "This year",
  custom: "Custom range",
};

export type ResolvedRange = {
  preset: RangePreset;
  startUTC: Date | null; // null = unbounded (All time)
  endUTC: Date | null; // EXCLUSIVE bound (the midnight after the last day)
  label: string; // human period label — shown wherever the figures are
  // Non-null when the input was corrected: reversed dates swapped, or
  // invalid input fell back — always states what period is actually shown.
  notice: string | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseYmd(s: string): Ymd | null {
  if (!DATE_RE.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Reject impossible dates (e.g. Feb 30) via round-trip.
  const rt = new Date(Date.UTC(y, m - 1, d, 12));
  if (rt.getUTCFullYear() !== y || rt.getUTCMonth() + 1 !== m || rt.getUTCDate() !== d)
    return null;
  return { y, m, d };
}

function fmtDay(ymd: Ymd): string {
  return new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d, 12)).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Weekday of a calendar date, Monday=0..Sunday=6 (approved D-R2: weeks start
// Monday).
function mondayIndex(ymd: Ymd): number {
  return (new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d, 12)).getUTCDay() + 6) % 7;
}

export type RangeSearchParams = { range?: string; from?: string; to?: string };

export function resolveDateRange(
  params: RangeSearchParams,
  now: Date = new Date(),
  timeZone: string = BUSINESS_TIME_ZONE,
): ResolvedRange {
  const today = ymdInZone(now, timeZone);
  const todayStart = zonedMidnightUTC(today, timeZone);
  const tomorrowStart = zonedMidnightUTC(shiftYmd(today, 1), timeZone);
  const mk = (
    preset: RangePreset,
    startUTC: Date | null,
    endUTC: Date | null,
    label: string,
    notice: string | null = null,
  ): ResolvedRange => ({ preset, startUTC, endUTC, label, notice });

  const requested = (params.range ?? "").trim();

  if (requested === "custom" || (!requested && (params.from || params.to))) {
    let from = params.from ? parseYmd(params.from) : null;
    let to = params.to ? parseYmd(params.to) : null;
    if (!from && !to) {
      return mk("all", null, null, PRESET_LABELS.all,
        "Invalid dates — showing All time instead.");
    }
    // A single bound means a single-day range on that bound.
    if (!from) from = to as Ymd;
    if (!to) to = from;
    let notice: string | null = null;
    const fromTs = Date.UTC(from.y, from.m - 1, from.d);
    const toTs = Date.UTC(to.y, to.m - 1, to.d);
    if (toTs < fromTs) {
      [from, to] = [to, from];
      notice = `Dates were swapped — showing ${fmtDay(from)} to ${fmtDay(to)}.`;
    }
    const label =
      fromTs === toTs ? fmtDay(from) : `${fmtDay(from)} – ${fmtDay(to)}`;
    return mk(
      "custom",
      zonedMidnightUTC(from, timeZone),
      zonedMidnightUTC(shiftYmd(to, 1), timeZone), // end day fully inclusive
      label,
      notice,
    );
  }

  switch (requested) {
    case "":
    case "all":
      return mk("all", null, null, PRESET_LABELS.all);
    case "today":
      return mk("today", todayStart, tomorrowStart, PRESET_LABELS.today);
    case "yesterday": {
      const yStart = zonedPreviousDayStartUTC(now, timeZone);
      return mk("yesterday", yStart, todayStart, PRESET_LABELS.yesterday);
    }
    case "this-week": {
      const monday = shiftYmd(today, -mondayIndex(today));
      return mk("this-week", zonedMidnightUTC(monday, timeZone), tomorrowStart, PRESET_LABELS["this-week"]);
    }
    case "this-month":
      return mk(
        "this-month",
        zonedMidnightUTC({ y: today.y, m: today.m, d: 1 }, timeZone),
        tomorrowStart,
        PRESET_LABELS["this-month"],
      );
    case "last-month": {
      const firstThis = { y: today.y, m: today.m, d: 1 };
      const lastMonth =
        today.m === 1 ? { y: today.y - 1, m: 12, d: 1 } : { y: today.y, m: today.m - 1, d: 1 };
      return mk(
        "last-month",
        zonedMidnightUTC(lastMonth, timeZone),
        zonedMidnightUTC(firstThis, timeZone),
        PRESET_LABELS["last-month"],
      );
    }
    case "this-year":
      return mk(
        "this-year",
        zonedMidnightUTC({ y: today.y, m: 1, d: 1 }, timeZone),
        tomorrowStart,
        PRESET_LABELS["this-year"],
      );
    default:
      return mk("all", null, null, PRESET_LABELS.all,
        "Unknown period — showing All time instead.");
  }
}

// Shared predicate for the small already-fetched tables (products, customers,
// leads): the same boundaries the SQL path uses, applied to an ISO timestamp.
export function isoInRange(iso: string, range: ResolvedRange): boolean {
  const t = new Date(iso).getTime();
  if (range.startUTC && t < range.startUTC.getTime()) return false;
  if (range.endUTC && t >= range.endUTC.getTime()) return false;
  return true;
}
