# System QA test plan, 2026-10-12

Scope: every route and feature for the **visitor**, the **customer** (portal) and the **admin**, at **375 px (phone)** and
**1440 px (desktop)**. There was no `FEATURE_INVENTORY.md` from the video work in the repo, so the inventory below was built
from the code (routes under `src/app`, server actions, `supabase/migrations`).

## Environment and safety

- Everything runs against the **local stand-in only** (`videos/devstack`: embedded Postgres 18 + PostgREST + auth emulator +
  folder storage, seeded with fictional `@olleik-demo.test` data). The hosted Supabase project in the owner's `.env.local`
  was **never read or written**: the worktree has no `.env.local` of the owner's, and the one used here is generated from
  the local stack's keys. Playwright's `globalSetup` refuses to run unless the Supabase URL is `http://127.0.0.1:*`.
- No email is sent (the auth emulator swallows invite/recovery mails) and no payment is made (Stripe keys are unset).
- Browser: Playwright with the installed Chrome, timezone `America/Toronto`, locale `en-CA`. Next dev server (so React
  hydration warnings are visible), plus a production build + `next start` smoke at the end.
- Every Playwright test has an auto-fixture that fails on any `console.error`/`console.warn`, uncaught page error, failed
  network request or 5xx response. Per page it also checks: no horizontal overflow, no broken or alt-less image, every form
  control has an accessible name, every button/link has a name.
- Existing integration suites (they use throwaway rows through the same local stack): `npm run test:visibility`,
  `test:orders`, `test:inventory`, `test:dashboard`, `test:dates`, `test:documents`, `test:statements`, `test:bulk-offers`,
  `test:analytics`, `test:reports`, `scripts/test-schema-preflight.mjs`; pure suites `test:offers`, `test:offers-format`,
  `test:format-dates`, `scripts/test-pricing-engine.mjs`; `npm run guard:portal`. Plus `tsc --noEmit`, `npm run lint`,
  `npm run build`.

## Roles and test data

| Role | Account | Notes |
|---|---|---|
| Visitor | none | marketing site, apply / contact / supplier forms |
| Customer | `copperleaf@olleik-demo.test` (net-30, 18 assigned products, a live 8% offer), `ember@…` (cod, 10% offer), `juniper@…` (card-on-file) | seeded by `videos/devstack/seed.mjs`; passwords generated per run |
| Pending customer | `saffron@…` (no login yet) | invite flow |
| Admin | `admin@olleik-demo.test` (allow-listed through `ADMIN_EMAILS`) | |

## A. Visitor (marketing site)

| ID | Item | Cases |
|---|---|---|
| V-01 | Every public route renders: `/`, `/about`, `/apply`, `/careers`, `/catalog`, `/catalog/[category]` (all 8), `/contact`, `/delivery`, `/faq`, `/resources`, `/resources/[slug]` (3), `/suppliers`, `/who-we-serve`, `/login`, `/admin-login` | status 200, h1 present, no console/network errors, layout + a11y checks, phone and desktop |
| V-02 | Unknown URL | real 404 page, status 404 |
| V-03 | Catalog | category index shows every category, category page lists products with photo or fallback tile, empty category state |
| V-04 | Apply form (`/apply`) | valid → success message and a `leads` row; missing required field → error; bad email → error; very long text; HTML in fields is stored as text |
| V-05 | Contact form (`/contact`) | valid → thank-you and a `contact_messages` row; missing name/email; invalid topic |
| V-06 | Supplier form (`/suppliers`) | valid → `?sent=1` thank-you and a `vendor_submissions` row; missing fields |
| V-07 | Newsletter box in the footer | does submit do anything? (see report) |
| V-08 | Placeholder content | list every placeholder-looking stat, testimonial, customer name, phone number (report only; no invention) |
| V-09 | Navigation | header links, mobile menu, footer links, "Become a customer" CTA all resolve (no 404, no dead `#`) |

## B. Auth and guards

| ID | Item | Cases |
|---|---|---|
| G-01 | Logged out opens `/portal/*` | redirect to `/login` (every portal route) |
| G-02 | Logged out opens `/admin/*` | redirect to `/admin-login` (every admin route) |
| G-03 | Customer opens `/admin/*` | redirected to `/admin-login`, no admin data rendered |
| G-04 | Admin opens `/portal` | no customer record: not shown another customer's data |
| G-05 | Login errors | wrong password and unknown email give the same neutral message; empty fields blocked by the browser; pending customer message (`?status=pending`) |
| G-06 | Password reset request | neutral message whether or not the email exists |
| G-07 | Sign out (portal and admin) | session ends, protected pages redirect again |
| G-08 | Customer A cannot read customer B | `/portal/orders/<B's order id>` and its invoice return "not found" |
| G-09 | Server actions refuse non-admins | `confirmOrder`, `receiveStock`, … (covered by `test:orders`) |

## C. Customer portal

