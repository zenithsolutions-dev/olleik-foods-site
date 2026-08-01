// SCHEMA PREFLIGHT — asserts the live DB has every column, constraint value,
// and index the deployed code depends on. Catches partial-migration drift
// (the class of failure suspected in the 2026-07-30 production incident).
// All probes are BEHAVIORAL (insert attempts on throwaway rows, named-constraint
// rejections) so they verify the EFFECTIVE schema, not a dashboard rendering —
// dashboard constraint displays truncate long definitions and can mislead.
// Provisions throwaway rows, tears everything down, exits 1 listing failures.
//
//   node scripts/test-schema-preflight.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const failures = [];
const pass = (n) => console.log(`  PASS  ${n}`);
const fail = (n, detail) => {
  failures.push(`${n}${detail ? ` — ${detail}` : ""}`);
  console.log(`  FAIL  ${n}${detail ? ` — ${detail}` : ""}`);
};

// ---------- 1. columns the code selects/writes (0006 + 0007) ----------
const columnChecks = [
  ["products", "id, sku, name, category_id, unit, unit_size, list_price_cents, image_url, is_active"],
  ["categories", "id, name, parent_id"],
  ["customers", "id, business_name, status"],
  ["customer_products", "customer_id, product_id, price_cents"],
  ["product_costs", "product_id, cost_cents, updated_at"],
  ["pricing_rules", "id, scope, category_id, customer_id, product_id, margin_percent, is_priority, is_active, created_at, updated_at"],
  ["customer_product_pricing_meta", "customer_id, product_id, price_source, margin_percent, rule_scope, is_priority, computed_at"],
];
for (const [table, cols] of columnChecks) {
  const { error } = await admin.from(table).select(cols).limit(1);
  if (error) fail(`columns: ${table}(${cols.split(",").length} cols)`, `${error.code} ${error.message.slice(0, 80)}`);
  else pass(`columns: ${table} — all ${cols.split(",").length} code-referenced columns exist`);
}

