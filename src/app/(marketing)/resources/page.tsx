import Link from "next/link";
import type { Metadata } from "next";
import { articles } from "@/lib/resources";

export const metadata: Metadata = {
  title: "Resources | Olleik Foods",
  description:
    "Practical guides for restaurants and food businesses — choosing a supplier, understanding wholesale pricing, and managing food cost — from Olleik Foods.",
};

export default function ResourcesPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,_var(--brand-mist),_transparent_55%)]"
        />
        <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-12 md:pt-24">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
            Resources
          </p>
          <h1 className="font-display mt-4 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-tight text-brand-deep sm:text-5xl lg:text-6xl">
            Run a <em className="italic text-accent">sharper</em> kitchen.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            Practical, no-fluff guides for operators — choosing suppliers,
            understanding wholesale pricing, and protecting your margins.
          </p>
        </div>
      </section>

      {/* Article list */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-5">
          {articles.map((a) => (
            <Link
              key={a.slug}
              href={`/resources/${a.slug}`}
              className="group rounded-3xl border border-[var(--border)] bg-surface p-7 transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_30px_60px_-30px_rgba(20,53,39,0.25)] md:p-8"
            >
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.13em]">
                <span className="rounded-full bg-accent-soft px-3 py-1 text-accent-deep">
                  {a.tag}
                </span>
                <span className="text-muted-soft">{a.readMins} min read</span>
              </div>
              <h2 className="font-display mt-4 text-2xl font-semibold leading-tight tracking-tight text-brand-deep group-hover:text-brand">
                {a.title}
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{a.excerpt}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-accent-deep">
                Read
                <span aria-hidden className="transition group-hover:translate-x-0.5">
                  →
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
