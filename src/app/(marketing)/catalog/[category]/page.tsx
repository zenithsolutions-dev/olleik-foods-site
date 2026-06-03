import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { categories, getCategory } from "@/lib/catalog";

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const data = getCategory(category);
  if (!data) return { title: "Catalog | Olleik Foods" };
  return {
    title: `${data.name} — Wholesale | Olleik Foods`,
    description: `${data.description} Wholesale supply across the Ottawa region from Olleik Foods.`,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const data = getCategory(category);
  if (!data) notFound();

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
            <p className="mt-5 text-lg leading-relaxed text-muted">{data.description}</p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              {data.highlights.map((h) => (
                <span
                  key={h}
                  className="inline-flex items-center rounded-full border border-[var(--border-strong)] bg-brand-mist/50 px-4 py-2 text-sm font-medium text-brand-deep"
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
          <div className="lg:col-span-6">
            <div className="relative aspect-[5/4] w-full overflow-hidden rounded-[2rem] border border-[var(--border-strong)] bg-brand-mist shadow-[0_40px_80px_-40px_rgba(20,53,39,0.45)]">
              {data.image ? (
                <Image
                  src={data.image}
                  alt={data.imageAlt ?? data.name}
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
              ) : (
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${data.gradient}`}
                  aria-hidden
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Representative items */}
      <section className="bg-brand-mist/40 py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
              Representative of the range
            </p>
            <h2 className="font-display mt-4 text-3xl font-semibold leading-[1.08] tracking-tight text-brand-deep sm:text-4xl">
              A sample of what&apos;s available.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              A snapshot, not the full list. Your signed-in catalog shows the
              specific items and pack sizes set up for your account.
            </p>
          </div>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.examples.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-surface px-5 py-4"
              >
                <span
                  aria-hidden
                  className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-mist text-brand-deep"
                >
                  •
                </span>
                <span className="text-[15px] font-medium text-foreground">{item}</span>
              </li>
            ))}
          </ul>
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
