-- 0010_inventory.sql
-- CP-3b: inventory — admin-only stock tracking + availability flag + the
-- atomic confirm-with-decrement / cancel-with-restock functions.
-- Standalone + idempotent: safe to run more than once.
-- Run manually before merging feat/inventory (same protocol as 0007/0008/0009).
--
-- 0007/0008/0009 discipline: NO exception-swallowing DO blocks — every
-- statement is individually idempotent (IF NOT EXISTS / DROP IF EXISTS +
-- CREATE / CREATE OR REPLACE), so a partial run converges on re-run. The only
-- DO block below RAISES on missing prerequisites.
--
-- SECURITY MODEL (approved D-O4/D-O5/D-O6):
--   * product_inventory is a SEPARATE deny-all table (RLS enabled, ZERO
--     policies — service-role only), NOT columns on products: products is
--     customer-readable and RLS is row-level, so stock quantities must live
--     where no customer policy can ever reach them. No inventory row =
--     UNTRACKED product (never blocks orders, never alerts).
--   * order_stock_movements is deny-all too. It records the EXACT per-line
--     amount decremented at confirmation — required because the D-O5 oversell
--     override CLAMPS to zero (ordered 10, stock 4 -> only 4 decremented), and
--     D-O4 says cancellation restocks exactly what was decremented. The amount
--     cannot go on order_items (customer-readable: a clamped amount would leak
--     the stock level at confirmation time, violating D-O6).
--   * The portal sees availability ONLY via products.is_available (a boolean;
--     never quantities). It is maintained solely by the service-role paths in
--     this migration + the admin stock action: stock hits 0 -> false, restock
--     above 0 -> true, untracked products stay true.
--   * confirm_order_stock / cancel_order_with_restock are SECURITY DEFINER
--     with EXECUTE revoked from authenticated/anon, granted to service_role
--     only — the same posture as submit_order_atomic (D-O0). Each makes the
--     status transition and the stock movement ONE transaction: an order can
--     never be confirmed without its decrement, or cancelled without its
--     restock.
--   * No existing policy on any table changes. Anon gains nothing. Unavailable
--     products stay VISIBLE in the portal (with an "Unavailable" chip) — the
--     CP-2 products policy is untouched.

-- ---------- Pre-checks (raises, never swallows) ----------
do $$
begin
  if to_regclass('public.products') is null then
    raise exception '0010 requires 0001 (products missing) — run earlier migrations first';
  end if;
  if to_regclass('public.orders') is null then
    raise exception '0010 requires 0009 (orders missing) — run 0009 first';
  end if;
  if to_regclass('public.order_items') is null then
    raise exception '0010 requires 0009 (order_items missing) — run 0009 first';
  end if;
end $$;

-- ---------- 1. products.is_available (the ONLY stock signal the portal sees) ----------

alter table products add column if not exists is_available boolean not null default true;

-- ---------- 2. orders.stock_decremented_at (restock guard, D-O4) ----------

alter table orders add column if not exists stock_decremented_at timestamptz;

-- ---------- 3. product_inventory (ADMIN-ONLY; deny-all) ----------

