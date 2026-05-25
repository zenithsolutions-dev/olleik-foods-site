import Link from "next/link";
import { AdminProvider } from "@/lib/admin/store";
import { AdminNav } from "./admin-nav";

export const metadata = {
  title: "Olleik Admin",
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AdminProvider>
      <div className="flex min-h-screen bg-[#f7f4eb]">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--border)] bg-surface md:flex">
          <div className="border-b border-[var(--border)] px-6 py-5">
            <Link href="/admin" className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="grid h-9 w-9 place-items-center rounded-md bg-brand text-white font-display text-base font-semibold"
              >
                O
              </span>
              <div>
                <p className="font-display text-base font-semibold leading-tight text-brand-deep">
                  Olleik <span className="text-accent">Foods</span>
                </p>
                <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
                  Admin
                </p>
              </div>
            </Link>
          </div>

          <AdminNav />

          <div className="mt-auto border-t border-[var(--border)] px-6 py-5 text-[11px] text-muted-soft">
            <p>Demo mode — data lives in this browser only.</p>
            <Link href="/" className="mt-2 inline-block text-brand hover:text-accent">
              ← Back to site
            </Link>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-[var(--border)] bg-surface px-8 py-4 md:hidden">
            <Link href="/admin" className="font-display text-lg font-semibold text-brand-deep">
              Olleik Admin
            </Link>
            <Link href="/" className="text-xs text-muted hover:text-brand">
              ← Back to site
            </Link>
          </header>
          <main className="flex-1 px-6 py-8 md:px-10 md:py-10">{children}</main>
        </div>
      </div>
    </AdminProvider>
  );
}
