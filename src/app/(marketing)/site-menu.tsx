"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

// Navigation for screens below lg, where the header's link row is hidden: without this a phone or tablet visitor had
// no way to reach Catalog, Delivery, About, Contact or Sign in except by scrolling to the footer. The panel is tied to
// the path it was opened on, so following a link closes it.
const LINKS = [
  { href: "/who-we-serve", label: "Who we serve" },
  { href: "/catalog", label: "Catalog" },
  { href: "/delivery", label: "Delivery" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/login", label: "Sign in" },
];

export function SiteMenu() {
  const pathname = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="site-mobile-menu"
        onClick={() => setOpenAt(open ? null : pathname)}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3 py-2 text-sm font-medium text-brand-deep"
      >
        {open ? <X size={15} aria-hidden /> : <Menu size={15} aria-hidden />}
        Menu
      </button>
      {open && (
        <nav
          id="site-mobile-menu"
          aria-label="Main"
          className="absolute inset-x-0 top-full border-b border-[var(--border)] bg-background px-6 py-3 shadow-lg"
        >
          <ul className="flex flex-col">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block border-b border-[var(--border)] py-3 text-base font-medium text-foreground/85 last:border-b-0">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
