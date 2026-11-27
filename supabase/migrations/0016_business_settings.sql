-- 0016: business settings — the business's public identity in ONE row, edited from the admin Settings page.
-- Run in the Supabase SQL editor BEFORE deploying the app code that reads it.
--
-- Why a table: the system is resold to other wholesalers, so no business name, phone or address may live in
-- the code. Everything here is information the business prints on its own documents and website, so it is
-- readable by anyone; it is writable only through the service role (the admin Settings action).
-- Private settings (notification recipients, report schedule) do NOT belong here: they go in a deny-all table.

create table if not exists business_settings (
  id              boolean primary key default true check (id),  -- single row
  display_name    text,   -- short brand name shown in headers and on documents
  legal_name      text,
  address         text,
  phone           text,
  email           text,
  whatsapp_number text,   -- any format; the app keeps the digits for wa.me links
  updated_at      timestamptz not null default now()
);

insert into business_settings (id) values (true) on conflict (id) do nothing;

alter table business_settings enable row level security;

drop policy if exists "anyone reads business identity" on business_settings;
create policy "anyone reads business identity" on business_settings
  for select using (true);
-- No insert/update/delete policy: anon and authenticated can never write.
