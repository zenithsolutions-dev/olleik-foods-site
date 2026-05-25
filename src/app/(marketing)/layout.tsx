import Link from "next/link";

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col">
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

function AnnouncementBar() {
  return (
    <div className="bg-brand-deep text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-2 text-[12px]">
        <p className="flex items-center gap-2 font-medium tracking-wide">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          Now accepting new wholesale accounts — same-day review during business hours.
        </p>
        <Link
          href="/apply"
          className="hidden font-semibold text-accent-soft hover:text-white sm:inline-flex"
        >
          Apply →
        </Link>
      </div>
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid h-9 w-9 place-items-center rounded-md bg-brand text-white font-display text-base font-semibold"
          >
            O
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-brand-deep">
            Olleik <span className="text-accent">Foods</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-foreground/80 md:flex">
          <Link href="/#why" className="transition hover:text-brand">Why Olleik</Link>
          <Link href="/#categories" className="transition hover:text-brand">Categories</Link>
          <Link href="/#how-it-works" className="transition hover:text-brand">How it works</Link>
          <Link href="/#testimonials" className="transition hover:text-brand">Customers</Link>
          <Link href="/login" className="transition hover:text-brand">Sign in</Link>
        </nav>

        <Link
          href="/apply"
          className="group inline-flex items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(200,122,42,0.6)] transition hover:bg-accent-deep"
        >
          Become a customer
          <span className="transition group-hover:translate-x-0.5">→</span>
        </Link>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-[var(--border)] bg-brand-deep text-white">
      <div className="absolute inset-0 grain" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="grid h-9 w-9 place-items-center rounded-md bg-accent font-display text-base font-semibold text-white"
              >
                O
              </span>
              <span className="font-display text-xl font-semibold tracking-tight">
                Olleik Foods
              </span>
            </div>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-white/70">
              Wholesale food supply for restaurants, cafés, and small
              businesses. Personalized catalogs, transparent pricing, and
              dependable delivery — built around the way your kitchen actually
              runs.
            </p>

            <form className="mt-7 flex max-w-sm gap-2" aria-label="Stay in the loop">
              <input
                type="email"
                name="newsletter"
                placeholder="your@business.com"
                className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-deep"
              >
                Subscribe
              </button>
            </form>
            <p className="mt-2 text-[11px] text-white/40">
              Monthly seasonal availability and price-list updates. No spam.
            </p>
          </div>

          <div className="md:col-span-2">
            <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-accent-soft">
              Explore
            </h4>
            <ul className="mt-5 space-y-2.5 text-sm text-white/70">
              <li><Link href="/#why" className="hover:text-white">Why Olleik</Link></li>
              <li><Link href="/#categories" className="hover:text-white">Categories</Link></li>
              <li><Link href="/#how-it-works" className="hover:text-white">How it works</Link></li>
              <li><Link href="/#testimonials" className="hover:text-white">Customers</Link></li>
              <li><Link href="/#faq" className="hover:text-white">FAQ</Link></li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-accent-soft">
              Account
            </h4>
            <ul className="mt-5 space-y-2.5 text-sm text-white/70">
              <li><Link href="/apply" className="hover:text-white">Become a customer</Link></li>
              <li><Link href="/login" className="hover:text-white">Customer sign in</Link></li>
            </ul>
          </div>

          <div className="md:col-span-3">
            <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-accent-soft">
              Get in touch
            </h4>
            <ul className="mt-5 space-y-2.5 text-sm text-white/70">
              <li>sales@olleikfoods.com</li>
              <li>(000) 000-0000</li>
              <li className="text-white/50">Mon – Sat · 7am – 5pm</li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/50 md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} Olleik Foods. All rights reserved.</p>
          <p>Crafted by Zenith AI</p>
        </div>
      </div>
    </footer>
  );
}
