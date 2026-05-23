import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Olleik Foods — Wholesale food supply for restaurants & small businesses",
  description:
    "Olleik Foods delivers reliable, restaurant-grade ingredients with personalized pricing and dedicated service for restaurants, cafés, and small businesses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-md bg-brand text-white text-sm font-bold tracking-tight"
          >
            OF
          </span>
          <span className="text-lg font-semibold tracking-tight text-brand-deep">
            Olleik Foods
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-foreground/80 md:flex">
          <Link href="/#why" className="transition hover:text-brand">Why Olleik</Link>
          <Link href="/#categories" className="transition hover:text-brand">Categories</Link>
          <Link href="/#how-it-works" className="transition hover:text-brand">How it works</Link>
          <Link href="/login" className="transition hover:text-brand">Customer login</Link>
        </nav>

        <Link
          href="/apply"
          className="inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-deep"
        >
          Become a customer
        </Link>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-brand-soft/40">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="grid h-8 w-8 place-items-center rounded-md bg-brand text-white text-sm font-bold"
              >
                OF
              </span>
              <span className="text-lg font-semibold tracking-tight text-brand-deep">
                Olleik Foods
              </span>
            </div>
            <p className="mt-4 max-w-md text-sm text-muted">
              Wholesale food supply for restaurants, cafés, and small businesses.
              Personalized catalogs, transparent pricing, and dependable delivery.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-deep">
              Explore
            </h4>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li><Link href="/#why" className="hover:text-brand">Why Olleik</Link></li>
              <li><Link href="/#categories" className="hover:text-brand">Categories</Link></li>
              <li><Link href="/#how-it-works" className="hover:text-brand">How it works</Link></li>
              <li><Link href="/apply" className="hover:text-brand">Become a customer</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-deep">
              Contact
            </h4>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li>sales@olleikfoods.com</li>
              <li>(000) 000-0000</li>
              <li>Mon–Sat, 7am–5pm</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-[var(--border)] pt-6 text-xs text-muted md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} Olleik Foods. All rights reserved.</p>
          <p>Built by Zenith AI</p>
        </div>
      </div>
    </footer>
  );
}
