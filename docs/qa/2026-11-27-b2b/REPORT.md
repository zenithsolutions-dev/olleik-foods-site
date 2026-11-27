# QA report: B2B ordering build (branch `feat/b2b-ordering`, 2026-11-27)

Covers everything on the branch since `main`: business settings, owner level, admin phone menu, email
notifications, public specials, statement delivery. 6 feature commits plus the fixes made during this gate.

## Verdict: READY WITH GAPS (updated after the Next.js upgrade, same day)

Nothing failed. The first run of this gate was BLOCKED by a critical advisory against the installed Next.js
(16.2.6, already in the project). It was upgraded to 16.4.6 and the gate was re-run (see "Re-run after the
upgrade"). What remains are gaps, listed under NOT TESTED: the owner accepts or closes each before go-live.
The most important are that nothing has been deployed, no real email has been sent, and only one browser
engine was used.

## Re-run after the upgrade (`next` and `eslint-config-next` 16.2.6 → 16.4.6)

| Check | Result |
|---|---|
| `npm audit --omit=dev` (what ships) | 0 vulnerabilities (was 6: 1 critical, 4 high, 1 moderate) |
| `npm audit` (including development tools) | 12 remain (4 high, 7 moderate, 1 low), all in development-only packages that are not deployed; not changed |
| `npx tsc --noEmit` | 0 errors |
| Lint, files changed on the branch | the same 7 pre-existing errors, plus 1 new warning from the newer rule set on pre-existing code (`customer-detail-client.tsx:894`, `window.location.href`) |
| `next build` | exit 0, same route table (all sensitive routes rendered on demand) |
| Test scripts | 22 of 23 pass (the same one cannot run in this harness) |
| Production smoke (curl) | public pages 200; gated pages redirect without a session; cron 401 without the secret; statement link 200 with `private, no-store`, `no-referrer`, `noindex`, `DENY` |
| Signed-in customer, production build | portal shows the special, checkout prices it, order submits, special count 0 → 1, order email logged as sent |
| Customer session opening `/admin/specials` | redirected to `/admin-login` |
| Non-owner admin, production build | 12 admin pages: no cost, profit or margin in the page data or wording; the 3 owner-only pages redirect |

Note: the first attempt at `npm audit fix --omit=dev` removed the development packages from `node_modules`
(that flag also applies to the install it performs). `npm install` restored them; `package.json` and the
lock file were not harmed.

## What was run

All on this machine against the local throwaway database (`videos/devstack`, fictional data). No real
customer data, no real email, nothing paid.

| Check | Command / method | Result |
|---|---|---|
| Test scripts | `node scripts/test-local.mjs` | 22 of 23 scripts pass; 1 cannot run in this harness (see finding 7) |
| New test scripts | business-settings 23, admin-roles 11, cost-visibility 13, email 40, specials 52, statement-links 28 | 167 checks, all pass |
| Type check | `npx tsc --noEmit` | 0 errors |
| Lint, files changed on the branch (98 files) | `eslint` | 7 errors, all in `src/app/(marketing)/page.tsx`, all present on `main` (finding 5) |
| Portal security guard | `node scripts/guard-portal.mjs` | pass |
| Production build | `next build` with every setting pointed at the local stack | exit 0; every admin, portal, specials, statement and cron route is rendered on demand (not cached) |
| Production smoke | `next start` + curl | 10 public pages 200; 6 gated pages redirect to login without a session; cron 401 without the secret; statement page sends `private, no-store`, `no-referrer`, `noindex`, `X-Frame-Options: DENY` |
| Migrations on an empty database | bootstrap + 0001–0020 applied in order, then all applied a second time | all applied both times; 24 tables, none without row-level security |
| Migrations over existing data | 0016–0020 applied one by one to the seeded local database during the build | no data lost; existing tests still pass |
| Dependency audit | `npm audit --omit=dev` | 6 advisories: 1 critical, 4 high, 1 moderate (finding 1) |
| Secret scan of the branch diff | grep for key patterns | none (one false positive: a template string in `scripts/test-local.mjs`) |
| Independent reviews | 1 code review + 4 security reviews by separate agents, one per feature | no critical or high findings; every medium fixed or listed below |

## Screen-size matrix (Chromium only)

Horizontal overflow of the page, measured on the production build. 0 = fits.

| Screen | 320 px | 375 px | 768 px | Desktop |
|---|---|---|---|---|
| Public home, `/specials`, `/specials/[id]` | 0 | 0 | 0 | ok |
| Public statement link `/statement/[token]` | 0 | 0 | not measured | ok |
| Admin dashboard, specials, settings, products, orders, order detail, reports, analytics, customers list | 0 | 0 | 0 | ok |
| Admin customer detail | 0 (was 421, fixed) | 0 (was 366, fixed) | 0 (was 268, fixed) | ok |
| Admin customer statement | 0 (was 64, fixed) | 0 (was 9, fixed) | 0 | ok |
| Portal home, catalog, cart, checkout, orders, offers, account, statement | 0 | not measured | not measured | ok |

## Findings (most severe first)

1. **RESOLVED (was CRITICAL; already in the project, not introduced by this work) — `package.json`: `next` 16.2.6.**
   `npm audit` lists it inside advisories that include "Middleware / Proxy bypass in App Router applications
   using Turbopack and single locale" and a denial-of-service issue; fixed in 16.4.6 (not a major version).
   What it means here: `src/proxy.ts` is the first gate in front of `/admin` and `/portal`. The app does not
   rely on it alone: the admin layout, every admin action and the portal layout check the session again on
   the server, so a bypass of the proxy by itself should not expose data. That mitigation was read in the
   code, not attacked. Three more advisories (postcss, sharp, and next itself) are fixed by the same upgrade.
   Not verified beyond the `npm audit` text. Fix: upgrade `next` and `eslint-config-next` to 16.4.6 or later,
   rebuild, re-run this gate.

2. **MEDIUM — nothing on this branch is pushed.** 6 feature commits and this report exist only on this
   machine, and drive D: has 1.5 GB free (the dev server crashed once during testing, exit `0xC0000409`).
   A disk problem would lose the whole build. Fix: push the branch.

3. **MEDIUM — supported browsers are not declared and only one engine was tested.** `package.json` has no
   `browserslist` or `engines`. Every check here ran in Chromium. Firefox, Safari and real phones were not
   tested (see NOT TESTED).

4. **MEDIUM — email has never left this machine.** Sending follows the Resend API as documented and works
   against a local test inbox, including a refused send. A real account, a verified domain (SPF, DKIM), the
   real error format and deliverability are untested. The daily report also needs a scheduler entry that does
   not exist yet.

5. **MEDIUM (already in the project) — lint errors.** 7 `react/no-unescaped-entities` errors in
   `src/app/(marketing)/page.tsx`. Repo-wide `npm run lint` reports 1,838 errors because it also scans a
   duplicate of the repo under `.claude/worktrees` and the `videos` project.

6. **LOW — owner level fails open by design.** With `OWNER_EMAILS` empty, every admin sees cost and profit.
   It must be set the day a second, non-owner admin is added.

7. **LOW — `scripts/test-login-roundtrip.mjs` cannot run in the suite.** It needs a dev server on port 3001
   and a pre-made login. It is reported as not run, not as passed.

8. **LOW — 19 test scripts end with `process.exit()`.** On Windows with Node 24 that call can abort after
   all checks pass. It was proven for `test-pricing-engine.mjs` (11 of 12 runs failed that way; 0 of 12 after
   the fix). The other 19 have not shown it yet.

9. **LOW — re-running migration 0015 alone re-creates the old 3-argument `analytics_revenue_buckets`.**
   Harmless (the app calls the 4-argument one), removed again by 0017.

## Fixed during this gate

- Admin customer detail page was wider than the screen at phone and tablet widths (pre-existing table with no
  scroll container): the table now scrolls inside its card.
- Every printable document, including the statement a customer opens from a link, had 40 px of padding on a
  phone and its tables ran off the screen: padding is now phone-sized and a wide table scrolls inside the
  sheet. Print output is unchanged (print rule added).
- `test-pricing-engine.mjs` no longer aborts on exit (finding 8).

## NOT TESTED (each one is a risk the owner accepts or closes)

- **Firefox, Safari, iOS, Android, real devices.** Risk: a layout or input problem only those show.
- **Real email delivery** (provider account, domain verification, spam placement, click-tracking rewriting
  statement links). Risk: emails fail or land in spam on day one.
- **WhatsApp opening for real.** The test browser blocks pop-ups from automated clicks; the prepared link was
  inspected, not opened in WhatsApp. Link preview inside WhatsApp needs a public address.
- **The hosted database.** Migrations 0016–0020 were never applied to the real Supabase project; its current
  state is unknown (project notes say its data was removed on 2026-10-12).
- **Deployment on Vercel** (environment variables, cron, build with the real settings).
- **Two people ordering the last units at the same moment from two browsers.** Proven at the database level
  (one succeeds, one is refused), not from two real sessions.
- **Load and long sessions**, **accessibility with assistive technology** (keyboard and labels were checked by
  hand on the new forms only), **daily report arriving at the chosen hour on a real schedule**.
- **Brief items not built**: fixed discount on a product, margin as a fixed amount per carton, a history of
  reject reasons, a count sheet for physical inventory; SMS, email campaigns and WhatsApp API are later-phase.

## Next steps, waiting for your go

1. ~~Upgrade Next.js to 16.4.6 or later, rebuild, re-run this gate.~~ Done.
2. Push `feat/b2b-ordering` so the work exists off this machine.
3. Decide the email sender domain and create the provider account; then test one real send to a test inbox.
4. Confirm the hosted database's state, then apply migrations 0016–0020 there.
5. Test on one iPhone (Safari) and one Android phone before showing Samir.
6. Decide the four unbuilt brief items.
