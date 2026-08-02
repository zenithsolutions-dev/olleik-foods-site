// CP-7 customer-statements test — proves the guarantees the statement makes:
//   1. STRUCTURAL: the customer copy cannot carry cost/profit. Proven the hard
//      way — fat internal lines (costCents attached) are fed straight into the
//      customer builder and the serialized model still has no cost trace,
//      because lines are projected field by field, not spread.
//   2. AGREEMENT: the two copies never disagree. Every shared figure is
//      compared field by field — the internal builder calls the customer
//      builder, so these are the same values, and this is the backstop.
//   3. COUNTING: exactly the CP-4 revenue statuses count (imported, never
//      redefined). 'new' and 'cancelled' are LISTED but contribute zero.
//   4. BOUNDARIES: live — an order at the first instant of the period is IN,
//      one at the exclusive end instant is OUT (the CP-5 boundary pattern,
//      through resolveDateRange + the same gte/lt the data layer issues).
//   5. SNAPSHOT: live — prices change AFTER the orders; the statement doesn't
//      move a cent.
//   6. ISOLATION: live — a customer's own session-scoped statement read can
//      never return another customer's orders.
//
//   node --experimental-strip-types scripts/test-statements.mjs   (npm run test:statements)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  buildCustomerStatement,
  buildInternalStatement,
  MAX_STATEMENT_ORDERS,
} from "../src/lib/documents/customer-statement-model.ts";
import { REVENUE_STATUSES } from "../src/lib/admin/dashboard-math.ts";
import { resolveDateRange, zonedMidnightUTC } from "../src/lib/dates.ts";

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

const BUSINESS = {
  displayName: "Olleik Foods",
  legalName: "Olleik Foods — [LEGAL NAME TBC]",
  address: "[STREET ADDRESS], Ottawa, ON [POSTAL CODE]",
  phone: "[PHONE]",
  email: "[EMAIL]",
  taxEnabled: false,
  taxNumber: null,
};
const FOR = { businessName: "Test Diner", contactName: "T", email: "t@example.com", phone: "0" };

const line = (over = {}) => ({
  name: "Feta",
  sku: "F-1",
  unit: "case",
  unitSize: "4 lb",
  qty: 2,
  unitPriceCents: 1000,
  lineTotalCents: 2000,
  appliedOfferTitle: null,
  ...over,
});
const order = (over = {}) => ({
  orderId: "aaaaaaaa-0000-0000-0000-000000000001",
  status: "confirmed",
  createdAt: "2026-06-10T12:00:00Z",
  fulfillment: "pickup",
  totalCents: 2000,
  lines: [line()],
  ...over,
});
const common = { business: BUSINESS, statementFor: FOR, periodLabel: "June 2026", generatedAt: new Date("2026-07-02T12:00:00Z") };

// ---------- 1. counting rule + context sections ----------
console.log("--- counting rule (D-S3): revenue statuses count, others are listed ---");
{
  const orders = [
    order({ orderId: "o-confirmed", status: "confirmed", totalCents: 1000, lines: [line({ lineTotalCents: 1000, qty: 1 })] }),
    order({ orderId: "o-prepared", status: "prepared", totalCents: 2000 }),
    order({ orderId: "o-completed", status: "completed", totalCents: 3000, lines: [line({ qty: 3, lineTotalCents: 3000 })] }),
    order({ orderId: "o-new", status: "new", totalCents: 500 }),
    order({ orderId: "o-cancelled", status: "cancelled", totalCents: 900 }),
  ];
  const m = buildCustomerStatement({ ...common, orders });
  note(
    m.orderCount === 3 && m.totalCents === 6000,
    `only ${REVENUE_STATUSES.join("+")} count: 3 orders, $60.00 (new $5 and cancelled $9 excluded)`,
  );
  note(
    m.awaiting.length === 1 && m.awaiting[0].marker === "AWAITING CONFIRMATION",
    "'new' order is LISTED in its own section, marked in words",
  );
  note(
    m.cancelled.length === 1 && m.cancelled[0].marker === "CANCELLED",
    "cancelled order is LISTED, marked CANCELLED (words, not colour)",
  );
  note(
    !m.orders.some((o) => o.status === "new" || o.status === "cancelled"),
    "neither ever appears inside the counted table",
  );
  // The invariant that keeps the document honest.
  const rollupSum = m.products.reduce((n, p) => n + p.amountCents, 0);
  const orderSum = m.orders.reduce((n, o) => n + o.totalCents, 0);
  note(
    rollupSum === m.totalCents && orderSum === m.totalCents,
    `invariant: product rollup ($${rollupSum / 100}) = order sum = period total`,
  );
  note(
    m.orders[0].createdAt <= m.orders[m.orders.length - 1].createdAt,
    "counted orders read oldest-first",
  );
}

