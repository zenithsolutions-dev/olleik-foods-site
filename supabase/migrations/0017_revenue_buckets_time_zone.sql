-- 0017: analytics_revenue_buckets takes the business time zone as an argument.
-- Run in the Supabase SQL editor BEFORE deploying the app code that passes p_time_zone.
--
-- 0015 had 'America/Toronto' written into the function. The system is resold to businesses in other
-- zones, so the app now passes its configured zone (NEXT_PUBLIC_BUSINESS_TIME_ZONE). Same maths as 0015.
-- The default is UTC only so a call without the argument still works; the app always passes it.

drop function if exists analytics_revenue_buckets(timestamptz, timestamptz, text);

create or replace function analytics_revenue_buckets(
  p_start     timestamptz,
  p_end       timestamptz,
  p_bucket    text,
  p_time_zone text default 'UTC'
)
returns table (
  bucket_start  timestamptz, -- start of the bucket: the UTC instant of the local boundary
  revenue_cents bigint,
  orders_count  bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    date_trunc(p_bucket, o.created_at at time zone p_time_zone)
      at time zone p_time_zone        as bucket_start,
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

revoke all on function analytics_revenue_buckets(timestamptz, timestamptz, text, text) from public;
revoke all on function analytics_revenue_buckets(timestamptz, timestamptz, text, text) from authenticated;
revoke all on function analytics_revenue_buckets(timestamptz, timestamptz, text, text) from anon;
grant execute on function analytics_revenue_buckets(timestamptz, timestamptz, text, text) to service_role;
