import type { OfferDiscountKind } from "@/lib/admin/types";

// Pure pricing logic shared by the admin panel and the customer portal, so the
// price a customer sees always matches what the admin sees. No I/O, no clock
// reads inside — callers pass `now` — so every function is unit-testable.

// Effective (pre-offer) price: the customer's negotiated price if set, else the
// product's list price. A custom price of 0 is honored (COALESCE, not ||).
export function effectivePriceCents(
  customCents: number | null | undefined,
  listCents: number,
): number {
  return customCents ?? listCents;
}

// Is an offer live right now? Active flag AND within its date window.
//   is_active && (starts_at is null || starts_at <= now)
//             && (ends_at   is null || ends_at   >= now)
export function offerIsActiveNow(
  o: { isActive: boolean; startsAt: string | null; endsAt: string | null },
  now: Date,
): boolean {
  if (!o.isActive) return false;
  if (o.startsAt && new Date(o.startsAt) > now) return false;
  if (o.endsAt && new Date(o.endsAt) < now) return false;
  return true;
}

export type PriceOffer = { discountKind: OfferDiscountKind; discountValue: number };

export type OfferPriceResult<T> = {
  finalCents: number;
  discounted: boolean;
  originalCents: number;
  appliedOffer?: T;
};

// The price a single offer would produce from `base`, clamped to [0, base] so an
// offer can only ever LOWER the price (encodes the fixed_price "never increase"
// rule and the final >= 0 rule).
function candidateCents(base: number, o: PriceOffer): number {
  let c: number;
  if (o.discountKind === "percent") c = Math.round(base * (1 - o.discountValue / 100));
  else if (o.discountKind === "amount_off") c = base - o.discountValue;
  else c = o.discountValue; // fixed_price
  return Math.max(0, Math.min(c, base));
}

// Apply the SINGLE BEST (largest) discount among already-applicable offers.
// Offers are NEVER compounded — the one yielding the lowest price wins. Callers
// pass only offers that already pass the active/date-window + scope filter and
// have a non-null discount_kind/discount_value.
export function applyOffersToPrice<T extends PriceOffer>(
  effectiveCents: number,
  applicable: T[],
): OfferPriceResult<T> {
  let finalCents = effectiveCents;
  let appliedOffer: T | undefined;

  for (const o of applicable) {
    const c = candidateCents(effectiveCents, o);
    if (c < finalCents) {
      finalCents = c;
      appliedOffer = o;
    }
  }

  return {
    finalCents,
    discounted: finalCents < effectiveCents,
    originalCents: effectiveCents,
    appliedOffer,
  };
}

// Does an offer apply to product `productId` right now? Combines the window
// check, the non-null discount guard, and the scope rule (account-wide when
// product_id is null; otherwise only the matching product).
export function offerAppliesToProduct(
  o: {
    isActive: boolean;
    startsAt: string | null;
    endsAt: string | null;
    productId: string | null;
    discountKind: OfferDiscountKind | null;
    discountValue: number | null;
  },
  productId: string,
  now: Date,
): boolean {
  if (o.discountKind == null || o.discountValue == null) return false;
  if (o.productId != null && o.productId !== productId) return false;
  return offerIsActiveNow(o, now);
}
