"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "./cart-context";

// Adds a special's product to the cart. The special price is applied by the server when the cart is priced
// (the same code that charges), so nothing about the price is decided here.
export function AddSpecialToCart({ productId, isSoldOut }: { productId: string; isSoldOut: boolean }) {
  const cart = useCart();
  const [wasAdded, setWasAdded] = useState(false);

  if (isSoldOut) return <p className="text-sm font-medium text-muted">This special is over.</p>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => {
          cart.add(productId, 1);
          setWasAdded(true);
        }}
        className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-white transition hover:bg-accent-deep"
      >
        {wasAdded ? "Add one more" : "Add to cart"}
      </button>
      {wasAdded && (
        <Link href="/portal/cart" className="text-sm font-semibold text-brand hover:text-accent" aria-live="polite">
          In your cart — set the quantity →
        </Link>
      )}
    </div>
  );
}
