-- 0007_product_pricing_rules.sql
-- CP-1: product-scope margin rules + meta priority snapshot.
-- Standalone + idempotent: safe to run more than once. Run manually before
-- merging feat/pricing-autopilot (same protocol as 0006).
--
-- What it does:
--   1. pricing_rules: adds product_id, allows scope 'product' in the scope
--      check + shape check, lets product rules use is_priority, and enforces
--      at most ONE rule per product (partial unique index).
--   2. customer_product_pricing_meta: allows rule_scope 'product' and adds
--      is_priority so source chips can show "(priority)" faithfully (D8).
--   3. NO RLS changes: both tables keep RLS enabled with zero policies
--      (deny-all). Service-role only, as established in 0006.

-- ---------- Pre-checks ----------
do $$
begin
  if to_regclass('public.pricing_rules') is null then
    raise exception '0007 requires 0006 (pricing_rules missing) — run 0006 first';
  end if;
  if to_regclass('public.customer_product_pricing_meta') is null then
    raise exception '0007 requires 0006 (customer_product_pricing_meta missing) — run 0006 first';
  end if;
end $$;

-- ---------- 1. pricing_rules: product scope ----------

alter table pricing_rules
  add column if not exists product_id uuid references products(id) on delete cascade;

-- Rebuild the three checks to admit scope 'product'. Names: the two named
-- constraints from 0006 plus the auto-named inline check on scope
-- (pricing_rules_scope_check). All drops are IF EXISTS so re-runs are safe.
do $$
begin
  alter table pricing_rules drop constraint if exists pricing_rules_scope_check;
  alter table pricing_rules drop constraint if exists pricing_rules_scope_shape;
  alter table pricing_rules drop constraint if exists pricing_rules_priority_scope;

  alter table pricing_rules
    add constraint pricing_rules_scope_check
    check (scope in ('global','category','customer','product'));

  alter table pricing_rules
    add constraint pricing_rules_scope_shape
    check (
      (scope = 'global'   and category_id is null     and customer_id is null and product_id is null) or
      (scope = 'category' and category_id is not null and customer_id is null and product_id is null) or
      (scope = 'customer' and customer_id is not null and category_id is null and product_id is null) or
      (scope = 'product'  and product_id  is not null and category_id is null and customer_id is null)
    );

  -- is_priority is meaningful for category AND (new) product rules.
  alter table pricing_rules
    add constraint pricing_rules_priority_scope
    check (is_priority = false or scope in ('category','product'));
exception
  when duplicate_object then null; -- constraint already re-added by a prior run
end $$;

-- One rule per product (same one-rule-per-target pattern as 0006).
create unique index if not exists pricing_rules_one_per_product
  on pricing_rules(product_id) where scope = 'product';

create index if not exists pricing_rules_product_idx on pricing_rules(product_id);

-- ---------- 2. meta: rule_scope 'product' + is_priority (D8) ----------

alter table customer_product_pricing_meta
  add column if not exists is_priority boolean not null default false;

do $$
begin
  alter table customer_product_pricing_meta
    drop constraint if exists customer_product_pricing_meta_rule_scope_check;

  alter table customer_product_pricing_meta
    add constraint customer_product_pricing_meta_rule_scope_check
    check (rule_scope in ('global','category','customer','product'));
exception
  when duplicate_object then null;
end $$;

-- ---------- 3. Post-checks (informational; run manually after) ----------
-- 1) Shape sanity:
--    insert into pricing_rules (scope, margin_percent) values ('product', 10);
--      -> must FAIL (product_id required by pricing_rules_scope_shape)
-- 2) Deny-all still holds (anon + authenticated):
--    GET {SUPABASE_URL}/rest/v1/pricing_rules   (apikey: anon)  -> 0 rows/401
--    node scripts/test-pricing-rls.mjs          -> PASS on all four tables
-- 3) Uniqueness:
--    two inserts of scope='product' with the same product_id -> second fails 23505
