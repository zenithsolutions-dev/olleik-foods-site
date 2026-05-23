import Link from "next/link";

export default function Home() {
  return (
    <>
      <Hero />
      <LogoCloud />
      <WhyUs />
      <Categories />
      <HowItWorks />
      <Testimonials />
      <Comparison />
      <FAQ />
      <FinalCta />
    </>
  );
}

/* ---------------- HERO ---------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <BackgroundFlourishes />

      <div className="relative mx-auto grid max-w-7xl gap-14 px-6 pt-16 pb-24 lg:grid-cols-12 lg:items-center lg:pt-24 lg:pb-32">
        <div className="lg:col-span-7">
          <span className="fade-up inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-white/70 px-3 py-1 text-xs font-medium text-brand-deep backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Wholesale food supply · Restaurants & small businesses
          </span>

          <h1 className="fade-up-delay-1 font-display mt-6 text-5xl font-semibold leading-[1.02] tracking-tight text-brand-deep sm:text-6xl lg:text-7xl">
            The supplier behind <em className="italic text-accent">great</em> kitchens.
          </h1>

          <p className="fade-up-delay-2 mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Olleik Foods partners with restaurants, cafés, and food businesses
            to deliver restaurant-grade ingredients with the personal service
            and dependable delivery a real operation needs.
          </p>

          <div className="fade-up-delay-3 mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/apply"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 text-sm font-semibold text-white shadow-[0_15px_30px_-12px_rgba(200,122,42,0.65)] transition hover:bg-accent-deep"
            >
              Open a wholesale account
              <span className="transition group-hover:translate-x-0.5">→</span>
            </Link>
            <Link
              href="/#categories"
              className="inline-flex h-12 items-center justify-center rounded-full border border-brand/20 bg-white/70 px-7 text-sm font-semibold text-brand-deep backdrop-blur transition hover:border-brand/40 hover:bg-white"
            >
              See what we carry
            </Link>
          </div>

          <HeroStats />
        </div>

        <div className="lg:col-span-5">
          <HeroMockup />
        </div>
      </div>
    </section>
  );
}

function BackgroundFlourishes() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_-10%,_var(--brand-mist),_transparent_55%),radial-gradient(circle_at_95%_15%,_var(--accent-soft)_0%,_transparent_45%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--border-strong)] to-transparent"
      />
    </>
  );
}

function HeroStats() {
  const stats = [
    { value: "1,500+", label: "SKUs in stock" },
    { value: "6 days/wk", label: "Delivery" },
    { value: "Same-day", label: "Account review" },
  ];
  return (
    <dl className="fade-up-delay-3 mt-12 grid max-w-lg grid-cols-3 gap-4 border-t border-[var(--border-strong)] pt-7">
      {stats.map((s) => (
        <div key={s.label}>
          <dt className="text-xs uppercase tracking-[0.13em] text-muted-soft">{s.label}</dt>
          <dd className="font-display mt-1.5 text-2xl font-semibold tabular-nums text-brand-deep">
            {s.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function HeroMockup() {
  const products = [
    { name: "Roma Tomatoes", note: "25 lb case · vine-ripened", price: "$28.40", tag: "Tier B" },
    { name: "Mozzarella, whole-milk", note: "5 lb log · fresh", price: "$22.95", tag: "Tier B" },
    { name: "Extra-virgin olive oil", note: "3 L · cold-pressed", price: "$32.75", tag: "Contract" },
    { name: "AP Flour", note: "50 lb · unbleached", price: "$19.10", tag: "Tier B" },
  ];
  return (
    <div className="fade-up-delay-2 relative">
      <div className="absolute -inset-6 rounded-[2rem] bg-brand/5 blur-2xl" aria-hidden />
      <div
        aria-hidden
        className="absolute -right-3 -top-3 hidden h-24 w-24 rounded-full bg-accent/20 blur-2xl md:block"
      />
      <div className="relative rounded-3xl border border-[var(--border-strong)] bg-white p-6 shadow-[0_40px_80px_-40px_rgba(20,53,39,0.4)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-soft">
              Your catalog
            </p>
            <p className="font-display mt-1 text-lg font-semibold text-brand-deep">
              Cedar Pizza Co.
            </p>
            <p className="mt-0.5 text-xs text-muted">Tier B · Net-30 · West-side delivery</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-brand-deep">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
            Live
          </span>
        </div>

        <ul className="mt-4 space-y-3">
          {products.map((p) => (
            <li
              key={p.name}
              className="flex items-center justify-between rounded-xl px-2 py-2 transition hover:bg-brand-mist/60"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-mist text-brand-deep"
                >
                  <ProductGlyph name={p.name} />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{p.name}</p>
                  <p className="text-xs text-muted">{p.note}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums text-brand-deep">{p.price}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-soft">{p.tag}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-brand-mist/60 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.13em] text-muted-soft">Delivery</p>
            <p className="mt-1 text-sm font-semibold text-brand-deep">Tomorrow · 6–9am</p>
          </div>
          <div className="rounded-xl bg-accent-soft/50 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.13em] text-accent-deep">Cart</p>
            <p className="mt-1 text-sm font-semibold text-brand-deep">$1,284.20</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductGlyph({ name }: { name: string }) {
  const n = name.toLowerCase();
  if (n.includes("tomato")) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M12 4c-1 1.5-3 1.7-4.4 1.4C5.6 6 4 8 4 11c0 4.5 3.6 9 8 9s8-4.5 8-9c0-3-1.6-5-3.6-5.6C15 5.7 13 5.5 12 4z" opacity=".25" />
        <path d="M11 2c-.4.8-1.3 1.6-2.3 2 .7.4 1.5.6 2.3.6.8 0 1.6-.2 2.3-.6-1-.4-1.9-1.2-2.3-2z" />
      </svg>
    );
  }
  if (n.includes("flour")) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M5 7h14l-1.2 12.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 7z" opacity=".25" />
        <path d="M5 7l1-3h12l1 3H5z" />
      </svg>
    );
  }
  if (n.includes("oil")) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M9 3h6v4l2 2v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9l2-2V3z" opacity=".25" />
        <path d="M9 3h6v3H9z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="8" opacity=".25" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/* ---------------- LOGO CLOUD ---------------- */

