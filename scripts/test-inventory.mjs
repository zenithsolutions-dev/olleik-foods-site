// CP-3b inventory test. Proves stock tracking against the live DB with a real
// customer session (same conventions as test-order-security: throwaway rows,
// ANON session client, full teardown).
//
//   node scripts/test-inventory.mjs   (npm run test:inventory)
//
// What it proves:
//   1. product_inventory and order_stock_movements are deny-all: unreadable
//      and unwritable by a customer session AND anon (quantities never reach
//      the portal — D-O6 exposes only products.is_available).
//   2. confirm_order_stock / cancel_order_with_restock are unreachable from
//      customer/anon JWTs (EXECUTE revoked — same posture as
//      submit_order_atomic).
//   3. Confirming a NEW order decrements tracked stock exactly, stamps
//      stock_decremented_at, and records the movement (D-O4).
//   4. Insufficient stock BLOCKS by default with an exact shortage report and
//      changes NOTHING (D-O5).
//   5. The oversell override clamps stock to 0, flips is_available=false, and
//      records the ACTUAL decremented amount (not the ordered qty).
//   6. Cancelling a decremented order restocks exactly what was decremented,
//      flips is_available back to true, and clears the guard so it can never
//      restock twice; new->cancelled restocks nothing (D-O4).
//   7. Untracked products never block and never move stock.
//   8. Completed is terminal — cancel/restock refuses.
//   9. stock_qty can never go negative (DB CHECK).
//
// Requires migration 0010; exits with an explicit message if it isn't applied.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;

const svc = createClient(URL, SVC, { auth: { persistSession: false } });
const rnd = Math.random().toString(36).slice(2, 8);
const A = { email: `zzinv-a-${rnd}@example.com`, password: `Test!${rnd}aA9` };

