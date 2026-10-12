"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
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

// Phone/tablet navigation (< md): the sidebar is hidden there, so without this the admin could only reach other
// pages through links on the dashboard. A menu button in the top bar opens the same links. The panel is tied to the
// path it was opened on, so following any link closes it without an effect.
export function AdminMobileNav({
  newOrderCount = 0,
  children,
}: {
  newOrderCount?: number;
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  const liveCount = useOrderAlerts()?.newCount;
  const count = liveCount ?? newOrderCount;
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  return (
    <div className="print:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="admin-mobile-menu"
        onClick={() => setOpenAt(open ? null : pathname)}
        className="relative inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3.5 py-1.5 text-sm font-medium text-brand-deep"
      >
        {open ? <X size={15} aria-hidden /> : <Menu size={15} aria-hidden />}
        Menu
        {count > 0 && !open && (
          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {count} new
          </span>
        )}
      </button>
      {open && (
        <div
          id="admin-mobile-menu"
          className="absolute inset-x-0 top-full z-40 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-[var(--border)] bg-surface shadow-lg"
        >
          <AdminNav newOrderCount={newOrderCount} />
          {children && <div className="border-t border-[var(--border)] px-6 py-4 text-sm">{children}</div>}
        </div>
      )}
    </div>
  );
}
