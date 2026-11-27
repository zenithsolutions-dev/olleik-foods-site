import Link from "next/link";
import { requireCustomer } from "@/lib/portal/require-customer";
import { fetchMyVisibleProductCount, fetchMyOffers } from "@/lib/portal/portal-data";
import { WelcomeBanner } from "./welcome-banner";
import { BUSINESS_TIME_ZONE } from "@/lib/dates";
import { fetchMySpecials } from "@/lib/portal/specials-data";
import { LiveRefresh } from "@/components/specials/live-refresh";
import { SpecialCard } from "@/components/specials/special-card";
import { AddSpecialToCart } from "./add-special-to-cart";

export const dynamic = "force-dynamic";

export default async function PortalDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const customer = await requireCustomer();
  const { welcome } = await searchParams;
  const [productCount, offers, specials] = await Promise.all([
    fetchMyVisibleProductCount(),
    fetchMyOffers(),
    fetchMySpecials(),
  ]);

  return (
    <div className="space-y-8">
      {welcome && <WelcomeBanner />}
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

      {/* Specials come first: a limited quantity, open to every customer, gone when the count hits zero. */}
      {specials.length > 0 && (
        <section aria-labelledby="specials-heading">
          <LiveRefresh />
          <h2 id="specials-heading" className="font-display text-2xl font-semibold tracking-tight text-brand-deep">
            Specials
          </h2>
          <p className="mt-1 text-sm text-muted">Limited quantities at a special price, while they last.</p>
          <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {specials.map((s) => (
              <SpecialCard key={s.id} special={s} timeZone={BUSINESS_TIME_ZONE}>
                <AddSpecialToCart productId={s.productId} isSoldOut={s.isSoldOut} />
              </SpecialCard>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/portal/catalog"
          className="lift rounded-2xl border border-[var(--border)] bg-surface p-6"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-muted">My catalog</p>
          <p className="font-display mt-2 text-3xl font-semibold text-brand-deep">{productCount}</p>
          <p className="mt-1 text-xs text-muted-soft">products available to you →</p>
        </Link>
        <Link
          href="/portal/offers"
          className="lift rounded-2xl border border-[var(--border)] bg-surface p-6"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Active offers</p>
          <p className="font-display mt-2 text-3xl font-semibold text-brand-deep">{offers.length}</p>
          <p className="mt-1 text-xs text-muted-soft">current promotions →</p>
        </Link>
      </div>

      <p className="rounded-xl border border-[var(--border)] bg-brand-mist/40 p-4 text-sm text-muted">
        Need a product you don&apos;t see, or have a question about pricing? Contact your sales
        rep and we&apos;ll get it added to your account.
      </p>
    </div>
  );
}
