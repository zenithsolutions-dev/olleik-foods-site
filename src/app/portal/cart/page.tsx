"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/portal/format";
import type { CartPricing } from "@/lib/orders/submit";
import { useCart } from "../cart-context";
import { priceCart } from "../orders-actions";

// CP-3a cart page. The cart itself is client-side (D-O7: localStorage,
// {productId, qty} only); every price shown here comes from the priceCart
// server action — the SAME code path that will charge at submission.

export default function CartPage() {
  const cart = useCart();
  const [pricing, setPricing] = useState<CartPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Re-price whenever the cart changes: setState only inside the promise
  // callback (guarded against unmount/stale runs) — never synchronously in
  // the effect body.
  useEffect(() => {
    if (!cart.ready) return;
    let alive = true;
    if (cart.lines.length === 0) {
      Promise.resolve().then(() => {
        if (!alive) return;
        setPricing(null);
        setLoading(false);
      });
      return () => {
        alive = false;
      };
    }
    priceCart(cart.lines).then((res) => {
      if (!alive) return;
      setLoading(false);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setError(null);
      setPricing(res.pricing);
    });
    return () => {
      alive = false;
    };
  }, [cart.ready, cart.lines]);

  const missing = pricing?.missingProductIds ?? [];
  // CP-3b: unavailable lines (is_available=false) — visible but not orderable;
  // the submit action rejects them server-side too.
  const unavailable = (pricing?.lines ?? []).filter((l) => !l.available);
  const blocked = missing.length > 0 || unavailable.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-brand-deep">
          Your cart
        </h1>
        <p className="mt-2 text-sm text-muted">
          Prices are live from your account — assigned products at your price, everything else
          at the listed price.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {missing.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {missing.length} item{missing.length === 1 ? " is" : "s are"} no longer available to
          your account.{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => missing.forEach((id) => cart.remove(id))}
          >
            Remove {missing.length === 1 ? "it" : "them"}
          </button>
        </div>
      )}

      {unavailable.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {unavailable.length === 1
            ? `“${unavailable[0].name}” is currently unavailable`
            : `${unavailable.length} items are currently unavailable`}{" "}
          and can&apos;t be ordered right now.{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => unavailable.forEach((l) => cart.remove(l.productId))}
          >
            Remove {unavailable.length === 1 ? "it" : "them"}
          </button>
        </div>
      )}

      {cart.ready && cart.lines.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-surface p-10 text-center text-sm text-muted">
          Your cart is empty.{" "}
          <Link href="/portal/catalog" className="font-medium text-brand hover:text-accent">
            Browse your catalog →
          </Link>
        </div>
      ) : loading && !pricing ? (
        <p className="rounded-2xl border border-[var(--border)] bg-surface p-10 text-center text-sm text-muted">
          Loading prices…
        </p>
      ) : pricing ? (
        <>
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface">
            {pricing.lines.map((l) => (
              <div
                key={l.productId}
                className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-5 py-4 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {l.name}
                    {!l.available && (
                      <span className="ml-2 rounded-full bg-zinc-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-600">
                        Unavailable
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {l.sku} · {l.unitSize} / {l.unit}
                  </p>
                  <p className="mt-0.5 text-xs">
                    <span className="font-mono font-semibold text-brand-deep">
                      {formatMoney(l.unitPriceCents)}
                    </span>
                    {l.appliedOfferTitle && (
                      <span className="ml-1.5 text-emerald-700">
                        {l.appliedOfferTitle} (was {formatMoney(l.basePriceCents)})
                      </span>
                    )}
                    {l.assigned && !l.appliedOfferTitle && (
                      <span className="ml-1.5 rounded-full bg-brand/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand-deep">
                        Your price
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-full border border-[var(--border-strong)] px-1 py-0.5">
                  <button
                    type="button"
                    aria-label={`Decrease ${l.name}`}
                    onClick={() => cart.setQty(l.productId, l.qty - 1)}
                    className="grid h-7 w-7 place-items-center rounded-full hover:bg-brand-mist"
                  >
                    <Minus size={13} />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold">{l.qty}</span>
                  <button
                    type="button"
                    aria-label={`Increase ${l.name}`}
                    onClick={() => cart.setQty(l.productId, l.qty + 1)}
                    className="grid h-7 w-7 place-items-center rounded-full hover:bg-brand-mist"
                  >
                    <Plus size={13} />
                  </button>
                </div>
                <p className="w-20 text-right font-mono text-sm font-semibold text-brand-deep">
                  {formatMoney(l.lineTotalCents)}
                </p>
                <button
                  type="button"
                  aria-label={`Remove ${l.name}`}
                  onClick={() => cart.remove(l.productId)}
                  className="rounded p-1.5 text-muted hover:text-red-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between bg-brand-mist/30 px-5 py-4">
              <p className="text-sm font-medium text-muted">
                Total ({pricing.lines.reduce((n, l) => n + l.qty, 0)} units)
              </p>
              <p className="font-mono text-lg font-semibold text-brand-deep">
                {formatMoney(pricing.totalCents)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/portal/catalog" className="text-sm text-brand hover:text-accent">
              ← Keep browsing
            </Link>
            <Link
              href="/portal/checkout"
              aria-disabled={blocked}
              className={`rounded-full px-6 py-2.5 text-sm font-semibold text-white ${
                blocked ? "pointer-events-none bg-brand/40" : "bg-brand hover:bg-brand-deep"
              }`}
            >
              Proceed to checkout →
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
