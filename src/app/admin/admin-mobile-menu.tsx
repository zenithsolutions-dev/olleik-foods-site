"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

// Phone-width admin menu: the sidebar is hidden below md, so this button opens the same navigation.
// Open state is tied to the path it was opened on, so following a link closes the menu without an effect.
export function AdminMobileMenu({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const isOpen = openOn === pathname;

  return (
    <>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="admin-mobile-menu"
        onClick={() => setOpenOn(isOpen ? null : pathname)}
        onKeyDown={(e) => e.key === "Escape" && setOpenOn(null)}
        className="inline-flex h-11 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm font-medium text-brand-deep"
      >
        {isOpen ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
        Menu
      </button>
      {isOpen && (
        <div
          id="admin-mobile-menu"
          className="absolute inset-x-0 top-full z-40 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-[var(--border)] bg-surface shadow-lg"
        >
          {children}
        </div>
      )}
    </>
  );
}
