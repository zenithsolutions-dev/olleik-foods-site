// CP-3a order-security test. Proves the first customer-write surface is locked
// down end-to-end against the live DB, with real customer sessions (same
// conventions as test-cross-tenant/test-visibility-rls: throwaway rows, ANON
// session clients, full teardown).
//
//   node scripts/test-order-security.mjs   (npm run test:orders)
//
// What it proves:
//   1. A customer JWT has ZERO write ability on orders/order_items — direct
//      PostgREST INSERT (for self OR another customer) fails; UPDATE and
//      DELETE after submission affect 0 rows (no policies exist).
//   2. submit_order_atomic is unreachable from customer/anon JWTs (EXECUTE
//      revoked) — price tampering via direct RPC is impossible.
//   3. A legitimate order (service-role RPC, as the server action does) is
//      readable by its owner only: B sees zero, anon sees zero.
//   4. Cost snapshots (order_item_costs) are unreadable by every customer
//      session and anon (deny-all).
//   5. Idempotency: the same client_token returns the SAME order id and
//      creates no second order.
//   6. DB invariants hold: line-math check, status check, fulfillment check.
//
// Requires migration 0009; exits with an explicit message if it isn't applied.
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
const mk = (n) => ({ email: `zzord-${n}-${rnd}@example.com`, password: `Test!${rnd}${n}aA9` });
const A = mk("a"), B = mk("b");

