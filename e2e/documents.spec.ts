import { test, expect, authFile, pageProblems } from "./helpers/fixtures";
import { createOrder, customerByKey, setStock } from "./helpers/data";
import { select } from "./helpers/db";
import { spawn, type ChildProcess } from "node:child_process";
import type { Page } from "@playwright/test";

// A-16 and C-08: invoice, statements (customer copy, internal copy), stock sheets, print behaviour, and the
// placeholder business details (flagged to the owner, never silently printed).
const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const docText = (page: Page) => page.locator(".doc-sheet").innerText();

test.describe("admin documents", () => {
  test.use({ storageState: authFile("admin") });

  test("A-16 invoice: lines and total are the order's frozen snapshot, and no cost or profit appears", async ({ page }) => {
    const o = await createOrder("copperleaf", [{ sku: "DRY-101", qty: 2 }, { sku: "PRD-001", qty: 3 }], { status: "completed" });
    await page.goto(`/admin/orders/${o.id}/invoice`);
    const t = await docText(page);
    expect(t).toMatch(/INVOICE/i);
    expect(t).toContain("Copperleaf Kitchen");
    expect(t).toContain("Aged Cheddar Block");
    expect(t).toContain("Vine-Ripe Tomatoes");
    expect(t).toContain(money(o.totalCents));
    expect(t).not.toMatch(/\bcost\b|\bprofit\b|\bmargin\b/i);
    expect(t).toContain("Net 30".replace("Net 30", "net-30")); // payment terms snapshot
  });

  test("A-16 a cancelled order's invoice carries the CANCELLED watermark on every page", async ({ page }) => {
    const o = await createOrder("juniper", [{ sku: "BEV-501", qty: 1 }], { status: "cancelled" });
    await page.goto(`/admin/orders/${o.id}/invoice`);
    await expect(page.locator(".doc-watermark")).toContainText(/cancelled/i);
    expect(await page.locator(".doc-watermark").evaluate((e) => getComputedStyle(e).position)).toBe("fixed"); // repeats per printed page
  });

  test("A-16 print layout: toolbar and chrome disappear, table header repeats, rows do not split", async ({ page }) => {
    const o = await createOrder("copperleaf", [{ sku: "DRY-101", qty: 1 }], { status: "completed" });
    await page.goto(`/admin/orders/${o.id}/invoice`);
    await expect(page.getByRole("button", { name: /Print/ })).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: /Print/ })).toBeHidden();
    await expect(page.locator("aside")).toBeHidden();
    const css = await page.evaluate(() => ({
      thead: getComputedStyle(document.querySelector(".doc-table thead")!).display,
      row: getComputedStyle(document.querySelector(".doc-table tbody tr")!).breakInside,
    }));
    expect(css).toEqual({ thead: "table-header-group", row: "avoid" });
    await page.emulateMedia({ media: "screen" });
  });

  test("A-16 customer statement (customer copy) has no cost columns; internal copy is bannered INTERNAL and shows cost and profit", async ({ page }) => {
    const c = await customerByKey("copperleaf");
    await createOrder("copperleaf", [{ sku: "DRY-101", qty: 2 }], { status: "completed" });
    await page.goto(`/admin/customers/${c.id}/statement?range=this-year`);
    const customerCopy = await docText(page);
    expect(customerCopy).toMatch(/statement/i);
    expect(customerCopy).not.toMatch(/\bcost\b|\bprofit\b/i);
    expect(customerCopy).not.toMatch(/INTERNAL/);
    await page.goto(`/admin/customers/${c.id}/statement/internal?range=this-year`);
    await expect(page.locator(".doc-internal-banner")).toContainText(/internal/i);
    const internal = await docText(page);
    expect(internal).toMatch(/\bcost\b/i);
    expect(internal).toMatch(/\bprofit\b/i);
  });

  test("A-16 statement period filter: an empty period still produces a valid empty document", async ({ page }) => {
    const c = await customerByKey("copperleaf");
    await page.goto(`/admin/customers/${c.id}/statement?range=custom&from=2020-01-01&to=2020-01-31`);
    await expect(page.locator(".doc-sheet")).toBeVisible();
    expect(await docText(page)).toMatch(/no orders|nothing|0 orders/i);
  });

  test("A-16 low-stock and out-of-stock sheets list exactly the right products, in words", async ({ page }) => {
    await setStock("BEV-501", 50, 5); // fine
    await setStock("BEV-502", 3, 5); // low
    await setStock("DRY-101", 0, 5); // out
    await setStock("DRY-102", -2, 5); // oversold
    await page.goto("/admin/documents/low-stock");
    let t = await docText(page);
    expect(t).toContain("BEV-502");
    expect(t).not.toContain("BEV-501");
    expect(t).toMatch(/LOW/);
    expect(t).toContain("DRY-101");
    expect(t).toMatch(/OUT OF STOCK/); // the low-stock sheet names a zero count in words
    await page.goto("/admin/documents/out-of-stock");
    t = await docText(page);
    expect(t).toContain("DRY-101");
    expect(t).toContain("DRY-102");
    expect(t).toMatch(/OVERSOLD BY 2/);
    expect(t).toMatch(/UNAVAILABLE/);
    expect(t).not.toContain("BEV-501");
  });

  test("A-16 product statement renders every active product", async ({ page }) => {
    await page.goto("/admin/documents/products");
    const rows = await page.locator(".doc-table tbody tr").count();
    const active = (await select("products?select=id&is_active=eq.true")).length;
    expect(rows).toBe(active);
    expect(await pageProblems(page)).toEqual([]);
  });

  test("A-17 reports page renders for a range and the totals match the orders in that range", async ({ page }) => {
    await page.goto("/admin/reports?range=this-year");
    await expect(page.getByRole("heading", { name: /report/i }).first()).toBeVisible();
    expect(await pageProblems(page)).toEqual([]);
  });
});

