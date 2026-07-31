"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/portal/format";
import type { CartPricing } from "@/lib/orders/submit";
import { useCart } from "../cart-context";
import { priceCart, submitOrder } from "../orders-actions";

// CP-3a checkout. Read-only priced summary + pickup/delivery + notes → submit.
// The server re-resolves every price at submission; if anything moved since
// this screen rendered, the action rejects with fresh prices and we re-render
// instead of silently charging a different amount.

const MAX_NOTES = 1000;

export default function CheckoutPage() {
  const cart = useCart();
  const router = useRouter();
  const [pricing, setPricing] = useState<CartPricing | null>(null);
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pricesChanged, setPricesChanged] = useState(false);

  // Fetch-on-mount (and whenever the cart changes): setState only inside the
  // promise callback, guarded against unmount/stale runs.
  useEffect(() => {
    if (!cart.ready || cart.lines.length === 0) return;
    let alive = true;
    priceCart(cart.lines).then((res) => {
      if (!alive) return;
      if (res.ok) setPricing(res.pricing);
      else setError(res.message);
    });
    return () => {
      alive = false;
    };
  }, [cart.ready, cart.lines]);

  async function place() {
    if (!pricing) return;
    setBusy(true);
    setError(null);
    setPricesChanged(false);
    const res = await submitOrder({
      lines: cart.lines,
      fulfillment,
      notes: notes.trim() || undefined,
      clientToken: cart.token,
      expectedTotalCents: pricing.totalCents,
    });
    setBusy(false);
    if (res.ok) {
      cart.clearAfterSubmit();
      router.push(`/portal/orders/${res.orderId}?placed=1`);
      return;
    }
    if (res.code === "prices-changed" && res.pricing) {
      setPricing(res.pricing); // show the fresh numbers; customer re-confirms
      setPricesChanged(true);
      return;
    }
    if ((res.code === "not-visible" || res.code === "unavailable") && res.pricing) {
      setPricing(res.pricing); // re-render with fresh flags; the message names the lines
    }
    setError(res.message);
  }

  if (cart.ready && cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-[var(--border)] bg-surface p-10 text-center text-sm text-muted">
        Your cart is empty.{" "}
        <Link href="/portal/catalog" className="font-medium text-brand hover:text-accent">
          Browse your catalog →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-brand-deep">
          Checkout
        </h1>
        <p className="mt-2 text-sm text-muted">
          Review your order, choose how you&apos;ll receive it, and submit. Settlement stays on
          your existing payment terms — no online payment.
        </p>
      </div>

      {pricesChanged && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Prices changed since you loaded your cart. The totals below are current — review and
          submit again.
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {!pricing ? (
        <p className="rounded-2xl border border-[var(--border)] bg-surface p-10 text-center text-sm text-muted">
          Loading your order…
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface">
            {pricing.lines.map((l) => (
              <div
                key={l.productId}
                className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {l.name} <span className="text-muted">× {l.qty}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {formatMoney(l.unitPriceCents)} each
                    {l.appliedOfferTitle ? ` · ${l.appliedOfferTitle}` : ""}
                  </p>
                </div>
                <p className="font-mono text-sm font-semibold text-brand-deep">
                  {formatMoney(l.lineTotalCents)}
                </p>
              </div>
            ))}
            <div className="flex items-center justify-between bg-brand-mist/30 px-5 py-4">
              <p className="text-sm font-medium text-muted">Order total</p>
              <p className="font-mono text-lg font-semibold text-brand-deep">
                {formatMoney(pricing.totalCents)}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-surface p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
              Receive your order
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["pickup", "Pickup", "You collect from the Olleik warehouse."],
                  ["delivery", "Delivery", "We deliver on your usual route."],
                ] as const
              ).map(([value, title, blurb]) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-xl border p-3 transition ${
                    fulfillment === value
                      ? "border-brand bg-brand-mist/40"
                      : "border-[var(--border)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="fulfillment"
                      checked={fulfillment === value}
                      onChange={() => setFulfillment(value)}
                      className="accent-[var(--brand)]"
                    />
                    <span className="text-sm font-semibold text-foreground">{title}</span>
                  </span>
                  <span className="mt-1 block text-xs text-muted">{blurb}</span>
                </label>
              ))}
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted">
                Notes (optional)
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, MAX_NOTES))}
                rows={3}
                placeholder="Delivery window, substitutions, anything we should know…"
                className="mt-1.5 w-full rounded-xl border border-[var(--border-strong)] bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/portal/cart" className="text-sm text-brand hover:text-accent">
              ← Back to cart
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={place}
              className="rounded-full bg-brand px-8 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-50"
            >
              {busy ? "Submitting…" : `Submit order · ${formatMoney(pricing.totalCents)}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
