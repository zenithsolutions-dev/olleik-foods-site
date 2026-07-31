import Link from "next/link";
import { requireCustomer } from "@/lib/portal/require-customer";
import { PortalNav } from "./portal-nav";
import { CartProvider } from "./cart-context";
import { signOutPortal } from "./actions";

export const metadata = {
  title: "Your account — Olleik Foods",
};

// Authoritative gate for the whole portal: requireCustomer() redirects anyone
// who isn't a signed-in, ACTIVE customer (scoped by RLS via the session client).
export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const customer = await requireCustomer();

  return (
    <CartProvider>
    <div className="min-h-screen bg-[#f7f4eb]">
      <header className="border-b border-[var(--border)] bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Link href="/portal" className="flex items-center gap-2.5">
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
                Customer portal
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-muted sm:inline" title={customer.email}>
              {customer.businessName}
            </span>
            <form action={signOutPortal}>
              <button type="submit" className="font-medium text-brand hover:text-accent">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <PortalNav />
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8 md:py-10">{children}</main>
    </div>
    </CartProvider>
  );
}