let pass = true;
const note = (ok, msg) => {
  if (!ok) pass = false;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${msg}`);
};

let aCust, aUser, p1, p2;

// Create an order for customer aCust via the legitimate path (service-role
// RPC, exactly what the server action does) and return its id.
async function makeOrder(productId, name, qty) {
  const { data, error } = await svc.rpc("submit_order_atomic", {
    p_customer_id: aCust,
    p_fulfillment: "pickup",
    p_notes: null,
    p_payment_terms: "net-30",
    p_total_cents: qty * 1000,
    p_client_token: randomUUID(),
    p_lines: [
      {
        product_id: productId, name, sku: name, unit: "ea", unit_size: "1",
        qty, base_price_cents: 1000, unit_price_cents: 1000,
        applied_offer_title: null, was_assigned: false, cost_cents: null,
      },
    ],
  });
  if (error) throw new Error(`makeOrder failed: ${error.message}`);
  return data;
}

const stockOf = async (id) =>
  (await svc.from("product_inventory").select("stock_qty").eq("product_id", id).maybeSingle())
    .data?.stock_qty ?? null;
const availOf = async (id) =>
  (await svc.from("products").select("is_available").eq("id", id).single()).data?.is_available;
const orderRow = async (id) =>
  (await svc.from("orders").select("status, stock_decremented_at").eq("id", id).single()).data;

try {
  // ---- migration guard ----
  const probe = await svc.from("product_inventory").select("product_id").limit(1);
  if (probe.error) {
    console.log("MIGRATION 0010 NOT APPLIED — the product_inventory table is missing.");
    console.log("Run supabase/migrations/0010_inventory.sql, then re-run this script.");
    process.exit(1);
  }

  // ---- setup: tracked P1 (stock 10, alert 3), untracked P2, customer A ----
  for (const [tag, holder] of [["P1", "p1"], ["P2", "p2"]]) {
    const { data, error } = await svc
      .from("products")
      .insert({
        sku: `ZZINV-${tag}-${rnd}`, name: `ZZINV ${tag} ${rnd}`, unit: "ea",
        unit_size: "1", list_price_cents: 1000, is_active: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    if (holder === "p1") p1 = data.id; else p2 = data.id;
  }
  {
    const { error } = await svc
      .from("product_inventory")
      .insert({ product_id: p1, stock_qty: 10, low_stock_threshold: 3 });
    if (error) throw error;
  }
  {
    const { data: u, error: ue } = await svc.auth.admin.createUser({
      email: A.email, password: A.password, email_confirm: true,
    });
    if (ue) throw ue;
    aUser = u.user.id;
    const { data: c, error: ce } = await svc
      .from("customers")
      .insert({
        business_name: `ZZINV A ${rnd}`, contact_name: "A", email: A.email,
        phone: "000", status: "active", user_id: aUser,
      })
      .select("id")
      .single();
    if (ce) throw ce;
    aCust = c.id;
  }
  const asA = createClient(URL, ANON, { auth: { persistSession: false } });
  {
    const { error } = await asA.auth.signInWithPassword({ email: A.email, password: A.password });
    if (error) throw error;
  }
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  console.log("signed in as A via an anon client (RLS now applies)\n");

  // ---- 1. deny-all: quantities never reach a customer session or anon ----
  {
    const r1 = await asA.from("product_inventory").select("stock_qty");
    note(!!r1.error || (r1.data ?? []).length === 0, "A reads product_inventory → denied/0 rows (deny-all)");
    const r2 = await anon.from("product_inventory").select("stock_qty");
    note(!!r2.error || (r2.data ?? []).length === 0, "anon reads product_inventory → denied/0 rows");
    const r3 = await asA.from("order_stock_movements").select("qty_decremented");
    note(!!r3.error || (r3.data ?? []).length === 0, "A reads order_stock_movements → denied/0 rows (deny-all)");
    const w = await asA.from("product_inventory")
      .insert({ product_id: p1, stock_qty: 9999 }).select("product_id");
    note(!!w.error, `A INSERT into product_inventory → denied (${w.error?.code ?? "ACCEPTED!"})`);
    const w2 = await asA.from("product_inventory")
      .update({ stock_qty: 9999 }).eq("product_id", p1).select("product_id");
    note((!w2.error && (w2.data ?? []).length === 0) || !!w2.error, "A UPDATE product_inventory → 0 rows/denied");
    note((await stockOf(p1)) === 10, "stock is untouched after the attempts (10)");
  }

  // ---- 2. the 0010 functions are unreachable from customer/anon JWTs ----
  {
    const r = await asA.rpc("confirm_order_stock", { p_order_id: randomUUID(), p_allow_oversell: true });
    note(!!r.error, `A calls confirm_order_stock directly → denied (${r.error?.code ?? "ACCEPTED!"})`);
    const r2 = await anon.rpc("confirm_order_stock", { p_order_id: randomUUID(), p_allow_oversell: true });
    note(!!r2.error, `anon calls confirm_order_stock → denied (${r2.error?.code ?? "ACCEPTED!"})`);
    const r3 = await asA.rpc("cancel_order_with_restock", { p_order_id: randomUUID(), p_admin_note: null });
    note(!!r3.error, `A calls cancel_order_with_restock directly → denied (${r3.error?.code ?? "ACCEPTED!"})`);
  }

  // ---- 3. confirm decrements tracked stock exactly (D-O4) ----
  const o1 = await makeOrder(p1, `ZZINV P1 ${rnd}`, 4);
  {
    const { data, error } = await svc.rpc("confirm_order_stock", { p_order_id: o1, p_allow_oversell: false });
    note(!error && data?.ok === true && data?.decremented_units === 4,
      `confirm(new, qty 4, stock 10) → ok, decremented 4 (${JSON.stringify(data)})`);
    note((await stockOf(p1)) === 6, `stock is now 6 (${await stockOf(p1)})`);
    const ord = await orderRow(o1);
    note(ord?.status === "confirmed" && ord?.stock_decremented_at != null,
      `order is confirmed with stock_decremented_at stamped`);
    const { data: mv } = await svc.from("order_stock_movements")
      .select("qty_decremented").eq("order_id", o1).single();
    note(mv?.qty_decremented === 4, `movement records exactly 4 (${mv?.qty_decremented})`);
    note((await availOf(p1)) === true, "still available (stock 6 > 0)");
  }

  // ---- 4. insufficient stock BLOCKS by default, changing nothing (D-O5) ----
  const o2 = await makeOrder(p1, `ZZINV P1 ${rnd}`, 10);
  {
    const { data, error } = await svc.rpc("confirm_order_stock", { p_order_id: o2, p_allow_oversell: false });
    const s = data?.shortages?.[0];
    note(!error && data?.ok === false && data?.code === "insufficient",
      `confirm(qty 10, stock 6, oversell=false) → blocked (${data?.code})`);
    note(s?.ordered === 10 && s?.in_stock === 6,
      `shortage report is exact: ordered ${s?.ordered}, in stock ${s?.in_stock}`);
    note((await stockOf(p1)) === 6, "stock unchanged after the block (6)");
    const ord = await orderRow(o2);
    note(ord?.status === "new" && ord?.stock_decremented_at == null,
      "order is still new, nothing stamped");
  }

  // ---- 5. oversell override clamps to 0 and records the ACTUAL amount ----
  {
    const { data, error } = await svc.rpc("confirm_order_stock", { p_order_id: o2, p_allow_oversell: true });
    note(!error && data?.ok === true && data?.oversold === true && data?.decremented_units === 6,
      `confirm(oversell=true) → ok, oversold, decremented 6 not 10 (${JSON.stringify(data)})`);
    note((await stockOf(p1)) === 0, "stock clamped to 0, never negative");
    note((await availOf(p1)) === false, "is_available flipped to false at stock 0 (D-O6)");
    const { data: mv } = await svc.from("order_stock_movements")
      .select("qty_decremented").eq("order_id", o2).single();
    note(mv?.qty_decremented === 6, `movement records the clamped 6, not the ordered 10 (${mv?.qty_decremented})`);
  }

  // ---- 6. cancel restocks EXACTLY what was decremented, once (D-O4) ----
  {
    const { data, error } = await svc.rpc("cancel_order_with_restock", { p_order_id: o2, p_admin_note: "inv test" });
    note(!error && data?.ok === true && data?.restocked_units === 6,
      `cancel(decremented order) → restocked exactly 6 (${JSON.stringify(data)})`);
    note((await stockOf(p1)) === 6, "stock is back to 6 — the phantom 4 was never minted");
    note((await availOf(p1)) === true, "is_available flipped back to true above 0 (D-O6)");
    const ord = await orderRow(o2);
    note(ord?.status === "cancelled" && ord?.stock_decremented_at == null,
      "order cancelled and the restock guard cleared");
    const { count } = await svc.from("order_stock_movements")
      .select("order_id", { count: "exact", head: true }).eq("order_id", o2);
    note(count === 0, "movement rows deleted — a second restock has nothing to add");
    const again = await svc.rpc("cancel_order_with_restock", { p_order_id: o2, p_admin_note: null });
    note(again.data?.ok === false, "cancelling again refuses (already cancelled)");
    note((await stockOf(p1)) === 6, "stock still 6 after the second attempt");
  }

  // ---- 7. new->cancelled restocks nothing; untracked never blocks ----
  {
    const o3 = await makeOrder(p1, `ZZINV P1 ${rnd}`, 2);
    const { data } = await svc.rpc("cancel_order_with_restock", { p_order_id: o3, p_admin_note: null });
    note(data?.ok === true && data?.restocked_units === 0,
      "cancel(new order, never decremented) → restocks 0");
    note((await stockOf(p1)) === 6, "stock untouched (6)");

    const o4 = await makeOrder(p2, `ZZINV P2 ${rnd}`, 500);
    const { data: c4 } = await svc.rpc("confirm_order_stock", { p_order_id: o4, p_allow_oversell: false });
    note(c4?.ok === true && c4?.decremented_units === 0,
      "untracked product: qty 500 confirms without blocking, decrements 0");
    const ord4 = await orderRow(o4);
    note(ord4?.stock_decremented_at == null, "untracked-only order gets no decrement stamp");
    note((await availOf(p2)) === true, "untracked product stays available");
  }

  // ---- 8. completed is terminal ----
  {
    await svc.from("orders").update({ status: "prepared" }).eq("id", o1).eq("status", "confirmed");
    await svc.from("orders").update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", o1).eq("status", "prepared");
    const { data } = await svc.rpc("cancel_order_with_restock", { p_order_id: o1, p_admin_note: null });
    note(data?.ok === false, "cancel(completed order) → refused (terminal)");
    note((await stockOf(p1)) === 6, "completed order's stock stays sold (6)");
  }

  // ---- 9. stock can never go negative (DB CHECK) ----
  {
    const { error } = await svc.from("product_inventory")
      .update({ stock_qty: -1 }).eq("product_id", p1);
    note(error?.code === "23514", `product_inventory_qty_check rejects -1 (${error?.code})`);
  }
} catch (e) {
  console.log("ERROR:", e.message);
  pass = false;
} finally {
  // Orders first (order_items FK->products is RESTRICT), then products/customer.
  if (aCust) await svc.from("orders").delete().eq("customer_id", aCust);
  if (p1) await svc.from("products").delete().eq("id", p1); // cascades inventory
  if (p2) await svc.from("products").delete().eq("id", p2);
  if (aCust) await svc.from("customers").delete().eq("id", aCust);
  if (aUser) await svc.auth.admin.deleteUser(aUser);
  console.log("\nteardown complete (test orders, products, inventory, customer, auth user removed)");
  console.log(pass ? "\n=== INVENTORY TEST: PASS ===" : "\n=== INVENTORY TEST: failures above ===");
  process.exit(pass ? 0 : 1);
}
