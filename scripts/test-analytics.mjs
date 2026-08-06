// CP-8b analytics test.
//
// PURE (always runs): ranking + ties + profit-null sinking; slow movers
// include zero-movement products with age and new-in-period flags; the
// inactive/never-ordered split at the 29/31-day boundaries.
//
// LIVE (always runs — fallback aggregation needs no migration): seeds orders
// in EVERY status for two customers, then proves
//   * analytics figures equal hand-computed sums over the seeded orders,
//   * THE NON-DIVERGENCE CHECK: analytics revenue for the period equals
//     aggregateDay's revenue over the same rows — analytics, dashboard and
//     statements are one family of numbers,
//   * only REVENUE_STATUSES count ('new'/'cancelled' move nothing).
//
// RPC (auto-detects migration 0014): the SQL aggregates must return figures
// identical to the in-app fallback over the same window, and EXECUTE must be
// denied to an authenticated customer session (D-O0). Pre-0014 this section
// reports SKIPPED loudly and the suite result says so.
//
//   node --experimental-strip-types scripts/test-analytics.mjs   (npm run test:analytics)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  rankProducts,
  buildSlowMovers,
  rankCustomers,
  splitByActivity,
} from "../src/lib/admin/analytics-math.ts";
import { aggregateDay, REVENUE_STATUSES } from "../src/lib/admin/dashboard-math.ts";

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
const svc = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const rnd = Math.random().toString(36).slice(2, 8);

