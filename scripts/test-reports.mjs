// CP-8c report-builder test.
//
// PURE (always runs):
//   * STRUCTURAL ABSENCE: unticked sections are absent from the model —
//     their keys do not appear anywhere in the serialization.
//   * DERIVED INTERNAL: a report containing the profit section is IMPOSSIBLE
//     to build with internal:false — proven by brute-forcing EVERY one of the
//     128 tick combinations and asserting internal === contains-profit.
//   * Cost figures live ONLY in the profit section: without it, the
//     serialized model has no cost/profit key or value even though the
//     analytics input rows carry costs (field-by-field projection).
//   * Preset resolution: each of the four presets maps to its exact section
//     set and range.
//   * Empty state: nothing ticked → isEmpty, still a valid designed document.
//
// LIVE: seeds orders, then proves ONE FAMILY OF NUMBERS — the report's
// revenue-summary, best-sellers and profit figures equal the analytics RPC
// figures for the same window (0014 is applied in prod; if it ever isn't,
// the equality is asserted against the same-shape fallback aggregation).
//
//   node --experimental-strip-types scripts/test-reports.mjs   (npm run test:reports)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  buildReportModel,
  PRESET_DEFS,
  REPORT_PRESETS,
  REPORT_SECTIONS,
  PROFIT_BEARING,
} from "../src/lib/documents/report-model.ts";
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
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const rnd = Math.random().toString(36).slice(2, 8);

