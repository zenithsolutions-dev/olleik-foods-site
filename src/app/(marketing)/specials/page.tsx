import type { Metadata } from "next";
import Link from "next/link";
import { getBusinessIdentity } from "@/lib/business";
import { BUSINESS_TIME_ZONE } from "@/lib/dates";
import { siteUrl } from "@/lib/email/send";
import { fetchPublicSpecials, viewerIsCustomer } from "@/lib/specials-data";
import { LiveRefresh } from "@/components/specials/live-refresh";
import { SpecialCard } from "@/components/specials/special-card";
import { SpecialActions } from "./special-actions";

// Read on every request: the number left must be the real one.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const business = await getBusinessIdentity();
  return {
    title: `Specials | ${business.displayName}`,
    description: `Limited-quantity wholesale specials from ${business.displayName}. When they are gone, they are gone.`,
  };
}

export default async function SpecialsPage() {
  const isCustomer = await viewerIsCustomer();
  const [specials, business] = await Promise.all([fetchPublicSpecials({ isCustomer }), getBusinessIdentity()]);
  const base = siteUrl();

  return (
    <>
      <LiveRefresh />
      <section className="mx-auto max-w-7xl px-6 pb-8 pt-14 md:pt-20">
        <h1 className="font-display max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-brand-deep sm:text-5xl">
          Specials
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          Limited quantities at a special price. The count you see is live: when it reaches zero, the special is over.
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        {specials.length === 0 ? (
          <div className="max-w-2xl rounded-3xl border border-dashed border-[var(--border-strong)] bg-surface p-8">
            <p className="font-display text-2xl font-semibold text-brand-deep">No specials right now.</p>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              New ones appear here the moment they are published. Account holders see them first when they sign in.
            </p>
            <Link
              href="/apply"
              className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-white transition hover:bg-accent-deep"
            >
              Open an account
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {specials.map((s) => (
              <SpecialCard key={s.id} special={s} href={`/specials/${s.id}`} timeZone={BUSINESS_TIME_ZONE}>
                <SpecialActions special={s} url={`${base}/specials/${s.id}`} business={business} isCustomer={isCustomer} />
              </SpecialCard>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
