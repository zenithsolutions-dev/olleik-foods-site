-- Olleik Foods — initial schema (Phase 2 backend)
-- Run this in the Supabase SQL editor (or `supabase db push`).
-- Mirrors src/lib/admin/types.ts so the admin panel swaps from mock data
-- to real rows mechanically.
--
-- Access model (this pass): all app reads/writes go through the secret
-- service-role key in server actions/components, which BYPASSES RLS. RLS is
-- enabled and deny-by-default for the public; the `authenticated` policies
-- below are the foundation for the customer portal (each customer sees only
-- their own row + assigned products).

-- ---------- Enums ----------
do $$ begin
  create type product_unit as enum ('case','bag','lb','kg','gal','L','ea','box');
exception when duplicate_object then null; end $$;

do $$ begin
  create type customer_status as enum ('active','pending','suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_terms as enum ('net-15','net-30','card-on-file','cod');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_status as enum ('new','contacted','approved','rejected');
exception when duplicate_object then null; end $$;

-- ---------- Tables ----------
create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists products (
  id               uuid primary key default gen_random_uuid(),
  sku              text not null unique,
  name             text not null,
  description      text,
  category_id      uuid references categories(id) on delete set null,
  unit             product_unit not null,
  unit_size        text not null,
  list_price_cents integer not null check (list_price_cents >= 0),
  image_url        text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);
create index if not exists products_category_idx on products(category_id);

create table if not exists customers (
  id            uuid primary key default gen_random_uuid(),
  -- Links to Supabase Auth once the customer portal logins exist. Nullable
  -- until a customer is invited / signs up.
  user_id       uuid unique references auth.users(id) on delete set null,
  business_name text not null,
  contact_name  text not null,
  email         text not null,
  phone         text not null,
  address       text not null default '',
  status        customer_status not null default 'pending',
  payment_terms payment_terms not null default 'cod',
  notes         text,
  created_at    timestamptz not null default now()
);

-- Per-customer assigned products + negotiated price. Absent row => customer
-- doesn't see the product. Row with null price_cents => sees list price.
create table if not exists customer_products (
  customer_id uuid not null references customers(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,
  price_cents integer check (price_cents is null or price_cents >= 0),
  primary key (customer_id, product_id)
);

-- /apply submissions (wholesale account requests)
create table if not exists leads (
  id             uuid primary key default gen_random_uuid(),
  business_name  text not null,
  contact_name   text not null,
  email          text not null,
  phone          text not null,
  address        text,
  business_type  text,
  monthly_volume text,
  message        text,
  status         lead_status not null default 'new',
  submitted_at   timestamptz not null default now()
);

-- /suppliers submissions (become-a-vendor)
create table if not exists vendor_submissions (
  id          uuid primary key default gen_random_uuid(),
  company     text not null,
  contact     text,
  email       text,
  phone       text,
  categories  text,
  about       text,
  received_at timestamptz not null default now()
);

-- /contact submissions (general messages)
create table if not exists contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  phone       text,
  business    text,
  topic       text,
  message     text,
  received_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
alter table categories        enable row level security;
alter table products          enable row level security;
alter table customers         enable row level security;
alter table customer_products enable row level security;
alter table leads             enable row level security;
alter table vendor_submissions enable row level security;
alter table contact_messages  enable row level security;

-- Catalog is readable by any signed-in user (foundation for the portal).
-- (Service role bypasses RLS, so admin/server code is unaffected.)
drop policy if exists "categories readable by authenticated" on categories;
create policy "categories readable by authenticated"
  on categories for select to authenticated using (true);

drop policy if exists "active products readable by authenticated" on products;
create policy "active products readable by authenticated"
  on products for select to authenticated using (is_active);

-- A customer can read only their own record...
drop policy if exists "customer reads own row" on customers;
create policy "customer reads own row"
  on customers for select to authenticated using (user_id = auth.uid());

-- ...and only their own assigned products/pricing.
drop policy if exists "customer reads own assigned products" on customer_products;
create policy "customer reads own assigned products"
  on customer_products for select to authenticated using (
    customer_id in (select id from customers where user_id = auth.uid())
  );

-- leads / vendor_submissions / contact_messages: no public policies on
-- purpose. Inserts/reads happen via the service role in server actions.

-- ---------- Seed data ----------
insert into categories (name, description) values
  ('Produce', 'Fresh vegetables, fruits, herbs'),
  ('Dairy & Eggs', null),
  ('Meat & Poultry', null),
  ('Seafood', null),
  ('Dry Goods', 'Flour, sugar, oils, spices, canned'),
  ('Beverages', null),
  ('Frozen', null),
  ('Packaging & Disposables', null)
on conflict (name) do nothing;

insert into products (sku, name, description, category_id, unit, unit_size, list_price_cents, is_active, created_at) values
  ('PRD-001','Vine-Ripe Tomatoes','Locally grown, picked at peak ripeness',(select id from categories where name='Produce'),'case','25 lb',4800,true, now()-interval '30 days'),
  ('PRD-002','Yellow Onions',null,(select id from categories where name='Produce'),'bag','50 lb',3200,true, now()-interval '30 days'),
  ('DRY-101','Aged Cheddar Block',null,(select id from categories where name='Dairy & Eggs'),'ea','5 lb',2950,true, now()-interval '25 days'),
  ('DRY-102','Whole Milk Mozzarella, Shredded',null,(select id from categories where name='Dairy & Eggs'),'case','6 x 5 lb',14500,true, now()-interval '25 days'),
  ('MEAT-201','Boneless Chicken Breast',null,(select id from categories where name='Meat & Poultry'),'case','40 lb',18900,true, now()-interval '20 days'),
  ('MEAT-202','Ground Beef 80/20',null,(select id from categories where name='Meat & Poultry'),'case','20 x 1 lb',11200,true, now()-interval '20 days'),
  ('SEA-301','Frozen Shrimp 21-25 ct',null,(select id from categories where name='Seafood'),'bag','2 lb',2800,true, now()-interval '15 days'),
  ('DRY-401','Extra Virgin Olive Oil',null,(select id from categories where name='Dry Goods'),'gal','1 gal',4200,true, now()-interval '60 days'),
  ('DRY-402','All-Purpose Flour',null,(select id from categories where name='Dry Goods'),'bag','50 lb',2400,true, now()-interval '60 days'),
  ('DRY-403','Crushed San Marzano Tomatoes',null,(select id from categories where name='Dry Goods'),'case','6 x #10 can',5400,true, now()-interval '40 days'),
  ('BEV-501','Whole Bean Coffee, Medium Roast',null,(select id from categories where name='Beverages'),'bag','5 lb',4800,true, now()-interval '10 days'),
  ('FRZ-601','Shoestring French Fries',null,(select id from categories where name='Frozen'),'case','6 x 5 lb',4200,true, now()-interval '45 days'),
  ('PKG-701','Pizza Boxes 12"',null,(select id from categories where name='Packaging & Disposables'),'case','50 ct',2100,true, now()-interval '50 days'),
  ('PKG-702','Burger Clamshell, Compostable',null,(select id from categories where name='Packaging & Disposables'),'case','500 ct',8400,true, now()-interval '50 days')
on conflict (sku) do nothing;

insert into customers (business_name, contact_name, email, phone, address, status, payment_terms, notes, created_at) values
  ('Milano Pizzeria','Antonio Russo','antonio@milanopizzeria.ca','(613) 555-0142','5644 Osgoode Main St, Osgoode, ON','active','net-30','Standing weekly order Tues + Fri. Pizza-only menu.', now()-interval '180 days'),
  ('Al''s Drive-In','Mohammed Amer','amer@alsdrivein.ca','(613) 555-0188','1247 Sunset Blvd, Ottawa, ON','active','net-15','Burgers, fries, shakes. High-volume Fri-Sun.', now()-interval '220 days'),
  ('Joey''s Cafe','Joelle Marchand','joelle@joeyscafe.ca','(613) 555-0233','88 Bank St, Ottawa, ON','active','card-on-file','Independent coffee shop. Specialty roasts, pastries.', now()-interval '95 days'),
  ('Pho Saigon','Linh Nguyen','linh@phosaigon.ca','(613) 555-0301','2233 Carling Ave, Ottawa, ON','pending','cod','New account. Awaiting first delivery scheduled Friday.', now()-interval '7 days')
on conflict do nothing;

-- Per-customer assigned products (joined by natural keys)
insert into customer_products (customer_id, product_id, price_cents)
select c.id, p.id, v.price from (values
  ('Milano Pizzeria','DRY-102',13800),
  ('Milano Pizzeria','DRY-403',5100),
  ('Milano Pizzeria','DRY-402',null),
  ('Milano Pizzeria','DRY-401',3900),
  ('Milano Pizzeria','PKG-701',1950),
  ('Milano Pizzeria','PRD-002',null),
  ('Milano Pizzeria','PRD-001',null),
  ('Al''s Drive-In','MEAT-202',10500),
  ('Al''s Drive-In','DRY-101',null),
  ('Al''s Drive-In','FRZ-601',3950),
  ('Al''s Drive-In','PRD-002',null),
  ('Al''s Drive-In','PRD-001',null),
  ('Al''s Drive-In','PKG-702',7800),
  ('Joey''s Cafe','BEV-501',4500),
  ('Joey''s Cafe','DRY-101',null)
) as v(business, sku, price)
join customers c on c.business_name = v.business
join products  p on p.sku = v.sku
on conflict (customer_id, product_id) do nothing;

insert into leads (business_name, contact_name, email, phone, message, status, submitted_at) values
  ('Brewers Lane Tap House','Sarah O''Donnell','sarah@brewerslane.ca','(613) 555-0411','Looking for a new produce + bun supplier. We do ~80 covers/night, 6 days a week. Currently with Sysco but service has slipped.','new', now()-interval '1 days'),
  ('Sunrise Bakery','Hisham Saleh','hisham@sunrisebakery.ca','(613) 555-0529','Need flour, sugar, butter, and packaging. Daily delivery if possible.','contacted', now()-interval '3 days'),
  ('Ottawa Catering Co.','Marie-Claire Dubois','mc@ottawacatering.ca','(613) 555-0670',null,'approved', now()-interval '10 days'),
  ('TacoTaco','Diego Mendez','diego@tacotaco.ca','(613) 555-0788','Spec request for tortillas (corn + flour), Mexican spices, and produce. Two locations.','new', now())
on conflict do nothing;
