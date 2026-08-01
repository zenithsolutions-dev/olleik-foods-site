// CP-4 dashboard test — proves the numbers are CORRECT:
//   1. The America/Toronto "today" boundary, including BOTH DST transitions
//      (spring-forward 2026-03-08, fall-back 2026-11-01) and the 23/25-hour
//      days around them.
//   2. The status filtering (approved D-D1): revenue/profit = confirmed +
//      prepared + completed ONLY; 'new' is a separate pending line;
//      'cancelled' counts nowhere.
//   3. Revenue/profit aggregation matches the underlying orders on the LIVE
//      DB: seeds orders in every status with known totals + cost snapshots
//      (incl. a line WITHOUT cost), runs the dashboard's exact query shape
//      scoped to the throwaway customer, and feeds the SAME pure functions
//      the dashboard ships with (../src/lib/admin/dashboard-math.ts).
//   4. Empty states: zero rows aggregate to intentional zeros/nulls.
//
//   node --experimental-strip-types scripts/test-dashboard.mjs   (npm run test:dashboard)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  aggregateDay,
  aggregateProfit,
  zonedDayStartUTC,
  zonedPreviousDayStartUTC,
  REVENUE_STATUSES,
} from "../src/lib/admin/dashboard-math.ts";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const rnd = Math.random().toString(36).slice(2, 8);

