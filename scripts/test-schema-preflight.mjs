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