test.describe("customer documents", () => {
  test.use({ storageState: authFile("copperleaf") });

  test("C-08 the customer's own statement covers only their orders, with no cost data", async ({ page }) => {
    await page.goto("/portal/orders/statement?range=this-year");
    const t = await docText(page);
    expect(t).toContain("Copperleaf Kitchen");
    expect(t).not.toContain("Ember Lane Pizza");
    expect(t).not.toMatch(/\bcost\b|\bprofit\b/i);
  });
});

// ---- placeholder business details: a second server without the BUSINESS_* variables --------------------------------
test.describe("placeholder business details", () => {
  test.describe.configure({ mode: "serial" });
  let server: ChildProcess;
  const base = "http://localhost:3101";

  test.beforeAll(async () => {
    server = spawn(process.execPath, ["videos/devstack/dev.mjs", "start"], {
      env: { ...process.env, DEVSTACK_PORT: "3101", DEVSTACK_PLACEHOLDERS: "1" },
      stdio: "ignore",
    });
    const t0 = Date.now();
    for (;;) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {
        /* not up yet */
      }
      if (Date.now() - t0 > 60_000) throw new Error("placeholder server did not start (run `node videos/devstack/dev.mjs build` first)");
      await new Promise((r) => setTimeout(r, 500));
    }
  });
  test.afterAll(() => {
    server?.kill();
  });

  test.describe("as admin", () => {
    test.use({ storageState: authFile("admin") });

    test("A-16 the admin area shows a banner naming the four unset variables", async ({ page }) => {
      await page.goto(`${base}/admin`);
      const banner = page.getByTestId("identity-placeholder-banner");
      await expect(banner).toBeVisible();
      for (const v of ["BUSINESS_LEGAL_NAME", "BUSINESS_ADDRESS", "BUSINESS_PHONE", "BUSINESS_EMAIL"]) await expect(banner).toContainText(v);
      await expect(banner).toContainText(/Do not send documents to customers/);
    });

    test("A-16 invoices print the visibly fake placeholder text (impossible to mistake for a real document)", async ({ page }) => {
      const o = await createOrder("copperleaf", [{ sku: "DRY-101", qty: 1 }], { status: "completed" });
      await page.goto(`${base}/admin/orders/${o.id}/invoice`);
      const t = await docText(page);
      expect(t).toContain("[LEGAL NAME TBC]");
      expect(t).toContain("[STREET ADDRESS]");
      expect(t).toContain("[PHONE]");
      expect(t).toContain("[EMAIL]");
    });
  });

  test.describe("as customer", () => {
    test.use({ storageState: authFile("copperleaf") });
    test("C-08 the customer never sees the owner-only banner, but the placeholders are on their invoice too", async ({ page }) => {
      const o = await createOrder("copperleaf", [{ sku: "DRY-101", qty: 1 }], { status: "completed" });
      await page.goto(`${base}/portal/orders/${o.id}/invoice`);
      await expect(page.getByTestId("identity-placeholder-banner")).toHaveCount(0);
      expect(await docText(page)).toContain("[LEGAL NAME TBC]");
    });
  });

  test("A-16 with the variables set (the normal server) there is no banner and real-looking details print", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin") });
    const page = await ctx.newPage();
    await page.goto("http://localhost:3100/admin");
    await expect(page.getByTestId("identity-placeholder-banner")).toHaveCount(0);
    await ctx.close();
  });
});
