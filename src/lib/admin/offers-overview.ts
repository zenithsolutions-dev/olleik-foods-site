// Relative + explicit .ts specifiers so node --experimental-strip-types can
// import this module directly (the dashboard-math/dates pattern): the module
// the suite tests is the module Next ships.
import { offerIsActiveNow } from "../pricing.ts";
import type { OfferDiscountKind } from "./types";

// CP-8a pure offers-overview logic — no IO, callers pass `now` (the lib/pricing
// convention). This module answers "what is running, on whom, until when?" by
// deriving EVERYTHING from the same offerIsActiveNow the pricing path uses —
// imported, never re-implemented — so this view and the prices customers
// actually pay cannot disagree (proven by scripts/test-offers.mjs).
//
// Approved D-N1: NO historical impact figures here. The only trustworthy link
// from orders back to offers today is a title snapshot, and an approximate
// number is worse than no number. The order_items.offer_id FK lands in the
// CP-9 migration (carry-over list).

export const EXPIRING_SOON_HOURS = 72; // dashboard chip (CP-4 D-D3) — unchanged
export const EXPIRY_BUCKET_DAYS = 7; // "Running now" grouping
export const RECENTLY_ENDED_DAYS = 14; // how far back "just ended" looks

// The ONE time-to-expiry predicate. The dashboard's 72h flag and the overview's
// 7-day bucket are two thresholds over this single function — CP-10's email
// notifications must consume it too rather than growing a third definition.
export function offerEndsWithin(
  o: { endsAt: string | null },
  now: Date,
  hours: number,
): boolean {
  if (o.endsAt == null) return false; // no end date = never "expiring"
  const end = new Date(o.endsAt).getTime();
  return end > now.getTime() && end <= now.getTime() + hours * 3600_000;
}

export type OverviewOffer = {
  id: string;
  customerId: string;
  customerName: string;
  title: string;
  // null productId = account-wide (every product this customer sees).
  productId: string | null;
  productLabel: string | null; // "Feta 4lb (F-1)" or null for account-wide
  discountKind: OfferDiscountKind | null;
  discountValue: number | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

export type OffersOverview = {
  // Live now (offerIsActiveNow == true), split by how urgent the end is.
  endingSoon: OverviewOffer[]; // ends within EXPIRY_BUCKET_DAYS — soonest first
  runningLater: OverviewOffer[]; // has an end date beyond the bucket — soonest first
  openEnded: OverviewOffer[]; // no end date — they run until switched off
  // Not live: scheduled to start, and the recently-fallen-off (so an expiry
  // that already happened is SEEN, not silently gone — gap F3).
  scheduled: OverviewOffer[]; // starts_at in the future — soonest start first
  recentlyEnded: OverviewOffer[]; // ended/deactivated within RECENTLY_ENDED_DAYS — newest first
  liveCount: number; // endingSoon + runningLater + openEnded
};

// An offer with no discount is announcement-only: it can never change a price
// (offerAppliesToProduct rejects it), so showing it as "running" would be the
// same lie in the other direction. It appears with a "no discount" marker.
export function hasDiscount(o: { discountKind: OfferDiscountKind | null; discountValue: number | null }): boolean {
  return o.discountKind != null && o.discountValue != null;
}

export function buildOffersOverview(offers: OverviewOffer[], now: Date): OffersOverview {
  const bySoonestEnd = (a: OverviewOffer, b: OverviewOffer) =>
    (a.endsAt ?? "9999").localeCompare(b.endsAt ?? "9999") || a.customerName.localeCompare(b.customerName);

  const live = offers.filter((o) => offerIsActiveNow(o, now));
  const endingSoon = live
    .filter((o) => offerEndsWithin(o, now, EXPIRY_BUCKET_DAYS * 24))
    .sort(bySoonestEnd);
  const runningLater = live
    .filter((o) => o.endsAt != null && !offerEndsWithin(o, now, EXPIRY_BUCKET_DAYS * 24))
    .sort(bySoonestEnd);
  const openEnded = live
    .filter((o) => o.endsAt == null)
    .sort((a, b) => a.customerName.localeCompare(b.customerName));

  const scheduled = offers
    .filter((o) => o.isActive && o.startsAt != null && new Date(o.startsAt) > now)
    .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));

  const cutoff = now.getTime() - RECENTLY_ENDED_DAYS * 24 * 3600_000;
  const recentlyEnded = offers
    .filter(
      (o) =>
        !offerIsActiveNow(o, now) &&
        o.endsAt != null &&
        new Date(o.endsAt).getTime() < now.getTime() &&
        new Date(o.endsAt).getTime() >= cutoff &&
        // A scheduled-again offer isn't "ended"; window math above handles it.
        !(o.startsAt != null && new Date(o.startsAt) > now),
    )
    .sort((a, b) => (b.endsAt ?? "").localeCompare(a.endsAt ?? ""));

  return {
    endingSoon,
    runningLater,
    openEnded,
    scheduled,
    recentlyEnded,
    liveCount: endingSoon.length + runningLater.length + openEnded.length,
  };
}

// ---------- apply-effect summary (gap F2) ----------
//
// "What just changed?" — computed with the SAME applyOffersToPrice /
// offerAppliesToProduct pipeline the UI and portal already run; this type just
// names the result so the confirmation can speak plainly.

export type ApplyEffect = {
  affectedCount: number; // products whose price is lower WITH the new offer
  totalProducts: number; // assigned products considered
  averageDropPct: number | null; // over affected products only
  example: { name: string; beforeCents: number; afterCents: number } | null; // biggest drop
  endsAt: string | null;
};

export function summarizeApplyEffect(
  rows: { name: string; beforeCents: number; afterCents: number }[],
  endsAt: string | null,
): ApplyEffect {
  const affected = rows.filter((r) => r.afterCents < r.beforeCents);
  const example =
    affected.length > 0
      ? affected.reduce((best, r) =>
          best.beforeCents - best.afterCents >= r.beforeCents - r.afterCents ? best : r,
        )
      : null;
  const averageDropPct =
    affected.length > 0
      ? (affected.reduce((n, r) => n + (r.beforeCents - r.afterCents) / r.beforeCents, 0) /
          affected.length) *
        100
      : null;
  return {
    affectedCount: affected.length,
    totalProducts: rows.length,
    averageDropPct,
    example,
    endsAt,
  };
}