function LogoCloud() {
  const customers = [
    "Cedar Pizza Co.",
    "Harvest & Hearth",
    "Maple Lane Café",
    "Olive Branch Bistro",
    "The Standard Kitchen",
    "Driftwood Catering",
  ];
  return (
    <section className="border-y border-[var(--border)] bg-brand-mist/40">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Trusted by independent kitchens across the region
        </p>
        <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
          {customers.map((c) => (
            <p
              key={c}
              className="font-display text-center text-base font-semibold tracking-tight text-brand-deep/70"
            >
              {c}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- WHY US ---------------- */

function WhyUs() {
  const reasons = [
    {
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
          <circle cx="19" cy="17" r="2" fill="currentColor" />
        </svg>
      ),
      title: "Personalized catalog & pricing",
      body: "Each customer sees their negotiated catalog and price tier when they log in — not a public price list. We honor your contract, every order.",
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M3 16V8h11l3 3h4v5h-2" strokeLinejoin="round" />
          <circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" />
        </svg>
      ),
      title: "Reliable, on-schedule delivery",
      body: "Our own trucks, our own drivers, six days a week. Your kitchen knows exactly when stock arrives — and what's on it.",
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="9" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" strokeLinecap="round" />
        </svg>
      ),
      title: "One rep who knows your kitchen",
      body: "A dedicated account manager handles substitutions, special orders, and credits. No call-center runaround, no ticket numbers.",
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18M8 14h4" strokeLinecap="round" />
        </svg>
      ),
      title: "Built for small operators",
      body: "Low minimums, flexible net-30 terms, and order online or by phone. Designed for independent operators, not just enterprise chains.",
    },
  ];
  return (
    <section id="why" className="mx-auto max-w-7xl px-6 py-24 md:py-32">
      <div className="grid gap-10 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
            Why operators choose Olleik
          </p>
          <h2 className="font-display mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-brand-deep sm:text-5xl">
            Built for the way restaurants <em className="italic text-accent">actually</em> order.
          </h2>
        </div>
        <p className="md:col-span-5 text-lg leading-relaxed text-muted">
          Big national distributors treat you like a SKU number. We work with
          you the way a good supplier did twenty years ago — with technology
          that respects your time.
        </p>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-2 lg:gap-7">
        {reasons.map((r) => (
          <div
            key={r.title}
            className="group rounded-3xl border border-[var(--border)] bg-surface p-7 transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_30px_60px_-30px_rgba(20,53,39,0.25)]"
          >
            <span className="inline-grid h-11 w-11 place-items-center rounded-2xl bg-brand-mist text-brand-deep transition group-hover:bg-brand group-hover:text-white">
              {r.icon}
            </span>
            <h3 className="font-display mt-5 text-2xl font-semibold tracking-tight text-brand-deep">
              {r.title}
            </h3>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">{r.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- CATEGORIES ---------------- */

function Categories() {
  const cats = [
    {
      name: "Fresh Produce",
      note: "Daily-sourced fruit and vegetables from regional growers.",
      gradient: "from-emerald-100/80 via-brand-mist to-brand-soft/60",
      icon: (
        <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden>
          <path d="M16 5c-1.5 2-4 3-7 3 0 9 4 16 11 18 7-2 11-9 11-18-3 0-5.5-1-7-3-2 1.2-5 1.2-8 0z" opacity=".25" />
          <path d="M16 5c1.2 1.6 3 2.6 5 3-1 1.5-2.5 2.5-5 2.5S12.5 9.5 11 8c2-.4 3.8-1.4 5-3z" />
        </svg>
      ),
    },
    {
      name: "Meat & Poultry",
      note: "Restaurant-grade cuts, portion control, halal & specialty.",
      gradient: "from-rose-100/70 via-accent-soft/40 to-brand-mist",
      icon: (
        <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden>
          <path d="M9 14c0-5 4-8 9-8s9 3 9 8c0 4-3 7-7 7l-1 5-5-2c-3-1-5-5-5-10z" opacity=".25" />
          <circle cx="11" cy="14" r="2" />
        </svg>
      ),
    },
    {
      name: "Dairy & Eggs",
      note: "Cheese, butter, cream, cultured dairy, and farm-fresh eggs.",
      gradient: "from-amber-50 via-brand-mist to-brand-soft/60",
      icon: (
        <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden>
          <path d="M11 5h10l2 4v17a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9l2-4z" opacity=".25" />
          <path d="M11 5h10l2 4H9l2-4z" />
        </svg>
      ),
    },
    {
      name: "Dry Goods & Pantry",
      note: "Grains, oils, spices, canned goods, and baking essentials.",
      gradient: "from-stone-100 via-brand-mist to-brand-soft/60",
      icon: (
        <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden>
          <path d="M7 9h18l-2 18a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2L7 9z" opacity=".25" />
          <path d="M7 9l1-4h16l1 4H7z" />
        </svg>
      ),
    },
    {
      name: "Beverages",
      note: "Coffee, espresso, juices, bottled water, and soft drinks.",
      gradient: "from-sky-100/70 via-brand-mist to-brand-soft/60",
      icon: (
        <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden>
          <path d="M9 7h12l-1.5 18a3 3 0 0 1-3 2.5h-3a3 3 0 0 1-3-2.5L9 7z" opacity=".25" />
          <path d="M9 7h12v3H9z" />
        </svg>
      ),
    },
    {
      name: "Paper & Cleaning",
      note: "Disposables, take-out packaging, sanitation, and PPE.",
      gradient: "from-lime-50 via-brand-mist to-brand-soft/60",
      icon: (
        <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden>
          <rect x="6" y="6" width="20" height="20" rx="2" opacity=".25" />
          <path d="M6 12h20M12 6v20" strokeWidth="2" stroke="currentColor" fill="none" />
        </svg>
      ),
    },
  ];
  return (
    <section id="categories" className="relative overflow-hidden bg-brand-mist/40 py-24 md:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(28,77,58,0.08),_transparent_60%)]"
      />
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid gap-6 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
              What we carry
            </p>
            <h2 className="font-display mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-brand-deep sm:text-5xl">
              Everything your kitchen needs, <em className="italic text-accent">from one supplier</em>.
            </h2>
          </div>
          <p className="md:col-span-5 text-base leading-relaxed text-muted">
            Approved customers see their assigned catalog with negotiated
            pricing once they sign in. Below is what's available across our
            full inventory.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cats.map((c) => (
            <div
              key={c.name}
              className={`group relative overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-br ${c.gradient} p-7 transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_30px_60px_-30px_rgba(20,53,39,0.3)]`}
            >
              <div className="flex items-start justify-between">
                <span className="inline-grid h-14 w-14 place-items-center rounded-2xl bg-white/80 text-brand-deep shadow-sm">
                  {c.icon}
                </span>
                <span
                  aria-hidden
                  className="text-brand/30 transition group-hover:translate-x-0.5 group-hover:text-brand"
                >
                  →
                </span>
              </div>
              <h3 className="font-display mt-8 text-2xl font-semibold tracking-tight text-brand-deep">
                {c.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{c.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- HOW IT WORKS ---------------- */

function HowItWorks() {
  const steps = [
    { n: "01", title: "Apply in two minutes", body: "Tell us about your business. Same-day review during business hours." },
    { n: "02", title: "We set up your account", body: "Your rep loads your catalog and pricing tier, and walks you through your first order." },
    { n: "03", title: "Order online, anytime", body: "Place, repeat, and adjust orders from your phone. Track delivery and invoices in one place." },
  ];
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-24 md:py-32">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
          How it works
        </p>
        <h2 className="font-display mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-brand-deep sm:text-5xl">
          From application to first delivery in <em className="italic text-accent">days</em>, not weeks.
        </h2>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
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
  );
}

/* ---------------- TESTIMONIALS ---------------- */

function Testimonials() {
  const quotes = [
    {
      quote:
        "Switching to Olleik cut a full hour off our prep mornings. Their rep actually picks up the phone, and the catalog just shows what we order — no scrolling past stuff we'll never buy.",
      name: "Maria Salinas",
      role: "Owner, Cedar Pizza Co.",
      hue: "bg-accent-soft",
    },
    {
      quote:
        "We needed a supplier who could keep up with our menu changes without re-negotiating every quarter. The contract pricing they set up has saved us thousands.",
      name: "James Park",
      role: "Executive Chef, Harvest & Hearth",
      hue: "bg-brand-soft",
    },
    {
      quote:
        "Reliable delivery windows are everything for a café. In two years with Olleik I can count missed slots on one hand — and they always called ahead.",
      name: "Lena Okafor",
      role: "Operator, Maple Lane Café",
      hue: "bg-brand-mist",
    },
  ];
  return (
    <section
      id="testimonials"
      className="relative overflow-hidden border-y border-[var(--border)] bg-brand-deep text-white"
    >
      <div className="absolute inset-0 grain" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-accent/15 blur-3xl"
      />
      <div className="relative mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-soft">
            What customers say
          </p>
          <h2 className="font-display mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            Operators who <em className="italic text-accent">stayed</em>.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-white/70">
            We measure ourselves on how long customers stick with us. Here's
            what a few of them have to say.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {quotes.map((q) => (
            <figure
              key={q.name}
              className="flex flex-col rounded-3xl border border-white/10 bg-white/5 p-7 backdrop-blur"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-7 w-7 text-accent"
                aria-hidden
              >
                <path d="M9 6c-3 0-5 2.5-5 6v6h6v-6H7c0-2.5 1-4 3-4V6zm9 0c-3 0-5 2.5-5 6v6h6v-6h-3c0-2.5 1-4 3-4V6z" />
              </svg>
              <blockquote className="font-display mt-5 flex-1 text-lg leading-relaxed text-white/90">
                "{q.quote}"
              </blockquote>
              <figcaption className="mt-7 flex items-center gap-3 border-t border-white/10 pt-5">
                <span
                  aria-hidden
                  className={`grid h-10 w-10 place-items-center rounded-full ${q.hue} text-sm font-semibold text-brand-deep`}
                >
                  {q.name.split(" ").map((n) => n[0]).join("")}
                </span>
                <div>
                  <p className="text-sm font-semibold">{q.name}</p>
                  <p className="text-xs text-white/60">{q.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- COMPARISON ---------------- */

function Comparison() {
  const rows: Array<{ label: string; olleik: boolean; others: boolean | "limited" | "sometimes" }> = [
    { label: "Personalized catalog & contract pricing", olleik: true, others: false },
    { label: "Dedicated account manager (not a call center)", olleik: true, others: false },
    { label: "Low minimums for independent operators", olleik: true, others: false },
    { label: "Six-day, on-schedule delivery", olleik: true, others: "limited" },
    { label: "Order online, by phone, or via your rep", olleik: true, others: true },
    { label: "Net-30 terms for established accounts", olleik: true, others: "sometimes" },
    { label: "Same-day account review & onboarding", olleik: true, others: false },
  ];
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 md:py-32">
      <div className="grid gap-10 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
            Why we're different
          </p>
          <h2 className="font-display mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-brand-deep sm:text-5xl">
            Olleik vs. <em className="italic text-accent">traditional</em> distributors.
          </h2>
        </div>
        <p className="md:col-span-5 text-base leading-relaxed text-muted">
          The big-box distributors weren't built for independent kitchens.
          We were.
        </p>
      </div>

      <div className="mt-12 overflow-hidden rounded-3xl border border-[var(--border)] bg-surface shadow-sm">
        <div className="grid grid-cols-[1.5fr_1fr_1fr] border-b border-[var(--border)] bg-brand-mist/50 px-6 py-4 text-xs font-semibold uppercase tracking-[0.13em] text-brand-deep">
          <span>Feature</span>
          <span className="text-center">Olleik Foods</span>
          <span className="text-center text-muted">Big distributors</span>
        </div>
        {rows.map((r, i) => (
          <div
            key={r.label}
            className={`grid grid-cols-[1.5fr_1fr_1fr] items-center gap-3 px-6 py-4 text-sm ${
              i % 2 === 0 ? "bg-white" : "bg-brand-mist/20"
            }`}
          >
            <span className="text-foreground">{r.label}</span>
            <span className="text-center">
              <CheckMark value={r.olleik} brand />
            </span>
            <span className="text-center">
              <CheckMark value={r.others} />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CheckMark({
  value,
  brand = false,
}: {
  value: boolean | "limited" | "sometimes";
  brand?: boolean;
}) {
  if (value === true) {
    return (
      <span
        className={`inline-grid h-7 w-7 place-items-center rounded-full ${
          brand ? "bg-brand text-white" : "bg-brand-mist text-brand-deep"
        }`}
      >
        ✓
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-grid h-7 w-7 place-items-center rounded-full bg-[var(--border)] text-muted-soft">
        —
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent-deep">
      {value}
    </span>
  );
}

/* ---------------- FAQ ---------------- */

function FAQ() {
  const items = [
    {
      q: "Who can open an account?",
      a: "Licensed food businesses — restaurants, cafés, bakeries, catering, food trucks, hotels, schools, and grocery. We verify business documents during onboarding.",
    },
    {
      q: "What's the minimum order?",
      a: "We keep minimums low for independent operators. Most accounts have a $250 minimum per delivery, with no minimum monthly volume requirements.",
    },
    {
      q: "Do you offer net-30 terms?",
      a: "Yes. Established customers qualify for net-30 invoicing after the first month, subject to credit approval. New accounts start prepaid or card-on-file.",
    },
    {
      q: "Can I get my existing supplier's pricing matched?",
      a: "If you share a recent invoice or price list with your rep, we'll do our best to match or beat it on equivalent items. We'd rather earn your business once than chase it forever.",
    },
    {
      q: "How fast can I start ordering?",
      a: "We typically have new accounts placing their first order within 24–48 hours. Your rep handles catalog setup and walks you through your first checkout.",
    },
    {
      q: "What if you don't carry an item I need?",
      a: "Tell your rep. We special-order regularly for kitchens with specific menus, and we'll quote within one business day.",
    },
  ];
  return (
    <section id="faq" className="bg-brand-mist/30 py-24 md:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
            Frequently asked
          </p>
          <h2 className="font-display mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-brand-deep sm:text-5xl">
            Answers, before you ask.
          </h2>
        </div>

        <div className="mt-14 grid gap-3 md:grid-cols-2">
          {items.map((item) => (
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
    </section>
  );
}

/* ---------------- FINAL CTA ---------------- */

function FinalCta() {
  return (
    <section className="px-6 pb-24">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-brand-deep px-8 py-16 text-white shadow-[0_40px_80px_-30px_rgba(20,53,39,0.55)] md:px-16 md:py-20">
        <div className="absolute inset-0 grain" aria-hidden />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-brand-soft/15 blur-3xl"
        />

        <div className="relative grid gap-10 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-soft">
              Ready when you are
            </p>
            <h2 className="font-display mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              Simplify your supply chain. <em className="italic text-accent">Today.</em>
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/75">
              Apply in two minutes. Same-day review during business hours, with
              a rep walking you through your first order.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              href="/apply"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 text-sm font-semibold text-white shadow-[0_15px_30px_-12px_rgba(200,122,42,0.8)] transition hover:bg-accent-deep"
            >
              Open an account
              <span className="transition group-hover:translate-x-0.5">→</span>
            </Link>
            <Link
              href="mailto:sales@olleikfoods.com"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-7 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/5"
            >
              Talk to sales
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
