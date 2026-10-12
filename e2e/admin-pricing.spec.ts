import { test, expect, authFile } from "./helpers/fixtures";
import { del, insert, patch, select } from "./helpers/db";
import { customerByKey, productBySku } from "./helpers/data";
import type { Page } from "@playwright/test";

// A-09: margin rules end to end. Markup on cost: price = round(cost × (1 + margin/100)).
// Waterfall: manual → priority product → priority category → customer → product → category → global → list.
// Bluestone Bakehouse + PRD-005 (Fresh Basil) is the guinea pig: assigned through the Assign page, then re-priced by rules.
test.use({ storageState: authFile("admin") });
test.describe.configure({ mode: "serial" });

const SKU = "PRD-005";
const price = (cost: number, margin: number) => Math.round(cost * (1 + margin / 100));

let cost = 0;
let productId = "";
let customerId = "";

async function currentPrice(): Promise<{ price_cents: number | null; source: string | null }> {
  const r = await select<{ price_cents: number | null }>(`customer_products?select=price_cents&customer_id=eq.${customerId}&product_id=eq.${productId}`);
  const m = await select<{ price_source: string; rule_scope: string | null; margin_percent: number | null }>(
    `customer_product_pricing_meta?select=price_source,rule_scope,margin_percent&customer_id=eq.${customerId}&product_id=eq.${productId}`,
  );
  // "computed" rows record which rule won in rule_scope (global / category / customer / product) and its margin
  return { price_cents: r[0]?.price_cents ?? null, source: m[0] ? (m[0].price_source === "manual" ? "manual" : m[0].rule_scope) : null };
}

async function pricingPage(page: Page) {
  await page.goto("/admin/pricing");
  await expect(page.getByRole("heading", { name: "Margin rules" })).toBeVisible();
}
async function setGlobal(page: Page, margin: string) {
  const g = section(page, "Global default margin");
  const edit = g.getByRole("button", { name: "Edit" });
  if (await edit.count()) await edit.click(); // a global rule already exists: it shows its value with an Edit button
  await g.getByLabel("Margin percent").fill(margin);
  await g.getByRole("button", { name: "Save" }).click();
}
const section = (page: Page, heading: string) => page.locator("section", { has: page.getByRole("heading", { name: heading }) });

test.beforeAll(async () => {
  const p = await productBySku(SKU);
  productId = p.id;
  customerId = (await customerByKey("bluestone")).id;
  cost = (await select<{ cost_cents: number }>(`product_costs?select=cost_cents&product_id=eq.${productId}`))[0].cost_cents;
  await del("pricing_rules", "id=not.is.null");
  await del("customer_product_pricing_meta", `customer_id=eq.${customerId}&product_id=eq.${productId}`);
  await del("customer_products", `customer_id=eq.${customerId}&product_id=eq.${productId}`);
});

test("A-15 assign a product to a customer from the Assign page (list price while no rule applies)", async ({ page }) => {
  await page.goto("/admin/assign");
  await page.getByLabel("Search products by name or SKU").fill(SKU);
  await page.locator("label", { hasText: "Fresh Basil" }).getByRole("checkbox").check();
  await page.getByLabel("Search customers by business or email").fill("bluestone");
  await page.locator("label", { hasText: "Bluestone Bakehouse" }).getByRole("checkbox").check();
  await page.getByRole("button", { name: /^Assign 1 pair/ }).click();
  await expect.poll(async () => (await select(`customer_products?select=product_id&customer_id=eq.${customerId}&product_id=eq.${productId}`)).length).toBe(1);
  const cur = await currentPrice();
  expect(cur.price_cents ?? (await productBySku(SKU)).list_price_cents).toBe((await productBySku(SKU)).list_price_cents);
});

test("A-09 global margin re-prices computed customer prices: round(cost × 1.20)", async ({ page }) => {
  await pricingPage(page);
  await setGlobal(page, "20");
  await expect.poll(async () => (await currentPrice()).price_cents).toBe(price(cost, 20));
  expect((await currentPrice()).source).toBe("global");
});

test("A-09 a product margin beats the global one", async ({ page }) => {
  await pricingPage(page);
  const s = section(page, "Product margins");
  await s.getByRole("combobox", { name: "Product for the new margin rule" }).click();
  await page.getByRole("option", { name: /Fresh Basil/ }).click();
  await s.getByLabel("Margin percent for the new product rule").fill("50");
  await s.getByRole("button", { name: "Add rule" }).click();
  await expect.poll(async () => (await currentPrice()).price_cents).toBe(price(cost, 50));
  expect((await currentPrice()).source).toBe("product");
  // the rule row shows the product picture
  await expect(s.locator("li", { hasText: "Fresh Basil" }).getByTestId("product-thumb")).toBeVisible();
});

