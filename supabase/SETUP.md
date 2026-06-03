# Supabase setup — Olleik Foods

The app code is wired and will start persisting the moment these env vars are
set. Until then, form submissions fall back to Vercel function logs (nothing
breaks). The service-role key is used **server-side only** and bypasses RLS.

## 1. Create the Supabase project
1. Sign in at https://supabase.com and create a new project (region: closest to
   Ottawa, e.g. East US / Canada). Save the database password somewhere safe.

## 2. Run the schema
1. In the project, open **SQL Editor → New query**.
2. Paste the contents of `supabase/migrations/0001_init.sql` and **Run**.
3. This creates the tables, enums, RLS policies, and seeds the demo catalog,
   customers, and leads. It's safe to re-run (idempotent).

## 3. Get the three keys
In **Project Settings → API**, copy:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** key (under "Project API keys", reveal it) →
  `SUPABASE_SERVICE_ROLE_KEY`  ⚠️ secret — never commit or expose to the browser.

## 4. Set them locally
Create `.env.local` in the repo root (it's gitignored):

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## 5. Set them in Vercel
Project → **Settings → Environment Variables**. Add the same three for
**Production** and **Preview**. Mark `SUPABASE_SERVICE_ROLE_KEY` as sensitive.
Redeploy (or push) so the new vars take effect.

## 6. Verify
- Submit the `/apply`, `/suppliers`, and `/contact` forms.
- In Supabase **Table Editor**, confirm new rows land in `leads`,
  `vendor_submissions`, and `contact_messages`.

## What's still mock
The `/admin` panel currently reads from `localStorage` seed data
(`src/lib/admin/`). Pointing it at these tables (server-side, via the
service-role client) is the next step once the project exists.
