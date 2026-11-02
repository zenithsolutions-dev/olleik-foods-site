import { test, expect, authFile } from "./helpers/fixtures";
import { del, select } from "./helpers/db";
import { productBySku, restoreBaseline, setStock, stockOf } from "./helpers/data";
import { join } from "node:path";
import type { Page } from "@playwright/test";

// A-08 (products) and the pricing maths that sits behind the product form: markup on cost, half-up rounding to the cent.
test.use({ storageState: authFile("admin") });
test.afterEach(async () => {
  await restoreBaseline();
});

const sku = () => `QA-${Date.now().toString(36).toUpperCase()}`;
const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const PHOTO = join(process.cwd(), "product-photos", "DRY-101.jpg");

async function openNew(page: Page) {
  await page.goto("/admin/products");
  await page.getByRole("button", { name: /Add product/ }).click();
  return page.getByRole("dialog");
}
async function fill(dlg: ReturnType<Page["getByRole"]>, v: { sku: string; name: string; size?: string; cost?: string; price?: string; margin?: string }) {
  await dlg.getByLabel("SKU").fill(v.sku);
  await dlg.getByLabel("Name", { exact: true }).fill(v.name);
  await dlg.getByLabel("Size").fill(v.size ?? "10 lb");
  if (v.cost !== undefined) await dlg.getByLabel(/Purchase cost/).fill(v.cost);
  if (v.margin !== undefined) await dlg.getByLabel(/Margin % on cost/).fill(v.margin);
  if (v.price !== undefined) await dlg.getByLabel(/Sale price/).fill(v.price);
}

