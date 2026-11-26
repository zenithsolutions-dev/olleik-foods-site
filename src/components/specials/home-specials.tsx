import Link from "next/link";
import { BUSINESS_TIME_ZONE } from "@/lib/dates";
import { fetchPublicSpecials, viewerIsCustomer } from "@/lib/specials-data";
import { SpecialCard } from "./special-card";

// The home page's specials band: up to three live specials, most urgent first. Renders nothing when there
// are none, so the home page is unchanged on a quiet day.
const MAX_ON_HOME = 3;

export async function HomeSpecials() {
  const specials = (await fetchPublicSpecials({ isCustomer: await viewerIsCustomer() })).filter((s) => !s.isSoldOut);
  if (specials.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-6 py-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          This week&apos;s specials
        </h2>
        <Link href="/specials" className="text-sm font-semibold text-brand hover:text-accent">
          See all specials →
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {specials.slice(0, MAX_ON_HOME).map((s) => (
          <SpecialCard key={s.id} special={s} href={`/specials/${s.id}`} timeZone={BUSINESS_TIME_ZONE}>
            <Link
              href={`/specials/${s.id}`}
              className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-white transition hover:bg-accent-deep"
            >
              See this special
            </Link>
          </SpecialCard>
        ))}
      </div>
    </section>
  );
}
