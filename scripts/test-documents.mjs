// CP-6 documents test — proves the document layer's money guarantees:
//   1. Invoice figures come from the STORED SNAPSHOT, never recomputed: after
//      the order, current prices change — the model doesn't move by a cent.
//   2. NO cost/profit on any customer-facing document — STRUCTURAL scan of
//      the serialized invoice model (no cost-like key or value can appear).
//   3. The INTERNAL toggle genuinely gates: includeCosts=false → cost keys
//      absent from the model entirely; true → present + internal marking.
//   4. The portal invoice path cannot fetch another customer's order (same
//      session read as the order screen; RLS decides).
//   5. Cancelled orders build with the watermark flag; tax stays DORMANT
//      (null) while disabled and flows only when enabled; the integrity
//      check fires on a total/lines mismatch; empty statements are valid.
//
//   node --experimental-strip-types scripts/test-documents.mjs   (npm run test:documents)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { buildInvoiceModel } from "../src/lib/documents/invoice-model.ts";
import {
  buildProductStatementModel,
  buildLowStockStatementModel,
  buildUnavailableStatementModel,
} from "../src/lib/documents/statement-models.ts";

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
const BILL_TO = {
  businessName: "Test Diner",
  contactName: "T",
  email: "t@example.com",
  phone: "0",
};
const line = (over = {}) => ({
  name: "Feta", sku: "F-1", unit: "case", unitSize: "4 lb",
  qty: 2, unitPriceCents: 1000, lineTotalCents: 2000, appliedOfferTitle: null, ...over,
});
const source = (over = {}) => ({
  orderId: "aaaaaaaa-0000-0000-0000-000000000000",
  status: "confirmed", fulfillment: "pickup", createdAt: "2026-07-01T12:00:00Z",
  paymentTerms: "net-30", notes: null, totalCents: 2000, lines: [line()], ...over,
});

// ---------- 1. pure invoice model ----------
console.log("--- pure invoice model (tax dormant, integrity, cancelled) ---");
{
  const m = buildInvoiceModel({ source: source(), business: BUSINESS, billTo: BILL_TO });
  note(m.subtotalCents === 2000 && m.totalCents === 2000 && m.integrityWarning === null,
    "subtotal/total from the snapshot lines, integrity clean");
  note(m.taxCents === null, "tax DORMANT: taxCents null while business.taxEnabled=false");
  note(m.documentNumber === "Order #aaaaaaaa", "document number = Order #<8 chars> (D-C5)");
  const withTaxOff = buildInvoiceModel({
    source: source({ taxCents: 260 }), business: BUSINESS, billTo: BILL_TO,
  });
  note(withTaxOff.taxCents === null,
    "even a source tax snapshot stays hidden while the business flag is off");
  const withTaxOn = buildInvoiceModel({
    source: source({ taxCents: 260, totalCents: 2260 }),
    business: { ...BUSINESS, taxEnabled: true, taxNumber: "TBD" },
    billTo: BILL_TO,
  });
  note(withTaxOn.taxCents === 260 && withTaxOn.totalCents === 2260 && withTaxOn.integrityWarning === null,
    "when enabled, the tax snapshot flows: subtotal 2000 + tax 260 = total 2260");
  const cancelled = buildInvoiceModel({
    source: source({ status: "cancelled" }), business: BUSINESS, billTo: BILL_TO,
  });
  note(cancelled.cancelled === true, "cancelled order → watermark flag set (D-C4)");
  const bad = buildInvoiceModel({
    source: source({ totalCents: 9999 }), business: BUSINESS, billTo: BILL_TO,
  });
  note(bad.integrityWarning !== null, "total/lines mismatch raises the integrity warning");
}