// ---------- 2. constraint behavior (throwaway rows) ----------
let probeProduct = null;
let probeCustomer = null;
try {
  const { data: p, error: pErr } = await admin
    .from("products")
    .insert({ sku: `QA-PREFLIGHT-${Date.now()}`, name: "QA schema preflight", unit: "ea", unit_size: "1", list_price_cents: 1000, is_active: false })
    .select("id")
    .single();
  if (pErr) throw new Error(`cannot provision probe product: ${pErr.message}`);
  probeProduct = p.id;
  const { data: c } = await admin.from("customers").select("id").limit(1).maybeSingle();
  probeCustomer = c?.id ?? null;

  // expectAccept / expectNamedReject helpers
  const tryInsert = async (row) => (await admin.from("pricing_rules").insert(row).select("id").maybeSingle());
  const cleanRule = async () => admin.from("pricing_rules").delete().eq("product_id", probeProduct);

  // scope check accepts 'product'
  {
    const { data, error } = await tryInsert({ scope: "product", product_id: probeProduct, margin_percent: 1, is_priority: false, is_active: false });
    if (error) fail("pricing_rules_scope_check accepts scope='product'", `${error.code} ${error.message.slice(0, 90)}`);
    else pass("pricing_rules_scope_check accepts scope='product'");
    // one_per_product unique index
    if (data) {
      const dup = await tryInsert({ scope: "product", product_id: probeProduct, margin_percent: 2 });
      if (dup.error?.code === "23505" && dup.error.message.includes("pricing_rules_one_per_product"))
        pass("pricing_rules_one_per_product unique index enforced");
      else fail("pricing_rules_one_per_product unique index enforced", dup.error ? `${dup.error.code} ${dup.error.message.slice(0, 90)}` : "duplicate was ACCEPTED");
      if (dup.data) await admin.from("pricing_rules").delete().eq("id", dup.data.id);
    }
    await cleanRule();
  }
  // scope check rejects unknown values
  {
    const { data, error } = await tryInsert({ scope: "bogus", margin_percent: 1 });
    if (error?.code === "23514") pass(`scope check rejects unknown scopes (via ${error.message.match(/"([^"]+)"\s*$/)?.[1] ?? "check"})`);
    else fail("scope check rejects unknown scopes", data ? "'bogus' was ACCEPTED" : `${error?.code}`);
    if (data) await admin.from("pricing_rules").delete().eq("id", data.id);
  }
  // shape check: product without product_id
  {
    const { data, error } = await tryInsert({ scope: "product", margin_percent: 1 });
    if (error?.code === "23514") pass("pricing_rules_scope_shape enforces product_id for scope='product'");
    else fail("pricing_rules_scope_shape enforces product_id for scope='product'", data ? "ACCEPTED without product_id" : `${error?.code}`);
    if (data) await admin.from("pricing_rules").delete().eq("id", data.id);
  }
  // priority check: allows product, rejects customer
  {
    const ok = await tryInsert({ scope: "product", product_id: probeProduct, margin_percent: 1, is_priority: true, is_active: false });
    if (ok.error) fail("pricing_rules_priority_scope allows is_priority on scope='product'", `${ok.error.code} ${ok.error.message.slice(0, 90)}`);
    else pass("pricing_rules_priority_scope allows is_priority on scope='product'");
    await cleanRule();
    const bad = await tryInsert({ scope: "customer", customer_id: "00000000-0000-0000-0000-000000000001", margin_percent: 1, is_priority: true });
    if (bad.error?.code === "23514") pass("pricing_rules_priority_scope rejects is_priority on scope='customer'");
    else fail("pricing_rules_priority_scope rejects is_priority on scope='customer'", bad.data ? "ACCEPTED" : `${bad.error?.code}`);
    if (bad.data) await admin.from("pricing_rules").delete().eq("id", bad.data.id);
  }

  // meta rule_scope accepts 'product', rejects unknown (needs a cp row)
  if (probeCustomer) {
    await admin.from("customer_products").upsert({ customer_id: probeCustomer, product_id: probeProduct, price_cents: null }, { onConflict: "customer_id,product_id" });
    const metaTry = async (rule_scope) =>
      admin.from("customer_product_pricing_meta").upsert(
        { customer_id: probeCustomer, product_id: probeProduct, price_source: "computed", margin_percent: 1, rule_scope, is_priority: false, computed_at: new Date().toISOString() },
        { onConflict: "customer_id,product_id" },
      );
    const okMeta = await metaTry("product");
    if (okMeta.error) fail("meta rule_scope check accepts 'product'", `${okMeta.error.code} ${okMeta.error.message.slice(0, 90)}`);
    else pass("meta rule_scope check accepts 'product'");
    const badMeta = await metaTry("bogus");
    if (badMeta.error?.code === "23514") pass("meta rule_scope check rejects unknown values");
    else fail("meta rule_scope check rejects unknown values", badMeta.error ? `${badMeta.error.code}` : "'bogus' ACCEPTED");
  } else {
    fail("meta rule_scope probes", "no customer row available to attach a probe assignment");
  }

  // ---------- 3. the autopilot's embedded join shape ----------
  const { error: joinErr } = await admin
    .from("customer_products")
    .select("customer_id, product_id, price_cents, customers(business_name), products(name, list_price_cents, category_id)")
    .limit(1);
  if (joinErr) fail("recompute join (customer_products→customers,products)", `${joinErr.code} ${joinErr.message.slice(0, 90)}`);
  else pass("recompute join (customer_products→customers,products) resolves");

  // ---------- 4. CP-2 visibility schema (0008) ----------
  // Pre-migration this is a WARN, not a FAIL: the deployed CP-2 code degrades
  // safely (admin card shows a run-migration notice; portal behaves as
  // assigned-only). Once visibility_mode exists, everything below must hold.
  const visProbe = await admin.from("customers").select("visibility_mode").limit(1);
  if (visProbe.error) {
    console.log("  WARN  0008 not applied yet — CP-2 visibility checks skipped (code degrades to assigned-only). Run 0008.");
  } else {
    pass("columns: customers.visibility_mode exists");
    // Dedicated probe customer — never mutate a real customer's mode.
    const { data: pc, error: pcErr } = await admin
      .from("customers")
      .insert({ business_name: `ZZ-PREFLIGHT-${Date.now()}`, contact_name: "QA", email: `zzpre-${Date.now()}@example.com`, phone: "000", status: "pending" })
      .select("id, visibility_mode")
      .single();
    if (pcErr) {
      fail("visibility probe customer", `${pcErr.code} ${pcErr.message.slice(0, 90)}`);
    } else {
      try {
        if (pc.visibility_mode === "assigned") pass("customers.visibility_mode defaults to 'assigned'");
        else fail("customers.visibility_mode defaults to 'assigned'", `got '${pc.visibility_mode}'`);

        const okMode = await admin.from("customers").update({ visibility_mode: "all" }).eq("id", pc.id);
        if (okMode.error) fail("visibility_mode check accepts 'all'", `${okMode.error.code} ${okMode.error.message.slice(0, 90)}`);
        else pass("visibility_mode check accepts 'all'");
        const badMode = await admin.from("customers").update({ visibility_mode: "bogus" }).eq("id", pc.id);
        if (badMode.error?.code === "23514") pass("customers_visibility_mode_check rejects unknown modes");
        else fail("customers_visibility_mode_check rejects unknown modes", badMode.error ? `${badMode.error.code}` : "'bogus' ACCEPTED");

        // customer_visible_categories: insert + composite-PK duplicate rejection
        const { data: cat } = await admin.from("categories").select("id").limit(1).maybeSingle();
        if (cat) {
          const ins = await admin.from("customer_visible_categories").insert({ customer_id: pc.id, category_id: cat.id });
          if (ins.error) fail("customer_visible_categories insert", `${ins.error.code} ${ins.error.message.slice(0, 90)}`);
          else {
            pass("customer_visible_categories insert accepted");
            const dup = await admin.from("customer_visible_categories").insert({ customer_id: pc.id, category_id: cat.id });
            if (dup.error?.code === "23505") pass("customer_visible_categories composite PK rejects duplicates");
            else fail("customer_visible_categories composite PK rejects duplicates", dup.error ? `${dup.error.code}` : "duplicate ACCEPTED");
          }
        } else {
          fail("customer_visible_categories probes", "no category row available");
        }

        // customer_hidden_products: insert + FK to products
        if (probeProduct) {
          const insH = await admin.from("customer_hidden_products").insert({ customer_id: pc.id, product_id: probeProduct });
          if (insH.error) fail("customer_hidden_products insert", `${insH.error.code} ${insH.error.message.slice(0, 90)}`);
          else pass("customer_hidden_products insert accepted");
          const badH = await admin.from("customer_hidden_products").insert({ customer_id: pc.id, product_id: "00000000-0000-0000-0000-000000000001" });
          if (badH.error?.code === "23503") pass("customer_hidden_products FK rejects unknown product ids");
          else fail("customer_hidden_products FK rejects unknown product ids", badH.error ? `${badH.error.code}` : "ACCEPTED");
        } else {
          fail("customer_hidden_products probes", "no probe product available");
        }
      } finally {
        // customers delete cascades cvc + chp probe rows
        await admin.from("customers").delete().eq("id", pc.id);
      }
    }
  }

  // ---------- 5. CP-3a orders schema (0009) ----------
  // Pre-migration this is a WARN, not a FAIL: the deployed CP-3a code degrades
  // safely (portal shows no orders; admin inbox shows a run-migration notice;
  // submission returns "not enabled yet"). Once orders exists, everything
  // below must hold.
  const ordProbe = await admin.from("orders").select("id").limit(1);
  if (ordProbe.error) {
    console.log("  WARN  0009 not applied yet — CP-3a order checks skipped (ordering disabled until you run it). Run 0009.");
  } else {
    const ordColumns = [
      ["orders", "id, customer_id, status, fulfillment, notes, payment_terms_snapshot, total_cents, client_token, admin_note, created_at, confirmed_at, completed_at, cancelled_at"],
      ["order_items", "order_id, product_id, name, sku, unit, unit_size, qty, base_price_cents, unit_price_cents, applied_offer_title, was_assigned, line_total_cents"],
      ["order_item_costs", "order_id, product_id, cost_cents"],
    ];
    for (const [table, cols] of ordColumns) {
      const { error } = await admin.from(table).select(cols).limit(1);
      if (error) fail(`columns: ${table}(${cols.split(",").length} cols)`, `${error.code} ${error.message.slice(0, 80)}`);
      else pass(`columns: ${table} — all ${cols.split(",").length} code-referenced columns exist`);
    }

    // Behavioral constraint probes on a throwaway customer + the probe product.
    const { data: oc, error: ocErr } = await admin
      .from("customers")
      .insert({ business_name: `ZZ-PREFLIGHT-ORD-${Date.now()}`, contact_name: "QA", email: `zzpreord-${Date.now()}@example.com`, phone: "000", status: "active" })
      .select("id")
      .single();
    if (ocErr) {
      fail("order probe customer", `${ocErr.code} ${ocErr.message.slice(0, 90)}`);
    } else {
      try {
        const baseOrder = () => ({
          customer_id: oc.id, status: "new", fulfillment: "pickup",
          payment_terms_snapshot: "net-30", total_cents: 0,
          client_token: crypto.randomUUID(),
        });
        const okIns = await admin.from("orders").insert(baseOrder()).select("id").single();
        if (okIns.error) fail("orders insert (service role)", `${okIns.error.code} ${okIns.error.message.slice(0, 90)}`);
        else pass("orders insert accepted for valid status/fulfillment");
        const badS = await admin.from("orders").insert({ ...baseOrder(), status: "bogus" }).select("id");
        if (badS.error?.code === "23514") pass("orders_status_check rejects unknown statuses");
        else fail("orders_status_check rejects unknown statuses", badS.error ? `${badS.error.code}` : "'bogus' ACCEPTED");
        if (badS.data?.[0]) await admin.from("orders").delete().eq("id", badS.data[0].id);
        const badF = await admin.from("orders").insert({ ...baseOrder(), fulfillment: "bogus" }).select("id");
        if (badF.error?.code === "23514") pass("orders_fulfillment_check rejects unknown fulfillment");
        else fail("orders_fulfillment_check rejects unknown fulfillment", badF.error ? `${badF.error.code}` : "'bogus' ACCEPTED");
        if (badF.data?.[0]) await admin.from("orders").delete().eq("id", badF.data[0].id);

        if (okIns.data && probeProduct) {
          const badMath = await admin.from("order_items").insert({
            order_id: okIns.data.id, product_id: probeProduct, name: "x", sku: "x", unit: "ea", unit_size: "1",
            qty: 2, base_price_cents: 100, unit_price_cents: 100, was_assigned: false, line_total_cents: 1,
          });
          if (badMath.error?.code === "23514") pass("order_items_line_math_check enforces line_total = qty*price");
          else fail("order_items_line_math_check enforces line_total = qty*price", badMath.error ? `${badMath.error.code}` : "ACCEPTED");
          const badQty = await admin.from("order_items").insert({
            order_id: okIns.data.id, product_id: probeProduct, name: "x", sku: "x", unit: "ea", unit_size: "1",
            qty: 0, base_price_cents: 100, unit_price_cents: 100, was_assigned: false, line_total_cents: 0,
          });
          if (badQty.error?.code === "23514") pass("order_items_qty_check rejects qty 0");
          else fail("order_items_qty_check rejects qty 0", badQty.error ? `${badQty.error.code}` : "ACCEPTED");
        }

        // The atomic function exists and validates: an EMPTY line set must be
        // rejected by its line-count guard, proving the function is present
        // and its internal checks run.
        const fn = await admin.rpc("submit_order_atomic", {
          p_customer_id: oc.id, p_fulfillment: "pickup", p_notes: null,
          p_payment_terms: "net-30", p_total_cents: 0,
          p_client_token: crypto.randomUUID(), p_lines: [],
        });
        if (fn.error?.message?.includes("ORDER_LINE_COUNT_OUT_OF_RANGE")) {
          pass("submit_order_atomic exists and enforces its line-count guard");
        } else if (fn.error?.message?.includes("does not exist")) {
          fail("submit_order_atomic exists", "function missing — re-run 0009");
        } else {
          fail("submit_order_atomic exists and enforces its line-count guard", fn.error ? fn.error.message.slice(0, 90) : "empty lines ACCEPTED");
        }
      } finally {
        await admin.from("orders").delete().eq("customer_id", oc.id);
        await admin.from("customers").delete().eq("id", oc.id);
      }
    }
  }

  // ---------- 6. CP-3b inventory schema (0010) ----------
  // Pre-migration this is a WARN, not a FAIL: the deployed CP-3b code degrades
  // safely (everything shows as available; stock fields disabled with a
  // run-migration notice; confirm/cancel fall back to the plain transitions).
  // Once product_inventory exists, everything below must hold.
  const invProbe = await admin.from("product_inventory").select("product_id").limit(1);
  if (invProbe.error) {
    console.log("  WARN  0010 not applied yet — CP-3b inventory checks skipped (stock tracking disabled until you run it). Run 0010.");
  } else {
    const invColumns = [
      ["product_inventory", "product_id, stock_qty, low_stock_threshold, updated_at"],
      ["order_stock_movements", "order_id, product_id, qty_decremented"],
    ];
    for (const [table, cols] of invColumns) {
      const { error } = await admin.from(table).select(cols).limit(1);
      if (error) fail(`columns: ${table}(${cols.split(",").length} cols)`, `${error.code} ${error.message.slice(0, 80)}`);
      else pass(`columns: ${table} — all ${cols.split(",").length} code-referenced columns exist`);
    }
    const availCol = await admin.from("products").select("id, is_available").limit(1);
    if (availCol.error) fail("columns: products.is_available exists", `${availCol.error.code}`);
    else pass("columns: products.is_available exists");
    const sdCol = await admin.from("orders").select("id, stock_decremented_at").limit(1);
    if (sdCol.error) fail("columns: orders.stock_decremented_at exists", `${sdCol.error.code}`);
    else pass("columns: orders.stock_decremented_at exists");

    // Behavioral: CP-3c (0011) makes stock SIGNED — negative = units owed.
    // Pre-0011 the old >= 0 check still rejects, which is a WARN (the deployed
    // signed-inventory code expects negatives to be storable).
    if (probeProduct) {
      const neg = await admin.from("product_inventory")
        .insert({ product_id: probeProduct, stock_qty: -1 });
      if (!neg.error) {
        pass("signed stock: negative stock_qty accepted (0011 applied)");
      } else if (neg.error.code === "23514") {
        console.log("  WARN  0011 not applied yet — stock is still unsigned/clamped (phantom-stock fix inactive). Run 0011.");
      } else {
        fail("signed stock probe", `${neg.error.code} ${neg.error.message.slice(0, 80)}`);
      }
      // Threshold stays physical: negative thresholds must still be rejected.
      const badThr = await admin.from("product_inventory")
        .upsert({ product_id: probeProduct, stock_qty: 5, low_stock_threshold: -1 });
      if (badThr.error?.code === "23514") pass("product_inventory_threshold_check rejects negative thresholds");
      else fail("product_inventory_threshold_check rejects negative thresholds", badThr.error ? `${badThr.error.code}` : "-1 ACCEPTED");
      const okInv = await admin.from("product_inventory")
        .upsert({ product_id: probeProduct, stock_qty: 5, low_stock_threshold: 2 });
      if (okInv.error) fail("product_inventory accepts a valid tracked row", `${okInv.error.code} ${okInv.error.message.slice(0, 80)}`);
      else pass("product_inventory accepts a valid tracked row");
      await admin.from("product_inventory").delete().eq("product_id", probeProduct);
    }

    // The 0010 functions exist and enforce their status guard: a random order
    // id can never be in state 'new', so a well-formed call returns the stale
    // result — proving presence + the guard in one probe.
    const cfn = await admin.rpc("confirm_order_stock", {
      p_order_id: crypto.randomUUID(), p_allow_oversell: false,
    });
    if (cfn.error?.message?.includes("does not exist")) {
      fail("confirm_order_stock exists", "function missing — re-run 0010");
    } else if (!cfn.error && cfn.data?.ok === false && cfn.data?.code === "stale") {
      pass("confirm_order_stock exists and enforces its status guard");
    } else {
      fail("confirm_order_stock exists and enforces its status guard", cfn.error ? cfn.error.message.slice(0, 90) : JSON.stringify(cfn.data).slice(0, 90));
    }
    const xfn = await admin.rpc("cancel_order_with_restock", {
      p_order_id: crypto.randomUUID(), p_admin_note: null,
    });
    if (xfn.error?.message?.includes("does not exist")) {
      fail("cancel_order_with_restock exists", "function missing — re-run 0010");
    } else if (!xfn.error && xfn.data?.ok === false && xfn.data?.code === "stale") {
      pass("cancel_order_with_restock exists and enforces its status guard");
    } else {
      fail("cancel_order_with_restock exists and enforces its status guard", xfn.error ? xfn.error.message.slice(0, 90) : JSON.stringify(xfn.data).slice(0, 90));
    }
  }
} finally {
  if (probeProduct) {
    await admin.from("pricing_rules").delete().eq("product_id", probeProduct);
    await admin.from("products").delete().eq("id", probeProduct); // cascades cp + meta
  }
  console.log("teardown complete.");
}

if (failures.length) {
  console.log(`\n=== SCHEMA PREFLIGHT: FAIL (${failures.length}) ===`);
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log("\n=== SCHEMA PREFLIGHT: PASS — live schema matches everything the code depends on ===");
process.exit(0);
