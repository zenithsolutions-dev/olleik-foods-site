import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Who We Serve | Olleik Foods — Ottawa Wholesale Food Supply",
  description:
    "Olleik Foods supplies restaurants, cafés, bakeries, caterers, food trucks, hotels, and institutions across the Ottawa region with personalized catalogs and dependable delivery.",
};

const segments = [
  {
    title: "Restaurants & bistros",
    body: "Full-service and quick-service kitchens that need consistent, restaurant-grade product and a rep who answers the phone.",
  },
  {
    title: "Cafés & bakeries",
    body: "Reliable dairy, flour, specialty ingredients, and packaging — on a delivery window your morning prep can count on.",
  },
  {
    title: "Caterers & event kitchens",
    body: "Flexible ordering and special-order sourcing for menus that change with every booking.",
  },
  {
    title: "Food trucks & small operators",
    body: "Low minimums and simple online ordering built for lean teams, not just enterprise chains.",
  },
  {
    title: "Hotels & hospitality",
    body: "Volume capacity with the personal account management that keeps multi-outlet operations running.",
  },
  {
    title: "Schools & institutions",
    body: "Dependable, documented supply for cafeterias and care facilities, with the paperwork your procurement needs.",
  },
];

export default function WhoWeServePage() {
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
            Who we serve
          </p>
          <h1 className="font-display mt-4 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-tight text-brand-deep sm:text-5xl lg:text-6xl">
            Built for independent kitchens of <em className="italic text-accent">every</em> kind.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            From a two-person café to a multi-outlet hotel, we tailor the
            catalog, pricing, and delivery to the way each operation actually
            runs. If you serve food, we can supply it.
          </p>
        </div>
      </section>

      {/* Segments */}
      <section className="mx-auto max-w-7xl px-6 py-12 md:py-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {segments.map((s) => (
            <div
              key={s.title}
              className="rounded-3xl border border-[var(--border)] bg-surface p-7 transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_30px_60px_-30px_rgba(20,53,39,0.25)]"
            >
              <h3 className="font-display text-xl font-semibold tracking-tight text-brand-deep">
                {s.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Reassurance band */}
      <section className="bg-brand-mist/40 py-20 md:py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
            One supplier, your way
          </p>
          <h2 className="font-display mt-4 text-3xl font-semibold leading-[1.08] tracking-tight text-brand-deep sm:text-4xl">
            Not sure if you&apos;re a fit? You probably are.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted">
            We work with licensed food businesses of all sizes. Tell us what you
            run, and your rep will set up a catalog and pricing tier that match.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/apply"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 text-sm font-semibold text-white shadow-[0_15px_30px_-12px_rgba(200,122,42,0.65)] transition hover:bg-accent-deep"
            >
              Open a wholesale account
              <span className="transition group-hover:translate-x-0.5">→</span>
            </Link>
            <Link
              href="/catalog"
              className="inline-flex h-12 items-center justify-center rounded-full border border-brand/20 bg-white/70 px-7 text-sm font-semibold text-brand-deep backdrop-blur transition hover:border-brand/40 hover:bg-white"
            >
              Browse the catalog
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