// ---------- 2. structural cost-absence on the customer document ----------
console.log("\n--- structural scans ---");
{
  const m = buildInvoiceModel({ source: source(), business: BUSINESS, billTo: BILL_TO });
  const json = JSON.stringify(m).toLowerCase();
  note(!/cost|profit|margin/.test(json),
    "invoice model serialization contains NO cost/profit/margin key or value");
}
{
  const inputs = [{
    sku: "F-1", name: "Feta", categoryLabel: "Dairy", unit: "case", unitSize: "4 lb",
    listPriceCents: 1000, isActive: true, isAvailable: true,
    stockQty: -3, lowStockThreshold: 2, costCents: 600,
  }];
  const safe = buildProductStatementModel(inputs, { includeCosts: false, periodLabel: "All time" });
  note(safe.internal === false && !/costcents|profit/.test(JSON.stringify(safe).toLowerCase()),
    "includeCosts=false → cost keys ABSENT from the model (not hidden — absent)");
  note(safe.lines[0].stockLabel.includes("OVERSOLD BY 3"),
    `severity is TEXT, legible in B&W: "${safe.lines[0].stockLabel}"`);
  const internal = buildProductStatementModel(inputs, { includeCosts: true, periodLabel: "All time" });
  note(internal.internal === true && internal.title.includes("INTERNAL")
    && internal.lines[0].costCents === 600 && internal.lines[0].profitAtListCents === 400,
    "includeCosts=true → internal-marked model with cost + profit-at-list");
  const empty = buildProductStatementModel([], { includeCosts: false, periodLabel: "This month" });
  note(empty.lines.length === 0 && empty.periodLabel === "This month",
    "empty statement is a valid model with its period stated");
}
{
  const low = buildLowStockStatementModel(
    [
      { sku: "A", name: "Oversold", stockQty: -4, lowStockThreshold: 2 },
      { sku: "B", name: "Out", stockQty: 0, lowStockThreshold: 2 },
      { sku: "C", name: "Low", stockQty: 2, lowStockThreshold: 3 },
    ],
    new Date("2026-07-01T12:00:00Z"),
  );
  note(low.lines[0].severity === "OVERSOLD BY 4" && low.lines[1].severity === "OUT OF STOCK"
    && low.lines[2].severity === "LOW",
    "low-stock severities in words, input (oversold-first) order preserved");
  const un = buildUnavailableStatementModel(
    [
      { sku: "X", name: "Dead", categoryLabel: null, unit: "ea", unitSize: "1", listPriceCents: 1, isActive: true, isAvailable: false, stockQty: 0, lowStockThreshold: 0, costCents: null },
      { sku: "Y", name: "Fine", categoryLabel: null, unit: "ea", unitSize: "1", listPriceCents: 1, isActive: true, isAvailable: true, stockQty: 5, lowStockThreshold: 0, costCents: null },
    ],
    new Date(),
  );
  note(un.lines.length === 1 && un.lines[0].sku === "X",
    "unavailable statement includes only active+unavailable products");
}

