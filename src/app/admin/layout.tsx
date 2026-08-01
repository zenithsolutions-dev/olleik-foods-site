import Link from "next/link";
import { AdminProvider } from "@/lib/admin/store";
import { RefreshLockProvider } from "@/lib/poll/use-live-refresh";
import { AdminNav } from "./admin-nav";
import { OrderAlertsProvider, OrderAlertsWidget } from "./order-alerts";
import { requireAdmin } from "@/lib/admin/require-admin";
import { fetchNewOrderCount } from "@/lib/admin/orders-data";
import { signOutAdmin } from "./actions";

export const metadata = {
  title: "Olleik Admin",
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Authoritative gate — redirects non-admins when Supabase is configured;
  // returns null (no-op) in mock mode before Supabase is provisioned.
  const adminEmail = await requireAdmin();
  // Live "N new" badge on the Orders nav item, refreshed on every admin page
  // render (admin pages are all force-dynamic).
  const newOrderCount = await fetchNewOrderCount();

  return (
    <AdminProvider>
      {/* CP-3d: the refresh lock (defers in-place refreshes while an admin is
          mid-action) and the single 15s order poller (badge/chime/title). */}
      <RefreshLockProvider>
      <OrderAlertsProvider>
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

          <AdminNav newOrderCount={newOrderCount} />

          {/* CP-3d: enable/mute + degraded state — always visible, never in a
              menu (owner requirement). */}
          <OrderAlertsWidget />

          <div className="mt-auto border-t border-[var(--border)] px-6 py-5 text-[11px] text-muted-soft">
            {adminEmail ? (
              <>
                <p className="truncate text-foreground/70" title={adminEmail}>
                  {adminEmail}
                </p>
                <form action={signOutAdmin} className="mt-2">
                  <button
                    type="submit"
                    className="text-brand hover:text-accent"
                  >
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <p>Demo mode — data lives in this browser only.</p>
            )}
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
      </OrderAlertsProvider>
      </RefreshLockProvider>
    </AdminProvider>
  );
}
