import Link from "next/link";
import { requireCustomer } from "@/lib/portal/require-customer";
import { fetchMyCatalog, fetchMyOffers } from "@/lib/portal/portal-data";

export const dynamic = "force-dynamic";

export default async function PortalDashboardPage() {
  const customer = await requireCustomer();
  const [catalog, offers] = await Promise.all([fetchMyCatalog(), fetchMyOffers()]);
  const productCount = catalog.reduce((n, g) => n + g.products.length, 0);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
          Welcome back
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          {customer.businessName}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your catalog shows the products and contract pricing set up for your account.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/portal/catalog"
          className="rounded-2xl border border-[var(--border)] bg-surface p-6 transition hover:border-[var(--border-strong)] hover:shadow-lg"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-muted">My catalog</p>
          <p className="font-display mt-2 text-3xl font-semibold text-brand-deep">{productCount}</p>
          <p className="mt-1 text-xs text-muted-soft">products at your pricing →</p>
        </Link>
        <Link
          href="/portal/offers"
          className="rounded-2xl border border-[var(--border)] bg-surface p-6 transition hover:border-[var(--border-strong)] hover:shadow-lg"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Active offers</p>
          <p className="font-display mt-2 text-3xl font-semibold text-brand-deep">{offers.length}</p>
          <p className="mt-1 text-xs text-muted-soft">current promotions →</p>
        </Link>
      </div>

      <p className="rounded-xl border border-[var(--border)] bg-brand-mist/40 p-4 text-sm text-muted">
        Need a product you don&apos;t see, or have a question about pricing? Contact your Olleik
        rep and we&apos;ll get it added to your account.
      </p>
    </div>
  );
}
