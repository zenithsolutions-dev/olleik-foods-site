import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  effectivePriceCents,
  applyOffersToPrice,
  offerAppliesToProduct,
} from "@/lib/pricing";
import type { OfferDiscountKind, ProductUnit } from "@/lib/admin/types";

// CP-3a PRIVILEGED ORDERS ZONE (approved D-O0). This module is the ONLY place
// portal-triggered code may touch the service-role client, and portal files may
// import ONLY this file from src/lib/orders (guard:portal + ESLint enforce it).
//
// Security model — "session reads, privileged atomic write":
//   * Identity comes from requireCustomer() upstream; the caller passes the
//     session-derived customer id. The client NEVER sends prices or a customer
//     id — only {productId, qty} lines.
//   * Every read here uses the SESSION client, so RLS itself is the oracle:
//     - visibility: products .in(ids) returns only rows visible under the
//       customer's CP-2 mode; anything missing is rejected by name/id.
//     - pricing: own customer_products + own active customer_offers, priced by
//       the SAME pure functions the catalog display uses -> display = charge.
//   * The ONLY privileged call is submit_order_atomic() via the service-role
//     client — a SECURITY DEFINER function revoked from authenticated/anon, so
//     no customer JWT can reach it directly. Customers have zero write policies
//     on orders/order_items; this RPC is the single write path in the system.

export type CartLineInput = { productId: string; qty: number };

export type SubmitOrderInput = {
  lines: CartLineInput[];
  fulfillment: "pickup" | "delivery";
  notes?: string;
  clientToken: string;
  // What the cart UI displayed. A server-side mismatch (price/offer changed
  // since render) REJECTS with fresh prices — we never silently charge a
  // different amount than the customer saw.
  expectedTotalCents: number;
};

export type PricedCartLine = {
  productId: string;
  name: string;
  sku: string;
  unit: ProductUnit;
  unitSize: string;
  qty: number;
  assigned: boolean;
  // CP-3b (D-O6): the boolean availability signal — never a quantity. An
  // unavailable line blocks submission (checked server-side below).
  available: boolean;
  basePriceCents: number; // pre-offer effective (assigned price or list)
  unitPriceCents: number; // charged (post-offer; offers apply to assigned only, D-O2)
  appliedOfferTitle: string | null;
  lineTotalCents: number;
};

export type CartPricing = {
  lines: PricedCartLine[];
  totalCents: number;
  // productIds requested but NOT visible to this customer (hidden/out-of-mode/
  // inactive/nonexistent — indistinguishable by design; RLS filters them all).
  missingProductIds: string[];
};

export type SubmitOrderResult =
  | { ok: true; orderId: string }
  | {
      ok: false;
      code:
        | "empty-cart"
        | "invalid-input"
        | "not-visible"
        | "unavailable"
        | "prices-changed"
        | "rate-limited"
        | "not-configured"
        | "error";
      message: string;
      // On "prices-changed": the fresh server-priced cart so the UI can rerender.
      pricing?: CartPricing;
    };

export const MAX_LINES = 100;
export const MAX_QTY = 999;
export const MAX_NOTES = 1000;
export const MAX_ORDERS_PER_HOUR = 20;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  unit: ProductUnit;
  unit_size: string;
  list_price_cents: number;
};

type OfferRow = {
  title: string;
  product_id: string | null;
  discount_kind: OfferDiscountKind | null;
  discount_value: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

// Validate the raw line shape. Returns an error message or null.
export function validateCartLines(lines: CartLineInput[]): string | null {
  if (lines.length === 0) return "Your cart is empty.";
  if (lines.length > MAX_LINES) return `Orders are limited to ${MAX_LINES} lines.`;
  const seen = new Set<string>();
  for (const l of lines) {
    if (!UUID_RE.test(l.productId)) return "Invalid product in cart.";
    if (seen.has(l.productId)) return "Duplicate product in cart — combine the quantities.";
    seen.add(l.productId);
    if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > MAX_QTY)
      return `Quantities must be whole numbers between 1 and ${MAX_QTY}.`;
  }
  return null;
}

