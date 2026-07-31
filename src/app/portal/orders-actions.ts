"use server";

import { requireCustomer } from "@/lib/portal/require-customer";
import {
  resolveCartPricing,
  submitOrderForCustomer,
  validateCartLines,
  type CartLineInput,
  type CartPricing,
  type SubmitOrderInput,
  type SubmitOrderResult,
} from "@/lib/orders/submit";

// CP-3a portal order actions. @/lib/orders/submit is the ONE privileged import
// portal code is allowed (guard:portal + ESLint enforce the allowlist). The
// customer identity ALWAYS comes from requireCustomer() — never from input.
//
// NOTE: only declared `export type X = ...` here — never `export type { X }`
// re-exports (Turbopack server-actions loader would emit a runtime export and
// every action in this module would 500).

export type PriceCartResult =
  | { ok: true; pricing: CartPricing }
  | { ok: false; message: string };

// Live pricing for the cart/checkout screens — same code path that charges.
export async function priceCart(lines: CartLineInput[]): Promise<PriceCartResult> {
  await requireCustomer(); // gate; reads below are RLS-scoped to the caller
  const invalid = validateCartLines(lines);
  if (invalid) return { ok: false, message: invalid };
  try {
    const pricing = await resolveCartPricing(lines);
    return { ok: true, pricing };
  } catch (e) {
    console.error("[portal] priceCart failed:", e instanceof Error ? e.message : e);
    return { ok: false, message: "Could not load cart prices. Please refresh." };
  }
}

export async function submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
  const customer = await requireCustomer();
  return submitOrderForCustomer(
    { id: customer.id, paymentTerms: customer.paymentTerms },
    input,
  );
}
