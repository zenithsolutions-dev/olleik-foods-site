import { formatMoney } from "./store";
import type { OfferDiscountKind } from "./types";

// Human label for an offer/template discount. Value convention (per migration
// 0002): percent = whole percent; fixed_price/amount_off = cents.
export function formatDiscount(
  kind: OfferDiscountKind | null | undefined,
  value: number | null | undefined,
): string | null {
  if (!kind || value == null) return null;
  if (kind === "percent") return `${value}% off`;
  if (kind === "fixed_price") return `${formatMoney(value)} fixed price`;
  return `${formatMoney(value)} off`; // amount_off
}
