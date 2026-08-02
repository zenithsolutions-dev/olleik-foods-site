-- 0012_orders_created_index.sql
-- CP-5: index for date-range access to orders (approved D-R4).
-- Standalone + idempotent: safe to run more than once. Run manually before
-- merging feat/date-filters (same protocol as 0007–0011).
--
-- WHY NOW (the reassessment the owner asked for): CP-4 scanned one business
-- day and did not justify an index. CP-5 makes created_at a PRIMARY ACCESS
-- PATH on the one unbounded table — "This year" range scans on the inbox and
-- dashboard, and every CP-6/7/8 invoice/statement/report period lands on the
-- same column. The existing indexes lead with status / (customer_id) and
-- cannot serve a bare created_at range.
--
-- SCOPE: exactly ONE statement of substance. No tables, no columns, no
-- policies, no functions — nothing else changes.

-- ---------- Pre-checks (raises, never swallows) ----------
do $$
begin
  if to_regclass('public.orders') is null then
    raise exception '0012 requires 0009 (orders missing) — run earlier migrations first';
  end if;
end $$;

-- ---------- 1. the index ----------

create index if not exists orders_created_idx
  on orders (created_at desc);

-- ---------- 2. Post-checks (informational; run manually after) ----------
-- 1) The index exists:
--    select indexname, indexdef from pg_indexes
--     where tablename = 'orders' and indexname = 'orders_created_idx';
--      -> one row: CREATE INDEX orders_created_idx ON public.orders
--                  USING btree (created_at DESC)
-- 2) The planner uses it for a range scan (any wide-ish range):
--    explain select id from orders
--     where created_at >= now() - interval '90 days';
--      -> plan mentions "Index Scan using orders_created_idx" (or a bitmap
--         scan on it; a Seq Scan on a tiny table is also legitimate — the
--         planner may prefer it until the table grows. The point of the
--         index is that the plan STAYS fast when it does.)
-- 3) Nothing else changed:
--    select count(*) from pg_policies where tablename = 'orders';
--      -> unchanged from before (1 select policy; zero write policies).
-- 4) The app suites still pass:
--    npm run test:orders && npm run test:dates && npm run preflight
