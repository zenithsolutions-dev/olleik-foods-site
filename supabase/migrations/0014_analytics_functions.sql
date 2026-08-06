-- Olleik Foods — CP-8b: read-only analytics aggregate functions (approved D-N4)
-- Standalone migration; renumbered 0014 after 0013 took the bulk-offers slot.
-- Run in the Supabase SQL editor. The app tolerates this not being applied:
-- analytics fall back to in-app aggregation (correct but unbounded as history
-- grows); these functions move the SUM/GROUP BY into Postgres, which the CP-5
-- spec flagged as the point where server-side aggregation becomes justified.
--
-- D-O0 PATTERN EXACTLY: SECURITY DEFINER, EXECUTE revoked from public/
-- authenticated/anon, granted to service_role ONLY. No new tables. No new
-- indexes — orders_created_idx (0012), orders_customer_created_idx (0009) and
-- the order_items PK cover these scans; the live EXPLAIN in the PR is the
-- measurement backing that claim.
--
-- COUNTING RULE: revenue statuses are confirmed/prepared/completed — the SQL
-- mirror of REVENUE_STATUSES in src/lib/admin/dashboard-math.ts. The
-- test:analytics non-divergence check asserts these two definitions agree by
-- comparing live figures against aggregateDay for the same period; if a status
-- is ever added there, it must be added here (and the test will catch a miss).
--
-- Both functions take a half-open window [p_start, p_end) with NULL meaning
-- unbounded — the exact CP-5 range semantics.

-- ---------- product sales ----------
-- One row per product that had at least one counted line in the window.
-- Cost figures come from the deny-all order_item_costs snapshots; costed_lines
-- vs total lines lets the UI say "profit over incomplete costs" honestly.
create or replace function analytics_product_sales(
  p_start timestamptz,
  p_end   timestamptz
)
returns table (
  product_id    uuid,
  name          text,
  sku           text,
  units         bigint,
  revenue_cents bigint,
  cost_cents    bigint,   -- sum over costed lines only; null if none costed
  costed_lines  bigint,
  total_lines   bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    oi.product_id,
    max(oi.name)                        as name,
    max(oi.sku)                         as sku,
    sum(oi.qty)::bigint                 as units,
    sum(oi.line_total_cents)::bigint    as revenue_cents,
    sum(oi.qty * oic.cost_cents)::bigint as cost_cents,
    count(oic.cost_cents)::bigint       as costed_lines,
    count(*)::bigint                    as total_lines
  from order_items oi
  join orders o on o.id = oi.order_id
  left join order_item_costs oic
    on oic.order_id = oi.order_id and oic.product_id = oi.product_id
  where o.status in ('confirmed','prepared','completed')
    and (p_start is null or o.created_at >= p_start)
    and (p_end   is null or o.created_at <  p_end)
  group by oi.product_id
$$;

revoke all on function analytics_product_sales(timestamptz, timestamptz) from public;
revoke all on function analytics_product_sales(timestamptz, timestamptz) from authenticated;
revoke all on function analytics_product_sales(timestamptz, timestamptz) from anon;
grant execute on function analytics_product_sales(timestamptz, timestamptz) to service_role;

-- ---------- customer sales ----------
-- One row per customer with at least one counted order in the window.
-- last_order_at is the customer's most recent counted order WITHIN the window
-- — called with NULL bounds (all time) it powers the inactive/never-ordered
-- split. No cost/profit here (approved D-N2: profit ranking is a product-table
-- concern; top customers rank by value and count).
create or replace function analytics_customer_sales(
  p_start timestamptz,
  p_end   timestamptz
)
returns table (
  customer_id   uuid,
  orders_count  bigint,
  revenue_cents bigint,
  last_order_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    o.customer_id,
    count(*)::bigint            as orders_count,
    sum(o.total_cents)::bigint  as revenue_cents,
    max(o.created_at)           as last_order_at
  from orders o
  where o.status in ('confirmed','prepared','completed')
    and (p_start is null or o.created_at >= p_start)
    and (p_end   is null or o.created_at <  p_end)
  group by o.customer_id
$$;

revoke all on function analytics_customer_sales(timestamptz, timestamptz) from public;
revoke all on function analytics_customer_sales(timestamptz, timestamptz) from authenticated;
revoke all on function analytics_customer_sales(timestamptz, timestamptz) from anon;
grant execute on function analytics_customer_sales(timestamptz, timestamptz) to service_role;

-- ---------- Verification queries (run after applying; expected results) ----------
--
-- 1. Functions exist, SECURITY DEFINER, stable:
--      select proname, prosecdef, provolatile from pg_proc
--      where proname in ('analytics_product_sales','analytics_customer_sales');
--    -> two rows, prosecdef = true, provolatile = 's'.
--
-- 2. EXECUTE is service_role-only:
--      select proname, proacl from pg_proc
--      where proname in ('analytics_product_sales','analytics_customer_sales');
--    -> proacl lists service_role=X; no authenticated/anon entry.
--
-- 3. A signed-in customer CANNOT call them (run in the SQL editor as
--    authenticated via impersonation, or trust test:analytics which asserts
--    the anon/authenticated call fails):
--      select * from analytics_product_sales(null, null);
--    -> permission denied for function (when not service_role).
--
-- 4. Sanity: all-time totals equal a direct sum:
--      select (select sum(total_cents) from orders
--               where status in ('confirmed','prepared','completed'))
--           = (select sum(revenue_cents) from analytics_customer_sales(null, null));
--    -> true.
--
-- 5. EXPLAIN (run these two here in the SQL editor — the project has
--    db_plan_enabled off, so PostgREST refuses EXPLAIN over the API and this
--    is the one measurement that must happen editor-side; paste the output
--    into the PR thread for the record):
--      explain (analyze, buffers)
--        select * from analytics_product_sales('2026-07-01','2026-08-01');
--      explain (analyze, buffers)
--        select * from analytics_customer_sales(null, null);
--    Expected at current volume (35 orders / 45 lines): a Seq Scan is CORRECT
--    and optimal — the planner ignores indexes on tiny tables. The design
--    claim to re-check at scale: once orders reaches tens of thousands, the
--    window query should show an Index Scan on orders_created_idx; if it
--    still seq-scans AND is slow, that is the measured justification for a
--    composite index — not before.