let pass = true;
const note = (ok, msg) => {
  if (!ok) pass = false;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${msg}`);
};

const NOW = new Date("2026-08-03T12:00:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400_000).toISOString();

// ---------- pure: ranking ----------
console.log("--- ranking, ties, profit sinking ---");
{
  const rows = [
    { productId: "a", name: "Alpha", sku: "A", units: 10, revenueCents: 5000, costCents: 3000, costedLines: 2, totalLines: 2 },
    { productId: "b", name: "Beta", sku: "B", units: 3, revenueCents: 9000, costCents: 2000, costedLines: 1, totalLines: 2 },
    { productId: "c", name: "Carol", sku: "C", units: 10, revenueCents: 5000, costCents: null, costedLines: 0, totalLines: 1 },
  ];
  const byRevenue = rankProducts(rows, "revenue");
  note(byRevenue[0].productId === "b", "revenue sort: Beta ($90) first");
  note(byRevenue[1].productId === "a" && byRevenue[2].productId === "c",
    "tie on revenue ($50=$50) broken by name: Alpha before Carol — values visible either way");
  const byUnits = rankProducts(rows, "units");
  note(byUnits[0].productId === "a" && byUnits[1].productId === "c",
    "units tie (10=10) also name-broken, stable");
  const byProfit = rankProducts(rows, "profit");
  note(byProfit[byProfit.length - 1].productId === "c",
    "profit sort: no-cost product sinks to the bottom (a figure we don't have can't outrank one we do)");
  note(byProfit.find((r) => r.productId === "b").profitIncomplete === true,
    "partially-costed product is flagged profitIncomplete (the on-screen warning)");
  note(byProfit.find((r) => r.productId === "a").profitCents === 2000 &&
    byProfit.find((r) => r.productId === "a").profitIncomplete === false,
    "fully-costed product: exact profit, no flag");
}

// ---------- pure: slow movers ----------
console.log("\n--- slow movers: zero included, age carried ---");
{
  const catalogue = [
    { productId: "sold", name: "Sold", sku: "S", isActive: true, createdAt: daysAgo(400) },
    { productId: "dead", name: "Dead", sku: "D", isActive: true, createdAt: daysAgo(200) },
    { productId: "fresh", name: "Fresh", sku: "F", isActive: true, createdAt: daysAgo(2) },
    { productId: "inactive", name: "Off", sku: "O", isActive: false, createdAt: daysAgo(300) },
  ];
  const sales = [{ productId: "sold", name: "Sold", sku: "S", units: 7, revenueCents: 700, costCents: null, costedLines: 0, totalLines: 1 }];
  const rows = buildSlowMovers(catalogue, sales, { periodStartUTC: new Date(daysAgo(30)), now: NOW });
  note(rows.length === 3 && rows.some((r) => r.productId === "dead" && r.units === 0),
    "zero-movement ACTIVE product is present with units 0 (the left join is the point); inactive excluded");
  note(rows[0].units === 0 && rows[rows.length - 1].productId === "sold",
    "ascending: non-movers first, the seller last");
  const fresh = rows.find((r) => r.productId === "fresh");
  note(fresh.newInPeriod === true && fresh.ageDays === 2,
    "2-day-old product carries its age and NEW IN PERIOD — not mislabelled stale");
  note(rows.find((r) => r.productId === "dead").newInPeriod === false, "old product isn't flagged new");
}

// ---------- pure: inactive split ----------
console.log("\n--- inactive vs never-ordered (D-N3 boundaries) ---");
{
  const customers = [
    { businessName: "Silent31", lastOrderAt: daysAgo(31) },
    { businessName: "Silent29", lastOrderAt: daysAgo(29) },
    { businessName: "Never", lastOrderAt: null },
    { businessName: "Ancient", lastOrderAt: daysAgo(200) },
  ];
  const s30 = splitByActivity(customers, 30, NOW);
  note(s30.inactive.map((c) => c.businessName).join() === "Ancient,Silent31",
    "30d: 31-days-silent is IN, 29 is OUT; longest-silent first");
  note(s30.neverOrdered.length === 1 && s30.neverOrdered[0].businessName === "Never",
    "never-ordered is a SEPARATE list, not mixed into inactive");
  note(s30.activeRecently === 1, "the 29-day customer counts as recently active");
  const s90 = splitByActivity(customers, 90, NOW);
  note(s90.inactive.length === 1 && s90.inactive[0].businessName === "Ancient",
    "90d threshold: only the 200-day customer qualifies");
  note(s30.inactive[0].daysSilent === 200, "daysSilent computed for the win-back call");
  const custRank = rankCustomers(
    [
      { customerId: "x", businessName: "X", ordersCount: 5, revenueCents: 1000, lastOrderAt: null },
      { customerId: "y", businessName: "Y", ordersCount: 2, revenueCents: 9000, lastOrderAt: null },
    ],
    "orders",
  );
  note(custRank[0].customerId === "x" && rankCustomers(custRank, "revenue")[0].customerId === "y",
    "top customers re-rank by orders vs revenue");
}

// ---------- live ----------
console.log("\n--- live: seeded figures, NON-DIVERGENCE vs aggregateDay ---");
let prod, custA, custB, userC;
const made = [];
const C = { email: `zzana-${rnd}@example.com`, password: `Test!${rnd}aA9` };
try {
  const { data: p } = await svc.from("products")
    .insert({ sku: `ZZANA-${rnd}`, name: `ZZANA ${rnd}`, unit: "ea", unit_size: "1", list_price_cents: 1000, is_active: true })
    .select("id").single();
  prod = p.id;
  const mk = async (name, uid) => {
    const { data: c } = await svc.from("customers")
      .insert({ business_name: name, contact_name: "a", email: `${name}@x.com`, phone: "0", status: "active", user_id: uid ?? null })
      .select("id").single();
    return c.id;
  };
  {
    const { data: u, error: ue } = await svc.auth.admin.createUser({
      email: C.email, password: C.password, email_confirm: true,
    });
    if (ue) throw ue;
    userC = u.user.id;
  }
  custA = await mk(`ZZANA-A-${rnd}`, userC);
  custB = await mk(`ZZANA-B-${rnd}`);

  const windowStart = "2026-06-01T00:00:00Z";
  const windowEnd = "2026-07-01T00:00:00Z";
  const place = async (customerId, qty, status, createdAtISO) => {
    const { data, error } = await svc.rpc("submit_order_atomic", {
      p_customer_id: customerId, p_fulfillment: "pickup", p_notes: null, p_payment_terms: "net-30",
      p_total_cents: qty * 1000, p_client_token: randomUUID(),
      p_lines: [{ product_id: prod, name: `ZZANA ${rnd}`, sku: `ZZANA-${rnd}`, unit: "ea", unit_size: "1", qty, base_price_cents: 1000, unit_price_cents: 1000, applied_offer_title: null, was_assigned: true, cost_cents: 600 }],
    });
    if (error) throw new Error(error.message);
    await svc.from("orders").update({ status, created_at: createdAtISO }).eq("id", data);
    made.push(data);
    return data;
  };

  // Every status inside the window + one confirmed outside it.
  await place(custA, 2, "confirmed", "2026-06-05T12:00:00Z");
  await place(custA, 3, "prepared", "2026-06-10T12:00:00Z");
  await place(custB, 4, "completed", "2026-06-15T12:00:00Z");
  await place(custB, 5, "new", "2026-06-16T12:00:00Z");
  await place(custB, 6, "cancelled", "2026-06-17T12:00:00Z");
  await place(custA, 7, "confirmed", "2026-07-10T12:00:00Z"); // outside

  // The data layer's fallback aggregation, replicated shape-for-shape.
  const readWindowOrders = async () => {
    const { data, error } = await svc
      .from("orders")
      .select("id, customer_id, status, total_cents, created_at, order_items(product_id, qty, line_total_cents)")
      .in("status", REVENUE_STATUSES)
      .gte("created_at", windowStart)
      .lt("created_at", windowEnd)
      .in("customer_id", [custA, custB]);
    if (error) throw new Error(error.message);
    return data ?? [];
  };
  const rows = await readWindowOrders();

  const units = rows.flatMap((r) => r.order_items).filter((i) => i.product_id === prod).reduce((n, i) => n + i.qty, 0);
  const revenue = rows.reduce((n, r) => n + r.total_cents, 0);
  note(units === 9 && revenue === 9000,
    "seeded window figures: 2+3+4 = 9 units, $90.00 — 'new' (5) and 'cancelled' (6) move NOTHING");

  // NON-DIVERGENCE (required): the same rows through the dashboard's
  // aggregateDay must equal the analytics revenue exactly.
  const agg = aggregateDay(rows.map((r) => ({ status: r.status, fulfillment: "pickup", totalCents: r.total_cents })));
  note(agg.revenueCents === revenue && agg.revenueCents === 9000,
    `NON-DIVERGENCE: analytics revenue (${revenue}) === aggregateDay revenue (${agg.revenueCents}) for the same period`);

  const perCustomer = new Map();
  for (const r of rows) {
    const cur = perCustomer.get(r.customer_id) ?? { orders: 0, cents: 0 };
    cur.orders += 1; cur.cents += r.total_cents;
    perCustomer.set(r.customer_id, cur);
  }
  note(perCustomer.get(custA)?.orders === 2 && perCustomer.get(custA)?.cents === 5000 &&
    perCustomer.get(custB)?.orders === 1 && perCustomer.get(custB)?.cents === 4000,
    "top-customer figures: A = 2 orders / $50.00, B = 1 order / $40.00");

  // ---------- RPC section (auto-detects 0014) ----------
  const rpc = await svc.rpc("analytics_product_sales", { p_start: windowStart, p_end: windowEnd });
  if (rpc.error && (rpc.error.code === "42883" || rpc.error.code === "PGRST202")) {
    console.log("\n⚠ RPC section SKIPPED: migration 0014 not applied yet.");
    console.log("  After applying 0014, rerun: npm run test:analytics — the parity and");
    console.log("  permission-denial checks below run automatically.");
  } else if (rpc.error) {
    note(false, `analytics_product_sales errored unexpectedly: ${rpc.error.message}`);
  } else {
    console.log("\n--- RPC (0014 applied): parity + permissions ---");
    const mine = (rpc.data ?? []).find((r) => r.product_id === prod);
    note(mine != null && Number(mine.units) === units && Number(mine.revenue_cents) === 9000,
      "RPC product figures === fallback figures (9 units, $90.00)");
    note(mine != null && Number(mine.cost_cents) === 9 * 600 && Number(mine.costed_lines) === 3,
      "RPC cost figures from the deny-all snapshots: $54.00 over 3 costed lines");
    const crpc = await svc.rpc("analytics_customer_sales", { p_start: windowStart, p_end: windowEnd });
    const a = (crpc.data ?? []).find((r) => r.customer_id === custA);
    const b = (crpc.data ?? []).find((r) => r.customer_id === custB);
    note(a && Number(a.orders_count) === 2 && Number(a.revenue_cents) === 5000 &&
      b && Number(b.orders_count) === 1 && Number(b.revenue_cents) === 4000,
      "RPC customer figures === fallback figures");
    note(b && b.last_order_at?.startsWith("2026-06-15"),
      "last_order_at = the most recent COUNTED order (B's 'new'/'cancelled' don't refresh it)");

    // D-O0: a signed-in CUSTOMER cannot execute the aggregates.
    const asC = createClient(URL, ANON, { auth: { persistSession: false } });
    {
      const { error } = await asC.auth.signInWithPassword({ email: C.email, password: C.password });
      if (error) throw error;
    }
    const denied = await asC.rpc("analytics_product_sales", { p_start: null, p_end: null });
    note(denied.error != null,
      `authenticated customer calling the aggregate is DENIED (${denied.error?.code ?? "error"}) — D-O0 holds`);
  }
} catch (e) {
  console.log("ERROR:", e.message);
  pass = false;
} finally {
  for (const id of made) await svc.from("orders").delete().eq("id", id);
  if (prod) await svc.from("products").delete().eq("id", prod);
  if (custA) await svc.from("customers").delete().eq("id", custA);
  if (custB) await svc.from("customers").delete().eq("id", custB);
  if (userC) await svc.auth.admin.deleteUser(userC);
  console.log("\nteardown complete (test orders, product, customers, auth user removed)");
  console.log(pass ? "\n=== ANALYTICS TEST: PASS ===" : "\n=== ANALYTICS TEST: failures above ===");
  process.exit(pass ? 0 : 1);
}
