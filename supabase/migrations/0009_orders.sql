-- 0009_orders.sql
-- CP-3a: orders + order_items + admin-only cost snapshots + the atomic
-- submission function. Standalone + idempotent: safe to run more than once.
-- Run manually before merging feat/orders (same protocol as 0006/0007/0008).
--
-- 0007/0008 discipline: NO exception-swallowing DO blocks in migration steps —
-- every statement is individually idempotent (IF NOT EXISTS / DROP IF EXISTS +
-- CREATE / CREATE OR REPLACE), so a partial run converges on re-run. The only
-- DO block below RAISES on missing prerequisites. (The idempotency handler
-- INSIDE submit_order_atomic is business logic for concurrent double-submits,
-- not migration-error swallowing.)
--
-- SECURITY MODEL (approved D-O0) — first customer-write surface:
--   * Customers get ZERO write policies. orders/order_items are SELECT-own
--     only; a raw PostgREST INSERT/UPDATE/DELETE from any customer JWT has no
--     policy to satisfy and fails. Price tampering, ordering-as-someone-else,
--     and post-submission edits are impossible at the DB layer.
--   * The ONLY write path is submit_order_atomic(): SECURITY DEFINER, EXECUTE
--     revoked from authenticated + anon, granted to service_role only. It is
--     called exclusively by the server (src/lib/orders) AFTER the server has
--     re-resolved every price from the customer's own session-visible rows.
--   * order_items carries PRICE data only (customer-readable history).
--     Cost snapshots live in order_item_costs: RLS enabled, ZERO policies
--     (deny-all), service-role only — same posture as product_costs.
--   * No existing policy on any other table changes. Anon gains nothing.

-- ---------- Pre-checks (raises, never swallows) ----------
do $$
begin
  if to_regclass('public.customers') is null then
    raise exception '0009 requires 0001 (customers missing) — run earlier migrations first';
  end if;
  if to_regclass('public.products') is null then
    raise exception '0009 requires 0001 (products missing) — run earlier migrations first';
  end if;
  if to_regclass('public.customer_products') is null then
    raise exception '0009 requires 0001 (customer_products missing) — run earlier migrations first';
  end if;
  if to_regclass('public.customer_hidden_products') is null then
    raise exception '0009 requires 0008 (customer_hidden_products missing) — run 0008 first';
  end if;
end $$;

-- ---------- 1. orders ----------

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  -- RESTRICT: order history must survive; customers are archived (status), not
  -- deleted, and this guarantees it at the DB layer too.
  customer_id uuid not null references customers(id) on delete restrict,
  status text not null default 'new',
  fulfillment text not null,
  notes text,
  -- Payment terms frozen at submission (settlement happens outside the system).
  payment_terms_snapshot text not null,
  total_cents integer not null,
  -- Idempotency: the cart's token; one order per (customer, token).
  client_token uuid not null,
  admin_note text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);

alter table orders drop constraint if exists orders_status_check;
alter table orders
  add constraint orders_status_check
  check (status in ('new', 'confirmed', 'prepared', 'completed', 'cancelled'));

alter table orders drop constraint if exists orders_fulfillment_check;
alter table orders
  add constraint orders_fulfillment_check
  check (fulfillment in ('pickup', 'delivery'));

alter table orders drop constraint if exists orders_total_check;
alter table orders
  add constraint orders_total_check check (total_cents >= 0);

alter table orders drop constraint if exists orders_notes_length_check;
alter table orders
  add constraint orders_notes_length_check
  check (notes is null or char_length(notes) <= 1000);

create unique index if not exists orders_customer_token_key
  on orders(customer_id, client_token);
create index if not exists orders_status_created_idx
  on orders(status, created_at desc);
create index if not exists orders_customer_created_idx
  on orders(customer_id, created_at desc);

alter table orders enable row level security;

drop policy if exists "customer reads own orders" on orders;
create policy "customer reads own orders"
  on orders for select to authenticated
  using (customer_id in (select id from customers where user_id = auth.uid()));
