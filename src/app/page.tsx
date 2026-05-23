import Link from "next/link";

const categories = [
  { name: "Fresh Produce", note: "Daily-sourced fruit & vegetables" },
  { name: "Meat & Poultry", note: "Restaurant-grade cuts and portions" },
  { name: "Dairy & Eggs", note: "Cheese, butter, cream, eggs" },
  { name: "Dry Goods & Pantry", note: "Grains, oils, spices, canned" },
  { name: "Beverages", note: "Coffee, juices, water, soft drinks" },
  { name: "Paper & Cleaning", note: "Disposables, packaging, sanitation" },
];

const reasons = [
  {
    title: "Personalized catalog & pricing",
    body: "Your account shows the products you actually buy, at the prices we negotiated for your business — not a public price list.",
  },
  {
    title: "Reliable, on-schedule delivery",
    body: "We run our own delivery windows so your kitchen knows exactly when stock arrives, six days a week.",
  },
  {
    title: "One rep who knows your kitchen",
    body: "A dedicated account manager handles substitutions, special orders, and credits — no call-center runaround.",
  },
  {
    title: "Built for small operators",
    body: "Low minimums, flexible terms, and order-online or by-phone — designed for independent restaurants, not just chains.",
  },
];

const steps = [
  {
    n: "01",
    title: "Apply in 2 minutes",
    body: "Tell us about your business. We review applications same-day during business hours.",
  },
  {
    n: "02",
    title: "We set up your account",
    body: "Your rep loads your catalog and pricing tier, and walks you through your first order.",
  },
  {
    n: "03",
    title: "Order online, anytime",
    body: "Place, repeat, and adjust orders from your phone — track delivery and invoices in one place.",
  },
];

export default function Home() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <WhyUs />
      <Categories />
      <HowItWorks />
      <FinalCta />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,_var(--brand-soft),_transparent_55%)]"
      />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-6 pt-20 pb-24 md:grid-cols-2 md:items-center md:pt-28 md:pb-32">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/70 px-3 py-1 text-xs font-medium text-brand-deep">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Wholesale food supply
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-brand-deep sm:text-5xl md:text-6xl">
            The dependable food supplier behind your kitchen.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Olleik Foods serves restaurants, cafés, and small businesses with
            personalized catalogs, transparent pricing, and on-schedule
            delivery — so your team can focus on the food, not the supply chain.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/apply"
              className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-deep"
            >
              Become a customer
            </Link>
            <Link
              href="/#categories"
              className="inline-flex h-12 items-center justify-center rounded-full border border-brand/20 bg-white px-6 text-sm font-semibold text-brand-deep transition hover:border-brand/40"
            >
              See what we carry →
            </Link>
          </div>
        </div>

        <HeroCard />
      </div>
    </section>
  );
}

function HeroCard() {
  const products = [
    { name: "Roma Tomatoes — 25 lb case", price: "$28.40", change: "Your price" },
    { name: "Mozzarella, whole-milk — 5 lb", price: "$22.95", change: "Your price" },
    { name: "AP Flour — 50 lb sack", price: "$19.10", change: "Your price" },
    { name: "Olive Oil, extra virgin — 3 L", price: "$32.75", change: "Your price" },
  ];
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-3xl bg-brand/5 blur-xl" aria-hidden />
      <div className="relative rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[0_30px_60px_-30px_rgba(20,53,39,0.35)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
              Your catalog
            </p>
            <p className="mt-0.5 text-sm font-semibold text-brand-deep">
              Cedar Pizza Co. — Tier B pricing
            </p>
          </div>
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-deep">
            Live
          </span>
        </div>

        <ul className="mt-3 divide-y divide-[var(--border)]">
          {products.map((p) => (
            <li key={p.name} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{p.name}</p>
                <p className="text-xs text-muted">{p.change}</p>
              </div>
              <p className="text-sm font-semibold tabular-nums text-brand-deep">
                {p.price}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between rounded-lg bg-brand-soft/60 px-4 py-3">
          <p className="text-xs text-muted">Delivery</p>
          <p className="text-xs font-semibold text-brand-deep">
            Tomorrow, 6–9am
          </p>
        </div>
      </div>
    </div>
  );
}

function TrustStrip() {
  const stats = [
    { value: "1,500+", label: "SKUs in stock" },
    { value: "6 days/wk", label: "Delivery schedule" },
    { value: "Same-day", label: "New-account review" },
    { value: "Net-30", label: "Terms available" },
  ];
  return (
    <section className="border-y border-[var(--border)] bg-white/70">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-6 py-8 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center md:text-left">
            <p className="text-2xl font-semibold text-brand-deep tabular-nums">
              {s.value}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wider text-muted">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhyUs() {
  return (
    <section id="why" className="mx-auto max-w-7xl px-6 py-20 md:py-28">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent-deep">
          Why operators choose Olleik
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          Built for the way restaurants actually order.
        </h2>
        <p className="mt-4 text-lg text-muted">
          Big distributors treat you like a SKU. We work with you the way a
          good supplier did twenty years ago — with technology that respects
          your time.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {reasons.map((r) => (
          <div
            key={r.title}
            className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <h3 className="text-lg font-semibold text-brand-deep">{r.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{r.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Categories() {
  return (
    <section id="categories" className="bg-brand-soft/40 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent-deep">
              What we carry
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
              Everything your kitchen needs, from one supplier.
            </h2>
          </div>
          <p className="max-w-sm text-sm text-muted">
            Approved customers see their assigned catalog and negotiated
            pricing once they log in.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <div
              key={c.name}
              className="group rounded-2xl border border-[var(--border)] bg-white p-6 transition hover:border-brand/30 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-brand-deep">
                  {c.name}
                </h3>
                <span
                  aria-hidden
                  className="text-brand/40 transition group-hover:translate-x-0.5 group-hover:text-brand"
                >
                  →
                </span>
              </div>
              <p className="mt-2 text-sm text-muted">{c.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-20 md:py-28">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent-deep">
          How it works
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          From application to first delivery in days, not weeks.
        </h2>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="relative rounded-2xl border border-[var(--border)] bg-white p-6">
            <p className="text-xs font-semibold tracking-widest text-accent">{s.n}</p>
            <h3 className="mt-3 text-lg font-semibold text-brand-deep">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-6 pb-24">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-brand-deep px-8 py-14 text-white shadow-[0_30px_60px_-30px_rgba(20,53,39,0.5)] md:px-14 md:py-16">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready to simplify your supply chain?
            </h2>
            <p className="mt-4 max-w-xl text-white/80">
              Apply in two minutes. We review same-day during business hours
              and have a rep walk you through your first order.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
            <Link
              href="/apply"
              className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-deep"
            >
              Become a customer
            </Link>
            <Link
              href="mailto:sales@olleikfoods.com"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/30 px-6 text-sm font-semibold text-white transition hover:border-white/60"
            >
              Talk to sales
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
