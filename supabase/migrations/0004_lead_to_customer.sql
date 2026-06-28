-- Olleik Foods — Phase E: lead -> customer linkage + invite provenance.
-- Run this in the Supabase SQL editor BEFORE deploying the Phase E code.
--
-- All new columns are admin-only (read/written via the service-role key). They
-- do NOT change portal RLS or tenant isolation — the portal never selects them.

-- 1) Add 'converted' to the lead_status ENUM (it is an enum, not a CHECK).
--    Idempotent; run as a top-level statement.
alter type lead_status add value if not exists 'converted';

-- 2) Provenance + dedup links. Both nullable; the two FKs reference each other,
--    which is fine for nullable columns added after both tables already exist.
alter table leads
  add column if not exists converted_customer_id uuid references customers(id) on delete set null;

alter table customers
  add column if not exists source_lead_id uuid references leads(id) on delete set null;

alter table customers
  add column if not exists invited_at timestamptz;

-- 3) Soft dedup backstop: no two NON-archived customers may share an email.
--    Archived customers are excluded, so an email can be re-used after archiving.
--
--    ⚠️  PRE-CHECK before running this statement — it FAILS if active duplicates
--        already exist. Run this first and resolve any rows it returns:
--        select lower(email), count(*) from customers
--        where status <> 'archived' group by lower(email) having count(*) > 1;
create unique index if not exists customers_email_unique_active
  on customers (lower(email)) where status <> 'archived';
