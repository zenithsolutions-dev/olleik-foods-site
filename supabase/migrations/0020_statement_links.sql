-- 0020: statement links — a secure, expiring link to one customer's statement, sent by WhatsApp or email.
-- Run in the Supabase SQL editor BEFORE deploying the app code that uses it.
--
-- WhatsApp click-to-chat cannot attach a file, so the customer gets a link instead. The link is the only
-- thing protecting the statement:
--   * the token is 256 random bits and is NEVER stored — only its SHA-256 hash is, so a copy of this table
--     does not contain a single working link;
--   * every link expires (7 days, set by the app) and can be revoked;
--   * the table is ADMIN-ONLY: RLS enabled with no policies. The public statement page looks a token up on
--     the server (service role) and renders the CUSTOMER copy of the statement — no cost, no profit.

create table if not exists statement_links (
  id           uuid primary key default gen_random_uuid(),
  token_hash   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  customer_id  uuid not null references customers(id) on delete cascade,
  -- The period the statement covers, fixed when the link is made (null = unbounded on that side).
  range_start  timestamptz,
  range_end    timestamptz,
  period_label text not null,
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  created_by   text,          -- the admin who sent it
  sent_via     text check (sent_via in ('email', 'whatsapp')),
  created_at   timestamptz not null default now()
);

create index if not exists statement_links_customer_idx on statement_links (customer_id, created_at desc);

alter table statement_links enable row level security;
