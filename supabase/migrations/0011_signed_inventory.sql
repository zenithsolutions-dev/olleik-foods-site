-- 0011_signed_inventory.sql
-- CP-3c: signed inventory — fixes the phantom-stock defect proven on
-- 2026-08-01 (orders af0fa195/a92a76ad): the D-O5 oversell CLAMP discarded the
-- oversell shortfall, so an oversold order could ship physical units the
-- ledger never attributed to it, and cancelling the order that DID hold the
-- ledger units resurrected stock that had physically left the warehouse.
--
-- AMENDED RULING (owner, 2026-08-01, supersedes the D-O5 clamp):
--   * Oversell decrements the FULL ordered qty. stock_qty is SIGNED —
--     negative stock means "we owe N units" and is the honest representation.
--     The ledger never loses information again: for every confirmed tracked
--     line, order_stock_movements records exactly the ordered qty, and
--     sum(movements applied) always equals the total stock delta.
--   * is_available = false when stock <= 0 (not just = 0); true only when a
--     restock or manual edit brings it above 0. The portal keeps showing only
--     the "Unavailable" chip — never numbers, never the deficit.
--   * cancel_order_with_restock is unchanged in principle (restock exactly
--     what the ledger recorded); re-issued below so 0011 is self-contained
--     and re-verified under signed semantics.
--
-- Standalone + idempotent: safe to run more than once. Run manually before
-- merging feat/signed-inventory (same protocol as 0007–0010). Same
-- discipline: NO exception-swallowing DO blocks; the only DO block RAISES on
-- missing prerequisites. No RLS policy on any table is touched. All three
-- SECURITY DEFINER functions remain revoked from authenticated/anon.

-- ---------- Pre-checks (raises, never swallows) ----------
do $$
begin
  if to_regclass('public.product_inventory') is null then
    raise exception '0011 requires 0010 (product_inventory missing) — run 0010 first';
  end if;
  if to_regclass('public.order_stock_movements') is null then
    raise exception '0011 requires 0010 (order_stock_movements missing) — run 0010 first';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'orders'
       and column_name = 'stock_decremented_at'
  ) then
    raise exception '0011 requires 0010 (orders.stock_decremented_at missing) — run 0010 first';
  end if;
end $$;

-- ---------- 1. stock_qty becomes SIGNED ----------

-- DROP IF EXISTS is idempotent; the threshold check stays (thresholds are
-- always physical counts and never negative).
alter table product_inventory drop constraint if exists product_inventory_qty_check;

-- ---------- 2. confirm_order_stock: full-qty decrement, no clamp ----------

-- Replaces the 0010 body. In ONE transaction:
--   * locks the order; not 'new' -> {ok:false, code:'stale'}.
--   * locks the tracked inventory rows and computes shortages
--     (stock_qty < ordered qty).
--   * shortages + p_allow_oversell=false -> {ok:false, code:'insufficient',
--     shortages:[{product_id, name, ordered, in_stock}]}, NOTHING changes.
--   * otherwise decrements every tracked line by its FULL ordered qty (stock
--     may go negative = units owed), records exactly that qty in
--     order_stock_movements, flips is_available=false for any tracked product
--     whose stock lands at or below 0, confirms the order, and stamps
--     stock_decremented_at whenever ANY movement was recorded.
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

  -- Decrement the FULL ordered qty on every tracked line (rows still locked).
  -- NO CLAMP (amended D-O5): negative stock = units owed; the movement equals
  -- the ordered qty so a later cancel restores exactly this.
  for v_line in
    select oi.product_id, oi.qty
      from order_items oi
      join product_inventory inv on inv.product_id = oi.product_id
     where oi.order_id = p_order_id
  loop
    update product_inventory
       set stock_qty = stock_qty - v_line.qty, updated_at = now()
     where product_id = v_line.product_id;
    insert into order_stock_movements (order_id, product_id, qty_decremented)
    values (p_order_id, v_line.product_id, v_line.qty);
    v_total := v_total + v_line.qty;
    v_any := true;
    -- Amended D-O6 boundary: at or below 0 -> unavailable.
    update products p
       set is_available = false
      from product_inventory inv
     where p.id = v_line.product_id
       and inv.product_id = p.id
       and inv.stock_qty <= 0
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

-- ---------- 3. cancel_order_with_restock: unchanged principle, re-verified ----------

-- Identical restock mechanics (add back exactly order_stock_movements, once,
-- guarded by stock_decremented_at). Under signed semantics this is now
-- automatically physically correct: movements always equal the ordered qty,
-- so cancel(decrementer) and cancel(oversold) both restore the ledger to the
-- physically true number. The availability flip stays "> 0 -> true": a
-- restock that only brings stock back up to 0 or below leaves the product
-- unavailable (still owed).
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
      insert into product_inventory (product_id, stock_qty, updated_at)
      values (v_mv.product_id, v_mv.qty_decremented, now())
      on conflict (product_id) do update
        set stock_qty = product_inventory.stock_qty + excluded.stock_qty,
            updated_at = now();
      v_total := v_total + v_mv.qty_decremented;
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

-- ---------- 4. Post-checks (informational; run manually after) ----------
-- 1) The sign constraint is gone (only the threshold check remains):
--    select conname from pg_constraint
--     where conrelid = 'product_inventory'::regclass and contype = 'c';
--      -> product_inventory_threshold_check ONLY (no product_inventory_qty_check)
-- 2) Negative stock is accepted (behavioral):
--    update product_inventory set stock_qty = -1
--     where product_id = '<any tracked product uuid>';   -> succeeds; revert it.
-- 3) Functions stay locked down:
--    select has_function_privilege('authenticated', 'confirm_order_stock(uuid,boolean)', 'execute');
--      -> false   (repeat for 'anon' -> false, 'service_role' -> true;
--                  same for cancel_order_with_restock(uuid,text)
--                  and submit_order_atomic(uuid,text,text,text,integer,uuid,jsonb))
-- 4) No policy changed:
--    select tablename, count(*) from pg_policies
--     where tablename in ('product_inventory','order_stock_movements','order_item_costs')
--     group by 1;   -> zero rows (all three stay deny-all)
-- 5) Full behavioral matrix incl. THE PRODUCTION REGRESSION (X decrements,
--    Y oversells to negative, Y completes, X cancels -> stock ends at the
--    physically true 0) and the ledger invariant sum(movements) = stock delta:
--    npm run test:inventory                 -> must PASS all checks
-- 6) Existing guards unchanged:
--    npm run preflight                      -> PASS
--    npm run test:orders                    -> PASS
--    npm run test:visibility                -> PASS
