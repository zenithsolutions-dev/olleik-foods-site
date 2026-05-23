# Olleik Foods

Wholesale B2B food-supply website. Built by [Zenith AI](https://zenithai-site.vercel.app).

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4**
- **Supabase** (Auth + Postgres + RLS) — Phase 2
- **Stripe** — Phase 2
- **Vercel** (auto-deploy on push to `main`)

## Phase 1 (this commit)

Marketing surface and lead capture:

- `/` — homepage (hero, why-us, categories, how it works, CTA)
- `/apply` — "Become a customer" application form (Server Action — logs to function output until Supabase is wired up)
- `/login` — placeholder for the eventual customer portal

## Phase 2 (next)

- Provision Supabase project — `applications`, `customers`, `customer_catalog`, `customer_prices`, `products`, `orders` tables
- Auth-gated `/portal` with personalized catalog and per-customer pricing (enforced via Postgres RLS)
- Cart + checkout — Stripe Invoicing for net-30 customers, card-on-file for upfront customers
- ERP one-way sync (CSV/API → Supabase) — depends on client's ERP system

## Local dev

```bash
npm install
cp .env.example .env.local   # fill in once Supabase/Stripe are provisioned
npm run dev
```

## Deploy

Vercel-linked to this repo. Pushes to `main` auto-deploy production.
