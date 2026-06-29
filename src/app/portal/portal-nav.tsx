"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/catalog", label: "My catalog" },
  { href: "/portal/offers", label: "Offers" },
  { href: "/portal/account", label: "Account" },
];

export function PortalNav() {
  const pathname = usePathname();
  return (
    <nav className="mx-auto max-w-6xl px-6">
      {/* flex-nowrap keeps all four tabs on ONE row at every width; on very
          narrow phones the row scrolls horizontally instead of wrapping
          "Account" onto a second line. */}
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
      </ul>
    </nav>
  );
}
