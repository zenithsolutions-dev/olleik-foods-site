// CP-3b/3c inventory test — SIGNED semantics (migration 0011). Proves stock
// tracking against the live DB with a real customer session (same conventions
// as test-order-security: throwaway rows, ANON session client, full teardown).
//
//   node scripts/test-inventory.mjs   (npm run test:inventory)
//
// The 2026-08-01 phantom-stock incident happened because the original suite
// only ever checked a single order against itself. This suite adds what was
// missing: CROSS-ORDER scenarios and an explicit LEDGER INVARIANT.
//
// What it proves:
//   1. product_inventory / order_stock_movements are deny-all to customer
//      sessions and anon; the 0010/0011 functions are unreachable from
//      customer/anon JWTs (EXECUTE revoked).
//   2. THE PRODUCTION REGRESSION, literally: stock 10 → X qty 10 confirmed
//      (stock 0) → Y qty 10 confirmed with oversell (stock -10, FULL qty in
//      the ledger) → Y completed → X cancelled (+10) → final stock 0 =
//      physical reality. (Pre-0011 this ended at +10 phantom.)
//   3. All orderings of the same scenario (cancel the oversold order instead;
//      complete the decrementer instead) land on the physically true number.
//   4. Full oversell from stock 0: decrement records the FULL qty, stock goes
//      to -N, stamp set; cancelling it restores exactly.
//   5. A zero-decrement order (untracked lines only) cancels with restock 0.
//   6. Repeated cancel refuses and adds nothing; completed is terminal.
//   7. Multi-line order with mixed partial oversell: exact per-line
//      movements, one shortage report, exact restock.
//   8. LEDGER INVARIANT (asserted after every scenario): stock delta ==
//      restocked - decremented (sum over applied movements) — the ledger can
//      never lose or invent units.
//   9. is_available flips across the 0 boundary in BOTH directions, including
//      from negative, and only turns true above 0.
//
// Requires migrations 0010 + 0011; exits with an explicit message otherwise.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
// CP-3e: the pure receive/recount math the admin action ships with — imported
// directly (run via `node --experimental-strip-types`, same as the engine
// tests) so the tested code IS the deployed code.
import {
  computeReceiveSettlement,
  deriveOversoldOrders,
} from "../src/lib/admin/stock-math.ts";

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

let aCust, aUser, p1, p2, p3;

const stockOf = async (id) =>
  (await svc.from("product_inventory").select("stock_qty").eq("product_id", id).maybeSingle())
    .data?.stock_qty ?? null;
const availOf = async (id) =>
  (await svc.from("products").select("is_available").eq("id", id).single()).data?.is_available;
const orderRow = async (id) =>
  (await svc.from("orders").select("status, stock_decremented_at").eq("id", id).single()).data;
const mvOf = async (o, pid) =>
  (await svc.from("order_stock_movements").select("qty_decremented")
    .eq("order_id", o).eq("product_id", pid).maybeSingle()).data?.qty_decremented ?? null;
const setStock = async (pid, qty) => {
  const { error } = await svc.from("product_inventory")
    .upsert({ product_id: pid, stock_qty: qty, low_stock_threshold: 3, updated_at: new Date().toISOString() });
  if (error) throw new Error(`setStock failed: ${error.message}`);
  const { error: e2 } = await svc.from("products").update({ is_available: qty > 0 }).eq("id", pid);
  if (e2) throw new Error(`setStock avail failed: ${e2.message}`);
};

// Order helper: lines = [[productId, qty], ...]
async function makeOrder(lines) {
  const total = lines.reduce((n, [, q]) => n + q * 1000, 0);
  const { data, error } = await svc.rpc("submit_order_atomic", {
    p_customer_id: aCust, p_fulfillment: "pickup", p_notes: null,
    p_payment_terms: "net-30", p_total_cents: total, p_client_token: randomUUID(),
    p_lines: lines.map(([pid, qty], i) => ({
      product_id: pid, name: `L${i}`, sku: `L${i}`, unit: "ea", unit_size: "1",
      qty, base_price_cents: 1000, unit_price_cents: 1000,
      applied_offer_title: null, was_assigned: false, cost_cents: null,
    })),
  });
  if (error) throw new Error(`makeOrder failed: ${error.message}`);
  return data;
}
const confirm = async (o, oversell) =>
  (await svc.rpc("confirm_order_stock", { p_order_id: o, p_allow_oversell: oversell })).data;
