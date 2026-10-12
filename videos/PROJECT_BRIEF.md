# Olleik Foods: Project Brief for the Videos (Phase 1)

Date: 2026-10-08. Status: discovery done, used for the storyboards and scripts. All copy derived from it is **Pending Review**.

## 1. What it is

**Olleik Foods** is a B2B wholesale food-supply business (Ottawa region) for restaurants, cafés, bakeries, caterers, food
trucks and other small food businesses. The product is a Next.js 16 website with three parts:

| Part | Who | What it does (verified in the code) |
|---|---|---|
| Marketing site | visitors | Explains the service, shows the categories and catalog, takes **wholesale account applications** (`/apply`), contact, supplier and careers forms |
| Customer portal (`/portal`) | approved customers (role: customer) | Sign in, **their own catalog with their own prices** ("Your price"), offers set up for them, cart, checkout (delivery or pickup, notes), order history with status, order detail and invoice, printable statement for a period, account details |
| Admin (`/admin`) | the owner/admins (allowlist `ADMIN_EMAILS`) | Dashboard (today's orders, revenue, profit, low stock), orders (confirm → prepared → completed, cancel with restock, invoice), products (stock, cost, list price, images), categories, customers (add, convert from leads, invite to the portal, visibility, per-customer prices, statements), assign products, margin rules (pricing), offer library (templates, bulk apply), leads, analytics (revenue trend, best sellers), report builder, stock and product documents (print / PDF) |

Live site: https://olleik-foods-site.vercel.app (Vercel; pushes to `main` deploy production). The business email used on the
site is sales@olleikfoods.com (no domain site confirmed).

## 2. Audiences and promises

Audiences: (1) independent food businesses looking for a supplier (visitor → applicant), (2) approved customers ordering
through the portal, (3) the owner and admins running the business.

The three main promises, phrased from what the product actually does (not from marketing stats):
1. **Your catalog, your prices.** Each customer signs in to see only their assigned products at their own account price.
2. **Order online, anytime.** Cart, delivery or pickup, notes for the driver; orders and invoices in one place.
3. **One supplier who runs it properly.** Orders confirmed and prepared by the team, live status, statements on demand.

Call to action: **Become a customer** / **Open a wholesale account** (`/apply`). Secondary: **Sign in** (`/login`).
Tagline (the site's hero line): **"The supplier behind great kitchens."**

## 3. Brand

- Logo: no logo file exists. The site uses a monogram tile (rounded square, letter **O** in Fraunces on brand green) and the
  wordmark **Olleik** (brand-deep) **Foods** (accent). The videos rebuild exactly that from the site's own tokens and fonts.
- Colours (`src/app/globals.css`): background `#faf6ec` (warm paper), surface `#ffffff`, foreground `#14201a`, brand
  `#1c4d3a` (deep green), brand-deep `#0e2c20`, brand-soft `#e8e1cf`, brand-mist `#f3eedc`, accent `#c87a2a` (amber),
  accent-deep `#9a5410`, accent-soft `#f4dcb8`, muted `#586056`, border `#e2dac6`.
- Fonts: **Fraunces** (display serif, italic accent words in amber: "great", "actually", "from one supplier") and **Geist**
  (sans). Both are SIL Open Font License; the videos load them locally from `@fontsource-variable`.
- Tone: warm, plain-spoken, operator-to-operator ("Built for the way restaurants actually order"). Headlines in sentence case
  with one italic accent word; small uppercase kickers ("WHAT WE CARRY"). Admin uses sentence-case labels.
- Language: English (Canadian context; the site uses "catalog" and "cafés").
- Dark mode: none (no dark theme in the product). The promo uses the brand-deep green as its dark colour field instead of a
  dark-mode product scene.

## 4. Roles

| Role | Exists | Video |
|---|---|---|
| Visitor | yes | V-VISITOR (with the applicant → customer journey) |
| Customer | yes (portal) | part of V-VISITOR ("after you're approved") |
| Admin / owner | yes (email allowlist; no role levels) | V-ADMIN |
| Staff | **no** (no staff role, no permissions model) | **V-STAFF skipped** |

## 5. Journeys and screens (capture targets)

### Visitor and customer (V-VISITOR)
| # | Route | Purpose | Needs data |
|---|---|---|---|
| 1 | `/` | Hero, "The supplier behind great kitchens.", Open a wholesale account | categories (seeded) |
| 2 | `/catalog`, `/catalog/<category>` | What we carry; prices only after sign-in | categories, products |
| 3 | `/delivery` | "From cutoff to dock" three steps | no |
| 4 | `/apply` | Application form (typed in the video; the local copy may submit to the local database only) | no |
| 5 | `/login` | Customer sign in | demo customer |
| 6 | `/portal` | Welcome, catalog count, active offers | demo customer, offers |
| 7 | `/portal/catalog` | My catalog, Your price badges, search, category filter, Add to cart | assigned products |
| 8 | `/portal/offers` | Offers set up by the rep | demo offer |
| 9 | `/portal/cart`, `/portal/checkout` | Cart, delivery or pickup, notes, submit | cart (local) |
| 10 | `/portal/orders`, `/portal/orders/<id>` | Status chips, order detail, invoice | demo orders |
| 11 | `/portal/orders/statement` | Statement for a period, Print / Save as PDF | demo orders |

### Admin (V-ADMIN)
| # | Route | Purpose |
|---|---|---|
| 1 | `/admin-login` | Admin sign in |
| 2 | `/admin` | Dashboard: new orders, today's revenue and profit, top products and customers, low stock |
| 3 | `/admin/orders`, `/admin/orders/<id>` | Order queue with status tabs; Confirm order → Mark prepared → complete; invoice |
| 4 | `/admin/leads` | Website applications; status; convert |
| 5 | `/admin/customers`, `/admin/customers/new`, `/admin/customers/<id>` | Customer cards, add / convert, portal invite, catalog and prices, statement |
| 6 | `/admin/products`, `/admin/categories` | Products with stock, cost, price; add/edit; categories |
| 7 | `/admin/assign`, `/admin/pricing`, `/admin/offers` | Assign products to customers, margin rules, offer library |
| 8 | `/admin/analytics`, `/admin/reports`, `/admin/documents/*` | Revenue trend, best sellers, report builder, low-stock and product documents |

## 6. Capture source and demo data (decision)

- The project's configured Supabase project is treated as **production** and was **not read or written** (a read attempt
  was blocked by the session's safety layer, which is the correct outcome). Instead, `videos/devstack/` runs a **fully local
  stand-in**: Postgres 18 (embedded binaries) with this repo's own 15 migrations, the official PostgREST 14 binary, and a
  small local auth emulator, all on 127.0.0.1. The Next dev server runs on port 3100 with every `.env.local` key overridden
  by local test values (`devstack/dev.mjs`), Stripe unset. The capture browser aborts every request that is not localhost
  (plus the site's own public Unsplash photos, read-only): 0 blocked so far.
- Demo data (`devstack/seed.mjs`, deterministic): 6 fictional customers (Copperleaf Kitchen, Bluestone Bakehouse, Juniper &
  Rye Café, Harbourline Catering, Ember Lane Pizza, Saffron Courtyard), invented contacts, `@olleik-demo.test` emails,
  (613) 555-01xx phones, "Demo Lane / Sample Street" addresses; 5 leads; 82 orders over 11 weeks; 30 generic products with
  demo prices, costs and stock (4 low or out of stock); 2 offers and 2 offer templates. One demo admin
  (`admin@olleik-demo.test`). Passwords are generated per seed and kept only in `devstack/_keys.json` (git-ignored).
- The 0001 migration's own seed customers and leads (realistic business names) are deleted in the local database so they
  never appear on screen.
- The URL shown in the video's browser bar is the public host `olleik-foods-site.vercel.app` (the pictures are the same
  code, captured locally).
- Clean-up: the whole demo database is local and is deleted with `node devstack/stack.mjs --reset` / removing
  `devstack/_data`. No account was created anywhere else.

## 7. Sensitive areas to avoid

- Real customer data: none exists in the local database by construction. Never capture the hosted project.
- Payments: Stripe is not configured; checkout records an order only (local).
- Secrets: `.env.local` values are never read into any file or log; local keys are throwaway test values.
- Admin "INTERNAL" cost and profit views: fine in the admin manual (demo numbers), **never in the public promo**.

## 8. Compliance list (food wholesale, pre-launch)

1. No health, nutrition, allergen, organic, halal, "fresh", "local farm" or food-safety claims in our copy.
2. No prices, discounts, minimums, terms promises (net-30), delivery times or windows ("same-day", "6 days a week",
   "tomorrow 6–9am"), stock counts ("1,500+ SKUs") or guarantees ("quality guaranteed") in our copy. The site shows some of
   these, but the business identity is still placeholders (`src/lib/business.ts`), so they are treated as unapproved.
3. No testimonials, customer names or logos: the site's quotes and "Trusted by" names are placeholders and are kept out of
   every frame.
4. No comparison with other distributors ("Olleik vs. traditional distributors" section kept out).
5. Demo prices may appear inside product screens of the manuals (clearly demo accounts); the promo shows prices only as
   UI texture with no claim attached, and never in a caption.
6. No back-office screens in the public promo.
7. Every caption, hook and line is **Pending Review** (owner and client).

## 9. Things in the product that looked wrong while exploring (not fixed here)

- `src/lib/business.ts` placeholders show on documents: "Olleik Foods — [LEGAL NAME TBC]", "[STREET ADDRESS]", "[PHONE]",
  "[EMAIL]" (statement, invoice, product list). Avoided in close-ups.
- Footer phone is "(000) 000-0000"; homepage testimonials, "Trusted by" names and hero stats look like placeholders.
- Portal product cards have no photos (letter tiles "A", "B"); no product has an image yet.
- The desktop portal is a narrow column with large empty margins at 1440 px; the phone layout reads better, so the customer
  part of V-VISITOR is captured mainly on a phone.
- Marketing pages use Unsplash photos (stock imagery): fine on the real pages in the manuals, avoided in the promo.
