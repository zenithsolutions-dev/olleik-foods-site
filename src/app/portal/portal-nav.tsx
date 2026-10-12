"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { useCart } from "./cart-context";

const LINKS = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/catalog", label: "My catalog" },
  { href: "/portal/orders", label: "My orders" },
  { href: "/portal/offers", label: "Offers" },
  { href: "/portal/account", label: "Account" },
];

export function PortalNav() {
  const pathname = usePathname();
  const { count, ready } = useCart();
  return (
    <nav className="mx-auto max-w-6xl px-6">
      {/* flex-nowrap keeps all tabs on ONE row at every width; on very narrow
          phones the row scrolls horizontally instead of wrapping onto a second
          line. The cart tab sits at the far end with a live unit-count badge. */}
      <ul className="flex flex-nowrap gap-1 -mb-px overflow-x-auto">
        {LINKS.map((l) => {
          const active = l.href === "/portal" ? pathname === "/portal" : pathname.startsWith(l.href);
          return (
            <li key={l.href} className="shrink-0">
              <Link
                href={l.href}
                className={`inline-block whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition sm:px-4 ${
                  active
                    ? "border-accent text-brand-deep"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
        {/* On phones the cart lives in the header (PortalCartLink): at the end of this scrolling row it was off-screen. */}
        <li className="ml-auto hidden shrink-0 sm:block">
          <Link
            href="/portal/cart"
            className={`inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition sm:px-4 ${
              pathname.startsWith("/portal/cart") || pathname.startsWith("/portal/checkout")
                ? "border-accent text-brand-deep"
                : "border-transparent text-brand hover:text-brand-deep"
            }`}
          >
            <ShoppingCart size={15} />
            Cart
            {ready && count > 0 && (
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {count}
              </span>
            )}
          </Link>
        </li>
      </ul>
    </nav>
  );
}

// Header cart button for phones (< sm). Same destination and live count as the Cart tab.
export function PortalCartLink() {
  const { count, ready } = useCart();
  return (
    <Link
      href="/portal/cart"
      className="relative inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3 py-1.5 font-semibold text-brand-deep sm:hidden"
    >
      <ShoppingCart size={16} aria-hidden />
      <span className="sr-only">Cart</span>
      {ready && count > 0 && (
        <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{count}</span>
      )}
    </Link>
  );
}
