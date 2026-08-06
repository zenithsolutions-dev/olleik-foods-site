-- Olleik Foods — CP-8 charts follow-on: time-bucketed revenue (migration 0015)
-- Standalone migration; run in the Supabase SQL editor. The app tolerates this
-- not being applied (the revenue chart falls back to in-app bucketing with an
-- on-screen notice, the 8b pattern).
--
-- WHY A NEW FUNCTION (justified, as required): the 0014 aggregates return
-- period TOTALS — the time dimension simply does not exist in their outputs
-- and cannot be derived from them. Bucketing in the app would mean shipping
-- every order row of the period over the wire, which is exactly what 0014
-- exists to avoid.
--
-- D-O0 PATTERN EXACTLY: SECURITY DEFINER, EXECUTE revoked from public/
-- authenticated/anon, granted to service_role only. No new tables, no new
-- indexes (same orders window scan as 0014 — measured baselines there).
--
-- BUCKET BOUNDARIES ARE TORONTO BUSINESS DAYS: date_trunc runs on the
-- timestamp converted to America/Toronto, then converts back — so a "day"
-- is the same business day the dashboard and CP-5 ranges use, a "week"
-- starts Monday (date_trunc ISO weeks — the CP-5 D-R2 rule), and DST edges
-- land where the merchant experiences them.
--
-- COUNTING: confirmed/prepared/completed — the SQL mirror of REVENUE_STATUSES
-- (dashboard-math), same as 0014; the suite asserts bucket sums equal the
-- period totals so the chart and the tables cannot disagree.
--
-- An invalid p_bucket returns an empty set (the WHERE guard) rather than
-- erroring — the app only ever passes 'day' | 'week' | 'month'.

create or replace function analytics_revenue_buckets(
  p_start  timestamptz,
  p_end    timestamptz,
  p_bucket text
)
returns table (
  bucket_start  timestamptz, -- start of the bucket, UTC instant of the Toronto boundary
  revenue_cents bigint,
  orders_count  bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    date_trunc(p_bucket, o.created_at at time zone 'America/Toronto')
      at time zone 'America/Toronto'  as bucket_start,
    sum(o.total_cents)::bigint        as revenue_cents,
    count(*)::bigint                  as orders_count
  from orders o
  where o.status in ('confirmed','prepared','completed')
    and p_bucket in ('day','week','month')
    and (p_start is null or o.created_at >= p_start)
    and (p_end   is null or o.created_at <  p_end)
  group by 1
  order by 1
$$;

revoke all on function analytics_revenue_buckets(timestamptz, timestamptz, text) from public;
revoke all on function analytics_revenue_buckets(timestamptz, timestamptz, text) from authenticated;
revoke all on function analytics_revenue_buckets(timestamptz, timestamptz, text) from anon;
grant execute on function analytics_revenue_buckets(timestamptz, timestamptz, text) to service_role;

-- ---------- Verification queries (run after applying; expected results) ----------
--
-- 1. Function exists, SECURITY DEFINER, stable, service_role-only:
--      select proname, prosecdef, provolatile, proacl from pg_proc
--      where proname = 'analytics_revenue_buckets';
--    -> one row, prosecdef = true, provolatile = 's', proacl lists
--       service_role=X with no authenticated/anon entry.
--
-- 2. Bucket sums equal the period total (the chart cannot disagree with the
--    tables):
--      select (select coalesce(sum(revenue_cents),0)
--                from analytics_revenue_buckets(null, null, 'month'))
--           = (select coalesce(sum(total_cents),0) from orders
--               where status in ('confirmed','prepared','completed'));
--    -> true.
--
-- 3. Toronto boundary sanity: an order at 2026-08-03 03:00 UTC (23:00 Aug 2
--    Toronto) must land in the Aug 2 'day' bucket:
--      select date_trunc('day',
--        timestamptz '2026-08-03 03:00:00+00' at time zone 'America/Toronto')
--        at time zone 'America/Toronto';
--    -> 2026-08-02 04:00:00+00 (midnight Aug 2 Toronto, EDT).
--
-- 4. Invalid bucket is empty, not an error:
--      select count(*) from analytics_revenue_buckets(null, null, 'hour');
--    -> 0.
