import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryChrome } from "@/lib/catalog";
import {
  fetchPublicCatalog,
  findCategoryBySlug,
  type PublicProduct,
} from "@/lib/catalog-data";

// Live, price-free read on every request.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const catalog = await fetchPublicCatalog();
  const data = findCategoryBySlug(catalog, category);
  if (!data) return { title: "Catalog | Olleik Foods" };
  const chrome = getCategoryChrome(data.slug);
  const desc = data.description ?? chrome.blurb ?? "";
  return {
    title: `${data.name} — Wholesale | Olleik Foods`,
    description: `${desc} Wholesale supply across the Ottawa region from Olleik Foods.`.trim(),
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const catalog = await fetchPublicCatalog();
  const data = findCategoryBySlug(catalog, category);
  if (!data) notFound(); // unknown slug → 404; real-but-empty falls through to empty state

  const chrome = getCategoryChrome(data.slug);
  const description = data.description ?? chrome.blurb ?? null;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 pt-14 pb-16 md:pt-20 lg:grid-cols-12 lg:items-center lg:gap-16">
          <div className="lg:col-span-6">
            <Link
              href="/catalog"
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-accent-deep transition hover:text-accent"
            >
              <span aria-hidden>←</span> Catalog
            </Link>
            <h1 className="font-display mt-6 text-4xl font-semibold leading-[1.04] tracking-tight text-brand-deep sm:text-5xl">
              {data.name}
            </h1>
            {description && (
              <p className="mt-5 text-lg leading-relaxed text-muted">{description}</p>
            )}
          </div>
          <div className="lg:col-span-6">
            <div className="relative aspect-[5/4] w-full overflow-hidden rounded-[2rem] border border-[var(--border-strong)] bg-brand-mist shadow-[0_40px_80px_-40px_rgba(20,53,39,0.45)]">
              {chrome.image ? (
                <Image
                  src={chrome.image}
                  alt={chrome.imageAlt ?? data.name}
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
              ) : (
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${chrome.gradient}`}
                  aria-hidden
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="bg-brand-mist/40 py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
              In this category
            </p>
            <h2 className="font-display mt-4 text-3xl font-semibold leading-[1.08] tracking-tight text-brand-deep sm:text-4xl">
              {data.products.length > 0
                ? "What we carry here."
                : "Items coming soon."}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              Pack sizes shown are typical. Your signed-in catalog shows the
              specific items and negotiated pricing set up for your account.
            </p>
          </div>

          {data.products.length > 0 ? (
            data.children.length > 0 ? (
              // Parent category (D4): its own products first, then each
              // subcategory under its own subheading. Still price-free.
              <div className="mt-10 space-y-12">
                {data.ownProducts.length > 0 && (
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {data.ownProducts.map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                )}
                {data.children
                  .filter((sub) => sub.products.length > 0)
                  .map((sub) => (
                    <div key={sub.id}>
                      <h3 className="font-display text-xl font-semibold tracking-tight text-brand-deep">
                        {sub.name}
                      </h3>
                      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {sub.products.map((p) => (
                          <ProductCard key={p.id} product={p} />
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {data.products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )
          ) : (
            <div className="mt-10 rounded-3xl border border-dashed border-[var(--border-strong)] bg-surface p-8 text-center">
              <p className="text-[15px] leading-relaxed text-muted">
                We&apos;re still loading items into this category online. Tell us
                what you need and we&apos;ll quote it within one business day.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 md:py-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-brand-deep px-8 py-14 text-white shadow-[0_40px_80px_-30px_rgba(20,53,39,0.55)] md:px-16 md:py-16">
          <div className="absolute inset-0 grain" aria-hidden />
          <div className="relative grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
            <div>
              <h2 className="font-display text-3xl font-semibold leading-[1.08] tracking-tight sm:text-4xl">
                Want pricing on {data.name.toLowerCase()}?
              </h2>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/75">
                Open an account to see your catalog and contract pricing, or ask
                us to quote specific items.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="/apply"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 text-sm font-semibold text-white transition hover:bg-accent-deep"
              >
                Request pricing →
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-7 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/5"
              >
                Ask about an item
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function ProductCard({ product: p }: { product: PublicProduct }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface">
      <div className="relative aspect-[4/3] w-full bg-brand-mist">
        {p.imageUrl ? (
          <Image
            src={p.imageUrl}
            alt={p.name}
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 grid place-items-center bg-gradient-to-br from-brand-mist to-accent-soft/50 text-brand-deep/35"
          >
            <span className="font-display text-4xl font-semibold">
              {p.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-medium leading-snug text-foreground">{p.name}</h3>
        {p.description && (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">
            {p.description}
          </p>
        )}
        <p className="mt-3 text-xs font-medium uppercase tracking-wider text-muted-soft">
          {p.unitSize} · {p.unit}
        </p>
      </div>
    </div>
  );
}
