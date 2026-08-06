-- Olleik Foods — CP-8a-2: bulk offer application (approved D-B3)
-- Standalone migration. Run in the Supabase SQL editor BEFORE testing the
-- bulk-apply feature on preview; the app tolerates this not being applied
-- (bulk apply fails with a clear schema-out-of-date message; everything else,
-- including CP-8a's Running now, keeps working).
--
-- BATCH IDENTITY IS A COLUMN, NOT A TABLE (approved ruling): every fact about
-- a batch — its template, member customers, date, remaining size — is derived
-- from the customer_offers rows themselves by grouping on batch_id. There is
-- deliberately NO offer_batches metadata table: a second record of the batch
-- could disagree with the rows, and the rows are the truth.
--
-- batch_size is the ONE denormalized exception: the member count at creation
-- time, stamped identically on every row of the batch. It exists so the undo
-- confirmation can say "applied to 30, still on 28 — 2 were removed
-- individually" after individual deletions have shrunk the group. It is
-- immutable, meaningless to pricing, and carried by the rows themselves.
--
-- A bulk-applied offer row is otherwise IDENTICAL to a hand-applied one:
-- pricing, RLS, expiry buckets and the portal read none of these columns.
-- Hand-applied offers keep batch_id NULL. No RLS change: customers already
-- read only their own offer rows; a batch uuid exposes nothing.

alter table customer_offers add column if not exists batch_id uuid;
alter table customer_offers add column if not exists batch_size integer
  check (batch_size is null or batch_size >= 1);

-- Partial index: batch lookups (the batches panel, undo scoping) touch only
-- batch rows; hand-applied rows (batch_id null) stay out of the index.
create index if not exists customer_offers_batch_idx
  on customer_offers(batch_id) where batch_id is not null;

-- ---------- Verification queries (run after applying; expected results) ----------
--
-- 1. Columns exist, nullable:
--      select column_name, data_type, is_nullable
--      from information_schema.columns
--      where table_name = 'customer_offers'
--        and column_name in ('batch_id','batch_size');
--    -> two rows: batch_id uuid YES, batch_size integer YES.
--
-- 2. Partial index exists:
--      select indexname, indexdef from pg_indexes
--      where tablename = 'customer_offers'
--        and indexname = 'customer_offers_batch_idx';
--    -> one row; indexdef ends with "WHERE (batch_id IS NOT NULL)".
--
-- 3. Existing (hand-applied) offers untouched:
--      select count(*) from customer_offers where batch_id is not null;
--    -> 0 (no batches exist yet).
--
-- 4. RLS unchanged (still exactly one SELECT-own policy, no new policies):
--      select policyname, cmd from pg_policies where tablename = 'customer_offers';
--    -> one row: "customer reads own offers", SELECT.