-- NO insert/update/delete policies for any role — intentional (see header).

-- ---------- 2. order_items (customer-readable; PRICE data only) ----------

create table if not exists order_items (
  order_id uuid not null references orders(id) on delete cascade,
  -- RESTRICT: a product with order history cannot be hard-deleted (products are
  -- deactivate-only by design; this enforces it).
  product_id uuid not null references products(id) on delete restrict,
  -- Product snapshot so history survives renames/deactivation.
  name text not null,
  sku text not null,
  unit text not null,
  unit_size text not null,
  qty integer not null,
  -- Pre-offer effective price (assigned price or list) and the charged price.
  base_price_cents integer not null,
  unit_price_cents integer not null,
  applied_offer_title text,
  was_assigned boolean not null,
  line_total_cents integer not null,
  primary key (order_id, product_id)
);

alter table order_items drop constraint if exists order_items_qty_check;
alter table order_items
  add constraint order_items_qty_check check (qty between 1 and 999);

alter table order_items drop constraint if exists order_items_price_check;
alter table order_items
  add constraint order_items_price_check
  check (base_price_cents >= 0 and unit_price_cents >= 0);

-- Line math is a DB invariant, not an app convention.
alter table order_items drop constraint if exists order_items_line_math_check;
alter table order_items
  add constraint order_items_line_math_check
  check (line_total_cents = qty * unit_price_cents);

alter table order_items enable row level security;

drop policy if exists "customer reads own order items" on order_items;
create policy "customer reads own order items"
  on order_items for select to authenticated
  using (order_id in (
    select o.id
      from orders o
      join customers c on c.id = o.customer_id and c.user_id = auth.uid()
  ));
-- NO insert/update/delete policies for any role — intentional.

-- ---------- 3. order_item_costs (ADMIN-ONLY cost snapshots; deny-all) ----------

create table if not exists order_item_costs (
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null,
  -- product_costs.cost_cents at submission time; NULL = no cost recorded then.
  -- Profit is DERIVED in the admin UI (line_total - qty*cost), never stored.
  cost_cents integer,
  primary key (order_id, product_id)
);

alter table order_item_costs enable row level security;
-- ZERO policies: deny-all (service-role only), same as product_costs.

-- ---------- 4. submit_order_atomic (the only write path) ----------