// ---------- 3+4. LIVE: snapshot-not-recompute + portal isolation ----------
console.log("\n--- live: figures frozen after price changes; portal isolation ---");
let aCust, bCust, aUser, bUser, prod, orderId;
const A = { email: `zzdoc-a-${rnd}@example.com`, password: `Test!${rnd}aA9` };
const B = { email: `zzdoc-b-${rnd}@example.com`, password: `Test!${rnd}bB9` };
try {
  const { data: p } = await svc.from("products")
    .insert({ sku: `ZZDOC-${rnd}`, name: `ZZDOC ${rnd}`, unit: "ea", unit_size: "1", list_price_cents: 1000, is_active: true })
    .select("id").single();
  prod = p.id;
  for (const [acct, setC, setU] of [
    [A, (v) => (aCust = v), (v) => (aUser = v)],
    [B, (v) => (bCust = v), (v) => (bUser = v)],
  ]) {
    const { data: u, error: ue } = await svc.auth.admin.createUser({
      email: acct.email, password: acct.password, email_confirm: true,
    });
    if (ue) throw ue;
    setU(u.user.id);
    const { data: c } = await svc.from("customers")
      .insert({ business_name: `ZZDOC ${acct.email}`, contact_name: "d", email: acct.email, phone: "0", status: "active", user_id: u.user.id })
      .select("id").single();
    setC(c.id);
  }
  {
    const { data, error } = await svc.rpc("submit_order_atomic", {
      p_customer_id: aCust, p_fulfillment: "pickup", p_notes: "doc test", p_payment_terms: "net-30",
      p_total_cents: 2000, p_client_token: randomUUID(),
      p_lines: [{ product_id: prod, name: `ZZDOC ${rnd}`, sku: `ZZDOC-${rnd}`, unit: "ea", unit_size: "1", qty: 2, base_price_cents: 1000, unit_price_cents: 1000, applied_offer_title: null, was_assigned: true, cost_cents: 600 }],
    });
    if (error) throw new Error(error.message);
    orderId = data;
  }
  // Prices move AFTER the order — the invoice must not.
  await svc.from("products").update({ list_price_cents: 9999 }).eq("id", prod);
  await svc.from("customer_products").upsert({ customer_id: aCust, product_id: prod, price_cents: 8888 });

  const fetchOrderRows = async (client) => {
    const { data } = await client
      .from("orders")
      .select("id, status, fulfillment, notes, payment_terms_snapshot, total_cents, created_at, order_items(name, sku, unit, unit_size, qty, unit_price_cents, applied_offer_title, line_total_cents)")
      .eq("id", orderId)
      .maybeSingle();
    return data;
  };
  const row = await fetchOrderRows(svc);
  const model = buildInvoiceModel({
    business: BUSINESS,
    billTo: BILL_TO,
    source: {
      orderId: row.id, status: row.status, fulfillment: row.fulfillment,
      createdAt: row.created_at, paymentTerms: row.payment_terms_snapshot,
      notes: row.notes, totalCents: row.total_cents,
      lines: row.order_items.map((i) => ({
        name: i.name, sku: i.sku, unit: i.unit, unitSize: i.unit_size, qty: i.qty,
        unitPriceCents: i.unit_price_cents, lineTotalCents: i.line_total_cents,
        appliedOfferTitle: i.applied_offer_title,
      })),
    },
  });
  note(model.lines[0].unitPriceCents === 1000 && model.totalCents === 2000 && model.integrityWarning === null,
    `SNAPSHOT NOT RECOMPUTE: list price → $99.99 and customer price → $88.88 AFTER the order; the invoice still says $10.00 × 2 = $20.00`);
  note(!/cost|profit|margin/.test(JSON.stringify(model).toLowerCase()),
    "live invoice model carries no cost trace (the 600¢ snapshot never enters)");

  // Portal isolation: B's session runs the same read the portal invoice uses.
  const asB = createClient(URL, ANON, { auth: { persistSession: false } });
  {
    const { error } = await asB.auth.signInWithPassword({ email: B.email, password: B.password });
    if (error) throw error;
  }
  const bSees = await fetchOrderRows(asB);
  note(bSees === null, "customer B fetching A's invoice order id → null (RLS decides ownership)");
  const asA = createClient(URL, ANON, { auth: { persistSession: false } });
  {
    const { error } = await asA.auth.signInWithPassword({ email: A.email, password: A.password });
    if (error) throw error;
  }
  const aSees = await fetchOrderRows(asA);
  note(aSees != null && aSees.total_cents === 2000, "customer A fetches their own invoice data fine");

  await svc.from("orders").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", orderId);
  const cancelledRow = await fetchOrderRows(svc);
  note(cancelledRow.status === "cancelled", "cancelled order still fetches for printing (record, not claim)");
} catch (e) {
  console.log("ERROR:", e.message);
  pass = false;
} finally {
  if (aCust) await svc.from("orders").delete().eq("customer_id", aCust);
  if (bCust) await svc.from("orders").delete().eq("customer_id", bCust);
  if (prod) await svc.from("products").delete().eq("id", prod);
  if (aCust) await svc.from("customers").delete().eq("id", aCust);
  if (bCust) await svc.from("customers").delete().eq("id", bCust);
  if (aUser) await svc.auth.admin.deleteUser(aUser);
  if (bUser) await svc.auth.admin.deleteUser(bUser);
  console.log("\nteardown complete (test order, product, customers, auth users removed)");
  console.log(pass ? "\n=== DOCUMENTS TEST: PASS ===" : "\n=== DOCUMENTS TEST: failures above ===");
  process.exit(pass ? 0 : 1);
}
