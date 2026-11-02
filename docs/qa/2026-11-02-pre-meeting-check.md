# Pre-meeting production check — 2026-11-02 12:44–12:52 EST

Target: https://olleik-foods-site.vercel.app (Vercel production deployment `dpl_5h3X4Q4SnWq6fuPBUrwd72iLQSFD`, built from `main`, status Ready, deployed 2026-10-21).

## Verdict: GO. No bug found. Nothing was changed or redeployed.

The reported "admin won't open" was a wrong URL. `/apply/admin` does not exist in the app and never did.
The correct URLs are:

| Purpose | URL |
|---|---|
| Admin sign-in | https://olleik-foods-site.vercel.app/admin-login |
| Admin panel (after sign-in) | https://olleik-foods-site.vercel.app/admin |
| Customer sign-in | https://olleik-foods-site.vercel.app/login |
| Customer portal (after sign-in) | https://olleik-foods-site.vercel.app/portal |
| Wholesale application form | https://olleik-foods-site.vercel.app/apply |

## What was tested

### 1. Every route on production (curl, HTTP status)
| Route | Result |
|---|---|
| `/`, `/about`, `/apply`, `/careers`, `/catalog`, `/contact`, `/delivery`, `/faq`, `/login`, `/resources`, `/suppliers`, `/who-we-serve`, `/admin-login`, `/auth/confirm` | 200 |
| `/catalog/beverages`, `/dairy-eggs`, `/dry-goods`, `/frozen`, `/meat-poultry`, `/packaging-disposables`, `/produce`, `/seafood` (all 8 live category links) | 200 |
| `/admin`, `/admin/orders`, `/admin/products`, `/admin/customers`, `/admin/analytics` (signed out) | 307 → `/admin-login` (correct: gate works) |
| `/portal`, `/portal/catalog`, `/portal/orders` (signed out) | 307 → `/login` (correct: gate works) |
| `/apply/admin` | 404 (expected: not a real page) |
| `/sitemap.xml`, `/robots.txt` | 404 (not implemented; cosmetic, not blocking) |

Response times 0.24–0.48 s.

### 2. Auth backend (browser, real form submissions)
- Admin login form at `/admin-login` submitted with a fake account → Supabase Auth answered HTTP 400 in 470 ms and the page showed "Invalid email or password." The production Supabase project is live and reachable.
- Customer login form at `/login`: same result, same backend.
- Vercel production env has all 7 required variables set: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, and the 3 Stripe keys. `ADMIN_EMAILS` is required by the fail-closed admin gate in `src/lib/admin/auth.ts`; it is present.

### 3. Home page render (browser screenshot)
Hero, nav, catalog preview card and stats all render. No console errors from the site itself (the only two 400s in the console were my own probe logins).

### 4. Code health
- `tsc --noEmit` on `main` (795fae2): exit 0, no type errors.
- Production deployment is from `main`; worktree is identical to `origin/main`.

## Not tested (needs credentials I do not have)
- A real admin sign-in and the admin screens after login. The admin email/password live in Supabase Auth and `ADMIN_EMAILS` on Vercel. Sign in once at `/admin-login` with the real admin account before the meeting; the backend path up to the password check is proven working.

## Tips for the demo
- Bookmark `/admin-login`, not `/admin` (the latter works too but redirects when signed out).
- The admin email must be in `ADMIN_EMAILS` on Vercel or the gate sends you back to `/admin-login` even with a correct password.
