// LIVE integration probe for the CP-1 waterfall: provisions a throwaway
// category + product + cost + rules, then resolves through the SAME data path
// the app uses (pricing_rules SELECT columns -> toRule mapping -> indexRules ->
// resolveWithIndex). Catches the class of failure unit tests cannot: a rule
// that exists in the DB but never reaches the engine (missing column in the
// select, bad mapping, dropped index key), or a rule that fails to persist.
// Tears everything down at the end. Requires migration 0007.
//
//   node --experimental-strip-types scripts/test-pricing-waterfall-live.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

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

const { indexRules, resolveWithIndex } = await import("../src/lib/admin/pricing-engine.ts");

// Same column list as src/lib/admin/pricing-data.ts fetchPricingRules.
const RULE_COLUMNS =
  "id, scope, category_id, customer_id, product_id, margin_percent, is_priority, is_active, created_at, updated_at";

const created = { categoryId: null, productId: null, ruleIds: [] };
let failed = false;

async function teardown() {
  if (created.ruleIds.length)
    await admin.from("pricing_rules").delete().in("id", created.ruleIds);
  if (created.productId) {
    await admin.from("product_costs").delete().eq("product_id", created.productId);
    await admin.from("products").delete().eq("id", created.productId);
  }
  if (created.categoryId) await admin.from("categories").delete().eq("id", created.categoryId);
  console.log("teardown complete.");
}

async function resolveViaAppPath(productId, categoryId) {
  const { data: raw, error } = await admin.from("pricing_rules").select(RULE_COLUMNS);
  assert.equal(error, null, `rules select failed: ${error?.message}`);
  // Same mapping as pricing-data.toRule
  const rules = raw.map((r) => ({
    id: r.id,
    scope: r.scope,
    categoryId: r.category_id,
    customerId: r.customer_id,
    productId: r.product_id,
    marginPercent: typeof r.margin_percent === "string" ? parseFloat(r.margin_percent) : r.margin_percent,
    isPriority: r.is_priority,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  return resolveWithIndex({
    idx: indexRules(rules),
    customerId: "00000000-0000-0000-0000-000000000000",
    productId,
    categoryId,
    parentCategoryId: null,
    costCents: 200,
    listPriceCents: 1000,
    manualPriceCents: null,
  });
}

try {
  // ---- provision ----
  const { data: cat, error: catErr } = await admin
    .from("categories")
    .insert({ name: `QA Waterfall ${Date.now()}` })
    .select("id")
    .single();
  assert.equal(catErr, null, `category insert: ${catErr?.message}`);
  created.categoryId = cat.id;

  const { data: prod, error: prodErr } = await admin
    .from("products")
    .insert({
      sku: `QA-WF-${Date.now()}`,
      name: "QA waterfall probe",
      category_id: cat.id,
      unit: "ea",
      unit_size: "1",
      list_price_cents: 1000,
      is_active: false, // never visible anywhere
    })
    .select("id")
    .single();
  assert.equal(prodErr, null, `product insert: ${prodErr?.message}`);
  created.productId = prod.id;

  await admin.from("product_costs").insert({ product_id: prod.id, cost_cents: 200 });

  const { data: catRule, error: crErr } = await admin
    .from("pricing_rules")
    .insert({ scope: "category", category_id: cat.id, margin_percent: 40, is_priority: false, is_active: true })
    .select("id")
    .single();
  assert.equal(crErr, null, `category rule insert: ${crErr?.message}`);
  created.ruleIds.push(catRule.id);

  const { data: prodRule, error: prErr } = await admin
    .from("pricing_rules")
    .insert({ scope: "product", product_id: prod.id, margin_percent: 50, is_priority: false, is_active: true })
    .select("id, scope, product_id")
    .single();
  assert.equal(prErr, null, `product rule insert: ${prErr?.message} (migration 0007 applied?)`);
  assert.equal(prodRule.product_id, prod.id, "product rule persisted WITHOUT its product_id");
  created.ruleIds.push(prodRule.id);

  // ---- 1. fetta scenario: non-priority product beats non-priority category ----
  let r = await resolveViaAppPath(prod.id, cat.id);
  assert.equal(r.priceCents, 300, `expected 300 (prod 50%), got ${r.priceCents} via ${r.source}`);
  assert.equal(r.source, "product-margin");
  console.log("  PASS  live: prod 50% beats cat 40% (both non-priority) -> $3.00 Prod");

  // ---- 2. deactivate the product rule -> category takes over ----
  await admin.from("pricing_rules").update({ is_active: false }).eq("id", prodRule.id);
  r = await resolveViaAppPath(prod.id, cat.id);
  assert.equal(r.priceCents, 280, `expected 280 (cat 40%), got ${r.priceCents} via ${r.source}`);
  assert.equal(r.source, "category-margin");
  console.log("  PASS  live: inactive product rule -> falls to cat 40% -> $2.80 Cat");

  // ---- 3. priority product rule beats a priority category rule ----
  await admin.from("pricing_rules").update({ is_active: true, is_priority: true }).eq("id", prodRule.id);
  await admin.from("pricing_rules").update({ is_priority: true }).eq("id", catRule.id);
  r = await resolveViaAppPath(prod.id, cat.id);
  assert.equal(r.priceCents, 300, `expected 300 (priority prod), got ${r.priceCents} via ${r.source}`);
  assert.equal(r.source, "product-margin");
  assert.equal(r.priority, true);
  console.log("  PASS  live: priority prod beats priority cat -> $3.00 Prod (priority)");

  console.log("\n=== PRICING WATERFALL LIVE TEST: PASS ===");
} catch (e) {
  failed = true;
  console.error("  FAIL ", e.message);
  console.error("\n=== PRICING WATERFALL LIVE TEST: FAIL ===");
} finally {
  await teardown();
}
process.exit(failed ? 1 : 0);