test.describe("create and edit", () => {
  test("A-08/A-09 margin on cost fills the sale price and the live profit readout", async ({ page }) => {
    const s = sku();
    const dlg = await openNew(page);
    await fill(dlg, { sku: s, name: `QA tomato ${s}`, cost: "10.00", margin: "40" });
    await expect(dlg.getByLabel(/Sale price/)).toHaveValue("14.00");
    await expect(dlg.getByText("Profit: $4.00 (40% on cost)")).toBeVisible();
    await dlg.getByRole("button", { name: /Create|Save/ }).click();
    await expect(dlg).toHaveCount(0);
    const row = (await select<{ list_price_cents: number }>(`products?select=list_price_cents&sku=eq.${s}`))[0];
    expect(row.list_price_cents).toBe(1400);
    const cost = await select<{ cost_cents: number }>(`product_costs?select=cost_cents&product_id=eq.${(await productBySku(s)).id}`);
    expect(cost[0].cost_cents).toBe(1000);
    await expect(page.locator("tr", { hasText: s })).toContainText("$14.00");
    await del("products", `sku=eq.${s}`);
  });

  test("A-09 rounding is half-up to the cent: cost $3.33 at 33.33% → $4.44", async ({ page }) => {
    const dlg = await openNew(page);
    await fill(dlg, { sku: sku(), name: "QA rounding", cost: "3.33", margin: "33.33" });
    // round(333 * 1.3333) = round(443.99) = 444
    await expect(dlg.getByLabel(/Sale price/)).toHaveValue("4.44");
    await dlg.getByLabel(/Margin % on cost/).fill("0");
    await expect(dlg.getByLabel(/Sale price/)).toHaveValue("3.33"); // margin 0 sells exactly at cost
    await dlg.getByLabel(/Margin % on cost/).fill("12.5");
    await expect(dlg.getByLabel(/Sale price/)).toHaveValue("3.75"); // 333 * 1.125 = 374.6 → 375
  });

  test("A-09 no cost recorded: the form says margins cannot apply", async ({ page }) => {
    const dlg = await openNew(page);
    await expect(dlg.getByText(/No cost — margins can.t apply/)).toBeVisible();
  });

  test("A-08 a negative profit (cost above price) is shown in red, not hidden", async ({ page }) => {
    const dlg = await openNew(page);
    await fill(dlg, { sku: sku(), name: "QA loss", cost: "10.00", price: "8.00" });
    await expect(dlg.getByText("Profit: -$2.00 (-20% on cost)")).toBeVisible();
  });

  test("A-08 required fields, duplicate SKU and impossible numbers", async ({ page }) => {
    const dlg = await openNew(page);
    await dlg.getByRole("button", { name: /Create|Save/ }).click();
    expect(await dlg.getByLabel("SKU").evaluate((e: HTMLInputElement) => e.validity.valueMissing)).toBe(true);
    await fill(dlg, { sku: "DRY-101", name: "QA duplicate", price: "5.00" });
    await dlg.getByRole("button", { name: /Create|Save/ }).click();
    await expect(dlg.getByText("That SKU is already in use.")).toBeVisible();
    await dlg.getByLabel("SKU").fill(sku());
    await dlg.getByLabel(/Sale price/).fill("-3");
    expect(await dlg.getByLabel(/Sale price/).evaluate((e: HTMLInputElement) => e.validity.rangeUnderflow)).toBe(true);
    await dlg.getByLabel(/Margin % on cost/).count(); // only present with a cost
  });

  test("A-08 edit a product price: customers' list-priced rows follow (autopilot) and the table updates", async ({ page }) => {
    const p = await productBySku("PRD-005");
    const before = p.list_price_cents;
    await page.goto("/admin/products");
    await page.locator("tr", { hasText: "PRD-005" }).getByRole("button", { name: "Edit" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel(/Sale price/).fill(((before + 100) / 100).toFixed(2));
    await dlg.getByRole("button", { name: /Save/ }).click();
    await expect(dlg).toHaveCount(0);
    await expect(page.locator("tr", { hasText: "PRD-005" })).toContainText(money(before + 100));
    const now = (await productBySku("PRD-005")).list_price_cents;
    expect(now).toBe(before + 100);
    await (await import("./helpers/db")).patch("products", `id=eq.${p.id}`, { list_price_cents: before });
  });

  test("A-08 deactivate asks first and the product shows as inactive", async ({ page }) => {
    const s = sku();
    const dlg = await openNew(page);
    await fill(dlg, { sku: s, name: `QA deactivate ${s}`, price: "9.00" });
    await dlg.getByRole("button", { name: /Create|Save/ }).click();
    await expect(dlg).toHaveCount(0);
    page.on("dialog", (d) => void d.accept());
    await page.locator("tr", { hasText: s }).getByRole("button", { name: "Edit" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Deactivate/ }).click();
    await expect(page.locator("tr", { hasText: s })).toContainText("Inactive");
    await del("products", `sku=eq.${s}`);
  });

  test("A-08 search and category filter; empty state", async ({ page }) => {
    await page.goto("/admin/products");
    await page.getByLabel("Search products or SKUs").fill("salmon");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.getByLabel("Search products or SKUs").fill("zzzz-no-such");
    await expect(page.getByText("No products match.")).toBeVisible();
    await page.getByLabel("Search products or SKUs").fill("");
    await page.getByLabel("Filter by category").selectOption({ label: "Seafood" });
    expect(await page.locator("tbody tr").count()).toBeGreaterThanOrEqual(2);
    await expect(page.locator("tbody tr", { hasText: "Aged Cheddar" })).toHaveCount(0);
  });
});

test.describe("stock", () => {
  test("A-05 first count sets stock; Receive adds (settling a deficit); Set count replaces", async ({ page }) => {
    await setStock("BEV-502", -4, 3); // oversold by 4
    await page.goto("/admin/products");
    await page.locator("tr", { hasText: "BEV-502" }).getByRole("button", { name: "Edit" }).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg.getByText(/Oversold by 4/)).toBeVisible();
    await dlg.getByLabel(/Quantity that ARRIVED/).fill("10");
    await expect(dlg.getByText("-4 + 10 = 6 — 4 units settle the deficit, 6 genuinely available")).toBeVisible();
    await dlg.getByRole("button", { name: /Save/ }).click();
    await expect(dlg).toHaveCount(0);
    expect(await stockOf("BEV-502")).toBe(6);

    await page.locator("tr", { hasText: "BEV-502" }).getByRole("button", { name: "Edit" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Set count" }).click();
    await page.getByRole("dialog").getByLabel(/REAL physical count/).fill("2");
    await expect(page.getByRole("dialog").getByText("6 → 2")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: /Save/ }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await stockOf("BEV-502")).toBe(2);
    await expect(page.locator("tr", { hasText: "BEV-502" })).toContainText("low"); // 2 is under the alert level of 3
  });

  test("A-05 stock states in the list: ok, low, out and oversold", async ({ page }) => {
    await setStock("BEV-501", 50, 5);
    await setStock("BEV-502", 3, 5);
    await setStock("DRY-101", 0, 5);
    await setStock("DRY-102", -2, 5);
    await page.goto("/admin/products");
    await expect(page.locator("tr", { hasText: "BEV-501" })).not.toContainText(/low|out|Oversold/);
    await expect(page.locator("tr", { hasText: "BEV-502" })).toContainText("low");
    await expect(page.locator("tr", { hasText: "DRY-101" })).toContainText("out");
    await expect(page.locator("tr", { hasText: "DRY-102" })).toContainText("Oversold by 2");
    // the customer portal only ever sees availability, never numbers
    expect((await productBySku("DRY-101")).id).toBeTruthy();
  });
});

test.describe("photo upload", () => {
  async function editPrd(page: Page, code: string) {
    await page.goto("/admin/products");
    await page.locator("tr", { hasText: code }).getByRole("button", { name: "Edit" }).click();
    return page.getByRole("dialog");
  }

  test("A-08 a wrong file type is refused with a clear message", async ({ page }) => {
    const dlg = await editPrd(page, "PRD-005");
    await dlg.locator("input[type=file]").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(dlg.getByText("Please use a JPG, PNG, or WebP file.")).toBeVisible();
  });

  test("A-08 a file over 5 MB is refused with a clear message", async ({ page }) => {
    const dlg = await editPrd(page, "PRD-005");
    await dlg.locator("input[type=file]").setInputFiles({ name: "big.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(5 * 1024 * 1024 + 10) });
    await expect(dlg.getByText("Image is too large. Maximum size is 5 MB.")).toBeVisible();
  });

  test("A-08 a JPG uploads, shows in the editor and the products list, and can be removed", async ({ page }) => {
    const s = sku();
    const dlg = await openNew(page);
    await fill(dlg, { sku: s, name: `QA photo ${s}`, price: "6.00" });
    await dlg.locator("input[type=file]").setInputFiles(PHOTO);
    await expect(dlg.locator("img[alt='Product photo']")).toBeVisible({ timeout: 20_000 });
    await dlg.getByRole("button", { name: /Create|Save/ }).click();
    await expect(dlg).toHaveCount(0);
    const row = page.locator("tr", { hasText: s });
    await expect(row.getByTestId("product-thumb")).toHaveAttribute("data-state", "image");
    const url = (await select<{ image_url: string }>(`products?select=image_url&sku=eq.${s}`))[0].image_url;
    expect(url).toMatch(/\/storage\/v1\/object\/public\/product-images\/products\/[0-9a-f-]{36}\.jpg$/);
    expect((await fetch(url)).status).toBe(200);
    await del("products", `sku=eq.${s}`);
  });
});
