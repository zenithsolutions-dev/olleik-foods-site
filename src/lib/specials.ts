// Public specials: a limited quantity of one product at a special price, shown to every visitor.
// Pure and dependency-light (only the date helper), so the test suite imports it directly.
//
// The quantity is the special's own allotment: quantity_sold rises when an order is submitted (so the
// last units cannot be promised twice) and falls back if that order is cancelled. Product stock is a
// separate count and still moves when the order is confirmed, as for any order.
import { zonedMidnightUTC } from "./dates.ts";

export type SpecialRow = {
  id: string;
  product_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  unit_label: string | null; // e.g. "3 L / tin" — what one unit of the quantity is
  special_price_cents: number;
  quantity_total: number;
  quantity_sold: number;
  starts_at: string | null;
  ends_at: string | null;
  is_published: boolean;
  show_price_to_guests: boolean;
};

export type SpecialState = "draft" | "scheduled" | "live" | "sold_out" | "ended";

export const remainingQty = (s: Pick<SpecialRow, "quantity_total" | "quantity_sold">) =>
  Math.max(0, s.quantity_total - s.quantity_sold);

export function specialState(
  s: Pick<SpecialRow, "is_published" | "starts_at" | "ends_at" | "quantity_total" | "quantity_sold">,
  now: Date,
): SpecialState {
  if (!s.is_published) return "draft";
  if (s.ends_at && new Date(s.ends_at) <= now) return "ended";
  if (s.starts_at && new Date(s.starts_at) > now) return "scheduled";
  return remainingQty(s) === 0 ? "sold_out" : "live";
}

// What leaves the server for the public pages. Built field by field: nothing internal rides along, and a
// guest gets no price at all when the special hides it from guests.
export type PublicSpecial = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  unitLabel: string | null;
  priceCents: number | null;
  remaining: number;
  total: number;
  isSoldOut: boolean;
  endsAt: string | null;
};

export function toPublicSpecial(s: SpecialRow, viewer: { isCustomer: boolean }, now: Date): PublicSpecial | null {
  const state = specialState(s, now);
  if (state !== "live" && state !== "sold_out") return null;
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    imageUrl: s.image_url,
    unitLabel: s.unit_label,
    priceCents: viewer.isCustomer || s.show_price_to_guests ? s.special_price_cents : null,
    remaining: remainingQty(s),
    total: s.quantity_total,
    isSoldOut: state === "sold_out",
    endsAt: s.ends_at,
  };
}

// Which price an order line gets.
//   special      the special's price, taking from its quantity
//   normal       the customer's own price (it is as good or better, or there is no live special)
//   short        they asked for more than is left at the special price
//   unavailable  the special is gone and this customer has no other way to buy the product
export type SpecialPick =
  | { kind: "special"; unitPriceCents: number; specialId: string; title: string }
  | { kind: "normal" }
  | { kind: "short"; remaining: number; title: string }
  | { kind: "unavailable" };

export function pickSpecialForLine(args: {
  special: SpecialRow | null;
  qty: number;
  normalUnitPriceCents: number | null; // null: the product is not in this customer's catalog
  now: Date;
}): SpecialPick {
  const { special, qty, normalUnitPriceCents } = args;
  const isLive = special !== null && specialState(special, args.now) === "live";
  if (!special || !isLive) return normalUnitPriceCents === null ? { kind: "unavailable" } : { kind: "normal" };
  if (normalUnitPriceCents !== null && normalUnitPriceCents <= special.special_price_cents) return { kind: "normal" };
  const remaining = remainingQty(special);
  if (qty > remaining) return { kind: "short", remaining, title: special.title };
  return { kind: "special", unitPriceCents: special.special_price_cents, specialId: special.id, title: special.title };
}

// ---------- the admin form ----------

export type SpecialFormRow = Omit<SpecialRow, "id" | "quantity_sold">;
type FormInput = Record<string, string | undefined>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const PRICE_PATTERN = /^\d{1,7}(\.\d{1,2})?$/;
const MAX_QUANTITY = 1_000_000;

// A date field is a whole local day. Returns the UTC instant of that day's midnight in the business zone,
// plus `addDays` days (the end date is inclusive, so it ends at the NEXT midnight).
function localMidnight(value: string, timeZone: string, addDays: number): Date | null {
  const m = DATE_PATTERN.exec(value);
  if (!m) return null;
  const probe = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + addDays));
  if (Number.isNaN(probe.getTime())) return null;
  return zonedMidnightUTC({ y: probe.getUTCFullYear(), m: probe.getUTCMonth() + 1, d: probe.getUTCDate() }, timeZone);
}

export function parseSpecialForm(
  input: FormInput,
  timeZone: string,
): { ok: true; row: SpecialFormRow } | { ok: false; error: string; row?: undefined } {
  const str = (key: string) => input[key]?.trim() ?? "";
  const fail = (error: string) => ({ ok: false as const, error });

  const productId = str("product_id");
  if (!UUID_PATTERN.test(productId)) return fail("Choose a product.");
  const title = str("title");
  if (!title) return fail("Give the special a title.");
  if (title.length > 120) return fail("The title is too long (120 characters at most).");
  const description = str("description") || null;
  if (description && description.length > 500) return fail("The description is too long (500 characters at most).");
  const unitLabel = str("unit_label") || null;
  if (unitLabel && unitLabel.length > 60) return fail("The unit is too long.");
  const imageUrl = str("image_url") || null;
  if (imageUrl && !/^https?:\/\/\S+$/i.test(imageUrl)) return fail("The picture must be a web address starting with http:// or https://.");

  const price = str("price");
  if (!PRICE_PATTERN.test(price)) return fail("Enter the special price as a number, like 18.99.");
  const priceCents = Math.round(Number(price) * 100);
  if (priceCents <= 0) return fail("The special price must be more than zero.");

  const quantity = Number(str("quantity_total"));
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    return fail("Enter how many are available as a whole number, 1 or more.");
  }

  const startText = str("start_date");
  const endText = str("end_date");
  const startsAt = startText ? localMidnight(startText, timeZone, 0) : null;
  const endsAt = endText ? localMidnight(endText, timeZone, 1) : null;
  if ((startText && !startsAt) || (endText && !endsAt)) return fail("Dates must look like 2026-12-31.");
  if (startsAt && endsAt && endsAt <= startsAt) return fail("The end date cannot be before the start date.");

  return {
    ok: true,
    row: {
      product_id: productId,
      title,
      description,
      image_url: imageUrl,
      unit_label: unitLabel,
      special_price_cents: priceCents,
      quantity_total: quantity,
      starts_at: startsAt?.toISOString() ?? null,
      ends_at: endsAt?.toISOString() ?? null,
      is_published: input.is_published !== undefined,
      show_price_to_guests: input.show_price_to_guests !== undefined,
    },
  };
}

// ---------- sharing ----------

// WhatsApp click-to-chat: opens WhatsApp with the message ready and lets the sender pick who gets it.
export function whatsappShareUrl(args: {
  title: string;
  priceCents: number | null;
  unitLabel: string | null;
  remaining: number;
  url: string;
  businessName: string;
}): string {
  const price = args.priceCents === null ? null : `$${(args.priceCents / 100).toFixed(2)}${args.unitLabel ? ` per ${args.unitLabel}` : ""}`;
  const lines = [
    `${args.businessName} special: ${args.title}`,
    [price, args.remaining > 0 ? `only ${args.remaining} left` : "sold out"].filter(Boolean).join(" · "),
    args.url,
  ];
  return `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
}
