-- Olleik Foods — Phase C: customer offers + archive status
-- Run this in the Supabase SQL editor BEFORE deploying the Phase C app code,
-- otherwise the admin customer pages will error (missing table / enum value).
--
-- Access model is unchanged from 0001: the app reads/writes through the
-- service-role key (which BYPASSES RLS). RLS here is the deny-by-default
-- foundation for the customer portal (Phase D): a signed-in customer may read
-- ONLY their own offers. There is deliberately NO anon policy.

-- ---------- Enums ----------

-- Add an 'archived' state to the existing customer_status ENUM (it is an enum,
-- not a CHECK constraint). Archived customers are soft-deleted: hidden from the
-- main admin list + dashboard count, but their row, customer_products, and
-- customer_offers are all preserved and restorable.
-- (ADD VALUE IF NOT EXISTS is idempotent; run as a top-level statement.)
alter type customer_status add value if not exists 'archived';

-- Discount kinds an offer can carry. Built now for full future flexibility even
-- though Phase C offers are informational (discount fields are stored but not
-- surfaced in the UI yet). discount_value interpretation by kind:
--   'percent'     -> whole percent off          (e.g. 10  = 10% off)
--   'fixed_price' -> flat replacement price, in cents (e.g. 1999 = $19.99)
--   'amount_off'  -> fixed amount off, in cents  (e.g. 500  = $5.00 off)
do $$ begin
  create type offer_discount_kind as enum ('percent','fixed_price','amount_off');
exception when duplicate_object then null; end $$;

-- ---------- Tables ----------

-- Per-customer offers. Informational this phase (title/description/validity/
-- optional product link). discount_kind/discount_value are nullable: an offer
-- may carry no discount, but when discount_kind is set it must be one of the
-- enum values above.
create table if not exists customer_offers (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references customers(id) on delete cascade,
  title          text not null,
  description    text,
  -- Optional product link; SET NULL so the offer survives if a product is ever
  -- removed (products are normally deactivated, not deleted).
  product_id     uuid references products(id) on delete set null,
  discount_kind  offer_discount_kind,            -- nullable; see convention above
  discount_value integer check (discount_value is null or discount_value >= 0),
  starts_at      timestamptz,
  ends_at        timestamptz,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  -- If both bounds are set, the window must be ordered.
  constraint customer_offers_window_chk
    check (starts_at is null or ends_at is null or ends_at >= starts_at)
);

create index if not exists customer_offers_customer_idx
  on customer_offers(customer_id);

-- ---------- Row Level Security ----------
alter table customer_offers enable row level security;

-- A customer may read ONLY their own offers (foundation for the Phase D portal).
-- Ownership-scoped via the same subquery used by customer_products. NO anon
-- policy and NO insert/update/delete policy: admin writes go through the
-- service-role client, which bypasses RLS.
--
-- ⚠️  This subquery is the ONLY thing preventing one signed-in customer from
--     reading another customer's offers. It must stay ownership-scoped — never
--     `using (true)`.
drop policy if exists "customer reads own offers" on customer_offers;
create policy "customer reads own offers"
  on customer_offers for select to authenticated using (
    customer_id in (select id from customers where user_id = auth.uid())
  );