const cancel = async (o) =>
  (await svc.rpc("cancel_order_with_restock", { p_order_id: o, p_admin_note: "test" })).data;
const complete = async (o) => {
  await svc.from("orders").update({ status: "prepared" }).eq("id", o).eq("status", "confirmed");
  await svc.from("orders").update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", o).eq("status", "prepared");
};

// LEDGER INVARIANT harness: every scenario tallies decremented/restocked units
// per product and then asserts stockBefore - dec + restock === stockAfter.
function ledger() {
  const t = { dec: 0, restock: 0 };
  return {
    onConfirm(res) { if (res?.ok) t.dec += res.decremented_units ?? 0; return res; },
    onCancel(res) { if (res?.ok) t.restock += res.restocked_units ?? 0; return res; },
    async assert(label, pids, before) {
      let after = 0;
      for (const pid of pids) after += (await stockOf(pid)) ?? 0;
      const expected = before - t.dec + t.restock;
      note(after === expected,
        `INVARIANT [${label}]: stock delta equals ledger (before ${before} - dec ${t.dec} + restock ${t.restock} = ${expected}; actual ${after})`);
    },
  };
}

try {
  // ---- migration guards ----
  const probe = await svc.from("product_inventory").select("product_id").limit(1);
  if (probe.error) {
    console.log("MIGRATION 0010 NOT APPLIED — the product_inventory table is missing.");
    console.log("Run supabase/migrations/0010_inventory.sql (then 0011), then re-run this script.");
    process.exit(1);
  }

  // ---- setup: tracked P1 + P3, untracked P2, customer A ----
  for (const [tag, set] of [["P1", (id) => (p1 = id)], ["P2", (id) => (p2 = id)], ["P3", (id) => (p3 = id)]]) {
    const { data, error } = await svc.from("products")
      .insert({ sku: `ZZINV-${tag}-${rnd}`, name: `ZZINV ${tag} ${rnd}`, unit: "ea", unit_size: "1", list_price_cents: 1000, is_active: true })
      .select("id").single();
    if (error) throw error;
    set(data.id);
  }
  await setStock(p1, 10);
  // 0011 guard: signed stock must be storable.
  {
    const { error } = await svc.from("product_inventory").update({ stock_qty: -1 }).eq("product_id", p1);
    if (error?.code === "23514") {
      console.log("MIGRATION 0011 NOT APPLIED — stock_qty still rejects negatives (phantom-stock fix inactive).");
      console.log("Run supabase/migrations/0011_signed_inventory.sql, then re-run this script.");
      process.exit(1);
    }
    if (error) throw error;
    await svc.from("product_inventory").update({ stock_qty: 10 }).eq("product_id", p1);
    note(true, "signed stock: negative stock_qty is storable (0011 applied)");
  }
  {
    const { data: u, error: ue } = await svc.auth.admin.createUser({ email: A.email, password: A.password, email_confirm: true });
    if (ue) throw ue;
    aUser = u.user.id;
    const { data: c, error: ce } = await svc.from("customers")
      .insert({ business_name: `ZZINV A ${rnd}`, contact_name: "A", email: A.email, phone: "000", status: "active", user_id: aUser })
      .select("id").single();
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

  // ---- 1. deny-all + revoked functions ----
  {
    const r1 = await asA.from("product_inventory").select("stock_qty");
    note(!!r1.error || (r1.data ?? []).length === 0, "A reads product_inventory → denied/0 rows (deny-all)");
    const r2 = await anon.from("product_inventory").select("stock_qty");
    note(!!r2.error || (r2.data ?? []).length === 0, "anon reads product_inventory → denied/0 rows");
    const r3 = await asA.from("order_stock_movements").select("qty_decremented");
    note(!!r3.error || (r3.data ?? []).length === 0, "A reads order_stock_movements → denied/0 rows (deny-all)");
    const w = await asA.from("product_inventory").insert({ product_id: p1, stock_qty: 9999 }).select("product_id");
    note(!!w.error, `A INSERT into product_inventory → denied (${w.error?.code ?? "ACCEPTED!"})`);
    const f1 = await asA.rpc("confirm_order_stock", { p_order_id: randomUUID(), p_allow_oversell: true });
    note(!!f1.error, `A calls confirm_order_stock → denied (${f1.error?.code ?? "ACCEPTED!"})`);
    const f2 = await anon.rpc("confirm_order_stock", { p_order_id: randomUUID(), p_allow_oversell: true });
    note(!!f2.error, `anon calls confirm_order_stock → denied (${f2.error?.code ?? "ACCEPTED!"})`);
    const f3 = await asA.rpc("cancel_order_with_restock", { p_order_id: randomUUID(), p_admin_note: null });
    note(!!f3.error, `A calls cancel_order_with_restock → denied (${f3.error?.code ?? "ACCEPTED!"})`);
    note((await stockOf(p1)) === 10, "stock untouched after the attempts (10)");
  }

  // ---- 2. THE PRODUCTION REGRESSION, literally ----
  {
    console.log("\n--- production regression: X decrements, Y oversells, Y completes, X cancels ---");
    const led = ledger();
    const X = await makeOrder([[p1, 10]]);
    const Y = await makeOrder([[p1, 10]]);
    const c1 = led.onConfirm(await confirm(X, false));
    note(c1?.ok === true && c1?.decremented_units === 10, `confirm X (qty 10, stock 10) → decremented 10`);
    note((await stockOf(p1)) === 0 && (await availOf(p1)) === false, "stock 0, unavailable");
    const c2a = await confirm(Y, false);
    note(c2a?.ok === false && c2a?.code === "insufficient" && c2a?.shortages?.[0]?.in_stock === 0,
      `confirm Y no-oversell → blocked, shortage exact (in_stock ${c2a?.shortages?.[0]?.in_stock})`);
    const c2b = led.onConfirm(await confirm(Y, true));
    note(c2b?.ok === true && c2b?.oversold === true && c2b?.decremented_units === 10,
      `confirm Y OVERSELL → decremented the FULL 10 (no clamp)`);
    note((await stockOf(p1)) === -10, `stock is now -10 = units owed (${await stockOf(p1)})`);
    note((await mvOf(Y, p1)) === 10, `Y's movement records the FULL 10 (${await mvOf(Y, p1)})`);
    note((await orderRow(Y))?.stock_decremented_at != null, "Y IS stamped (movement recorded)");
    await complete(Y);
    note((await stockOf(p1)) === -10, "Y completed (goods left) — stock still -10");
    const x1 = led.onCancel(await cancel(X));
    note(x1?.ok === true && x1?.restocked_units === 10, `cancel X → restocked exactly 10`);
    note((await stockOf(p1)) === 0,
      `FINAL STOCK = 0 — matches physical reality (was +10 phantom pre-0011)`);
    note((await availOf(p1)) === false, "still unavailable at 0 (available only ABOVE 0)");
    await led.assert("production regression", [p1], 10);
  }

  // ---- 3a. same scenario, cancel the OVERSOLD order instead ----
  {
    console.log("\n--- ordering variant: cancel the oversold order ---");
    await setStock(p1, 10);
    const led = ledger();
    const X = await makeOrder([[p1, 10]]);
    const Y = await makeOrder([[p1, 10]]);
    led.onConfirm(await confirm(X, false));
    led.onConfirm(await confirm(Y, true));
    note((await stockOf(p1)) === -10, "X dec 10, Y oversell dec 10 → stock -10");
    const y1 = led.onCancel(await cancel(Y));
    note(y1?.ok === true && y1?.restocked_units === 10, "cancel Y (the oversold) → restocked exactly 10");
    note((await stockOf(p1)) === 0, "stock back to 0 — X still holds its 10 sold units");
    note((await availOf(p1)) === false, "unavailable at 0");
    await complete(X);
    note((await stockOf(p1)) === 0, "X completed → stock stays 0 (physically true)");
    await led.assert("cancel-oversold variant", [p1], 10);
  }

  // ---- 3b. same scenario, complete the DECREMENTER instead ----
  {
    console.log("\n--- ordering variant: complete the decrementer, cancel the oversold ---");
    await setStock(p1, 10);
    const led = ledger();
    const X = await makeOrder([[p1, 10]]);
    const Y = await makeOrder([[p1, 10]]);
    led.onConfirm(await confirm(X, false));
    led.onConfirm(await confirm(Y, true));
    await complete(X);
    note((await stockOf(p1)) === -10, "X completed first — stock -10");
    const y1 = led.onCancel(await cancel(Y));
    note(y1?.ok === true && y1?.restocked_units === 10, "cancel Y → restocked exactly 10");
    note((await stockOf(p1)) === 0, "final stock 0 — physically true in this ordering too");
    await led.assert("complete-decrementer variant", [p1], 10);
  }

  // ---- 4. full oversell from stock 0 (+ its own cancel) ----
  {
    console.log("\n--- full oversell from empty shelf ---");
    await setStock(p1, 0);
    const led = ledger();
    const Z = await makeOrder([[p1, 7]]);
    const c = led.onConfirm(await confirm(Z, true));
    note(c?.ok === true && c?.oversold === true && c?.decremented_units === 7,
      "confirm at stock 0 with oversell → decremented the FULL 7");
    note((await stockOf(p1)) === -7 && (await mvOf(Z, p1)) === 7 && (await orderRow(Z))?.stock_decremented_at != null,
      `stock -7, movement 7, stamp set`);
    note((await availOf(p1)) === false, "unavailable while negative");
    const z1 = led.onCancel(await cancel(Z));
    note(z1?.ok === true && z1?.restocked_units === 7 && (await stockOf(p1)) === 0,
      "cancel restores exactly 7 → back to 0");
    note((await availOf(p1)) === false, "restock only TO 0 keeps it unavailable (> 0 required)");
    await led.assert("full oversell from 0", [p1], 0);
  }

  // ---- 5+6. zero-decrement cancel; repeated cancel; terminal completed ----
  {
    console.log("\n--- zero-decrement cancel / repeated cancel / terminal ---");
    await setStock(p1, 10);
    const led = ledger();
    const U = await makeOrder([[p2, 500]]); // untracked only
    const cu = led.onConfirm(await confirm(U, false));
    note(cu?.ok === true && cu?.decremented_units === 0 && (await orderRow(U))?.stock_decremented_at == null,
      "untracked-only order confirms, decrements 0, no stamp");
    const u1 = led.onCancel(await cancel(U));
    note(u1?.ok === true && u1?.restocked_units === 0, "cancel of a zero-decrement order restocks 0");
    const u2 = await cancel(U);
    note(u2?.ok === false, "repeated cancel refuses");
    note((await stockOf(p1)) === 10, "tracked stock untouched throughout (10)");

    const T = await makeOrder([[p1, 4]]);
    led.onConfirm(await confirm(T, false));
    await complete(T);
    const t1 = await cancel(T);
    note(t1?.ok === false, "cancel(completed) refuses — terminal");
    note((await stockOf(p1)) === 6, "completed order's stock stays sold (6)");
    await led.assert("zero-dec/terminal group", [p1], 10);
  }

  // ---- 7. multi-line mixed partial oversell ----
  {
    console.log("\n--- multi-line mixed partial oversell ---");
    await setStock(p1, 5);
    await setStock(p3, 20);
    const led = ledger();
    const M = await makeOrder([[p1, 8], [p3, 5], [p2, 3]]); // short / covered / untracked
    const b = await confirm(M, false);
    note(b?.ok === false && b?.shortages?.length === 1 && b?.shortages?.[0]?.ordered === 8 && b?.shortages?.[0]?.in_stock === 5,
      `blocked with EXACTLY one shortage (ordered 8, in stock 5)`);
    note((await stockOf(p1)) === 5 && (await stockOf(p3)) === 20, "block changed nothing");
    const c = led.onConfirm(await confirm(M, true));
    note(c?.ok === true && c?.oversold === true && c?.decremented_units === 13,
      `oversell → decremented 13 (8 short-line + 5 covered; untracked ignored)`);
    note((await stockOf(p1)) === -3 && (await stockOf(p3)) === 15,
      `per-line exact: P1 -3, P3 15`);
    note((await mvOf(M, p1)) === 8 && (await mvOf(M, p3)) === 5 && (await mvOf(M, p2)) === null,
      "movements exact per line (8 / 5 / none for untracked)");
    note((await availOf(p1)) === false && (await availOf(p3)) === true,
      "only the negative line went unavailable");
    const m1 = led.onCancel(await cancel(M));
    note(m1?.ok === true && m1?.restocked_units === 13 && (await stockOf(p1)) === 5 && (await stockOf(p3)) === 20,
      "cancel restores both lines exactly (P1 5, P3 20)");
    note((await availOf(p1)) === true, "P1 available again above 0");
    await led.assert("multi-line mixed", [p1, p3], 25);
  }

  // ---- 8/9. availability across the 0 boundary, both directions ----
  {
    console.log("\n--- availability boundary flips ---");
    await setStock(p1, 1);
    note((await availOf(p1)) === true, "stock 1 → available");
    const led = ledger();
    const V = await makeOrder([[p1, 3]]);
    led.onConfirm(await confirm(V, true));
    note((await stockOf(p1)) === -2 && (await availOf(p1)) === false,
      "1 - 3 = -2 → unavailable (crossed 0 downward into negative)");
    const v1 = led.onCancel(await cancel(V));
    note(v1?.restocked_units === 3 && (await stockOf(p1)) === 1 && (await availOf(p1)) === true,
      "-2 + 3 = 1 → available again (crossed 0 upward FROM negative)");
    await led.assert("boundary flips", [p1], 1);
  }

  // ---- 10. CP-3e: RECEIVE (add) vs SET COUNT (replace) ----
  // Receive is the action's CAS add mirrored here (read → UPDATE ... WHERE
  // stock_qty = read value) + the availability rule; the settlement and
  // oversold-attribution math is the SAME pure module the action imports.
  const casReceive = async (pid, qty) => {
    const { data: cur } = await svc.from("product_inventory")
      .select("stock_qty").eq("product_id", pid).single();
    const { data: upd, error } = await svc.from("product_inventory")
      .update({ stock_qty: cur.stock_qty + qty, updated_at: new Date().toISOString() })
      .eq("product_id", pid).eq("stock_qty", cur.stock_qty).select("stock_qty");
    if (error || !upd?.length) throw new Error(`CAS receive failed: ${error?.message ?? "0 rows"}`);
    await svc.from("products").update({ is_available: cur.stock_qty + qty > 0 }).eq("id", pid);
    return cur.stock_qty;
  };
  // The action's exact derivation read: open (confirmed/prepared) movements.
  const openMovements = async (pid) => {
    const { data } = await svc.from("order_stock_movements")
      .select("order_id, qty_decremented, orders(status, stock_decremented_at, customers(business_name))")
      .eq("product_id", pid);
    return (data ?? [])
      .filter((r) => ["confirmed", "prepared"].includes(r.orders?.status) && r.orders?.stock_decremented_at != null)
      .map((r) => ({
        orderId: r.order_id,
        businessName: r.orders?.customers?.business_name ?? "(unknown customer)",
        qty: r.qty_decremented,
        decrementedAt: r.orders?.stock_decremented_at,
      }));
  };
  {
    console.log("\n--- CP-3e: receive settles a REAL deficit + oversold attribution ---");
    await setStock(p1, 6);
    const O1 = await makeOrder([[p1, 6]]);
    const O2 = await makeOrder([[p1, 4]]);
    const c1 = await confirm(O1, false);
    const c2 = await confirm(O2, true);
    note(c1?.ok && c2?.ok && (await stockOf(p1)) === -4 && (await availOf(p1)) === false,
      "setup: O1 dec 6 (→0), O2 oversell dec 4 (→ -4), unavailable");

    // Attribution BEFORE the receive (as the action derives it, old stock -4):
    const att = deriveOversoldOrders(await openMovements(p1), 4);
    note(att.reliable === true && att.orders.length === 1 && att.orders[0].orderId === O2
      && att.orders[0].shortUnits === 4 && att.orders[0].partiallyCovered === false,
      `attribution: EXACTLY O2 owes 4 (last-confirmed holds the deficit; O1 is covered) — got ${JSON.stringify(att.orders.map(o => [o.orderId === O2 ? "O2" : "O1", o.shortUnits]))}`);
    // Partial-coverage attribution (deficit 2 of O2's 4):
    const part = deriveOversoldOrders(await openMovements(p1), 2);
    note(part.reliable && part.orders.length === 1 && part.orders[0].shortUnits === 2 && part.orders[0].partiallyCovered === true,
      "partial attribution: deficit 2 → O2 short by 2 of 4, marked partial");

    // Pure settlement math: -4 + 10 = 6, settles 4, 6 genuinely available.
    const s = computeReceiveSettlement(-4, 10);
    note(s.newStock === 6 && s.settledUnits === 4 && s.availableNow === 6,
      `computeReceiveSettlement(-4, 10) → ${JSON.stringify(s)}`);

    // Live receive onto negative: -4 + 10 = 6, available again.
    const old = await casReceive(p1, 10);
    note(old === -4 && (await stockOf(p1)) === 6 && (await availOf(p1)) === true,
      "RECEIVE onto -4: stock -4 + 10 = 6, available flips true (THE incident's fix: not 10)");
    // Ledger + adjustments invariant for this scenario:
    // start 6 - dec(6+4) + received 10 = 6.
    note((await stockOf(p1)) === 6 - 6 - 4 + 10,
      "INVARIANT [receive scenario]: start 6 - dec 10 + received 10 = 6 ✓");
  }

  {
    console.log("\n--- CP-3e: receive onto zero / positive; set-count replaces ---");
    await setStock(p1, 0);
    await casReceive(p1, 5);
    note((await stockOf(p1)) === 5 && (await availOf(p1)) === true
      && computeReceiveSettlement(0, 5).settledUnits === 0,
      "receive onto 0: 0 + 5 = 5, nothing to settle, available");
    await casReceive(p1, 3);
    note((await stockOf(p1)) === 8, "receive onto positive: 5 + 3 = 8");

    // Set-count = REPLACE (the action's upsert path).
    await setStock(p1, -4); // deficit again (as if oversold)
    await setStock(p1, 10); // recount says 10
    note((await stockOf(p1)) === 10 && (await availOf(p1)) === true,
      "SET COUNT from -4 → 10: deficit deliberately erased by a recount");
    await setStock(p1, 2);
    note((await stockOf(p1)) === 2, "SET COUNT from positive: 10 → 2");

    // Unreliable attribution: a deficit with NO open-order movements (created
    // by manual edits) must return numbers-only, never invented orders.
    await setStock(p3, -5);
    const att = deriveOversoldOrders(await openMovements(p3), 5);
    note(att.reliable === false && att.orders.length === 0,
      "manual-edit deficit: attribution says UNRELIABLE with zero orders (no guessing)");
    await setStock(p3, 0);
  }
} catch (e) {
  console.log("ERROR:", e.message);
  pass = false;
} finally {
  if (aCust) await svc.from("orders").delete().eq("customer_id", aCust);
  if (p1) await svc.from("products").delete().eq("id", p1);
  if (p2) await svc.from("products").delete().eq("id", p2);
  if (p3) await svc.from("products").delete().eq("id", p3);
  if (aCust) await svc.from("customers").delete().eq("id", aCust);
  if (aUser) await svc.auth.admin.deleteUser(aUser);
  console.log("\nteardown complete (test orders, products, inventory, customer, auth user removed)");
  console.log(pass ? "\n=== INVENTORY TEST (SIGNED): PASS ===" : "\n=== INVENTORY TEST (SIGNED): failures above ===");
  process.exit(pass ? 0 : 1);
}
