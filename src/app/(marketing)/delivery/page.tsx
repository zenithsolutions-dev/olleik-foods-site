import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delivery | Olleik Foods — Six-Day Wholesale Delivery, Ottawa",
  description:
    "Our own trucks and drivers deliver six days a week across the Ottawa region, with cold-chain integrity, scheduled windows, and order tracking for every account.",
};

const steps = [
  {
    n: "01",
    title: "Order by your cutoff",
    body: "Place your order online or with your rep before the daily cutoff for your route. Standing orders repeat automatically.",
  },
  {
    n: "02",
    title: "We pick & temperature-check",
    body: "Your order is picked, cold-chain verified at the dock, and staged for your delivery window — not your competitor's.",
  },
  {
    n: "03",
    title: "Delivered on schedule",
    body: "Our driver arrives in your window with a clear invoice. Short something or need a credit? Your rep handles it same day.",
  },
];

const features = [
  {
    title: "Our trucks, our drivers",
    body: "We don't hand your delivery to a third-party courier. The same drivers learn your dock, your hours, and your kitchen.",
  },
  {
    title: "Cold-chain integrity",
    body: "Refrigerated trucks and dock-to-dock temperature logs keep produce, dairy, and protein at spec the whole way.",
  },
  {
    title: "Six days a week",
    body: "Monday through Saturday across the Ottawa region, so your kitchen is never waiting on Monday for a weekend gap.",
  },
  {
    title: "Scheduled windows",
    body: "You know when stock arrives and what's on it — with a heads-up call if anything changes.",
  },
];

export default function DeliveryPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_-10%,_var(--accent-soft),_transparent_50%)]"
        />
        <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-12 md:pt-24">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
            Delivery
          </p>
          <h1 className="font-display mt-4 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-tight text-brand-deep sm:text-5xl lg:text-6xl">
            Reliable delivery is the <em className="italic text-accent">whole</em> job.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            A great price means nothing if the truck doesn&apos;t show. We run
            our own fleet across the Ottawa region so your kitchen knows exactly
            when stock arrives — and what&apos;s on it.
          </p>
        </div>
      </section>

      {/* How delivery works */}
      <section className="mx-auto max-w-7xl px-6 py-12 md:py-16">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
            How it works
          </p>
          <h2 className="font-display mt-4 text-3xl font-semibold leading-[1.08] tracking-tight text-brand-deep sm:text-4xl">
            From cutoff to dock.
          </h2>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className="relative rounded-3xl border border-[var(--border)] bg-surface p-7"
            >
              <div className="flex items-center justify-between">
                <p className="font-display text-3xl font-semibold text-accent">{s.n}</p>
                {i < steps.length - 1 && (
                  <span aria-hidden className="hidden text-brand/20 md:inline">→</span>
                )}
              </div>
              <h3 className="font-display mt-6 text-2xl font-semibold tracking-tight text-brand-deep">
                {s.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-brand-mist/40 py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-4 md:grid-cols-2">
            {features.map((f) => (
              <div
                key={f.title}
                className="flex items-start gap-4 rounded-3xl border border-[var(--border)] bg-surface p-7"
              >
                <span
                  aria-hidden
                  className="mt-0.5 inline-grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-sm text-white"
                >
                  ✓
                </span>
                <div>
                  <h3 className="font-display text-xl font-semibold tracking-tight text-brand-deep">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coverage / CTA */}
      <section className="px-6 py-20 md:py-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-brand-deep px-8 py-14 text-white shadow-[0_40px_80px_-30px_rgba(20,53,39,0.55)] md:px-16 md:py-16">
          <div className="absolute inset-0 grain" aria-hidden />
          <div className="relative grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-soft">
                Coverage
              </p>
              <h2 className="font-display mt-4 text-3xl font-semibold leading-[1.08] tracking-tight sm:text-4xl">
                Serving the greater Ottawa region.
              </h2>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/75">
                Not sure if your address is on a route? Ask — we&apos;re adding
                stops as we grow, and your rep can confirm your delivery window
                during onboarding.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="/apply"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 text-sm font-semibold text-white transition hover:bg-accent-deep"
              >
                Check my area
                <span className="transition group-hover:translate-x-0.5">→</span>
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-7 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/5"
              >
                Contact us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
