import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ | Olleik Foods — Wholesale Account Questions",
  description:
    "Answers to common questions about opening a wholesale account with Olleik Foods: eligibility, minimums, net-30 terms, delivery, pricing, and special orders.",
};

const groups: { heading: string; items: { q: string; a: string }[] }[] = [
  {
    heading: "Getting started",
    items: [
      {
        q: "Who can open an account?",
        a: "Licensed food businesses — restaurants, cafés, bakeries, catering, food trucks, hotels, schools, and grocery. We verify business documents during onboarding.",
      },
      {
        q: "How fast can I start ordering?",
        a: "We typically have new accounts placing their first order within 24–48 hours. Your rep handles catalog setup and walks you through your first checkout.",
      },
      {
        q: "Can I get my existing supplier's pricing matched?",
        a: "If you share a recent invoice or price list with your rep, we'll do our best to match or beat it on equivalent items. We'd rather earn your business once than chase it forever.",
      },
    ],
  },
  {
    heading: "Ordering & pricing",
    items: [
      {
        q: "What's the minimum order?",
        a: "We keep minimums low for independent operators. Most accounts have a $250 minimum per delivery, with no minimum monthly volume requirements.",
      },
      {
        q: "Why don't I see prices on the catalog?",
        a: "Pricing is personalized. Approved customers see their negotiated catalog and price tier once they sign in — not a public price list.",
      },
      {
        q: "Do you offer net-30 terms?",
        a: "Yes. Established customers qualify for net-30 invoicing after the first month, subject to credit approval. New accounts start prepaid or card-on-file.",
      },
      {
        q: "What if you don't carry an item I need?",
        a: "Tell your rep. We special-order regularly for kitchens with specific menus, and we'll quote within one business day.",
      },
    ],
  },
  {
    heading: "Delivery",
    items: [
      {
        q: "How often do you deliver?",
        a: "Six days a week — Monday through Saturday — across the Ottawa region, on a scheduled window for your route.",
      },
      {
        q: "Is my address on a delivery route?",
        a: "We're adding stops as we grow. Apply or contact us and your rep will confirm your delivery window during onboarding.",
      },
      {
        q: "What if an item arrives short or off-spec?",
        a: "Your rep credits the invoice — same day. Quality is checked at our dock, and we stand behind what we deliver.",
      },
    ],
  },
];

export default function FaqPage() {
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
            Frequently asked
          </p>
          <h1 className="font-display mt-4 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-tight text-brand-deep sm:text-5xl lg:text-6xl">
            Answers, before you <em className="italic text-accent">ask</em>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            Everything operators usually want to know about working with Olleik
            Foods. Still have a question? We&apos;re a message away.
          </p>
        </div>
      </section>

      {/* FAQ groups */}
      <section className="mx-auto max-w-5xl px-6 py-12 md:py-16">
        <div className="space-y-12">
          {groups.map((g) => (
            <div key={g.heading}>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-brand-deep">
                {g.heading}
              </h2>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {g.items.map((item) => (
                  <details
                    key={item.q}
                    className="group rounded-2xl border border-[var(--border)] bg-surface p-5 transition hover:border-brand/25 open:border-brand/30 open:shadow-sm"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
                      <span className="font-display text-lg font-semibold tracking-tight text-brand-deep">
                        {item.q}
                      </span>
                      <span
                        aria-hidden
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-mist text-brand-deep transition group-open:rotate-45 group-open:bg-brand group-open:text-white"
                      >
                        +
                      </span>
                    </summary>
                    <p className="mt-3 text-[15px] leading-relaxed text-muted">{item.a}</p>
                  </details>
                ))}
              </div>
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
                Still have a question?
              </h2>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/75">
                Our team is happy to help with eligibility, delivery, or pricing
                — no commitment required.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="/contact"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 text-sm font-semibold text-white transition hover:bg-accent-deep"
              >
                Contact us
                <span className="transition group-hover:translate-x-0.5">→</span>
              </Link>
              <Link
                href="/apply"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-7 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/5"
              >
                Open an account
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
