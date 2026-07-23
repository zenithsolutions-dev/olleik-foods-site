-- Olleik Foods — Cost & profit engine: admin-only product costs + margin rules,
-- price provenance, and one-level subcategories.
-- Run this in the Supabase SQL editor BEFORE deploying the feature code.
--
-- SECURITY MODEL (the point of this design):
--   product_costs, pricing_rules, and customer_product_pricing_meta are
--   ADMIN-ONLY: RLS enabled with ZERO policies = deny-all to anon AND
--   authenticated (service-role bypasses RLS for admin server code). Cost and
--   margin data must NEVER be readable by customers. products / customers /
--   customer_products all have customer-readable ROWS, and RLS is row-scoped,
--   not column-scoped — so nothing sensitive is added to those tables.
--   The ONLY change to a customer-readable table is categories.parent_id,
--   which is pure taxonomy (no pricing data).

-- ---------- Pre-checks ----------
do $$ begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'products') then
    raise exception 'products missing — run migration 0001 first';
  end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'customer_products') then
    raise exception 'customer_products missing — run migration 0001 first';
  end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'categories') then
    raise exception 'categories missing — run migration 0001 first';
  end if;
end $$;

-- ---------- Admin-only: purchase cost per product ----------
create table if not exists product_costs (
  product_id uuid primary key references products(id) on delete cascade,
  cost_cents integer not null check (cost_cents >= 0),
  updated_at timestamptz not null default now()
);
alter table product_costs enable row level security;  -- NO policies: deny-all

-- ---------- Admin-only: margin rules (markup on cost) ----------
-- scope 'global'   -> one default margin for everything
-- scope 'category' -> margin for a category (a child-category rule beats its
--                     parent's). is_priority=true makes a category rule beat
--                     even per-customer margins ("Overrides customer margins").
-- scope 'customer' -> margin for one customer (beats non-priority category +
--                     global rules)
-- margin_percent is MARKUP ON COST: price = round(cost * (1 + margin/100)).
-- Two decimals allowed (e.g. 12.50).
create table if not exists pricing_rules (
  id             uuid primary key default gen_random_uuid(),
  scope          text not null check (scope in ('global','category','customer')),
  category_id    uuid references categories(id) on delete cascade,
  customer_id    uuid references customers(id) on delete cascade,
  margin_percent numeric(6,2) not null check (margin_percent >= 0 and margin_percent <= 500),
  is_priority    boolean not null default false,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint pricing_rules_scope_shape check (
    (scope = 'global'   and category_id is null     and customer_id is null) or
    (scope = 'category' and category_id is not null and customer_id is null) or
    (scope = 'customer' and customer_id is not null and category_id is null)
  ),
  -- is_priority is meaningful only for category rules.
  constraint pricing_rules_priority_scope check (
    is_priority = false or scope = 'category'
  )
);
-- One rule per target — toggle is_active instead of duplicating.
create unique index if not exists pricing_rules_one_global
  on pricing_rules(scope) where scope = 'global';
create unique index if not exists pricing_rules_one_per_category
  on pricing_rules(category_id) where scope = 'category';
create unique index if not exists pricing_rules_one_per_customer
  on pricing_rules(customer_id) where scope = 'customer';
alter table pricing_rules enable row level security;  -- NO policies: deny-all

-- ---------- Admin-only: price provenance per assignment ----------
-- Records HOW each customer_products.price_cents was produced, so "recompute"
-- can skip manual prices. Composite FK onto customer_products so meta rows are
-- deleted automatically when an assignment is removed.
--   'manual'   -> admin typed it (inline edit, bulk set/%-off, copied prices)
--   'computed' -> produced by the pricing engine (waterfall)
-- Rollout default for rows with NO meta (everything pre-dating this migration):
-- treated in app logic as manual when price_cents is non-null, list otherwise.
create table if not exists customer_product_pricing_meta (
  customer_id    uuid not null,
  product_id     uuid not null,
  price_source   text not null check (price_source in ('manual','computed')),
  margin_percent numeric(6,2),
  rule_scope     text check (rule_scope in ('global','category','customer')),
  computed_at    timestamptz not null default now(),
  primary key (customer_id, product_id),
  foreign key (customer_id, product_id)
    references customer_products(customer_id, product_id) on delete cascade
);
alter table customer_product_pricing_meta enable row level security;  -- deny-all

-- ---------- Subcategories: one-level nesting ----------
-- parent_id is TAXONOMY ONLY. Depth-1 is enforced in app logic (all category
-- writes are admin/service-role). ON DELETE SET NULL: deleting a parent
-- promotes children to top level rather than orphaning them (the app also
-- guards parent deletion while children exist).
alter table categories
  add column if not exists parent_id uuid references categories(id) on delete set null;
create index if not exists categories_parent_idx on categories(parent_id);

-- ---------- Post-run verification (run these yourself after the migration) ----------
-- 1) Structure exists (each should succeed and return 0 rows):
--    select * from product_costs limit 1;
--    select * from pricing_rules limit 1;
--    select * from customer_product_pricing_meta limit 1;
--    select parent_id from categories limit 1;
-- 2) RLS spot-check — as the ANON key (SQL editor "Run as anon" or a REST call
--    with the anon apikey), these must all return EMPTY (RLS deny-all), never rows:
--    select * from product_costs;
--    select * from pricing_rules;
--    select * from customer_product_pricing_meta;
--    REST equivalents (should return []):
--      GET {SUPABASE_URL}/rest/v1/product_costs      (apikey: anon)
--      GET {SUPABASE_URL}/rest/v1/pricing_rules      (apikey: anon)
-- 3) A signed-in CUSTOMER session must also get [] from those endpoints
--    (authenticated has no policy on these tables either).
