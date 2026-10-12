# System QA report, 2026-10-12

Branch `fix/system-qa` (from `main`, draft PR, **not merged**). Plan: [TEST_PLAN.md](TEST_PLAN.md). Placeholder content for the
owner: [PLACEHOLDER_CONTENT.md](PLACEHOLDER_CONTENT.md).

## Safety

The hosted Supabase project was never read or written. All testing ran against the local stand-in in `videos/devstack`
(embedded Postgres 18, PostgREST, auth emulator, folder storage, fictional `@olleik-demo.test` data), rebuilt from its scripts.
No email was sent (the emulator swallows mail) and no payment was made. The owner's uncommitted `.env.example` change lives in
the main checkout and is in no commit of this branch. The local database and the git-ignored local `.env.local` of this
worktree are removed at the end (see "Cleanup").

## Results at a glance

| Check | Result |
|---|---|
| `tsc --noEmit` | green (was green on main) |
| `npm run lint` | green, 0 errors 0 warnings (main: **7 errors**, 1 warning, all in the home page / suppliers import) |
| `npm run build` (plain, and with the local stack's values) | green |
| Playwright suite, local stack, 375 px + 1440 px | **370 passed, 0 failed, 8 skipped** (7 viewport-specific by design, 1 `fixme` for the newsletter box); 26 spec files' worth across desktop and phone, about 5 minutes against `next start` |
| Existing integration suites against the local stack (`test:inventory`, `dashboard`, `dates`, `documents`, `statements`, `bulk-offers`, `analytics`, `reports`, `visibility`, `orders`, `scripts/test-schema-preflight.mjs`) | all PASS |
| Pure suites (`test:offers`, `pricing-engine`, `guard:portal`) plus new `test:offers-format`, `test:format-dates`, `test:money` | all PASS |

Note: the pre-existing suites normally read `.env.local`; they ran only after pointing a worktree-local `.env.local` at the
local stack. One run of `test-schema-preflight` was cut short by a pipe and left a throwaway `QA-PREFLIGHT-*` product in the
local DB; the seed now removes such rows.

## What was tested

Per [TEST_PLAN.md](TEST_PLAN.md): every public route, every portal route and every admin route at both widths (route sweep with
console/network/hydration capture, overflow and clipping, image alt, control names); auth guards (logged out, customer vs admin,
tenant isolation, malformed ids, login errors, password reset, set-password); visitor forms (valid and invalid); the customer flow
(catalog search and filter, cart, quantities, offers as percent / amount off / fixed price including clamping, expired, scheduled and
switched-off offers, best-offer-wins, checkout, idempotent submit, price-changed handling, order list and detail); the admin order
lifecycle (new, confirmed, prepared, completed, cancel, stale button), stock (block, oversell, restock, receive, set count, low and
out states), assignment on confirmation; offers (library for all three kinds, Running now, bulk apply with preview and undo);
margin rules (markup on cost, rounding half-up, the waterfall order, priority, off switch, manual price untouched, no cost); products
(create, edit, validation, duplicate SKU, photo upload ok / wrong type / over 5 MB, deactivate); leads and conversion; customers,
invites and access; categories; documents (invoice, customer and internal statements, stock sheets, print CSS, watermark,
placeholder state on a second server without the `BUSINESS_*` variables); dashboard, analytics, order alerts; every internal link
on the marketing site.

## What failed and what was fixed (one commit per item)

| # | Finding | Fix (commit) | Test |
|---|---|---|---|
| 1 | **Admin > Offer library > Running now crashed server-side** for amount-off and fixed-price offers: `running-now.tsx` (server component) called `formatMoney` from `lib/admin/store.tsx`, a `"use client"` module. | `a430965`: `offers-format.ts` uses the pure formatter | `npm run test:offers-format` (fails on the old import) and Playwright "Running now REGRESSION" |
| 2 | `npm run lint` failed on `main` (7 unescaped quotes in the home page, unused import) | `391f060` | `npm run lint` |
| 3 | **Phone cart truncated product names** to 2-3 letters ("Ag…") | `37442ff`: two-row cart line, names wrap | Playwright "names are never truncated" |
| 4 | Invoices, statements, reports print `[LEGAL NAME TBC]` etc. with no warning to the owner | `051e640`: env overrides unchanged; the admin area shows a banner listing the unset `BUSINESS_*` variables | Playwright placeholder tests on a second server |
| 5 | **Hydration error on `/admin/orders` and `/admin/orders/[id]`** and times that disagreed with the invoices for anyone outside Toronto: unzoned `toLocaleString` printed the server zone during SSR and the viewer zone after hydration. Custom range labels shifted a day in far-east zones. | `0f4247f`: `formatBusinessTime()` (America/Toronto) used everywhere | `npm run test:format-dates` (4 zones, DST edges) and Playwright (22:30 Toronto stays Oct 8) |
| 6 | Negative profit printed as `$-2.00` | `f423bca`, `033009f`: one shared `lib/money.ts` | `npm run test:money` |
| 7 | **Quick taps on + / - in the cart were lost** (quantity came from the stale priced snapshot while the server re-price was in flight) | `bc570dc`: relative `bump()` on the cart state | Playwright "two quick taps" |
| 8 | **No navigation on phones in the admin** (sidebar hidden, nothing replaced it) | `0b64296`: Menu button | Playwright phone menu test |
| 9 | **No navigation on phones/tablets on the public site** (header links hidden below `lg`) | `site-menu.tsx` commit "Public site: add a Menu…" | Playwright mobile menu test |
| 10 | **Cart link sat off-screen on phones** at the end of the scrolling portal tab row | `417bfbd`: cart in the header on phones | Playwright cart badge test |
| 11 | Admin products and categories tables were **clipped on phones** (Edit / Delete unreachable); approved-leads table too; page overflow on dashboard and customer detail; document sheets overflowed | `243c85e`, `cc7c01f`, `cfc894c` | route sweep now also detects `overflow:hidden` clipping |
| 12 | **Converting a lead ignored the review form's payment terms, status and notes** (every converted customer became COD); converted leads showed as "new" in the status dropdown | `cfc894c` | Playwright convert-lead test |
| 13 | Unlabelled controls: footer newsletter box, portal catalog search/filter, ~20 admin search boxes, filters, margin inputs, lead status selects, approved-lead checkboxes | `05f3629`, `22079ea`, `cfc894c` | route sweep (control names) |
| 14 | Next.js LCP warnings on catalog images | `5284d3e` | route sweep (console) |
| 15 | Mistyped ids in URLs (`/portal/orders/not-a-uuid`) logged a Postgres "invalid uuid" error | `68a8f89`: `isUuid` guard in the data readers | Playwright malformed-id test |

Also found while building the new picker, fixed before merge: the product picker did not move focus to its search box (caught by its test).

### Test-harness lessons (not product bugs)

The first admin sweep "passed" because a redirect to the login page is HTTP 200 and the saved admin login was captured too early. The
sweep now asserts the final path; the login state keeps only cookies. The Turbopack dev server runs out of browser resources
(`ERR_INSUFFICIENT_RESOURCES`) under a long suite on this machine; the full suite therefore runs against `next start`
(`E2E_MODE=prod`), the dev server is used for the sweep and for readable hydration warnings.

## Part 2: product photos

- `ProductThumb` / `ProductThumbStrip` (`src/components/product-thumb.tsx`): fixed-size box (no layout shift), lazy, alt = product
  name, letter tile when there is no photo **and** when the photo fails to load (onError). Used in: cart lines (desktop and phone),
  checkout summary, customer order lines and list, admin order lines and list, admin products list, customer assigned-products
  table and add-products list, assign list, pricing rule rows. New `ProductPicker` (pictures in the list, keyboard support) replaces the native
  `<select>` for the pricing product rule and the offer's linked product. Commits `37442ff`, `0f4247f`, `243c85e`.
- Demo set: all **31** generated photos from the video work are in `product-photos/` with `manifest.json` (SKU, generation id, model,
  date, prompt) and `LICENSES.md`; `videos/devstack/seed.mjs` loads them (stable per-SKU storage names, run twice gives identical
  data and URLs; verified). `PRD-007` (Red Bell Peppers, which only existed in a leftover local DB) is now seeded so all 31 have a
  product. **No new Higgsfield generation was needed**, so there is nothing new to log in `LICENSES.md`.
- Production: `scripts/seed-product-photos.mjs`, **dry run by default**, prints the target project first, maps SKU to file, skips
  products that already have a photo unless `--overwrite`, idempotent. Verified against the local stack only (dry run, apply, re-run
  shows "already correct"). README section "Product photos". It was **not run** against the hosted project.
- **Decision for the owner:** these are **AI-generated illustrations, not photographs of Olleik's real products.** Publish them or
  replace them with real photos before launch. Note also `next.config.ts` serves images unoptimized (to avoid the metered optimizer),
  so a 48 px thumbnail downloads the full ~150 KB file; fine for the demo set, worth a resize/transform step if real photos are large.

## Needs owner decision

1. **Footer newsletter box does nothing.** The form has no action or handler; "Subscribe" reloads the page with the visitor's email in
   the URL and no confirmation. Choose a provider, or remove the box. (Test `V-07` is marked `fixme` until decided.)
2. **Business details**: set `BUSINESS_LEGAL_NAME`, `BUSINESS_ADDRESS`, `BUSINESS_PHONE`, `BUSINESS_EMAIL` in the hosting environment; tax number and rate are still dormant.
3. **Marketing content**: every placeholder-looking statistic, testimonial, customer name, the `(000) 000-0000` number, hours and operating claims are listed with file and line in [PLACEHOLDER_CONTENT.md](PLACEHOLDER_CONTENT.md). Nothing was replaced.
4. **Product photos**: publish the AI set (run the script) or upload real photos (see above).
5. Stock Unsplash photography is presented as the business's own on the home page and category covers.
6. Admin invites and password-reset links cannot be completed end to end on the local stack (the auth emulator refuses to verify tokens, by design); the set-password form, expired-link handling and link generation were tested, the real email round trip needs a check on the hosted project by the owner (`scripts/test-login-roundtrip.mjs` exists for that).
7. Anyone signed in (even an admin) who opens `/auth/set-password` sees the change-password form for their own account. Harmless, noted.

## What remains and why

- Real e-mail delivery, Stripe and the hosted storage bucket were out of scope by rule (no real email, no payments, no hosted access).
- Colour-contrast was spot-checked visually only (no automated contrast audit was added).
- The in-app browser pane was not used; all browser work ran in Playwright with the installed Chrome.

## Before / after evidence

- Lint: main `✖ 8 problems (7 errors, 1 warning)`; branch 0.
- Running now: before, `test:offers-format` fails with `ERR_MODULE_NOT_FOUND ... admin/store` (the client module cannot be loaded outside React); after, 8 PASS. Browser evidence: with the old import restored and the app rebuilt, `GET /admin/offers?tab=running` returned **HTTP 500** with `Attempted to call formatMoney() from the server but formatMoney is on the client`; with the fix the same Playwright test passes.
- Cart on a phone: before, names rendered as "Ag…", "Cr…", "Bo…"; after, full names with 64 px photos (screenshots taken during the work, see the PR description).
- Hydration: before, `Hydration failed ... Oct 8, 11:30 a.m. vs Oct 8, 6:30 p.m.` on `/admin/orders`; after, none in the sweep or the suite.
- Phone sweep: before the fixes 4 pages overflowed and, once clipping was detected, 3 more tables were cut off; after, 0.