let pass = true;
const note = (ok, msg) => {
  if (!ok) pass = false;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${msg}`);
};

let aCust, bCust, aUser, bUser, productId, orderId;

try {
  // ---- migration guard ----
  const probe = await svc.from("orders").select("id").limit(1);
  if (probe.error) {
    console.log("MIGRATION 0009 NOT APPLIED — the orders table is missing.");
    console.log("Run supabase/migrations/0009_orders.sql, then re-run this script.");
    process.exit(1);
  }

  // ---- setup: product + two customers with real auth users ----
  {
    const { data, error } = await svc
      .from("products")
      .insert({
        sku: `ZZORD-${rnd}`,
        name: `ZZORD product ${rnd}`,
        unit: "ea",
        unit_size: "1",
        list_price_cents: 1000,
        is_active: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    productId = data.id;
  }
  await svc.from("product_costs").upsert({ product_id: productId, cost_cents: 600 });

  for (const [tag, acct] of [["A", A], ["B", B]]) {
    const { data: u, error: ue } = await svc.auth.admin.createUser({
      email: acct.email,
      password: acct.password,
      email_confirm: true,
    });
    if (ue) throw ue;
    const { data: c, error: ce } = await svc
      .from("customers")
      .insert({
        business_name: `ZZORD ${tag} ${rnd}`,
        contact_name: tag,
        email: acct.email,
        phone: "000",
        status: "active",
        user_id: u.user.id,
      })
      .select("id")
      .single();
    if (ce) throw ce;
    if (tag === "A") { aCust = c.id; aUser = u.user.id; }
    else { bCust = c.id; bUser = u.user.id; }
  }
  // A is assigned the product at a special price (so the order snapshot uses it).
  await svc.from("customer_products").insert({
    customer_id: aCust,
    product_id: productId,
    price_cents: 111,
  });

  const signIn = async (acct) => {
    const cl = createClient(URL, ANON, { auth: { persistSession: false } });
    const { error } = await cl.auth.signInWithPassword({ email: acct.email, password: acct.password });
    if (error) throw error;
    return cl;
  };
  const asA = await signIn(A);
  const asB = await signIn(B);
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  console.log("signed in as A and B via anon clients (RLS now applies)\n");

  const orderRow = (cust) => ({
    customer_id: cust,
    status: "new",
    fulfillment: "pickup",
    payment_terms_snapshot: "net-30",
    total_cents: 222,
    client_token: randomUUID(),
  });

  // ---- 1. zero write ability for customer JWTs ----
  {
    const own = await asA.from("orders").insert(orderRow(aCust)).select("id");
    note(!!own.error, `A direct-INSERT an order for HERSELF → denied (${own.error?.code ?? "ACCEPTED!"})`);
    const forB = await asA.from("orders").insert(orderRow(bCust)).select("id");
    note(!!forB.error, `A direct-INSERT an order for B → denied (${forB.error?.code ?? "ACCEPTED!"})`);
    const { count } = await svc.from("orders").select("id", { count: "exact", head: true }).in("customer_id", [aCust, bCust]);
    note(count === 0, `no orders exist after the denied inserts (${count})`);
  }

  // ---- 2. the atomic function is unreachable from customer/anon JWTs ----
  const rpcArgs = (token) => ({
    p_customer_id: aCust,
    p_fulfillment: "pickup",
    p_notes: null,
    p_payment_terms: "net-30",
    p_total_cents: 2, // tampered "price"
    p_client_token: token,
    p_lines: [
      {
        product_id: productId, name: "x", sku: "x", unit: "ea", unit_size: "1",
        qty: 2, base_price_cents: 1, unit_price_cents: 1,
        applied_offer_title: null, was_assigned: true, cost_cents: null,
      },
    ],
  });
  {
    const r = await asA.rpc("submit_order_atomic", rpcArgs(randomUUID()));
    note(!!r.error, `A calls submit_order_atomic directly (tampered prices) → denied (${r.error?.code ?? "ACCEPTED!"})`);
    const r2 = await anon.rpc("submit_order_atomic", rpcArgs(randomUUID()));
    note(!!r2.error, `anon calls submit_order_atomic → denied (${r2.error?.code ?? "ACCEPTED!"})`);
  }

  // ---- 3. legitimate order via service role (the server action's path) ----
  const token = randomUUID();
  const legitArgs = {
    p_customer_id: aCust,
    p_fulfillment: "pickup",
    p_notes: "test order",
    p_payment_terms: "net-30",
    p_total_cents: 222,
    p_client_token: token,
    p_lines: [
      {
        product_id: productId,
        name: `ZZORD product ${rnd}`, sku: `ZZORD-${rnd}`, unit: "ea", unit_size: "1",
        qty: 2, base_price_cents: 111, unit_price_cents: 111,
        applied_offer_title: null, was_assigned: true, cost_cents: 600,
      },
    ],
  };
  {
    const { data, error } = await svc.rpc("submit_order_atomic", legitArgs);
    if (error) throw new Error(`legit submit failed: ${error.message}`);
    orderId = data;
    note(typeof orderId === "string" && orderId.length > 10, `service-role submit creates the order (${String(orderId).slice(0, 8)})`);

    const { data: mine } = await asA.from("orders").select("id, total_cents");
    note(mine?.length === 1 && mine[0].id === orderId && mine[0].total_cents === 222, `A reads exactly her own order (${mine?.length} row)`);
    const { data: items } = await asA.from("order_items").select("unit_price_cents, qty");
    note(items?.length === 1 && items[0].unit_price_cents === 111, `A reads her own order_items with the snapshotted price (${items?.[0]?.unit_price_cents})`);
    const { data: bSees } = await asB.from("orders").select("id");
    note((bSees ?? []).length === 0, "B reads A's orders → 0 rows");
    const { data: bItems } = await asB.from("order_items").select("order_id");
    note((bItems ?? []).length === 0, "B reads A's order_items → 0 rows");
    const { data: anonSees } = await anon.from("orders").select("id");
    note((anonSees ?? []).length === 0, "anon reads orders → 0 rows");
  }

  // ---- 4. no UPDATE/DELETE after submission ----
  {
    const upd = await asA.from("orders").update({ total_cents: 1 }).eq("id", orderId).select("id");
    note(!upd.error && (upd.data ?? []).length === 0, `A UPDATE own order → 0 rows affected`);
    const updItem = await asA.from("order_items").update({ unit_price_cents: 1 }).eq("order_id", orderId).select("order_id");
    note(!updItem.error && (updItem.data ?? []).length === 0, `A UPDATE own order_items → 0 rows affected`);
    const del = await asA.from("orders").delete().eq("id", orderId).select("id");
    note(!del.error && (del.data ?? []).length === 0, `A DELETE own order → 0 rows affected`);
    const { data: still } = await svc.from("orders").select("total_cents").eq("id", orderId).single();
    note(still?.total_cents === 222, `order is untouched after the attempts (total ${still?.total_cents})`);
  }

  // ---- 5. cost snapshots unreadable ----
  {
    const { data: aCosts, error: aErr } = await asA.from("order_item_costs").select("cost_cents");
    note(!!aErr || (aCosts ?? []).length === 0, "A reads order_item_costs → denied/0 rows (deny-all)");
    const { data: anonCosts, error: anErr } = await anon.from("order_item_costs").select("cost_cents");
    note(!!anErr || (anonCosts ?? []).length === 0, "anon reads order_item_costs → denied/0 rows");
    const { data: svcCosts } = await svc.from("order_item_costs").select("cost_cents").eq("order_id", orderId);
    note(svcCosts?.length === 1 && svcCosts[0].cost_cents === 600, `service role reads the cost snapshot (${svcCosts?.[0]?.cost_cents})`);
  }

  // ---- 6. idempotency: same token → same order, no duplicate ----
  {
    const { data: again, error } = await svc.rpc("submit_order_atomic", legitArgs);
    note(!error && again === orderId, `duplicate client_token returns the SAME order id`);
    const { count } = await svc.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", aCust);
    note(count === 1, `still exactly one order for A (${count})`);
  }

  // ---- 7. DB invariants ----
  {
    const badStatus = await svc.from("orders").insert({ ...orderRow(aCust), status: "bogus" }).select("id");
    note(badStatus.error?.code === "23514", `orders_status_check rejects 'bogus' (${badStatus.error?.code})`);
    if (badStatus.data?.[0]) await svc.from("orders").delete().eq("id", badStatus.data[0].id);
    const badFul = await svc.from("orders").insert({ ...orderRow(aCust), fulfillment: "teleport" }).select("id");
    note(badFul.error?.code === "23514", `orders_fulfillment_check rejects 'teleport' (${badFul.error?.code})`);
    if (badFul.data?.[0]) await svc.from("orders").delete().eq("id", badFul.data[0].id);
    const badMath = await svc.from("order_items").insert({
      order_id: orderId, product_id: productId, name: "x", sku: "x2", unit: "ea", unit_size: "1",
      qty: 3, base_price_cents: 100, unit_price_cents: 100, was_assigned: true,
      line_total_cents: 1, // 3*100 != 1
    });
    note(badMath.error?.code === "23514", `order_items_line_math_check rejects wrong line totals (${badMath.error?.code})`);
  }
} catch (e) {
  console.log("ERROR:", e.message);
  pass = false;
} finally {
  // Order first (order_items FK->products is RESTRICT), then product, then customers.
  if (aCust) await svc.from("orders").delete().eq("customer_id", aCust);
  if (bCust) await svc.from("orders").delete().eq("customer_id", bCust);
  if (productId) await svc.from("products").delete().eq("id", productId);
  if (aCust) await svc.from("customers").delete().eq("id", aCust);
  if (bCust) await svc.from("customers").delete().eq("id", bCust);
  if (aUser) await svc.auth.admin.deleteUser(aUser);
  if (bUser) await svc.auth.admin.deleteUser(bUser);
  console.log("\nteardown complete (test orders, product, customers, auth users removed)");
  console.log(pass ? "\n=== ORDER SECURITY TEST: PASS ===" : "\n=== ORDER SECURITY TEST: failures above ===");
  process.exit(pass ? 0 : 1);
}
