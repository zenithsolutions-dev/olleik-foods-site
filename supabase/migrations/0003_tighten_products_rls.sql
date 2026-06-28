-- Olleik Foods — Phase D: tighten products RLS for the customer portal.
-- Run this in the Supabase SQL editor. Safe to run before deploying the Phase D
-- code (no customer can sign in yet), and required before any customer is
-- invited.
--
-- WHY: previously any authenticated user could read every active product
-- (including list_price_cents). Once customers can log in, that leaks the base
-- price list. This restricts a signed-in customer's SESSION reads of `products`
-- to ONLY the products assigned to them — matching the "absent = hidden" model.
--
-- UNAFFECTED: the admin panel and the public catalog read `products` via the
-- service-role key, which BYPASSES RLS entirely. So admin reads and the public
-- price-free catalog keep working exactly as before. Only the portal's
-- session-bound (anon-key) reads are scoped by this policy.

drop policy if exists "active products readable by authenticated" on products;
drop policy if exists "customer reads own assigned products only" on products;

create policy "customer reads own assigned products only"
  on products for select to authenticated using (
    is_active and id in (
      select product_id from customer_products
      where customer_id in (select id from customers where user_id = auth.uid())
    )
  );
