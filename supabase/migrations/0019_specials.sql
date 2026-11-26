-- 0019: public specials — a limited quantity of one product at a special price, for every visitor.
-- Run in the Supabase SQL editor BEFORE deploying the app code that uses it. Requires 0009–0011.
--
-- Access model:
--   * Guests never read this table. The public pages are rendered by the server (service role), which
--     decides field by field what a guest may see (a special can hide its price from guests).
--   * Signed-in ACTIVE customers may read published specials (the portal shows them with the price).
--   * Nobody but the service role writes it.
-- Quantity: quantity_sold rises when an order LINE carrying the special is inserted (inside the same
-- transaction as the order, so the last units cannot be promised twice) and falls back when that order is
-- cancelled. Both are triggers, so they hold for every code path that inserts lines or cancels orders.

do $$ begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'order_items') then
    raise exception 'order_items missing — run migration 0009 first';
  end if;
end $$;

-- ---------- specials ----------
create table if not exists specials (
  id                   uuid primary key default gen_random_uuid(),
  -- RESTRICT like order_items: products are deactivate-only.
  product_id           uuid not null references products(id) on delete restrict,
  -- The special describes itself, so its card needs no product read and survives product edits.
  title                text not null check (length(trim(title)) between 1 and 120),
  description          text,
  image_url            text,
  unit_label           text,   -- what one unit is, e.g. "3 L / tin"
  special_price_cents  integer not null check (special_price_cents > 0),
  quantity_total       integer not null check (quantity_total > 0),
  quantity_sold        integer not null default 0,
  starts_at            timestamptz,
  ends_at              timestamptz,
  is_published         boolean not null default false,
  show_price_to_guests boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint specials_sold_range check (quantity_sold >= 0 and quantity_sold <= quantity_total),
  constraint specials_window check (starts_at is null or ends_at is null or ends_at > starts_at)
);

-- One published special per product: an order line must never have two specials to choose from.
create unique index if not exists specials_one_published_per_product
  on specials (product_id) where is_published;

alter table specials enable row level security;
drop policy if exists "active customers read published specials" on specials;
create policy "active customers read published specials" on specials
  for select to authenticated
  using (
    is_published
    and exists (select 1 from customers c where c.user_id = auth.uid() and c.status = 'active')
  );

-- ---------- order lines remember the special they used ----------
-- SET NULL: deleting a special never touches order history.
alter table order_items
  add column if not exists special_id uuid references specials(id) on delete set null;

-- Take from the special when a line that uses it is inserted. The single UPDATE both checks and takes
-- (row-locked), so two orders racing for the last units cannot both succeed. The line must match the
-- special's product and price and the special must be live right now; anything else aborts the order.
create or replace function take_special_quantity() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.special_id is null then
    return new;
  end if;
  update specials
     set quantity_sold = quantity_sold + new.qty,
         updated_at = now()
   where id = new.special_id
     and product_id = new.product_id
     and special_price_cents = new.unit_price_cents
     and is_published
     and (starts_at is null or starts_at <= now())
     and (ends_at is null or ends_at > now())
     and quantity_sold + new.qty <= quantity_total;
  if not found then
    raise exception 'SPECIAL_SOLD_OUT: special % cannot cover % more', new.special_id, new.qty;
  end if;
  return new;
end $$;

drop trigger if exists order_items_take_special on order_items;
create trigger order_items_take_special
  before insert on order_items
  for each row execute function take_special_quantity();

-- Give it back when the order is cancelled (the status only ever becomes 'cancelled' once).
create or replace function release_special_quantity() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update specials s
     set quantity_sold = greatest(0, s.quantity_sold - x.qty),
         updated_at = now()
    from (
      select special_id, sum(qty)::int as qty
        from order_items
       where order_id = new.id and special_id is not null
       group by special_id
    ) x
   where s.id = x.special_id;
  return new;
end $$;