// Price a cart from the customer's own session-visible rows. Used by BOTH the
// cart/checkout preview and the submission path, so what the customer sees is
// computed by the exact code that charges them.
export async function resolveCartPricing(lines: CartLineInput[]): Promise<CartPricing> {
  const supabase = await createSupabaseServerClient();
  const ids = lines.map((l) => l.productId);

  const [{ data: prodRows, error: prodErr }, { data: cpRows }, { data: offerRows }] =
    await Promise.all([
      // RLS: only products visible under the caller's CP-2 mode come back.
      supabase
        .from("products")
        .select("id, name, sku, unit, unit_size, list_price_cents")
        .in("id", ids)
        .eq("is_active", true),
      supabase.from("customer_products").select("product_id, price_cents"),
      supabase
        .from("customer_offers")
        .select("title, product_id, discount_kind, discount_value, starts_at, ends_at, is_active")
        .eq("is_active", true),
    ]);
  if (prodErr) throw new Error(`cart product read failed: ${prodErr.message}`);

  // CP-3b availability — a SEPARATE tolerant query (pre-0010 the products
  // table has no is_available column; 42703 there just means everything is
  // available). Same session client, so RLS-visible rows only.
  const unavailable = new Set<string>();
  {
    const { data: availRows, error: availErr } = await supabase
      .from("products")
      .select("id, is_available")
      .in("id", ids);
    if (availErr) {
      if (availErr.code !== "42703")
        console.error("[orders] availability read failed:", availErr.message);
    } else {
      for (const r of (availRows as { id: string; is_available: boolean }[]) ?? [])
        if (!r.is_available) unavailable.add(r.id);
    }
  }

  const products = new Map(((prodRows as ProductRow[]) ?? []).map((p) => [p.id, p]));
  const myPrices = new Map(
    (((cpRows as { product_id: string; price_cents: number | null }[]) ?? [])).map((r) => [
      r.product_id,
      r.price_cents,
    ]),
  );
  const offers = ((offerRows as OfferRow[]) ?? []).map((o) => ({
    title: o.title,
    productId: o.product_id,
    discountKind: o.discount_kind,
    discountValue: o.discount_value,
    isActive: o.is_active,
    startsAt: o.starts_at,
    endsAt: o.ends_at,
  }));
  const now = new Date();

  const priced: PricedCartLine[] = [];
  const missing: string[] = [];
  for (const l of lines) {
    const p = products.get(l.productId);
    if (!p) {
      missing.push(l.productId);
      continue;
    }
    const assigned = myPrices.has(p.id);
    const base = assigned
      ? effectivePriceCents(myPrices.get(p.id) ?? null, p.list_price_cents)
      : p.list_price_cents;
    // D-O2: offers keep display=charge parity — assigned products only.
    const applicable = assigned
      ? offers
          .filter((o) => offerAppliesToProduct(o, p.id, now))
          .map((o) => ({
            title: o.title,
            discountKind: o.discountKind as OfferDiscountKind,
            discountValue: o.discountValue as number,
          }))
      : [];
    const res = applyOffersToPrice(base, applicable);
    priced.push({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      unit: p.unit,
      unitSize: p.unit_size,
      qty: l.qty,
      assigned,
      available: !unavailable.has(p.id),
      basePriceCents: base,
      unitPriceCents: res.finalCents,
      appliedOfferTitle: res.appliedOffer?.title ?? null,
      lineTotalCents: l.qty * res.finalCents,
    });
  }

  return {
    lines: priced,
    totalCents: priced.reduce((n, l) => n + l.lineTotalCents, 0),
    missingProductIds: missing,
  };
}

