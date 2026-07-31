-- 0008_catalog_visibility.sql
-- CP-2: per-customer catalog visibility (assigned | all | categories) plus a
-- per-customer hidden-products exclusion list that wins in EVERY mode.
-- Standalone + idempotent: safe to run more than once. Run manually before
-- merging feat/catalog-visibility (same protocol as 0006/0007).
--
-- 0007 lesson applied: NO exception-swallowing DO blocks. Every statement is
-- individually idempotent (IF NOT EXISTS / DROP IF EXISTS + CREATE), so a
-- partial run can simply be re-run and converges to the full state. The only
-- DO block below RAISES on missing prerequisites — it never hides a failure.
--
-- What it does:
--   1. customers.visibility_mode: 'assigned' (default, today's behavior),
--      'all', or 'categories'. Lives on customers, so the "customer reads own
--      row" policy lets the RLS policy below evaluate it from the customer's
--      own session (approved decision D-V1).
--   2. customer_visible_categories: which categories a 'categories'-mode
--      customer may browse. Selecting a PARENT includes its children at READ
--      time (future subcategories auto-include). Customer-readable for own
--      rows only (D-V2).
--   3. customer_hidden_products: products hidden from one customer in ANY
--      mode — hidden beats assigned (D-V4). Customer-readable for own rows
--      only; exposes opaque UUIDs at most, never product data (D-V3).
--   4. Replaces the products SELECT policy from 0003. The old policy's logic
--      survives verbatim as arm (a); arms (b)/(c) only activate when the
--      caller's own customers row carries that mode. NO anon policy is added:
--      anon keeps ZERO product reads. No other table's policies change; the
--      money tables (product_costs, pricing_rules, meta, offer_templates)
--      stay deny-all and are not touched here.

-- ---------- Pre-checks (raises, never swallows) ----------
do $$
begin
  if to_regclass('public.customers') is null then
    raise exception '0008 requires 0001 (customers missing) — run earlier migrations first';
  end if;
  if to_regclass('public.products') is null then
    raise exception '0008 requires 0001 (products missing) — run earlier migrations first';
  end if;
  if to_regclass('public.categories') is null then
    raise exception '0008 requires 0001 (categories missing) — run earlier migrations first';
  end if;
  if to_regclass('public.customer_products') is null then
    raise exception '0008 requires 0001 (customer_products missing) — run earlier migrations first';
  end if;
end $$;

-- ---------- 1. customers.visibility_mode ----------

alter table customers
  add column if not exists visibility_mode text not null default 'assigned';

-- Named check, rebuilt drop-then-add so re-runs converge (no swallowed errors).
alter table customers drop constraint if exists customers_visibility_mode_check;
alter table customers
  add constraint customers_visibility_mode_check
  check (visibility_mode in ('assigned', 'all', 'categories'));

-- ---------- 2. customer_visible_categories ----------

create table if not exists customer_visible_categories (
  customer_id uuid not null references customers(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, category_id)
);

-- The policy's parent-expansion arm joins on category_id.
create index if not exists customer_visible_categories_category_idx
  on customer_visible_categories(category_id);

alter table customer_visible_categories enable row level security;

drop policy if exists "customer reads own visible categories" on customer_visible_categories;
create policy "customer reads own visible categories"
  on customer_visible_categories for select to authenticated
  using (
    customer_id in (select id from customers where user_id = auth.uid())
  );
-- No insert/update/delete policies and no anon policy: writes are admin-only
-- via the service-role client (bypasses RLS); anon reads nothing.

-- ---------- 3. customer_hidden_products ----------

create table if not exists customer_hidden_products (
  customer_id uuid not null references customers(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, product_id)
);

alter table customer_hidden_products enable row level security;

drop policy if exists "customer reads own hidden products" on customer_hidden_products;
create policy "customer reads own hidden products"
  on customer_hidden_products for select to authenticated
  using (
    customer_id in (select id from customers where user_id = auth.uid())
  );
-- Same write posture as above: service-role only; no anon policy.

-- ---------- 4. products SELECT policy (replaces 0003) ----------

-- Old 0003 policy name, then the new one, so re-runs are clean either way.
drop policy if exists "customer reads own assigned products only" on products;
drop policy if exists "customer reads visible products" on products;

create policy "customer reads visible products"
  on products for select to authenticated using (
    is_active
    -- exclusions: hidden beats everything, in every mode (D-V4)
    and not exists (
      select 1
        from customer_hidden_products hp
        join customers hc on hc.id = hp.customer_id and hc.user_id = auth.uid()
       where hp.product_id = products.id
    )
    and (
      -- (a) assigned — visible in every mode (verbatim 0003 semantics)
      id in (
        select cp.product_id
          from customer_products cp
          join customers ac on ac.id = cp.customer_id and ac.user_id = auth.uid()
      )
      -- (b) mode 'all': the entire active catalog
      or exists (
        select 1 from customers c
         where c.user_id = auth.uid() and c.visibility_mode = 'all'
      )
      -- (c) mode 'categories': product's category is selected, or is a child
      --     of a selected parent (read-time expansion — a subcategory created
      --     later under a selected parent is included automatically)
      or (
        exists (
          select 1 from customers c
           where c.user_id = auth.uid() and c.visibility_mode = 'categories'
        )
        and category_id in (
          select vc.category_id
            from customer_visible_categories vc
            join customers vcc on vcc.id = vc.customer_id and vcc.user_id = auth.uid()
          union
          select ch.id
            from categories ch
            join customer_visible_categories vc2 on vc2.category_id = ch.parent_id
            join customers vcc2 on vcc2.id = vc2.customer_id and vcc2.user_id = auth.uid()
        )
      )
    )
  );

-- ---------- 5. Post-checks (informational; run manually after) ----------
-- 1) Column + constraint:
--    select visibility_mode, count(*) from customers group by 1;
--      -> every existing customer reads 'assigned' (default backfilled)
--    update customers set visibility_mode = 'bogus' where false;  -- shape only
--    insert-level probe: an UPDATE to 'bogus' on any row must FAIL with
--    customers_visibility_mode_check (23514).
-- 2) Policies in place (names + tables):
--    select tablename, policyname from pg_policies
--     where tablename in ('products','customer_visible_categories','customer_hidden_products')
--     order by 1,2;
--      -> products: 'customer reads visible products' (old 0003 name GONE)
--      -> one own-rows SELECT policy on each new table
-- 3) Anon still reads zero products:
--    GET {SUPABASE_URL}/rest/v1/products?select=id  (apikey: anon, no auth) -> []
-- 4) Behavioral matrix with real sessions:
--    node scripts/test-visibility-rls.mjs   -> must PASS all checks
-- 5) Existing guards unchanged:
--    node scripts/test-cross-tenant.mjs     -> PASS
--    node scripts/test-pricing-rls.mjs      -> PASS (money tables still deny-all)