let pass = true;
const note = (ok, msg) => {
  if (!ok) pass = false;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${msg}`);
};

// ---------- 1. timezone boundary (pure; no DB) ----------
console.log("--- America/Toronto day boundary (incl. both DST edges) ---");
const iso = (d) => d.toISOString();
note(iso(zonedDayStartUTC(new Date("2026-07-15T12:00:00Z"))) === "2026-07-15T04:00:00.000Z",
  "ordinary summer day (EDT, UTC-4): day starts 04:00Z");
note(iso(zonedDayStartUTC(new Date("2026-01-15T12:00:00Z"))) === "2026-01-15T05:00:00.000Z",
  "ordinary winter day (EST, UTC-5): day starts 05:00Z");
note(iso(zonedDayStartUTC(new Date("2026-07-15T03:59:00Z"))) === "2026-07-14T04:00:00.000Z",
  "03:59Z is still YESTERDAY in Toronto — boundary respects the zone, not UTC");
note(iso(zonedDayStartUTC(new Date("2026-03-08T15:00:00Z"))) === "2026-03-08T05:00:00.000Z",
  "SPRING-FORWARD day (2026-03-08): midnight was still EST → 05:00Z");
note(iso(zonedDayStartUTC(new Date("2026-03-09T12:00:00Z"))) === "2026-03-09T04:00:00.000Z",
  "day after spring-forward: EDT → 04:00Z");
note(iso(zonedDayStartUTC(new Date("2026-11-01T18:00:00Z"))) === "2026-11-01T04:00:00.000Z",
  "FALL-BACK day (2026-11-01): midnight was still EDT → 04:00Z");
note(iso(zonedDayStartUTC(new Date("2026-11-02T12:00:00Z"))) === "2026-11-02T05:00:00.000Z",
  "day after fall-back: EST → 05:00Z");
note(iso(zonedPreviousDayStartUTC(new Date("2026-03-09T12:00:00Z"))) === "2026-03-08T05:00:00.000Z",
  "yesterday across the 23-hour spring day resolves correctly");
note(iso(zonedPreviousDayStartUTC(new Date("2026-11-02T12:00:00Z"))) === "2026-11-01T04:00:00.000Z",
  "yesterday across the 25-hour fall day resolves correctly");

// ---------- 2. pure aggregation + empty states ----------
console.log("\n--- pure aggregation (D-D1) + empty states ---");
{
  const agg = aggregateDay([
    { status: "new", fulfillment: "pickup", totalCents: 1000 },
    { status: "confirmed", fulfillment: "pickup", totalCents: 2000 },
    { status: "prepared", fulfillment: "delivery", totalCents: 3000 },
    { status: "completed", fulfillment: "delivery", totalCents: 4000 },
    { status: "cancelled", fulfillment: "pickup", totalCents: 50000 },
  ]);
  note(agg.revenueCents === 9000, `revenue = confirmed+prepared+completed only (${agg.revenueCents})`);
  note(agg.pendingCount === 1 && agg.pendingCents === 1000, "'new' is the separate pending line");
  note(agg.byStatus.cancelled === 1 && agg.revenueCents + agg.pendingCents === 10000,
    "cancelled counts NOWHERE in money");
  note(agg.pickupCount === 1 && agg.deliveryCount === 2,
    "pickup/delivery counts cover accepted orders only");
  const empty = aggregateDay([]);
  note(empty.totalOrders === 0 && empty.revenueCents === 0 && empty.pendingCount === 0,
    "empty day aggregates to intentional zeros");
  const p = aggregateProfit([
    { qty: 2, lineTotalCents: 2000, costCents: 600 },   // profit 800
    { qty: 1, lineTotalCents: 4000, costCents: 1000 },  // profit 3000
    { qty: 3, lineTotalCents: 3000, costCents: null },  // excluded, counted
  ]);
  note(p.profitCents === 3800 && p.linesWithoutCost === 1,
    `profit derived per line, uncosted excluded+reported (${p.profitCents}, ${p.linesWithoutCost} uncosted)`);
  note(aggregateProfit([]).profitCents === null, "no costed lines → profit null (renders as —)");
}

// ---------- 3. LIVE: seeded orders match the dashboard's math ----------
console.log("\n--- live seeded verification (dashboard query shape + same pure fns) ---");
let cust, prod;
try {
  const { data: p } = await svc.from("products")
    .insert({ sku: `ZZDASH-${rnd}`, name: `ZZDASH ${rnd}`, unit: "ea", unit_size: "1", list_price_cents: 1000, is_active: true })
    .select("id").single();
  prod = p.id;
  const { data: c } = await svc.from("customers")
    .insert({ business_name: `ZZDASH ${rnd}`, contact_name: "d", email: `zzdash-${rnd}@example.com`, phone: "0", status: "active" })
    .select("id").single();
  cust = c.id;

  // makeOrder(qty, unitPrice, fulfillment, costCents|null) via the real RPC
  // (cost snapshots seeded through the same path production uses).
  const makeOrder = async (qty, unitPrice, fulfillment, costCents) => {
    const { data, error } = await svc.rpc("submit_order_atomic", {
      p_customer_id: cust, p_fulfillment: fulfillment, p_notes: null,
      p_payment_terms: "net-30", p_total_cents: qty * unitPrice, p_client_token: randomUUID(),
      p_lines: [{
        product_id: prod, name: "d", sku: "d", unit: "ea", unit_size: "1",
        qty, base_price_cents: unitPrice, unit_price_cents: unitPrice,
        applied_offer_title: null, was_assigned: false, cost_cents: costCents,
      }],
    });
    if (error) throw new Error(`makeOrder: ${error.message}`);
    return data;
  };
  const setStatus = (id, status) => svc.from("orders").update({ status }).eq("id", id);

  await makeOrder(1, 1000, "pickup", 600); // stays 'new' — the pending line
  const oConf = await makeOrder(2, 1000, "pickup", 600);       // revenue 2000, profit 800
  const oPrep = await makeOrder(1, 3000, "delivery", 1000);    // revenue 3000, profit 2000
  const oComp = await makeOrder(1, 4000, "delivery", null);    // revenue 4000, uncosted line
  const oCanc = await makeOrder(5, 10000, "pickup", 600);      // cancelled — counts nowhere
  await setStatus(oConf, "confirmed");
  await setStatus(oPrep, "prepared");
  await setStatus(oComp, "completed");
  await setStatus(oCanc, "cancelled");
  // A YESTERDAY order (accepted): created_at moved into yesterday's window.
  const oYest = await makeOrder(1, 7000, "pickup", 600);
  await setStatus(oYest, "completed");
  const yStart = zonedPreviousDayStartUTC(new Date());
  await svc.from("orders")
    .update({ created_at: new Date(yStart.getTime() + 60 * 60 * 1000).toISOString() })
    .eq("id", oYest);

  const todayStart = zonedDayStartUTC(new Date());
  // The dashboard's exact query shape, scoped to the throwaway customer so
  // real production orders never pollute the assertion.
  const { data: todayRows } = await svc.from("orders")
    .select("id, status, fulfillment, total_cents")
    .eq("customer_id", cust)
    .gte("created_at", todayStart.toISOString());
  const { data: yRows } = await svc.from("orders")
    .select("id, status, fulfillment, total_cents")
    .eq("customer_id", cust)
    .gte("created_at", yStart.toISOString())
    .lt("created_at", todayStart.toISOString());

  const agg = aggregateDay(todayRows.map((r) => ({
    status: r.status, fulfillment: r.fulfillment, totalCents: r.total_cents,
  })));
  note(agg.revenueCents === 9000,
    `LIVE revenue = 2000+3000+4000 accepted only (${agg.revenueCents}); the $500 cancelled order is excluded`);
  note(agg.pendingCount === 1 && agg.pendingCents === 1000,
    `LIVE pending line = the 1 unconfirmed order (${agg.pendingCents})`);
  note(agg.pickupCount === 1 && agg.deliveryCount === 2,
    `LIVE pickup/delivery = 1/2 accepted (${agg.pickupCount}/${agg.deliveryCount})`);
  note(agg.byStatus.cancelled === 1 && agg.totalOrders === 5,
    "LIVE status counts: 5 today incl. 1 cancelled");

  const yAgg = aggregateDay(yRows.map((r) => ({
    status: r.status, fulfillment: r.fulfillment, totalCents: r.total_cents,
  })));
  note(yAgg.totalOrders === 1 && yAgg.revenueCents === 7000,
    `LIVE yesterday window catches exactly the moved order (${yAgg.revenueCents})`);

  // Profit from the accepted orders' snapshots (same joins as the dashboard).
  const acceptedIds = todayRows
    .filter((r) => REVENUE_STATUSES.includes(r.status))
    .map((r) => r.id);
  const [{ data: items }, { data: snaps }] = await Promise.all([
    svc.from("order_items").select("order_id, product_id, qty, line_total_cents").in("order_id", acceptedIds),
    svc.from("order_item_costs").select("order_id, product_id, cost_cents").in("order_id", acceptedIds),
  ]);
  const costMap = new Map(snaps.map((s) => [`${s.order_id}:${s.product_id}`, s.cost_cents]));
  const profit = aggregateProfit(items.map((i) => ({
    qty: i.qty, lineTotalCents: i.line_total_cents,
    costCents: costMap.get(`${i.order_id}:${i.product_id}`) ?? null,
  })));
  // conf: 2000 - 2*600 = 800; prep: 3000 - 1*1000 = 2000; comp: no cost.
  note(profit.profitCents === 2800 && profit.linesWithoutCost === 1,
    `LIVE profit = 800+2000 from snapshots, 1 uncosted line reported (${profit.profitCents}, ${profit.linesWithoutCost})`);
} catch (e) {
  console.log("ERROR:", e.message);
  pass = false;
} finally {
  if (cust) await svc.from("orders").delete().eq("customer_id", cust);
  if (prod) await svc.from("products").delete().eq("id", prod);
  if (cust) await svc.from("customers").delete().eq("id", cust);
  console.log("\nteardown complete (test orders, product, customer removed)");
  console.log(pass ? "\n=== DASHBOARD TEST: PASS ===" : "\n=== DASHBOARD TEST: failures above ===");
  process.exit(pass ? 0 : 1);
}
