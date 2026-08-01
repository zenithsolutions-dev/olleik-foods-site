"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOrderAlerts } from "./order-alerts";

const ITEMS: Array<{ href: string; label: string; icon: string }> = [
  { href: "/admin", label: "Dashboard", icon: "■" },
  { href: "/admin/orders", label: "Orders", icon: "▤" },
  { href: "/admin/products", label: "Products", icon: "◇" },
  { href: "/admin/categories", label: "Categories", icon: "◈" },
  { href: "/admin/customers", label: "Customers", icon: "◉" },
  { href: "/admin/assign", label: "Assign products", icon: "◫" },
  { href: "/admin/pricing", label: "Pricing", icon: "◮" },
  { href: "/admin/offers", label: "Offer library", icon: "◆" },
  { href: "/admin/leads", label: "Leads", icon: "◐" },
];

// newOrderCount: fetched server-side by the layout (per admin page render).
// CP-3d: once the 15s poller has run, its LIVE count supersedes the
// server-rendered one, so the badge stays current on every admin page.
export function AdminNav({ newOrderCount = 0 }: { newOrderCount?: number }) {
  const pathname = usePathname();
  const liveCount = useOrderAlerts()?.newCount;
  const count = liveCount ?? newOrderCount;
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
            {it.href === "/admin/orders" && count > 0 && (
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold leading-none ${
                  active ? "bg-white text-brand" : "bg-accent text-white"
                }`}
              >
                {count} new
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