create table if not exists product_inventory (
  -- CASCADE is safe: products are deactivate-only in the app; if a product row
  -- ever goes, its stock counter is meaningless anyway.
  product_id uuid primary key references products(id) on delete cascade,
  stock_qty integer not null default 0,
  low_stock_threshold integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Never-negative is a DB invariant, not an app convention.
alter table product_inventory drop constraint if exists product_inventory_qty_check;
alter table product_inventory
  add constraint product_inventory_qty_check check (stock_qty >= 0);

alter table product_inventory drop constraint if exists product_inventory_threshold_check;
alter table product_inventory
  add constraint product_inventory_threshold_check check (low_stock_threshold >= 0);

alter table product_inventory enable row level security;
-- ZERO policies: deny-all (service-role only), same posture as product_costs.

-- ---------- 4. order_stock_movements (exact decrements; deny-all) ----------

create table if not exists order_stock_movements (
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null,
  -- The amount ACTUALLY subtracted (<= ordered qty when the oversell override
  -- clamped). Restock adds back exactly this, then the row is deleted.
  qty_decremented integer not null,
  primary key (order_id, product_id)
);

alter table order_stock_movements drop constraint if exists order_stock_movements_qty_check;
alter table order_stock_movements
  add constraint order_stock_movements_qty_check check (qty_decremented > 0);

alter table order_stock_movements enable row level security;
-- ZERO policies: deny-all (service-role only).

-- ---------- 5. confirm_order_stock (transition + decrement, one transaction) ----------

-- Replaces the app-side new->confirmed UPDATE for orders. In ONE transaction:
--   * locks the order; if it is not 'new' -> {ok:false, code:'stale'} (the
--     same race guard the app's .eq("status", from) gave, now with the
--     decrement inside the same atomic unit).
--   * locks the tracked inventory rows for the order's lines and computes
--     shortages (stock_qty < ordered qty).
--   * shortages + p_allow_oversell=false -> {ok:false, code:'insufficient',
--     shortages:[{product_id, name, ordered, in_stock}]} and NOTHING changes
--     (D-O5: block by default).
--   * otherwise decrements each tracked line by least(stock, qty) — the clamp
--     (D-O5 override) keeps product_inventory_qty_check unbreakable — records
--     the exact amount in order_stock_movements, flips is_available=false for
--     any tracked product whose stock lands on 0 (D-O6), and confirms the
--     order, stamping stock_decremented_at ONLY if something was decremented.
-- Untracked lines (no product_inventory row) never block and never move stock.
create or replace function confirm_order_stock(
  p_order_id uuid,
  p_allow_oversell boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_line record;
  v_short jsonb := '[]'::jsonb;
  v_dec int;
  v_total int := 0;
  v_any boolean := false;
begin
  select status into v_status from orders where id = p_order_id for update;
  if v_status is null or v_status <> 'new' then
    return jsonb_build_object('ok', false, 'code', 'stale');
  end if;

  -- Lock the tracked inventory rows and look for shortages first: the block
  -- path must change NOTHING (locks release at transaction end).
  for v_line in
    select oi.product_id, oi.name, oi.qty, inv.stock_qty
      from order_items oi
      join product_inventory inv on inv.product_id = oi.product_id
     where oi.order_id = p_order_id
     for update of inv
  loop
    if v_line.stock_qty < v_line.qty then
      v_short := v_short || jsonb_build_object(
        'product_id', v_line.product_id,
        'name', v_line.name,
        'ordered', v_line.qty,
        'in_stock', v_line.stock_qty);
    end if;
  end loop;

  if jsonb_array_length(v_short) > 0 and not p_allow_oversell then
    return jsonb_build_object('ok', false, 'code', 'insufficient', 'shortages', v_short);
  end if;

  -- Decrement (rows are still locked by this transaction).
  for v_line in
    select oi.product_id, oi.qty, inv.stock_qty
      from order_items oi
      join product_inventory inv on inv.product_id = oi.product_id
     where oi.order_id = p_order_id
  loop
    v_dec := least(v_line.stock_qty, v_line.qty); -- clamp: never below zero
    if v_dec > 0 then
      update product_inventory
         set stock_qty = stock_qty - v_dec, updated_at = now()
       where product_id = v_line.product_id;
      insert into order_stock_movements (order_id, product_id, qty_decremented)
      values (p_order_id, v_line.product_id, v_dec);
      v_total := v_total + v_dec;
      v_any := true;
    end if;
    -- D-O6: tracked stock at 0 -> unavailable (covers both the clamp landing
    -- on 0 and confirming against an already-empty shelf).
    update products p
       set is_available = false
      from product_inventory inv
     where p.id = v_line.product_id
       and inv.product_id = p.id
       and inv.stock_qty = 0
       and p.is_available; -- no-op write avoidance
  end loop;

  update orders
     set status = 'confirmed',
         confirmed_at = now(),
         stock_decremented_at = case when v_any then now() else null end
   where id = p_order_id;

  return jsonb_build_object('ok', true, 'decremented_units', v_total,
    'oversold', jsonb_array_length(v_short) > 0);
end $$;

revoke all on function confirm_order_stock(uuid, boolean) from public;
revoke all on function confirm_order_stock(uuid, boolean) from authenticated;
revoke all on function confirm_order_stock(uuid, boolean) from anon;
grant execute on function confirm_order_stock(uuid, boolean) to service_role;

-- ---------- 6. cancel_order_with_restock (transition + restock, one transaction) ----------

-- Replaces the app-side cancel transitions. In ONE transaction:
--   * locks the order; cancellable only from new/confirmed/prepared
--     (completed is terminal, D-O3/D-O4) -> {ok:false, code:'stale'} otherwise.
--   * cancels (stamping cancelled_at + optional admin note).
--   * if stock was decremented (stock_decremented_at guard, D-O4): adds back
--     EXACTLY order_stock_movements.qty_decremented per line, flips
--     is_available=true where stock rises above 0 (D-O6), deletes the movement
--     rows, and clears stock_decremented_at — so the restock can never run
--     twice. A new->cancelled order has no stamp and restocks nothing.
create or replace function cancel_order_with_restock(
  p_order_id uuid,
  p_admin_note text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_decremented_at timestamptz;
  v_mv record;
  v_total int := 0;
begin
  select status, stock_decremented_at into v_status, v_decremented_at
    from orders where id = p_order_id for update;
  if v_status is null or v_status not in ('new', 'confirmed', 'prepared') then
    return jsonb_build_object('ok', false, 'code', 'stale');
  end if;

  update orders
     set status = 'cancelled',
         cancelled_at = now(),
         admin_note = coalesce(nullif(trim(p_admin_note), ''), admin_note)
   where id = p_order_id;

  if v_decremented_at is not null then
    for v_mv in
      select product_id, qty_decremented
        from order_stock_movements
       where order_id = p_order_id
       for update
    loop
      -- The inventory row normally still exists; if the admin untracked the
      -- product meanwhile, re-tracking it with the restocked amount is the
      -- only interpretation that never loses stock.
      insert into product_inventory (product_id, stock_qty, updated_at)
      values (v_mv.product_id, v_mv.qty_decremented, now())
      on conflict (product_id) do update
        set stock_qty = product_inventory.stock_qty + excluded.stock_qty,
            updated_at = now();
      v_total := v_total + v_mv.qty_decremented;
      -- D-O6: back above 0 -> available again.
      update products p
         set is_available = true
        from product_inventory inv
       where p.id = v_mv.product_id
         and inv.product_id = p.id
         and inv.stock_qty > 0
         and not p.is_available;
    end loop;
    delete from order_stock_movements where order_id = p_order_id;
    update orders set stock_decremented_at = null where id = p_order_id;
  end if;

  return jsonb_build_object('ok', true, 'restocked_units', v_total);
end $$;

revoke all on function cancel_order_with_restock(uuid, text) from public;
revoke all on function cancel_order_with_restock(uuid, text) from authenticated;
revoke all on function cancel_order_with_restock(uuid, text) from anon;
grant execute on function cancel_order_with_restock(uuid, text) to service_role;

-- ---------- 7. Post-checks (informational; run manually after) ----------
-- 1) Deny-all posture (ZERO policies on both new tables):
--    select tablename, policyname from pg_policies
--     where tablename in ('product_inventory','order_stock_movements');
--      -> zero rows. And RLS is ON:
--    select relname, relrowsecurity from pg_class
--     where relname in ('product_inventory','order_stock_movements');
--      -> relrowsecurity = true for both.
-- 2) Functions are locked down:
--    select has_function_privilege('authenticated',
--      'confirm_order_stock(uuid,boolean)', 'execute');              -> false
--    select has_function_privilege('anon',
--      'confirm_order_stock(uuid,boolean)', 'execute');              -> false
--    select has_function_privilege('service_role',
--      'confirm_order_stock(uuid,boolean)', 'execute');              -> true
--      (repeat for cancel_order_with_restock(uuid,text) -> false/false/true)
-- 3) Constraints behave:
--    insert into product_inventory (product_id, stock_qty)
--      values ('<any product uuid>', -1);
--      -> FAILS with product_inventory_qty_check (23514)
-- 4) Columns exist with the right defaults:
--    select is_available from products limit 1;                      -> true
--    select stock_decremented_at from orders limit 1;                -> null
-- 5) Full behavioral matrix (decrement/block/oversell/restock/deny-all reads,
--    with a real customer session):
--    npm run test:inventory                 -> must PASS all checks
-- 6) Existing guards unchanged:
--    npm run preflight                      -> PASS (new 0010 section included)
--    npm run test:orders                    -> PASS
--    npm run test:visibility                -> PASS
--    node scripts/test-cross-tenant.mjs     -> PASS
--    node scripts/test-pricing-rls.mjs      -> PASS