// ---------- 2. structural cost-absence ----------
console.log("\n--- structural: the customer copy cannot carry cost ---");
{
  // Deliberately FAT input: internal lines, cost attached, fed to the CUSTOMER
  // builder. Field-by-field projection must drop them at runtime.
  const fat = [
    order({
      orderId: "o-fat",
      lines: [line({ costCents: 600 }), line({ sku: "F-2", name: "Halloumi", costCents: 700 })],
      totalCents: 4000,
    }),
  ];
  const m = buildCustomerStatement({ ...common, orders: fat });
  const json = JSON.stringify(m).toLowerCase();
  note(
    m.internal === false && !/cost|profit|margin/.test(json),
    "cost-carrying lines fed to the customer builder → NO cost/profit/margin key or value survives",
  );
  note(
    Object.keys(m.orders[0].lines[0]).length === 8 && !("costCents" in m.orders[0].lines[0]),
    "projected line has exactly the 8 snapshot fields, costCents absent (not null — absent)",
  );

  const internal = buildInternalStatement({ ...common, orders: fat });
  note(
    internal.internal === true && internal.title.includes("INTERNAL"),
    "internal model is marked INTERNAL in its title (banner + watermark in the renderer)",
  );
  note(
    internal.orders[0].lines[0].costCents === 600 &&
      internal.orders[0].lines[0].lineProfitCents === 2000 - 2 * 600,
    "internal line carries unit cost and profit derived from the SAME qty/line total",
  );
}

// ---------- 3. the two copies agree ----------
console.log("\n--- agreement: same orders, same totals, only the columns differ ---");
{
  const withCost = [
    order({ orderId: "o-1", status: "confirmed", totalCents: 2000, lines: [line({ costCents: 600 })] }),
    order({
      orderId: "o-2",
      status: "completed",
      createdAt: "2026-06-20T12:00:00Z",
      totalCents: 3000,
      lines: [line({ sku: "F-3", name: "Olives", qty: 3, lineTotalCents: 3000, costCents: null })],
    }),
    order({ orderId: "o-3", status: "cancelled", totalCents: 700, lines: [line({ costCents: 600 })] }),
    order({ orderId: "o-4", status: "new", totalCents: 800, lines: [line({ costCents: 600 })] }),
  ];
  // The customer copy from the SAME data with costs stripped at the source.
  const stripped = withCost.map((o) => ({
    ...o,
    lines: o.lines.map((l) => {
      const copy = { ...l };
      delete copy.costCents;
      return copy;
    }),
  }));
  const cust = buildCustomerStatement({ ...common, orders: stripped });
  const int = buildInternalStatement({ ...common, orders: withCost });

  const shared = (m) => ({
    orderCount: m.orderCount,
    totalCents: m.totalCents,
    orders: m.orders.map((o) => ({
      orderId: o.orderId,
      documentNumber: o.documentNumber,
      createdAt: o.createdAt,
      status: o.status,
      totalCents: o.totalCents,
      lines: o.lines.map((l) => ({
        sku: l.sku,
        name: l.name,
        qty: l.qty,
        unitPriceCents: l.unitPriceCents,
        lineTotalCents: l.lineTotalCents,
      })),
    })),
    products: m.products.map((p) => ({ sku: p.sku, qty: p.qty, amountCents: p.amountCents })),
    awaiting: m.awaiting,
    cancelled: m.cancelled,
    periodLabel: m.periodLabel,
    isEmpty: m.isEmpty,
  });
  note(
    JSON.stringify(shared(cust)) === JSON.stringify(shared(int)),
    "EVERY shared figure is identical between the customer copy and my copy",
  );
  note(
    int.totalProfitCents === 2000 - 2 * 600 && int.totalCostCents === 1200,
    "internal totals cover only costed lines: cost $12.00, profit $8.00",
  );
  note(
    int.linesWithoutCost === 1 && int.costWarning !== null && int.costWarning.includes("1 of 2"),
    "missing cost is reported PROMINENTLY, not hidden: profit is flagged as partial",
  );
  note(
    Math.abs(int.marginPct - (800 / 2000) * 100) < 0.001,
    "margin uses the COSTED revenue as the denominator — 40.0%, not a diluted figure",
  );
  const allCosted = buildInternalStatement({
    ...common,
    orders: [order({ orderId: "o-1", lines: [line({ costCents: 600 })] })],
  });
  note(allCosted.costWarning === null, "no warning when every line has a recorded cost");
}

