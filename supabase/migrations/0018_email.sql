-- 0018: email notifications — who gets what, a log of every send, and the low-stock alert marker.
-- Run in the Supabase SQL editor BEFORE deploying the app code that sends email.
--
-- All three are ADMIN-ONLY: RLS enabled with NO policies (deny-all to anon and authenticated), exactly
-- like the other admin tables. The app reads and writes them through the service role.

-- ---------- notification_settings (single row) ----------
create table if not exists notification_settings (
  id                      boolean primary key default true check (id),
  email_from_name         text,   -- e.g. "Acme Orders"
  email_from_address      text,   -- must be on the domain verified with the email service
  order_notify_emails     text[] not null default '{}',
  low_stock_notify_emails text[] not null default '{}',
  daily_report_enabled    boolean not null default false,
  daily_report_emails     text[] not null default '{}',
  daily_report_hour       integer not null default 7 check (daily_report_hour between 0 and 23), -- business time zone
  daily_report_sections   text[] not null default '{yesterday,week,low_stock}',
  last_daily_report_on    date,   -- the local day the report last went out: one per day
  updated_at              timestamptz not null default now()
);
insert into notification_settings (id) values (true) on conflict (id) do nothing;
alter table notification_settings enable row level security;

-- ---------- email_log ----------
-- One row per attempt, sent or failed, so a failed send is visible to the admin instead of vanishing.
create table if not exists email_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  kind        text not null check (kind in ('order','low_stock','daily_report','statement','test')),
  to_emails   text[] not null,
  subject     text not null,
  status      text not null check (status in ('sent','failed')),
  error       text,   -- why it failed, in words the admin can act on
  provider_id text,   -- the email service's id for a sent message
  related_id  text    -- e.g. the order id
);
create index if not exists email_log_created_idx on email_log (created_at desc);
alter table email_log enable row level security;

-- ---------- low-stock alert marker ----------
-- Set when the alert for a product goes out, cleared when it is restocked above its threshold:
-- one email per dip, not one per order.
alter table product_inventory add column if not exists low_stock_alerted_at timestamptz;
