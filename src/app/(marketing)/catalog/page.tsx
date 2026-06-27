import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getCategoryChrome } from "@/lib/catalog";
import { fetchPublicCatalog, visibleCategories } from "@/lib/catalog-data";

export const metadata: Metadata = {
  title: "Catalog | Olleik Foods Wholesale Categories",
  description:
    "Browse Olleik Foods wholesale categories — produce, meat & poultry, dairy & eggs, dry goods, beverages, and packaging — delivered across the Ottawa region.",
};

// Live, price-free read from Supabase on every request so the catalog reflects
// admin changes immediately.
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const catalog = await fetchPublicCatalog();
  const categories = visibleCategories(catalog);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_-10%,_var(--brand-mist),_transparent_55%),radial-gradient(circle_at_95%_10%,_var(--accent-soft)_0%,_transparent_45%)]"
        />
        <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-12 md:pt-24">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
            What we carry
          </p>
          <h1 className="font-display mt-4 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-tight text-brand-deep sm:text-5xl lg:text-6xl">
            Everything your kitchen needs, <em className="italic text-accent">from one supplier</em>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            Browse our categories below. Approved customers see their assigned
            catalog with negotiated pricing once they sign in — so the prices
            you see are always yours, never a public list.
          </p>
        </div>
      </section>

      {/* Category grid */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        {categories.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => {
              const chrome = getCategoryChrome(c.slug);
              const blurb = chrome.blurb ?? c.description ?? undefined;
              return (
                <Link
                  key={c.slug}
                  href={`/catalog/${c.slug}`}
                  className="group relative aspect-[4/5] overflow-hidden rounded-3xl border border-[var(--border)] shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_30px_60px_-30px_rgba(20,53,39,0.4)]"
                >
                  {chrome.image ? (
                    <Image
                      src={chrome.image}
                      alt={chrome.imageAlt ?? c.name}
                      fill
                      sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${chrome.gradient}`}
                      aria-hidden
                    />
                  )}
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-brand-deep/85 via-brand-deep/35 to-transparent"
                  />
                  <div className="relative flex h-full flex-col justify-end p-6">
                    <h2 className="font-display text-2xl font-semibold tracking-tight text-white">
                      {c.name}
                    </h2>
                    {blurb && (
                      <p className="mt-2 text-sm leading-relaxed text-white/80">{blurb}</p>
                    )}
                    <div className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-accent-soft">
                      Explore
                      <span aria-hidden className="transition group-hover:translate-x-0.5">
                        →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-12 rounded-3xl border border-[var(--border)] bg-brand-mist/40 p-8 text-center md:p-10">
          <p className="font-display text-2xl font-semibold tracking-tight text-brand-deep">
            Looking for something specific?
          </p>
          <p className="mx-auto mt-2 max-w-xl text-[15px] leading-relaxed text-muted">
            We special-order regularly for kitchens with specific menus. Tell us
            what you need and we&apos;ll quote within one business day.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/apply"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 text-sm font-semibold text-white transition hover:bg-accent-deep"
            >
              Open an account →
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-12 items-center justify-center rounded-full border border-brand/20 bg-white px-7 text-sm font-semibold text-brand-deep transition hover:border-brand/40"
            >
              Request an item
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
