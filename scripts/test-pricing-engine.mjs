// Unit assertions for the PURE pricing engine (CP-1 8-step waterfall, rounding,
// modal helpers, rule indexing, chip labels). No DB, no env, no dependencies —
// the .ts engine is imported directly via Node's built-in type stripping.
//
//   node --experimental-strip-types scripts/test-pricing-engine.mjs
//
// Exits 0 with a PASS summary, non-zero on the first failed assertion.
import assert from "node:assert/strict";

const engine = await import("../src/lib/admin/pricing-engine.ts");
const {
  marginPriceCents,
  saleFromCostAndMargin,
  profitOnCost,
  resolveCustomerPriceCents,
  indexRules,
  resolveWithIndex,
  validMarginPercent,
  marginSourceLabel,
} = engine;

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`  PASS  ${name}`);
}

const base = {
  costCents: 1000,
  listPriceCents: 2000,
  manualPriceCents: null,
  customerMargin: null,
  productMargin: null,
  categoryMargin: null,
  parentCategoryMargin: null,
  globalMargin: null,
};

console.log("pricing-engine waterfall (CP-1, 8 steps):");

check("rounding: half-up to whole cents", () => {
  assert.equal(marginPriceCents(1000, 40), 1400);
  assert.equal(marginPriceCents(333, 33.33), 444); // 443.9889 -> 444
  assert.equal(marginPriceCents(1, 0.4), 1); // 1.004 -> 1
  assert.equal(marginPriceCents(1000, 0), 1000); // margin 0 = at cost
});

check("modal helpers: sale-from-margin + profit-on-cost", () => {
  assert.equal(saleFromCostAndMargin(1440, 40), 2016);
  assert.deepEqual(profitOnCost(1440, 2016), { profitCents: 576, percentOnCost: 40 });
  assert.deepEqual(profitOnCost(0, 500), { profitCents: 500, percentOnCost: null });
  assert.equal(profitOnCost(1000, 900).profitCents, -100); // selling below cost
});

check("1. manual always wins (even over priority product rule)", () => {
  const r = resolveCustomerPriceCents({
    ...base,
    manualPriceCents: 1234,
    productMargin: { percent: 50, priority: true },
    globalMargin: 20,
  });
  assert.deepEqual(r, { priceCents: 1234, source: "manual", marginPercent: null, priority: false });
});

check("2. priority product beats priority category + customer", () => {
  const r = resolveCustomerPriceCents({
    ...base,
    productMargin: { percent: 50, priority: true },
    categoryMargin: { percent: 40, priority: true },
    customerMargin: 10,
  });
  assert.deepEqual(r, { priceCents: 1500, source: "product-margin", marginPercent: 50, priority: true });
});

check("3. priority category beats customer margin", () => {
  const r = resolveCustomerPriceCents({
    ...base,
    categoryMargin: { percent: 40, priority: true },
    customerMargin: 10,
  });
  assert.deepEqual(r, { priceCents: 1400, source: "category-margin", marginPercent: 40, priority: true });
});

check("3b. priority PARENT category also beats customer margin (child first)", () => {
  const r = resolveCustomerPriceCents({
    ...base,
    parentCategoryMargin: { percent: 30, priority: true },
    customerMargin: 10,
  });
  assert.equal(r.priceCents, 1300);
  assert.equal(r.priority, true);
});

check("4. customer margin beats NON-priority product rule", () => {
  const r = resolveCustomerPriceCents({
    ...base,
    productMargin: { percent: 50, priority: false },
    customerMargin: 10,
  });
  assert.deepEqual(r, { priceCents: 1100, source: "customer-margin", marginPercent: 10, priority: false });
});

check("5. non-priority product beats non-priority category + global", () => {
  const r = resolveCustomerPriceCents({
    ...base,
    productMargin: { percent: 25, priority: false },
    categoryMargin: { percent: 40, priority: false },
    globalMargin: 20,
  });
  assert.deepEqual(r, { priceCents: 1250, source: "product-margin", marginPercent: 25, priority: false });
});