drop trigger if exists orders_release_special on orders;
create trigger orders_release_special
  after update of status on orders
  for each row
  when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  execute function release_special_quantity();

revoke all on function take_special_quantity() from public, anon, authenticated;
revoke all on function release_special_quantity() from public, anon, authenticated;

-- ---------- submit_order_atomic: same function as 0009, plus special_id on each line ----------
-- p_lines entries may now carry "special_id" (uuid or absent/null).
create or replace function submit_order_atomic(
  p_customer_id uuid,
  p_fulfillment text,
  p_notes text,
  p_payment_terms text,
  p_total_cents integer,
  p_client_token uuid,
  p_lines jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_line jsonb;
  v_count int;
  v_sum bigint;
begin
  -- Defense in depth: the app layer already required an active customer.
  if not exists (select 1 from customers where id = p_customer_id and status = 'active') then
    raise exception 'ORDER_CUSTOMER_NOT_ACTIVE';
  end if;

  v_count := coalesce(jsonb_array_length(p_lines), 0);
  if v_count < 1 or v_count > 100 then
    raise exception 'ORDER_LINE_COUNT_OUT_OF_RANGE: %', v_count;
  end if;

  -- Idempotency (fast path): this cart token already produced an order.
  select id into v_order_id
    from orders
   where customer_id = p_customer_id and client_token = p_client_token;
  if v_order_id is not null then
    return v_order_id;
  end if;

  insert into orders
    (customer_id, status, fulfillment, notes, payment_terms_snapshot, total_cents, client_token)
  values
    (p_customer_id, 'new', p_fulfillment, p_notes, p_payment_terms, p_total_cents, p_client_token)
  returning id into v_order_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    insert into order_items
      (order_id, product_id, name, sku, unit, unit_size, qty,
       base_price_cents, unit_price_cents, applied_offer_title, was_assigned, line_total_cents,
       special_id)
    values
      (v_order_id,
       (v_line->>'product_id')::uuid,
       v_line->>'name',
       v_line->>'sku',
       v_line->>'unit',
       v_line->>'unit_size',
       (v_line->>'qty')::int,
       (v_line->>'base_price_cents')::int,
       (v_line->>'unit_price_cents')::int,
       nullif(v_line->>'applied_offer_title', ''),
       (v_line->>'was_assigned')::boolean,
       (v_line->>'qty')::int * (v_line->>'unit_price_cents')::int,
       nullif(v_line->>'special_id', '')::uuid);

    insert into order_item_costs (order_id, product_id, cost_cents)
    values
      (v_order_id,
       (v_line->>'product_id')::uuid,
       case when v_line->>'cost_cents' is null then null
            else (v_line->>'cost_cents')::int end);
  end loop;

  -- The order total must equal the sum of its lines — a mismatch aborts the
  -- whole transaction (no orphan orders: plpgsql functions are atomic).
  select coalesce(sum(line_total_cents), 0) into v_sum
    from order_items where order_id = v_order_id;
  if v_sum <> p_total_cents then
    raise exception 'ORDER_TOTAL_MISMATCH: lines % vs total %', v_sum, p_total_cents;
  end if;

  return v_order_id;
exception
  when unique_violation then
    -- Concurrent double-submit of the same cart token: the first writer won;
    -- return its order. (Business idempotency, not migration-error swallowing.)
    select id into v_order_id
      from orders
     where customer_id = p_customer_id and client_token = p_client_token;
    if v_order_id is not null then
      return v_order_id;
    end if;
    raise;
end $$;

revoke all on function submit_order_atomic(uuid, text, text, text, integer, uuid, jsonb) from public;
revoke all on function submit_order_atomic(uuid, text, text, text, integer, uuid, jsonb) from authenticated;
revoke all on function submit_order_atomic(uuid, text, text, text, integer, uuid, jsonb) from anon;
grant execute on function submit_order_atomic(uuid, text, text, text, integer, uuid, jsonb) to service_role;