| ID | Item | Cases |
|---|---|---|
| C-01 | Dashboard `/portal` | greeting, recent orders, offers teaser, empty states |
| C-02 | Catalog `/portal/catalog` | only assigned products (visibility modes), search by name and SKU, category filter, clear filter, no-results state, pagination, "Your price" chip, offer price + struck list price, **photo or fallback tile**, unavailable badge |
| C-03 | Add to cart | quantity stepper, add twice merges, cart badge count, persists across reload (localStorage) |
| C-04 | Cart `/portal/cart` | **names never truncated at 375 px**, thumbnail per line, +/- and remove, qty never below 1, totals = sum of lines, offer line shows "was $x", empty cart state, product no longer available → warning + remove, unavailable line blocks checkout |
| C-05 | Offers shown as prices | **percent off**, **amount off**, **fixed price**; best single offer wins (never compounded); a fixed price above the base never raises the price; an expired or scheduled offer does not apply; amount-off larger than price clamps at $0.00 |
| C-06 | Checkout `/portal/checkout` | summary with thumbnails, pickup vs delivery, notes (1000-char cap), submit → order created once (double click / retry idempotent), total equals cart total, cart cleared, redirect to the order page with the "received" banner, empty cart redirect |
| C-07 | Orders list and detail | date shown in Toronto time, status chip, thumbnails, item count, totals, other customer's order id → not found |
| C-08 | Documents | own invoice, own statement (period filter), print layout, placeholder business details visible and flagged |
| C-09 | Account `/portal/account` | shows own details, change password |
| C-10 | Offers page | live offers with dates; empty state |
| C-11 | Live refresh | order status changes appear without reload (30 s poll) |

## D. Admin

| ID | Item | Cases |
|---|---|---|
| A-01 | Dashboard | KPIs, period selector (today / week / custom / reversed range notice), new-orders tile, low stock, expiring offers, live badge |
| A-02 | **Phone navigation** | Menu button opens every admin link, closes on navigation |
| A-03 | Orders list | tabs per status with counts, thumbnails, Toronto dates, date range filter, empty state |
| A-04 | Order lifecycle | **new → confirmed → prepared → completed**, **cancel** from new/confirmed/prepared (cancel note), completed is terminal, stale button (two admins) refuses cleanly, each transition confirmed by a dialog |
| A-05 | Stock on confirm | enough stock decrements; **insufficient stock blocks** with a shortage list; **"Confirm anyway (oversell)"** goes negative with the full quantity in the ledger; cancel restocks exactly; receive stock settles a deficit |
| A-06 | Assignment on confirmation | products the customer ordered but was not assigned are added at waterfall prices |
| A-07 | Order detail | lines with cost and profit (admin only), profit % , lines without cost flagged, inactive / new-item chips, thumbnails, customer card, notes |
| A-08 | Products | create (valid, duplicate SKU, missing name, negative or non-numeric price, cost above price), edit, photo upload (JPG ok, wrong type, over 5 MB), remove photo, deactivate, stock set / receive, low-stock threshold, search + category filter, empty state |
| A-09 | **Pricing and margin rules** | markup on cost `price = round(cost × (1 + m/100))`; waterfall order manual → priority product → priority category → customer → product → category → global → list; no cost recorded → list; margin 0 sells at cost; rule edit / turn off / delete re-prices; manual prices never touched; rounding half-up to the cent |
| A-10 | **Offers** | library: create / edit / archive template for **percent**, **amount off**, **fixed price**, informational (none); validation (percent over 100, negative, empty title); apply to one customer; bulk apply with preview + undo batch; **Running now tab** for all three discount kinds (regression), grouped by urgency, empty state |
| A-11 | Customers | list + search, new customer (valid / invalid), edit, archive / restore, assigned products table (price, profit), set flat price, % off list, reprice by rules, recompute, copy catalog from customer, visibility modes (assigned / all / hidden products) |
| A-12 | **Invites and access** | invite by email (emulator, no mail), generate one-time link, link works once, set password page, expired / reused link message, customer then reaches the portal |
| A-13 | Leads | status changes, convert to customer, link to existing, delete with confirmation, empty state |
| A-14 | Categories | create (top-level / child), rename, delete blocked when in use, empty state |
| A-15 | Assign | bulk assign products to customers with per-customer exclusions and preview |
| A-16 | **Documents** | invoice (no cost leak), customer statement + internal statement (INTERNAL banner), product statement, low-stock and out-of-stock sheets, CANCELLED watermark, **placeholder business details flagged** (banner in admin), period filter, print CSS (header repeats, rows do not split) |
| A-17 | Reports and analytics | revenue buckets (day / week / month), top products, margin, date ranges and timezone edges (DST) |
| A-18 | Order alerts | 15 s poller badge, chime toggle, degraded state |

## E. Cross-cutting

| ID | Item |
|---|---|
| X-01 | Money: cents everywhere, `$x.xx`, totals equal the sum of lines, no float drift (e.g. 3 × $0.10) |
| X-02 | Dates: all instants rendered in `America/Toronto` regardless of server or viewer zone (no hydration mismatch); DST edges; range end-exclusive |
| X-03 | Mobile 375 px: no horizontal page scroll, tap targets ≥ 32 px, no truncated primary text |
| X-04 | Accessibility basics: names for every control, focus visible, keyboard path for the new product picker, colour contrast spot check |
| X-05 | Images: thumbnails reserve their box (no layout shift), alt = product name, lazy below the fold, fallback tile when no photo or the image 404s |
| X-06 | Console, network and server logs clean on every page |
| X-07 | `tsc`, `lint`, production build, production-mode smoke of the key pages |

## F. Product photos (Part 2) acceptance

- `ProductThumb` / `ProductThumbStrip` used on: cart lines, checkout summary, customer order lines and list, admin order lines
  and list, customer catalog rows (admin), assign list, pricing rule rows, product pickers (pricing rule, offer link).
- A product without a photo and a product whose photo URL fails to load both show the letter tile; the row height does not
  change between the two states.
- Seed: `node videos/devstack/seed.mjs` twice produces identical data and URLs and every demo SKU has a photo.
- Production path: `scripts/seed-product-photos.mjs` in **dry-run by default**, never touches the hosted project unless the
  owner passes `--apply` with real credentials.
