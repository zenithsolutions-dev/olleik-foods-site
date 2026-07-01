-- Olleik Foods — Phase F: reusable offer templates (admin-only) + provenance link.
-- Run this in the Supabase SQL editor BEFORE deploying the Phase F app code.
--
-- Access model unchanged: the app reads/writes via the service-role key, which
-- BYPASSES RLS. offer_templates is an ADMIN-ONLY table: RLS enabled with NO
-- policies (deny-all to anon AND authenticated) — exactly like leads /
-- vendor_submissions / contact_messages in 0001. customer_offers gains a
-- nullable template_id for provenance; its existing customer-facing SELECT
-- policy from 0002 is NOT touched.

-- ---------- Pre-check: dependencies from 0002 must exist ----------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'offer_discount_kind') then
    raise exception 'offer_discount_kind enum missing — run migration 0002 first';
  end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'customer_offers') then
    raise exception 'customer_offers missing — run migration 0002 first';
  end if;
end $$;

-- ---------- Table: offer_templates (admin-managed library) ----------
-- discount_value interpretation matches customer_offers (set by 0002):
--   'percent'     -> whole percent off            (10   = 10% off)
--   'fixed_price' -> flat replacement price, cents (1999 = $19.99)
--   'amount_off'  -> fixed amount off, cents       (500  = $5.00 off)
create table if not exists offer_templates (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,                 -- internal label, e.g. "Seasonal 10% off"
  description    text,                           -- default description for applied offers
  discount_kind  offer_discount_kind,            -- reuse the existing enum
  discount_value integer check (discount_value is null or discount_value >= 0),
  is_archived    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists offer_templates_active_idx
  on offer_templates(is_archived, name);

-- ---------- Provenance link on applied offers ----------
-- Nullable: existing offers stay NULL; ad-hoc (non-template) offers stay supported.
-- ON DELETE SET NULL: deleting a template never deletes or breaks applied offers —
-- they keep their snapshotted values and just lose the provenance pointer.
alter table customer_offers
  add column if not exists template_id uuid references offer_templates(id) on delete set null;

create index if not exists customer_offers_template_idx
  on customer_offers(template_id);

-- ---------- Row Level Security ----------
-- Admin-only: enable RLS, create NO policies → deny-all for anon AND authenticated.
-- Customers can never read templates. Service-role bypasses RLS for admin CRUD.
alter table offer_templates enable row level security;

-- customer_offers RLS is INTENTIONALLY UNCHANGED. The "customer reads own offers"
-- SELECT policy from 0002 still governs it; adding a column does not alter a policy.
-- (RLS is row-scoped, not column-scoped; the portal selects explicit columns and
-- never requests template_id, so it never reaches the browser.)
