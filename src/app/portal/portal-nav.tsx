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
      <ul className="flex flex-wrap gap-1 -mb-px">
        {LINKS.map((l) => {
          const active = l.href === "/portal" ? pathname === "/portal" : pathname.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`inline-block border-b-2 px-4 py-3 text-sm font-medium transition ${
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
