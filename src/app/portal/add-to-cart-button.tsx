"use client";

import { Minus, Plus, ShoppingCart } from "lucide-react";
import { useCart } from "./cart-context";

// Add-to-cart control on catalog cards: a button that becomes a qty stepper
// once the product is in the cart. Client-side only — prices and validity are
// the server's business at preview/submission time.

export function AddToCartButton({ productId }: { productId: string }) {
  const { qtyOf, add, setQty, ready } = useCart();
  const qty = qtyOf(productId);

  if (!ready) {
    return (
      <span className="mt-3 inline-block h-9 w-full rounded-full border border-[var(--border)] bg-brand-mist/30" />
    );
  }

  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={() => add(productId)}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-deep"
      >
        <ShoppingCart size={15} /> Add to cart
      </button>
    );
  }

  return (
    <div className="mt-3 flex items-center justify-between rounded-full border border-brand/40 bg-brand-mist/40 px-2 py-1">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => setQty(productId, qty - 1)}
        className="grid h-7 w-7 place-items-center rounded-full text-brand-deep hover:bg-brand/15"
      >
        <Minus size={14} />
      </button>
      <span className="text-sm font-semibold text-brand-deep">{qty} in cart</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => setQty(productId, qty + 1)}
        className="grid h-7 w-7 place-items-center rounded-full text-brand-deep hover:bg-brand/15"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