check("6. child category beats parent category", () => {
  const r = resolveCustomerPriceCents({
    ...base,
    categoryMargin: { percent: 35, priority: false },
    parentCategoryMargin: { percent: 15, priority: false },
  });
  assert.equal(r.priceCents, 1350);
});

check("7. global default when nothing more specific", () => {
  const r = resolveCustomerPriceCents({ ...base, globalMargin: 20 });
  assert.deepEqual(r, { priceCents: 1200, source: "global-margin", marginPercent: 20, priority: false });
});

check("8. list when no rules at all", () => {
  const r = resolveCustomerPriceCents({ ...base });
  assert.deepEqual(r, { priceCents: 2000, source: "list", marginPercent: null, priority: false });
});

check("no cost recorded => list, even with every rule set", () => {
  const r = resolveCustomerPriceCents({
    ...base,
    costCents: null,
    productMargin: { percent: 50, priority: true },
    categoryMargin: { percent: 40, priority: true },
    customerMargin: 10,
    globalMargin: 20,
  });
  assert.deepEqual(r, { priceCents: 2000, source: "list", marginPercent: null, priority: false });
});

check("indexRules drops inactive + resolveWithIndex wires product rules", () => {
  const rules = [
    { id: "1", scope: "global", categoryId: null, customerId: null, productId: null, marginPercent: 20, isPriority: false, isActive: true, createdAt: "", updatedAt: "" },
    { id: "2", scope: "product", categoryId: null, customerId: null, productId: "p1", marginPercent: 25, isPriority: false, isActive: true, createdAt: "", updatedAt: "" },
    { id: "3", scope: "product", categoryId: null, customerId: null, productId: "p2", marginPercent: 99, isPriority: true, isActive: false, createdAt: "", updatedAt: "" },
  ];
  const idx = indexRules(rules);
  assert.equal(idx.byProduct.size, 1); // inactive p2 rule dropped
  const r = resolveWithIndex({
    idx,
    customerId: "c1",
    productId: "p1",
    categoryId: null,
    parentCategoryId: null,
    costCents: 1000,
    listPriceCents: 2000,
    manualPriceCents: null,
  });
  assert.deepEqual(r, { priceCents: 1250, source: "product-margin", marginPercent: 25, priority: false });
  const r2 = resolveWithIndex({ ...{
    idx,
    customerId: "c1",
    productId: "p2", // its rule is inactive -> falls to global
    categoryId: null,
    parentCategoryId: null,
    costCents: 1000,
    listPriceCents: 2000,
    manualPriceCents: null,
  } });
  assert.equal(r2.source, "global-margin");
});

check("validMarginPercent bounds + 2-decimal cap", () => {
  assert.equal(validMarginPercent(0), true);
  assert.equal(validMarginPercent(500), true);
  assert.equal(validMarginPercent(33.33), true);
  assert.equal(validMarginPercent(33.333), false);
  assert.equal(validMarginPercent(-1), false);
  assert.equal(validMarginPercent(501), false);
  assert.equal(validMarginPercent(NaN), false);
});

check("marginSourceLabel covers product chips", () => {
  assert.equal(marginSourceLabel({ source: "product-margin", marginPercent: 25, priority: false }), "Prod 25%");
  assert.equal(marginSourceLabel({ source: "product-margin", marginPercent: 25, priority: true }), "Prod 25% (priority)");
  assert.equal(marginSourceLabel({ source: "category-margin", marginPercent: 40, priority: true }), "Cat 40% (priority)");
  assert.equal(marginSourceLabel({ source: "list", marginPercent: null, priority: false }), "List");
});

console.log(`\n=== PRICING-ENGINE TESTS: PASS (${passed} checks) ===`);
process.exit(0);
