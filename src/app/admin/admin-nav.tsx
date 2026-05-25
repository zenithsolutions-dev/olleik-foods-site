"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS: Array<{ href: string; label: string; icon: string }> = [
  { href: "/admin", label: "Dashboard", icon: "■" },
  { href: "/admin/products", label: "Products", icon: "◇" },
  { href: "/admin/categories", label: "Categories", icon: "◈" },
  { href: "/admin/customers", label: "Customers", icon: "◉" },
  { href: "/admin/leads", label: "Leads", icon: "◐" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 px-3 py-4">
      {ITEMS.map((it) => {
        const active =
          pathname === it.href ||
          (it.href !== "/admin" && pathname.startsWith(it.href));
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
              active
                ? "bg-brand text-white"
                : "text-foreground/75 hover:bg-brand-mist hover:text-brand-deep"
            }`}
          >
            <span
              aria-hidden
              className={`text-base ${active ? "text-accent-soft" : "text-accent"}`}
            >
              {it.icon}
            </span>
            <span className="font-medium">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