-- p_lines: jsonb array of
--   { product_id, name, sku, unit, unit_size, qty, base_price_cents,
--     unit_price_cents, applied_offer_title|null, was_assigned, cost_cents|null }
-- All prices are SERVER-computed before this call; the function re-validates
-- shape/caps and enforces atomicity + idempotency. SECURITY DEFINER so it can
-- write the deny-all cost table; EXECUTE is revoked from authenticated/anon
-- below, so no customer JWT can ever reach it.
create or replace function submit_order_atomic(
  p_customer_id uuid,
  p_fulfillment text,
  p_notes text,
  p_payment_terms text,
  p_total_cents integer,
  p_client_token uuid,
  p_lines jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_line jsonb;
  v_count int;
  v_sum bigint;
begin
  -- Defense in depth: the app layer already required an active customer.
  if not exists (select 1 from customers where id = p_customer_id and status = 'active') then
    raise exception 'ORDER_CUSTOMER_NOT_ACTIVE';
  end if;

  v_count := coalesce(jsonb_array_length(p_lines), 0);
  if v_count < 1 or v_count > 100 then
    raise exception 'ORDER_LINE_COUNT_OUT_OF_RANGE: %', v_count;
  end if;

  -- Idempotency (fast path): this cart token already produced an order.
  select id into v_order_id
    from orders
   where customer_id = p_customer_id and client_token = p_client_token;
  if v_order_id is not null then
    return v_order_id;
  end if;

  insert into orders
    (customer_id, status, fulfillment, notes, payment_terms_snapshot, total_cents, client_token)
  values
    (p_customer_id, 'new', p_fulfillment, p_notes, p_payment_terms, p_total_cents, p_client_token)
  returning id into v_order_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    insert into order_items
      (order_id, product_id, name, sku, unit, unit_size, qty,
       base_price_cents, unit_price_cents, applied_offer_title, was_assigned, line_total_cents)
    values
      (v_order_id,
       (v_line->>'product_id')::uuid,
       v_line->>'name',
       v_line->>'sku',
       v_line->>'unit',
       v_line->>'unit_size',
       (v_line->>'qty')::int,
       (v_line->>'base_price_cents')::int,
       (v_line->>'unit_price_cents')::int,
       nullif(v_line->>'applied_offer_title', ''),
       (v_line->>'was_assigned')::boolean,
       (v_line->>'qty')::int * (v_line->>'unit_price_cents')::int);

    insert into order_item_costs (order_id, product_id, cost_cents)
    values
      (v_order_id,
       (v_line->>'product_id')::uuid,
       case when v_line->>'cost_cents' is null then null
            else (v_line->>'cost_cents')::int end);
  end loop;

  -- The order total must equal the sum of its lines — a mismatch aborts the
  -- whole transaction (no orphan orders: plpgsql functions are atomic).
  select coalesce(sum(line_total_cents), 0) into v_sum
    from order_items where order_id = v_order_id;
  if v_sum <> p_total_cents then
    raise exception 'ORDER_TOTAL_MISMATCH: lines % vs total %', v_sum, p_total_cents;
  end if;

  return v_order_id;
exception
  when unique_violation then
    -- Concurrent double-submit of the same cart token: the first writer won;
    -- return its order. (Business idempotency, not migration-error swallowing.)
    select id into v_order_id
      from orders
     where customer_id = p_customer_id and client_token = p_client_token;
    if v_order_id is not null then
      return v_order_id;
    end if;
    raise;
end $$;

-- Lock the function down: service_role only. (Repeatable — grants/revokes are
-- idempotent by nature.)
revoke all on function submit_order_atomic(uuid, text, text, text, integer, uuid, jsonb) from public;
revoke all on function submit_order_atomic(uuid, text, text, text, integer, uuid, jsonb) from authenticated;
revoke all on function submit_order_atomic(uuid, text, text, text, integer, uuid, jsonb) from anon;
grant execute on function submit_order_atomic(uuid, text, text, text, integer, uuid, jsonb) to service_role;

-- ---------- 5. Post-checks (informational; run manually after) ----------
-- 1) Tables + policies:
--    select tablename, policyname, cmd from pg_policies
--     where tablename in ('orders','order_items','order_item_costs') order by 1,2;
--      -> orders: ONE select policy; order_items: ONE select policy;
--         order_item_costs: ZERO policies (deny-all). No insert/update/delete
--         policies anywhere.
-- 2) Function is locked down:
--    select has_function_privilege('authenticated',
--      'submit_order_atomic(uuid,text,text,text,integer,uuid,jsonb)', 'execute');
--      -> false      (repeat for 'anon' -> false, 'service_role' -> true)
-- 3) Constraints behave:
--    insert into orders (customer_id, status, fulfillment, payment_terms_snapshot, total_cents, client_token)
--      values ('<any customer uuid>', 'bogus', 'pickup', 'net-30', 0, gen_random_uuid());
--      -> FAILS with orders_status_check (23514); repeat with fulfillment='bogus'
--         -> orders_fulfillment_check. Delete any probe rows you create.
-- 4) Line math invariant: an order_items insert with line_total_cents <> qty*unit_price_cents
--      -> FAILS with order_items_line_math_check.
-- 5) Full behavioral matrix with real customer sessions:
--    node scripts/test-order-security.mjs   -> must PASS all checks
-- 6) Existing guards unchanged:
--    npm run preflight                      -> PASS (new 0009 section included)
--    node scripts/test-cross-tenant.mjs     -> PASS
--    npm run test:visibility                -> PASS
--    node scripts/test-pricing-rls.mjs      -> PASS
