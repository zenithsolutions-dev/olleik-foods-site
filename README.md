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

## Product photos

Products have an `image_url` (public bucket `product-images`; the admin uploads through Products > Edit). Thumbnails use
`src/components/product-thumb.tsx` (fixed box, lazy, letter-tile fallback when there is no photo or it fails to load).

`product-photos/` holds a set of 31 **AI-generated illustrations** (one per demo SKU; provenance, prompts and terms in
`product-photos/LICENSES.md` and `manifest.json`). They are **not photographs of Olleik's real products**: decide whether
to publish them or replace them with real photos before launch.

- Local demo stack: `node videos/devstack/seed.mjs` loads them (idempotent).
- Hosted project: `scripts/seed-product-photos.mjs` maps SKU to file, uploads to the bucket and sets `image_url`. It is a
  **dry run by default** and prints the target project first.

```bash
export NEXT_PUBLIC_SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...
node scripts/seed-product-photos.mjs                    # dry run: lists what it would upload / change, writes nothing
node scripts/seed-product-photos.mjs --apply            # upload + set image_url for products that have no photo yet
node scripts/seed-product-photos.mjs --apply --overwrite   # also replace existing photos
```

Re-running is safe (storage paths derive from the SKU). Products that already have a photo are skipped unless
`--overwrite`. Or skip the script and upload real photos one by one in Admin > Products.

## System QA (Playwright)

Runs only against the local stand-in in `videos/devstack` (embedded Postgres + PostgREST + auth emulator, fictional data),
never the hosted project. See `docs/qa/2026-10-12-system-qa/`.

```bash
node videos/devstack/stack.mjs               # terminal 1: the local database stack
node videos/devstack/dev.mjs build           # production build with the local values baked in
npm run test:e2e                              # starts `dev.mjs` (dev server) if :3100 is free; use E2E_MODE=prod for `next start`
```

Business details on invoices, statements and reports come from `BUSINESS_LEGAL_NAME`, `BUSINESS_ADDRESS`,
`BUSINESS_PHONE`, `BUSINESS_EMAIL`. While any is unset the documents print bracketed placeholders and the admin area shows
a banner naming what is missing.
