import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | Olleik Foods — Ottawa Wholesale Food Distributor",
  description:
    "Olleik Foods is an Ottawa-region wholesale food distributor built on dependable people, direct sourcing, and the personal service independent kitchens deserve.",
};

const values = [
  {
    title: "People over numbers",
    body: "Every customer gets a real rep who knows their kitchen. No call centers, no ticket queues — just someone who picks up.",
  },
  {
    title: "Source it right",
    body: "We work directly with regional farms and trusted importers, and we check quality at our dock so you don't have to at your door.",
  },
  {
    title: "Earn it every order",
    body: "We measure success by how long customers stay. That keeps us honest on price, quality, and the delivery window.",
  },
];

const stats = [
  { value: "1,500+", label: "SKUs in stock" },
  { value: "6 days/wk", label: "Delivery" },
  { value: "Same-day", label: "Account review" },
  { value: "Ottawa", label: "Region served" },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_-10%,_var(--brand-mist),_transparent_55%)]"
        />
        <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-12 md:pt-24">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
            About Olleik Foods
          </p>
          <h1 className="font-display mt-4 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-tight text-brand-deep sm:text-5xl lg:text-6xl">
            The supplier behind <em className="italic text-accent">great</em> kitchens.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            Olleik Foods is a wholesale food distributor serving restaurants,
            cafés, and food businesses across the Ottawa region — with the
            personal service and dependable delivery a real operation needs.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <div className="space-y-6 text-lg leading-relaxed text-muted">
          <p>
            We started Olleik Foods because the big national distributors treat
            independent kitchens like a SKU number. Long hold times, rotating
            reps, minimums that don&apos;t fit a small operation, and a public
            price list that ignores the relationship.
          </p>
          <p>
            We do it the way a good supplier did twenty years ago — one rep who
            knows your kitchen, a catalog and price tier negotiated for your
            business, and our own trucks on the road six days a week — but with
            technology that respects your time.
          </p>
          <p>
            Today we supply everything from fresh produce and protein to dry
            goods, beverages, and packaging, sourced directly and checked at our
            dock. We&apos;re proud to be part of the region&apos;s food scene,
            one kitchen at a time.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-brand-mist/40 py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <dd className="font-display text-4xl font-semibold tabular-nums text-brand-deep">
                  {s.value}
                </dd>
                <dt className="mt-2 text-xs uppercase tracking-[0.13em] text-muted">
                  {s.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Values */}
      <section className="mx-auto max-w-7xl px-6 py-20 md:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
            What we stand for
          </p>
          <h2 className="font-display mt-4 text-3xl font-semibold leading-[1.08] tracking-tight text-brand-deep sm:text-4xl">
            The principles behind every order.
          </h2>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {values.map((v) => (
            <div
              key={v.title}
              className="rounded-3xl border border-[var(--border)] bg-surface p-7"
            >
              <h3 className="font-display text-xl font-semibold tracking-tight text-brand-deep">
                {v.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-brand-deep px-8 py-14 text-white shadow-[0_40px_80px_-30px_rgba(20,53,39,0.55)] md:px-16 md:py-16">
          <div className="absolute inset-0 grain" aria-hidden />
          <div className="relative grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
            <div>
              <h2 className="font-display text-3xl font-semibold leading-[1.08] tracking-tight sm:text-4xl">
                Let&apos;s supply your kitchen.
              </h2>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/75">
                Apply in two minutes. Same-day review during business hours,
                with a rep walking you through your first order.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="/apply"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 text-sm font-semibold text-white transition hover:bg-accent-deep"
              >
                Open an account
                <span className="transition group-hover:translate-x-0.5">→</span>
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-7 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/5"
              >
                Talk to us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