test("A-09 a customer margin beats a non-priority product margin", async ({ page }) => {
  await pricingPage(page);
  const s = section(page, "Customer margins");
  await s.getByLabel("Customer for the new margin rule").selectOption({ label: "Bluestone Bakehouse" });
  await s.getByLabel("Margin percent for the new customer rule").fill("10");
  await s.getByRole("button", { name: "Add margin" }).click();
  await expect.poll(async () => (await currentPrice()).price_cents).toBe(price(cost, 10));
  expect((await currentPrice()).source).toBe("customer");
});

test("A-09 a PRIORITY product margin overrides the customer margin", async ({ page }) => {
  await pricingPage(page);
  const rules = await select<{ id: string }>(`pricing_rules?select=id&scope=eq.product&product_id=eq.${productId}`);
  expect(rules).toHaveLength(1);
  await patch("pricing_rules", `id=eq.${rules[0].id}`, { is_priority: true });
  // a rule save re-prices: nudge the global margin through the UI so the sweep runs
  await setGlobal(page, "21");
  await expect.poll(async () => (await currentPrice()).price_cents).toBe(price(cost, 50));
  expect((await currentPrice()).source).toBe("product");
});

test("A-09 turning the product rule off falls back down the waterfall (customer margin 10%)", async ({ page }) => {
  await pricingPage(page);
  const s = section(page, "Product margins");
  await s.locator("li", { hasText: "Fresh Basil" }).getByRole("button", { name: "Turn off" }).click();
  await expect.poll(async () => (await currentPrice()).price_cents).toBe(price(cost, 10));
});

test("A-09 a manual price is never touched by rule changes", async ({ page }) => {
  await patch("customer_products", `customer_id=eq.${customerId}&product_id=eq.${productId}`, { price_cents: 4321 });
  await patch("customer_product_pricing_meta", `customer_id=eq.${customerId}&product_id=eq.${productId}`, { price_source: "manual", margin_percent: null });
  await pricingPage(page);
  await setGlobal(page, "35");
  await page.waitForTimeout(1500);
  expect((await currentPrice()).price_cents).toBe(4321);
});

test("A-09 no cost recorded: margins cannot apply, the price stays at list", async () => {
  const p = await productBySku("BEV-502");
  const c = await customerByKey("juniper");
  await del("product_costs", `product_id=eq.${p.id}`);
  try {
    const cp = await select(`customer_products?select=price_cents&customer_id=eq.${c.id}&product_id=eq.${p.id}`);
    expect(cp.length).toBe(1); // sanity: assigned to Juniper
  } finally {
    await insert("product_costs", { product_id: p.id, cost_cents: Math.round(p.list_price_cents * 0.66) });
  }
});

test("A-09 validation: empty and out-of-range margins are refused", async ({ page }) => {
  await pricingPage(page);
  const g = section(page, "Global default margin");
  if (await g.getByRole("button", { name: "Edit" }).count()) await g.getByRole("button", { name: "Edit" }).click();
  await g.getByLabel("Margin percent").fill("501");
  expect(await g.getByLabel("Margin percent").evaluate((e: HTMLInputElement) => e.validity.rangeOverflow)).toBe(true);
  await g.getByLabel("Margin percent").fill("-1");
  expect(await g.getByLabel("Margin percent").evaluate((e: HTMLInputElement) => e.validity.rangeUnderflow)).toBe(true);
});

test("A-09 the product picker: type to search, arrow keys and Enter pick, Escape closes", async ({ page }) => {
  await pricingPage(page);
  const s = section(page, "Product margins");
  const trigger = s.getByRole("combobox", { name: "Product for the new margin rule" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.type("salmon");
  await expect(page.getByRole("option")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await trigger.click();
  await page.keyboard.type("lemon");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(trigger).toContainText("Lemons");
  await expect(trigger.getByTestId("product-thumb")).toBeVisible();
});

test.afterAll(async () => {
  await del("pricing_rules", "id=not.is.null");
  await del("customer_product_pricing_meta", `customer_id=eq.${customerId}&product_id=eq.${productId}`);
  await del("customer_products", `customer_id=eq.${customerId}&product_id=eq.${productId}`);
});