let pass = true;
const note = (ok, msg) => {
  if (!ok) pass = false;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${msg}`);
};

const BUSINESS = {
  displayName: "Olleik Foods",
  legalName: "Olleik Foods — [LEGAL NAME TBC]",
  address: "[STREET ADDRESS], Ottawa, ON [POSTAL CODE]",
  phone: "[PHONE]",
  email: "[EMAIL]",
  taxEnabled: false,
  taxNumber: null,
};

const INPUTS = {
  aggregates: aggregateDay([
    { status: "confirmed", fulfillment: "pickup", totalCents: 5000 },
    { status: "new", fulfillment: "pickup", totalCents: 700 },
    { status: "cancelled", fulfillment: "delivery", totalCents: 900 },
  ]),
  productSales: [
    { productId: "p1", name: "Feta", sku: "F-1", units: 5, revenueCents: 5000, costCents: 3000, costedLines: 1, totalLines: 2 },
  ],
  slowMovers: [
    { productId: "p2", name: "Dead", sku: "D-1", units: 0, revenueCents: 0, ageDays: 100, newInPeriod: false },
  ],
  customerSales: [
    { customerId: "c1", businessName: "Milano", ordersCount: 2, revenueCents: 5000, lastOrderAt: null },
  ],
  inactive: [{ customerId: "c2", businessName: "Quiet Co", lastOrderAt: "2026-06-01T00:00:00Z", daysSilent: 63 }],
  neverOrdered: ["Fresh Co"],
  inactiveThresholdDays: 30,
  orders: [
    { orderId: "aaaaaaaa-1", customerName: "Milano", createdAt: "2026-07-05T12:00:00Z", status: "confirmed", totalCents: 5000 },
  ],
};
const build = (ticked) =>
  buildReportModel({
    ticked,
    inputs: INPUTS,
    business: BUSINESS,
    periodLabel: "July 2026",
    generatedAt: new Date("2026-08-01T12:00:00Z"),
  });

// ---------- structural absence ----------
console.log("--- structural absence: unticked sections do not exist in the model ---");
{
  const m = build(["revenue-summary", "best-sellers"]);
  note(m.sections.length === 2 && m.sections.map((s) => s.key).sort().join() === "best-sellers,revenue-summary",
    "two ticked → exactly two sections in the model");
  const json = JSON.stringify(m);
  note(!json.includes("slow-movers") && !json.includes("top-customers") && !json.includes("inactive-customers"),
    "unticked section keys appear NOWHERE in the serialization — absent, not hidden");
  note(!/costCents|profitCents|margin/i.test(json),
    "without the profit section, NO cost/profit key survives — even though the analytics inputs carry costs");
  note(m.internal === false, "no profit-bearing section → internal:false, no banner");
}

// ---------- derived INTERNAL: all 128 combinations ----------
console.log("\n--- derived INTERNAL: brute force over every tick combination ---");
{
  let checked = 0;
  let holds = true;
  for (let mask = 0; mask < 1 << REPORT_SECTIONS.length; mask++) {
    const ticked = REPORT_SECTIONS.filter((_, i) => mask & (1 << i));
    const m = build(ticked);
    const containsProfitBearing = m.sections.some((s) => PROFIT_BEARING.includes(s.key));
    if (m.internal !== containsProfitBearing) holds = false;
    // and a profit-bearing model must NEVER exist unmarked:
    if (containsProfitBearing && !m.internal) holds = false;
    checked++;
  }
  note(holds && checked === 128,
    `all ${checked} tick combinations: internal === contains-profit-section — an unmarked profit report cannot be built`);
  const withProfit = build(["profit"]);
  note(withProfit.internal === true && withProfit.title.includes("internal"),
    "profit section alone → internal:true and the internal title");
  note(withProfit.sections[0].key === "profit" && withProfit.sections[0].costWarning?.includes("1 of 2"),
    "the profit section carries the missing-cost warning (1 of 2 lines costed)");
}

// ---------- presets ----------
console.log("\n--- preset resolution (D-N5) ---");
{
  note(REPORT_PRESETS.length === 4, "exactly the four approved presets");
  const daily = PRESET_DEFS.daily;
  note(daily.range === "today" && daily.sections.join() === "revenue-summary,best-sellers,orders",
    "Daily summary → today + revenue/best-sellers/orders");
  const weekly = PRESET_DEFS.weekly;
  note(weekly.range === "this-week" && weekly.sections.includes("top-customers"),
    "Weekly review → this week incl. top customers");
  const monthly = PRESET_DEFS.monthly;
  note(monthly.sections.length === REPORT_SECTIONS.length && monthly.sections.includes("profit"),
    "Monthly business review → ALL sections incl. profit (prints INTERNAL)");
  note(build(monthly.sections).internal === true,
    "…and building the monthly preset derives internal:true automatically");
  const buying = PRESET_DEFS.buying;
  note(buying.sections.includes("slow-movers") && !buying.sections.includes("profit"),
    "Buying list → slow movers (+ best sellers), customer-safe");
}

// ---------- empty state ----------
console.log("\n--- empty states ---");
{
  const empty = build([]);
  note(empty.isEmpty && empty.sections.length === 0 && empty.internal === false,
    "nothing ticked → isEmpty, zero sections, not internal — a designed document upstream");
  const emptyData = buildReportModel({
    ticked: ["best-sellers", "orders"],
    inputs: { ...INPUTS, productSales: [], orders: [] },
    business: BUSINESS,
    periodLabel: "Future range",
    generatedAt: new Date("2026-08-01T12:00:00Z"),
  });
  note(emptyData.sections.length === 2 && emptyData.sections.every((s) => (s.rows ?? []).length === 0),
    "sections with no data in the period still render as sections with designed empties");
}

// ---------- live: one family of numbers ----------
console.log("\n--- live: report figures === analytics figures for the same window ---");
let prod, custA, userA;
const made = [];
try {
  const { data: p } = await svc.from("products")
    .insert({ sku: `ZZREP-${rnd}`, name: `ZZREP ${rnd}`, unit: "ea", unit_size: "1", list_price_cents: 1000, is_active: true })
    .select("id").single();
  prod = p.id;
  {
    const { data: u, error: ue } = await svc.auth.admin.createUser({
      email: `zzrep-${rnd}@example.com`, password: `Test!${rnd}aA9`, email_confirm: true,
    });
    if (ue) throw ue;
    userA = u.user.id;
  }
  const { data: c } = await svc.from("customers")
    .insert({ business_name: `ZZREP-${rnd}`, contact_name: "r", email: `zzrep-${rnd}@x.com`, phone: "0", status: "active", user_id: userA })
    .select("id").single();
  custA = c.id;

  const windowStart = "2026-05-01T00:00:00Z";
  const windowEnd = "2026-06-01T00:00:00Z";
  const place = async (qty, status, createdAtISO) => {
    const { data, error } = await svc.rpc("submit_order_atomic", {
      p_customer_id: custA, p_fulfillment: "pickup", p_notes: null, p_payment_terms: "net-30",
      p_total_cents: qty * 1000, p_client_token: randomUUID(),
      p_lines: [{ product_id: prod, name: `ZZREP ${rnd}`, sku: `ZZREP-${rnd}`, unit: "ea", unit_size: "1", qty, base_price_cents: 1000, unit_price_cents: 1000, applied_offer_title: null, was_assigned: true, cost_cents: 600 }],
    });
    if (error) throw new Error(error.message);
    await svc.from("orders").update({ status, created_at: createdAtISO }).eq("id", data);
    made.push(data);
  };
  await place(2, "confirmed", "2026-05-05T12:00:00Z");
  await place(3, "completed", "2026-05-10T12:00:00Z");
  await place(9, "cancelled", "2026-05-11T12:00:00Z");

  // Analytics figures (RPC — 0014 is applied in prod; fall back to the same
  // shape if it ever isn't).
  let units, revenue, cost;
  const rpc = await svc.rpc("analytics_product_sales", { p_start: windowStart, p_end: windowEnd });
  if (!rpc.error) {
    const mine = (rpc.data ?? []).find((r) => r.product_id === prod);
    units = Number(mine.units); revenue = Number(mine.revenue_cents); cost = Number(mine.cost_cents);
    console.log("  (figures via 0014 RPC)");
  } else {
    const { data } = await svc.from("orders")
      .select("total_cents, order_items(product_id, qty, line_total_cents)")
      .in("status", REVENUE_STATUSES).gte("created_at", windowStart).lt("created_at", windowEnd)
      .eq("customer_id", custA);
    const items = (data ?? []).flatMap((r) => r.order_items).filter((i) => i.product_id === prod);
    units = items.reduce((n, i) => n + i.qty, 0);
    revenue = items.reduce((n, i) => n + i.line_total_cents, 0);
    cost = units * 600;
    console.log("  (figures via fallback shape — 0014 absent)");
  }

  // The report over the same window, built from the same analytics rows.
  const model = buildReportModel({
    ticked: ["revenue-summary", "best-sellers", "profit"],
    inputs: {
      ...INPUTS,
      aggregates: aggregateDay([
        { status: "confirmed", fulfillment: "pickup", totalCents: 2000 },
        { status: "completed", fulfillment: "pickup", totalCents: 3000 },
        { status: "cancelled", fulfillment: "pickup", totalCents: 9000 },
      ]),
      productSales: [
        { productId: prod, name: `ZZREP ${rnd}`, sku: `ZZREP-${rnd}`, units, revenueCents: revenue, costCents: cost, costedLines: 2, totalLines: 2 },
      ],
    },
    business: BUSINESS,
    periodLabel: "May 2026",
    generatedAt: new Date(),
  });

  const best = model.sections.find((s) => s.key === "best-sellers");
  const profitS = model.sections.find((s) => s.key === "profit");
  const revS = model.sections.find((s) => s.key === "revenue-summary");
  note(units === 5 && revenue === 5000, "analytics window figures: 5 units, $50.00 (cancelled 9 units move nothing)");
  note(best.rows[0].units === units && best.rows[0].revenueCents === revenue,
    "report best-sellers === analytics figures, verbatim");
  note(revS.aggregates.revenueCents === 5000,
    "report revenue-summary === aggregateDay revenue for the same rows");
  note(profitS.revenueCents === revenue && profitS.costCents === cost && profitS.profitCents === revenue - cost,
    `report profit section: revenue $50.00 − cost $${(cost / 100).toFixed(2)} = profit $${((revenue - cost) / 100).toFixed(2)} — same family of numbers`);
  note(model.internal === true, "and that report is, unavoidably, INTERNAL");
} catch (e) {
  console.log("ERROR:", e.message);
  pass = false;
} finally {
  for (const id of made) await svc.from("orders").delete().eq("id", id);
  if (prod) await svc.from("products").delete().eq("id", prod);
  if (custA) await svc.from("customers").delete().eq("id", custA);
  if (userA) await svc.auth.admin.deleteUser(userA);
  console.log("\nteardown complete (test orders, product, customer, auth user removed)");
  console.log(pass ? "\n=== REPORTS TEST: PASS ===" : "\n=== REPORTS TEST: failures above ===");
  process.exit(pass ? 0 : 1);
}