// Submit an order for the given (session-derived) customer. The caller MUST
// have obtained customerId + paymentTerms from requireCustomer() — never from
// client input.
export async function submitOrderForCustomer(
  customer: { id: string; paymentTerms: string },
  input: SubmitOrderInput,
): Promise<SubmitOrderResult> {
  // ---- input validation (caps approved as D-O8) ----
  const lineErr = validateCartLines(input.lines);
  if (lineErr) {
    return {
      ok: false,
      code: input.lines.length === 0 ? "empty-cart" : "invalid-input",
      message: lineErr,
    };
  }
  if (input.fulfillment !== "pickup" && input.fulfillment !== "delivery") {
    return { ok: false, code: "invalid-input", message: "Choose pickup or delivery." };
  }
  const notes = input.notes?.trim() || null;
  if (notes && notes.length > MAX_NOTES) {
    return { ok: false, code: "invalid-input", message: `Notes are limited to ${MAX_NOTES} characters.` };
  }
  if (!UUID_RE.test(input.clientToken)) {
    return { ok: false, code: "invalid-input", message: "Invalid submission token — refresh and retry." };
  }
  if (!Number.isInteger(input.expectedTotalCents) || input.expectedTotalCents < 0) {
    return { ok: false, code: "invalid-input", message: "Invalid cart total — refresh and retry." };
  }

  // ---- rate cap: own-orders count via the SESSION client (RLS-scoped) ----
  const supabase = await createSupabaseServerClient();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recent, error: rateErr } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .gte("created_at", hourAgo);
  if (rateErr) {
    console.error("[orders] rate-cap read failed:", rateErr.message);
    return { ok: false, code: "error", message: "Could not submit right now. Please try again." };
  }
  if ((recent ?? 0) >= MAX_ORDERS_PER_HOUR) {
    return {
      ok: false,
      code: "rate-limited",
      message: "You've reached the hourly order limit. Please try again later or call your Olleik rep.",
    };
  }

  // ---- visibility + pricing, from the customer's own session-visible rows ----
  let pricing: CartPricing;
  try {
    pricing = await resolveCartPricing(input.lines);
  } catch (e) {
    console.error("[orders] cart pricing failed:", e instanceof Error ? e.message : e);
    return { ok: false, code: "error", message: "Could not price your cart. Please try again." };
  }
  if (pricing.missingProductIds.length > 0) {
    return {
      ok: false,
      code: "not-visible",
      message:
        "Some items in your cart are no longer available to your account. Remove them and try again.",
      pricing,
    };
  }
  // CP-3b (D-O6): unavailable products can't be ordered — enforced here even
  // if a stale/forged client skipped the disabled add-to-cart control.
  const unavailableLines = pricing.lines.filter((l) => !l.available);
  if (unavailableLines.length > 0) {
    return {
      ok: false,
      code: "unavailable",
      message: `Currently unavailable: ${unavailableLines
        .map((l) => l.name)
        .join(", ")}. Remove ${unavailableLines.length === 1 ? "it" : "them"} and try again.`,
      pricing,
    };
  }
  if (pricing.totalCents !== input.expectedTotalCents) {
    return {
      ok: false,
      code: "prices-changed",
      message: "Prices changed since you loaded your cart. Review the updated total and submit again.",
      pricing,
    };
  }

  // ---- privileged: cost snapshots + the atomic write ----
  const admin = getAdminClient();
  if (!admin) {
    return { ok: false, code: "not-configured", message: "Ordering is not available right now." };
  }
  const { data: costRows, error: costErr } = await admin
    .from("product_costs")
    .select("product_id, cost_cents")
    .in("product_id", pricing.lines.map((l) => l.productId));
  if (costErr) console.error("[orders] cost snapshot read failed:", costErr.message);
  const costs = new Map(
    (((costRows as { product_id: string; cost_cents: number }[]) ?? [])).map((r) => [
      r.product_id,
      r.cost_cents,
    ]),
  );

  const { data: orderId, error: rpcErr } = await admin.rpc("submit_order_atomic", {
    p_customer_id: customer.id,
    p_fulfillment: input.fulfillment,
    p_notes: notes,
    p_payment_terms: customer.paymentTerms,
    p_total_cents: pricing.totalCents,
    p_client_token: input.clientToken,
    p_lines: pricing.lines.map((l) => ({
      product_id: l.productId,
      name: l.name,
      sku: l.sku,
      unit: l.unit,
      unit_size: l.unitSize,
      qty: l.qty,
      base_price_cents: l.basePriceCents,
      unit_price_cents: l.unitPriceCents,
      applied_offer_title: l.appliedOfferTitle,
      was_assigned: l.assigned,
      cost_cents: costs.get(l.productId) ?? null,
    })),
  });
  if (rpcErr || !orderId) {
    console.error("[orders] submit_order_atomic failed:", rpcErr?.message);
    if (rpcErr?.message?.includes("does not exist")) {
      return { ok: false, code: "not-configured", message: "Ordering is not enabled yet (migration 0009)." };
    }
    return { ok: false, code: "error", message: "Could not submit your order. Please try again." };
  }

  return { ok: true, orderId: orderId as string };
}