// ---------- 4. empty + truncation ----------
console.log("\n--- empty period and the visible cap (D-S1, D-S7) ---");
{
  const empty = buildCustomerStatement({ ...common, orders: [], periodLabel: "This month" });
  note(
    empty.isEmpty && empty.emptyNotice.includes("This month") && empty.emptyNotice.includes("All time"),
    `empty statement names the computed period and offers to widen it: "${empty.emptyNotice.slice(0, 60)}…"`,
  );
  note(empty.totalCents === 0 && empty.orders.length === 0, "empty statement totals zero, no invented balance");
  const capped = buildCustomerStatement({ ...common, orders: [order()], truncated: true });
  note(
    capped.truncationNotice !== null && capped.truncationNotice.includes(String(MAX_STATEMENT_ORDERS)),
    "truncation is stated ON the document, including that the totals are partial",
  );
  note(
    buildCustomerStatement({ ...common, orders: [order()] }).truncationNotice === null,
    "no notice when nothing was truncated",
  );
  const json = JSON.stringify(buildCustomerStatement({ ...common, orders: [order()] })).toLowerCase();
  note(
    !/balance|owed|paid|payment received/.test(json),
    "no balance/owed/paid anywhere — a statement is not an account ledger",
  );
}

// ---------- 5. LIVE ----------
console.log("\n--- live: boundaries, snapshot, isolation ---");
let aCust, bCust, aUser, bUser, prod;
const A = { email: `zzstm-a-${rnd}@example.com`, password: `Test!${rnd}aA9` };
const B = { email: `zzstm-b-${rnd}@example.com`, password: `Test!${rnd}bB9` };
const made = [];
try {
  const { data: p } = await svc
    .from("products")
    .insert({ sku: `ZZSTM-${rnd}`, name: `ZZSTM ${rnd}`, unit: "ea", unit_size: "1", list_price_cents: 1000, is_active: true })
    .select("id")
    .single();
  prod = p.id;

  for (const [acct, setC, setU] of [
    [A, (v) => (aCust = v), (v) => (aUser = v)],
    [B, (v) => (bCust = v), (v) => (bUser = v)],
  ]) {
    const { data: u, error: ue } = await svc.auth.admin.createUser({
      email: acct.email,
      password: acct.password,
      email_confirm: true,
    });
    if (ue) throw ue;
    setU(u.user.id);
    const { data: c } = await svc
      .from("customers")
      .insert({ business_name: `ZZSTM ${acct.email}`, contact_name: "d", email: acct.email, phone: "0", status: "active", user_id: u.user.id })
      .select("id")
      .single();
    setC(c.id);
  }

  const place = async (customerId, qty, status, createdAtISO) => {
    const total = qty * 1000;
    const { data, error } = await svc.rpc("submit_order_atomic", {
      p_customer_id: customerId,
      p_fulfillment: "pickup",
      p_notes: null,
      p_payment_terms: "net-30",
      p_total_cents: total,
      p_client_token: randomUUID(),
      p_lines: [
        {
          product_id: prod,
          name: `ZZSTM ${rnd}`,
          sku: `ZZSTM-${rnd}`,
          unit: "ea",
          unit_size: "1",
          qty,
          base_price_cents: 1000,
          unit_price_cents: 1000,
          applied_offer_title: null,
          was_assigned: true,
          cost_cents: 600,
        },
      ],
    });
    if (error) throw new Error(error.message);
    await svc.from("orders").update({ status, created_at: createdAtISO }).eq("id", data);
    made.push(data);
    return data;
  };

  // June 2026 in Toronto: [Jun 1 00:00, Jul 1 00:00).
  const range = resolveDateRange({ range: "custom", from: "2026-06-01", to: "2026-06-30" });
  const junStart = zonedMidnightUTC({ y: 2026, m: 6, d: 1 });
  const julStart = zonedMidnightUTC({ y: 2026, m: 7, d: 1 });
  note(
    range.startUTC.getTime() === junStart.getTime() && range.endUTC.getTime() === julStart.getTime(),
    "the resolved period is [Jun 1 00:00, Jul 1 00:00) Toronto — end day fully inclusive",
  );

  const idIn = await place(aCust, 3, "completed", "2026-06-15T16:00:00Z");
  const idEdgeStart = await place(aCust, 2, "confirmed", junStart.toISOString());
  const idEdgeEnd = await place(aCust, 5, "confirmed", julStart.toISOString());
  const idBefore = await place(aCust, 4, "confirmed", "2026-05-20T16:00:00Z");
  const idCancelled = await place(aCust, 1, "cancelled", "2026-06-18T16:00:00Z");
  const idNew = await place(aCust, 1, "new", "2026-06-19T16:00:00Z");
  await place(bCust, 7, "confirmed", "2026-06-16T16:00:00Z");

  // Prices move AFTER the orders — the statement must not.
  await svc.from("products").update({ list_price_cents: 9999 }).eq("id", prod);
  await svc.from("customer_products").upsert({ customer_id: aCust, product_id: prod, price_cents: 8888 });

  // The exact two queries the admin data layer issues (server-only module, so
  // the shape is replicated here rather than imported).
  const readOrders = async (client, customerId) => {
    let q = client
      .from("orders")
      .select(
        "id, status, fulfillment, total_cents, created_at, order_items(product_id, name, sku, unit, unit_size, qty, unit_price_cents, line_total_cents, applied_offer_title)",
      )
      .gte("created_at", range.startUTC.toISOString())
      .lt("created_at", range.endUTC.toISOString());
    if (customerId) q = q.eq("customer_id", customerId);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(MAX_STATEMENT_ORDERS + 1);
    if (error) throw new Error(error.message);
    return data ?? [];
  };
  const toInput = (rows, costs) =>
    rows.map((r) => ({
      orderId: r.id,
      status: r.status,
      createdAt: r.created_at,
      fulfillment: r.fulfillment,
      totalCents: r.total_cents,
      lines: r.order_items.map((i) => {
        const base = {
          name: i.name,
          sku: i.sku,
          unit: i.unit,
          unitSize: i.unit_size,
          qty: i.qty,
          unitPriceCents: i.unit_price_cents,
          lineTotalCents: i.line_total_cents,
          appliedOfferTitle: i.applied_offer_title,
        };
        return costs ? { ...base, costCents: costs.get(`${r.id}:${i.product_id}`) ?? null } : base;
      }),
    }));

  const rows = await readOrders(svc, aCust);
  const ids = rows.map((r) => r.id);
  note(
    ids.includes(idIn) && ids.includes(idEdgeStart) && ids.includes(idCancelled) && ids.includes(idNew),
    "BOUNDARY: an order at the first instant of the period is INCLUDED",
  );
  note(
    !ids.includes(idEdgeEnd) && !ids.includes(idBefore),
    "BOUNDARY: an order at the exclusive end instant (Jul 1 00:00) is EXCLUDED, as is one before the period",
  );

  const { data: costRows } = await svc
    .from("order_item_costs")
    .select("order_id, product_id, cost_cents")
    .in("order_id", ids);
  const costMap = new Map((costRows ?? []).map((c) => [`${c.order_id}:${c.product_id}`, c.cost_cents]));

  const custModel = buildCustomerStatement({
    ...common,
    orders: toInput(rows, null),
    periodLabel: range.label,
  });
  const intModel = buildInternalStatement({
    ...common,
    orders: toInput(rows, costMap),
    periodLabel: range.label,
  });

  note(
    custModel.orderCount === 2 && custModel.totalCents === 5000,
    "live period totals: 2 counted orders (3 units + 2 units) = $50.00; cancelled and new excluded",
  );
  note(
    custModel.orders.every((o) => o.lines.every((l) => l.unitPriceCents === 1000)) &&
      custModel.totalCents === 5000,
    "SNAPSHOT NOT RECOMPUTE: list price → $99.99 and customer price → $88.88 AFTER the orders; the statement still says $10.00/unit, $50.00 total",
  );
  note(
    custModel.products.length === 1 && custModel.products[0].qty === 5 && custModel.products[0].amountCents === 5000,
    "product rollup across orders: 5 units, $50.00 — 'what they took' in one row",
  );
  note(
    custModel.cancelled.length === 1 && custModel.awaiting.length === 1,
    "the cancelled and not-yet-accepted orders are listed for context",
  );
  note(
    !/cost|profit|margin/.test(JSON.stringify(custModel).toLowerCase()),
    "live customer statement carries no cost trace (the 600¢ snapshots never enter)",
  );
  note(
    intModel.totalCostCents === 3000 && intModel.totalProfitCents === 2000 && intModel.linesWithoutCost === 0,
    "live internal copy: cost $30.00, profit $20.00 over the SAME $50.00 the customer sees",
  );
  note(
    intModel.totalCents === custModel.totalCents && intModel.orderCount === custModel.orderCount,
    "live: both copies report the same period total and order count",
  );

  // Isolation — the portal read has NO customer filter; RLS is the boundary.
  const asB = createClient(URL, ANON, { auth: { persistSession: false } });
  {
    const { error } = await asB.auth.signInWithPassword({ email: B.email, password: B.password });
    if (error) throw error;
  }
  const bRows = await readOrders(asB, null);
  note(
    bRows.length === 1 && !bRows.some((r) => ids.includes(r.id)),
    "ISOLATION: customer B's own statement read returns only B's order — none of A's",
  );
  const asA = createClient(URL, ANON, { auth: { persistSession: false } });
  {
    const { error } = await asA.auth.signInWithPassword({ email: A.email, password: A.password });
    if (error) throw error;
  }
  const aRows = await readOrders(asA, null);
  const aSelf = buildCustomerStatement({ ...common, orders: toInput(aRows, null), periodLabel: range.label });
  note(
    aSelf.totalCents === custModel.totalCents && aSelf.orderCount === custModel.orderCount,
    "the customer's OWN portal statement matches the copy the admin prints — the identical document",
  );
  const { data: bCostPeek } = await asB.from("order_item_costs").select("cost_cents").limit(1);
  note(
    !bCostPeek || bCostPeek.length === 0,
    "a customer session reading the order cost table directly gets nothing (deny-all RLS)",
  );
} catch (e) {
  console.log("ERROR:", e.message);
  pass = false;
} finally {
  for (const id of made) await svc.from("orders").delete().eq("id", id);
  if (aCust) await svc.from("customer_products").delete().eq("customer_id", aCust);
  if (prod) await svc.from("products").delete().eq("id", prod);
  if (aCust) await svc.from("customers").delete().eq("id", aCust);
  if (bCust) await svc.from("customers").delete().eq("id", bCust);
  if (aUser) await svc.auth.admin.deleteUser(aUser);
  if (bUser) await svc.auth.admin.deleteUser(bUser);
  console.log("\nteardown complete (test orders, product, customers, auth users removed)");
  console.log(pass ? "\n=== STATEMENTS TEST: PASS ===" : "\n=== STATEMENTS TEST: failures above ===");
  process.exit(pass ? 0 : 1);
}
