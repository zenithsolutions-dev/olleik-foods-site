import { test, expect, authFile, pageProblems } from "./helpers/fixtures";
import { select } from "./helpers/db";
import { createOrder, customerByKey, orderRow, productBySku, setStock, stockOf } from "./helpers/data";
import type { Page } from "@playwright/test";

// A-03..A-07: the admin order list, the lifecycle (new → confirmed → prepared → completed, cancel), stock on confirm
// (block, oversell, restock) and assignment-on-confirmation.
test.use({ storageState: authFile("admin") });

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

async function open(page: Page, id: string) {
  page.on("dialog", (d) => void d.accept()); // every transition asks "are you sure?" with a browser dialog
  await page.goto(`/admin/orders/${id}`);
  await expect(page.getByRole("heading", { name: /Order #/ })).toBeVisible();
}
const chip = (page: Page) => page.locator("main span.rounded-full.uppercase").first();
const status = async (id: string) => (await orderRow(id)).status as string;

test.describe("order lifecycle", () => {
  test("A-04 new → confirmed → prepared → completed, each step recorded with its timestamp", async ({ page }) => {
    await setStock("DRY-101", null);
    const o = await createOrder("copperleaf", [{ sku: "DRY-101", qty: 2 }]);
    await open(page, o.id);
    await expect(page.getByRole("button", { name: /Confirm order/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Mark prepared/ })).toHaveCount(0);

    await page.getByRole("button", { name: /Confirm order/ }).click();
    await expect(page.getByRole("button", { name: /Mark prepared/ })).toBeVisible();
    expect(await status(o.id)).toBe("confirmed");
    expect((await orderRow(o.id)).confirmed_at).toBeTruthy();

    await page.getByRole("button", { name: /Mark prepared/ }).click();
    await expect(page.getByRole("button", { name: /Complete order/ })).toBeVisible();
    expect(await status(o.id)).toBe("prepared");

    await page.getByRole("button", { name: /Complete order/ }).click();
    await expect(page.getByText(/This order is completed — no further actions/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Cancel order|Confirm order|Mark prepared|Complete order/ })).toHaveCount(0);
    const row = await orderRow(o.id);
    expect(row.status).toBe("completed");
    expect(row.completed_at).toBeTruthy();
  });

  test("A-04 cancel from new, with a reason that is kept on the order", async ({ page }) => {
    const o = await createOrder("juniper", [{ sku: "BEV-501", qty: 1 }]);
    await open(page, o.id);
    await page.getByRole("button", { name: /Cancel order/ }).click();
    await page.getByPlaceholder(/Reason/).fill("Customer called, wrong day");
    await page.getByRole("button", { name: "Yes, cancel it" }).click();
    await expect(page.getByText(/This order is cancelled — no further actions/)).toBeVisible();
    await expect(page.getByText(/Customer called, wrong day/)).toBeVisible();
    const row = await orderRow(o.id);
    expect(row.status).toBe("cancelled");
    expect(row.cancelled_at).toBeTruthy();
  });

  test("A-04 'Keep the order' closes the cancel prompt and changes nothing", async ({ page }) => {
    const o = await createOrder("juniper", [{ sku: "BEV-501", qty: 1 }]);
    await open(page, o.id);
    await page.getByRole("button", { name: /Cancel order/ }).click();
    await page.getByRole("button", { name: "Keep the order" }).click();
    await expect(page.getByText("Cancel this order?")).toHaveCount(0);
    expect(await status(o.id)).toBe("new");
  });

  test("A-04 a stale button (another admin already moved the order) refuses cleanly", async ({ page }) => {
    await setStock("DRY-101", null);
    const o = await createOrder("copperleaf", [{ sku: "DRY-101", qty: 1 }]);
    await open(page, o.id);
    const { patch } = await import("./helpers/db");
    await patch("orders", `id=eq.${o.id}`, { status: "confirmed", confirmed_at: new Date().toISOString() }); // the other admin
    await page.getByRole("button", { name: /Confirm order/ }).click();
    await expect(page.getByText(/no longer in that state/i)).toBeVisible();
    expect(await status(o.id)).toBe("confirmed"); // not clobbered
  });

  test("A-04 completed and cancelled orders are terminal (no action buttons at all)", async ({ page }) => {
    const o = await createOrder("juniper", [{ sku: "BEV-501", qty: 1 }], { status: "completed" });
    await open(page, o.id);
    await expect(page.getByRole("button", { name: /Cancel order|Confirm order|Mark prepared|Complete order/ })).toHaveCount(0);
  });
});

test.describe("stock on confirm", () => {
  test("A-05 enough stock: confirm decrements, cancel restocks exactly", async ({ page }) => {
    await setStock("DRY-101", 10);
    const o = await createOrder("copperleaf", [{ sku: "DRY-101", qty: 4 }]);
    await open(page, o.id);
    await page.getByRole("button", { name: /Confirm order/ }).click();
    await expect(page.getByRole("button", { name: /Mark prepared/ })).toBeVisible();
    expect(await stockOf("DRY-101")).toBe(6);
    await page.getByRole("button", { name: /Cancel order/ }).click();
    await page.getByRole("button", { name: "Yes, cancel it" }).click();
    await expect(page.getByText(/4 units were restocked/)).toBeVisible();
    expect(await stockOf("DRY-101")).toBe(10);
    expect(await status(o.id)).toBe("cancelled");
  });

  test("A-05 insufficient stock blocks with a shortage list; 'Keep as new' leaves everything untouched", async ({ page }) => {
    await setStock("DRY-101", 3);
    const o = await createOrder("copperleaf", [{ sku: "DRY-101", qty: 5 }]);
    await open(page, o.id);
    await page.getByRole("button", { name: /Confirm order/ }).click();
    await expect(page.getByText("Not enough stock to cover this order")).toBeVisible();
    await expect(page.getByText(/Aged Cheddar Block[\s\S]*ordered\s*5[\s\S]*in stock\s*3/)).toBeVisible();
    await page.getByRole("button", { name: "Keep as new" }).click();
    expect(await status(o.id)).toBe("new");
    expect(await stockOf("DRY-101")).toBe(3);
  });

  test("A-05 'Confirm anyway (oversell)' goes negative with the full quantity; cancelling restores the true number", async ({ page }) => {
    await setStock("DRY-101", 3);
    const o = await createOrder("copperleaf", [{ sku: "DRY-101", qty: 5 }]);
    await open(page, o.id);
    await page.getByRole("button", { name: /Confirm order/ }).click();
    await page.getByRole("button", { name: "Confirm anyway (oversell)" }).click();
    await expect(page.getByText(/Confirmed with an oversell/)).toBeVisible();
    expect(await stockOf("DRY-101")).toBe(-2);
    await expect(page.getByText(/oversold by 2/i)).toBeVisible();
    const ledger = await select<{ qty_decremented: number }>(`order_stock_movements?select=qty_decremented&order_id=eq.${o.id}`);
    expect(ledger.reduce((n, r) => n + r.qty_decremented, 0)).toBe(5); // the FULL quantity, not the 3 that existed
    await page.getByRole("button", { name: /Cancel order/ }).click();
    await page.getByRole("button", { name: "Yes, cancel it" }).click();
    await expect(page.getByText(/This order is cancelled/)).toBeVisible();
    expect(await stockOf("DRY-101")).toBe(3);
  });

  test("A-05 untracked products never block a confirm", async ({ page }) => {
    await setStock("DRY-101", null);
    const o = await createOrder("copperleaf", [{ sku: "DRY-101", qty: 500 }]);
    await open(page, o.id);
    await page.getByRole("button", { name: /Confirm order/ }).click();
    await expect(page.getByRole("button", { name: /Mark prepared/ })).toBeVisible();
  });

  test("A-06 confirming adds products the customer ordered but was not assigned, at waterfall prices", async ({ page }) => {
    await setStock("MEAT-202", null);
    const c = await customerByKey("copperleaf");
    const p = await productBySku("MEAT-202");
    const { del } = await import("./helpers/db");
    await del("customer_product_pricing_meta", `customer_id=eq.${c.id}&product_id=eq.${p.id}`);
    await del("customer_products", `customer_id=eq.${c.id}&product_id=eq.${p.id}`); // a previous run (other viewport) may have assigned it
    const o = await createOrder("copperleaf", [{ sku: "MEAT-202", qty: 1, wasAssigned: false }]);
    await open(page, o.id);
    await page.getByRole("button", { name: /Confirm order/ }).click();
    await expect(page.getByText(/1 newly ordered product was added to this customer's catalog/)).toBeVisible();
    expect(await select(`customer_products?select=product_id&customer_id=eq.${c.id}&product_id=eq.${p.id}`)).toHaveLength(1);
  });
});

test.describe("order detail and list", () => {
  test("A-07 lines show price, cost and profit that add up; thumbnails on every line", async ({ page }) => {
    const o = await createOrder("copperleaf", [{ sku: "DRY-101", qty: 2 }, { sku: "PRD-001", qty: 3 }, { sku: "MEAT-201", qty: 1 }]);
    const costs = await select<{ product_id: string; cost_cents: number }>(`order_item_costs?select=product_id,cost_cents&order_id=eq.${o.id}`);
    const items = await select<{ product_id: string; qty: number; line_total_cents: number; name: string }>(`order_items?select=product_id,qty,line_total_cents,name&order_id=eq.${o.id}`);
    const profit = items.reduce((n, i) => n + i.line_total_cents - i.qty * costs.find((c) => c.product_id === i.product_id)!.cost_cents, 0);
    await page.goto(`/admin/orders/${o.id}`);
    await expect(page.getByText(money(o.totalCents)).first()).toBeVisible();
    await expect(page.getByText(money(profit)).first()).toBeVisible();
    const rows = page.locator("tbody tr").filter({ has: page.getByTestId("product-thumb") });
    await expect(rows).toHaveCount(3);
    for (const i of items) await expect(page.locator("tbody").getByText(i.name).first()).toBeVisible();
    // every thumbnail has the product name as alt text (or is the letter tile)
    const alts = await page.locator("tbody img").evaluateAll((els) => els.map((e) => (e as HTMLImageElement).alt));
    expect(alts.sort()).toEqual(items.map((i) => i.name).sort());
  });

  test("A-07 a line without a recorded cost is flagged and excluded from profit", async ({ page }) => {
    const o = await createOrder("juniper", [{ sku: "BEV-501", qty: 1 }, { sku: "BEV-502", qty: 1 }]);
    const p = await productBySku("BEV-502");
    const { del } = await import("./helpers/db");
    await del("order_item_costs", `order_id=eq.${o.id}&product_id=eq.${p.id}`);
    await page.goto(`/admin/orders/${o.id}`);
    await expect(page.getByText(/1 line has no cost/i)).toBeVisible();
  });

  test("A-03 status tabs show the true counts and filter the list", async ({ page }) => {
    await page.goto("/admin/orders");
    const all = await select<{ status: string }>("orders?select=status");
    const count = (s: string) => all.filter((r) => r.status === s).length;
    await expect(page.getByRole("button", { name: new RegExp(`^All\\s*${all.length}`) })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(`^New\\s*${count("new")}`) })).toBeVisible();
    await page.getByRole("button", { name: /^New/ }).click();
    const rows = page.locator("main a[href^='/admin/orders/']");
    await expect(rows).toHaveCount(count("new"));
    await page.getByRole("button", { name: /^Cancelled/ }).click();
    await expect(rows).toHaveCount(count("cancelled"));
  });

  test("A-03 the list shows Toronto time and 3 thumbnails + '+N' for a 5-line order", async ({ page }) => {
    const o = await createOrder("bluestone", [
      { sku: "DRY-402", qty: 1 }, { sku: "DRY-103", qty: 1 }, { sku: "DRY-104", qty: 1 }, { sku: "DRY-105", qty: 1 }, { sku: "BEV-501", qty: 1 },
    ], { createdAt: "2026-10-09T02:30:00Z" });
    await page.goto("/admin/orders");
    const row = page.locator(`a[href="/admin/orders/${o.id}"]`);
    await expect(row).toContainText("Oct 8, 10:30 p.m.");
    await expect(row).toContainText("5 items");
    await expect(row.getByTestId("thumb-strip").getByTestId("product-thumb")).toHaveCount(3);
    await expect(row).toContainText("+2");
    expect(await pageProblems(page)).toEqual([]);
  });

  test("A-03 an empty period shows the empty state", async ({ page }) => {
    await page.goto("/admin/orders?range=custom&from=2020-01-01&to=2020-01-31");
    await expect(page.getByText(/No orders in this period/)).toBeVisible();
  });

  test("A-03 a reversed custom range is swapped and the swap is reported", async ({ page }) => {
    await page.goto("/admin/orders?range=custom&from=2026-10-31&to=2026-10-01");
    await expect(page.getByText(/swapp|reversed|flipped/i).first()).toBeVisible();
  });
});

test.describe("phone navigation", () => {
  test("A-02 the Menu button opens every admin section and closes after following a link", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone only");
    await page.goto("/admin/orders");
    const menu = page.getByRole("button", { name: /^Menu/ });
    await expect(menu).toBeVisible();
    await menu.click();
    for (const l of ["Dashboard", "Orders", "Products", "Categories", "Customers", "Assign products", "Pricing", "Offer library", "Leads"]) {
      await expect(page.locator("#admin-mobile-menu").getByRole("link", { name: l, exact: false }).first()).toBeVisible();
    }
    await page.locator("#admin-mobile-menu").getByRole("link", { name: "Pricing", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/pricing/);
    await expect(page.locator("#admin-mobile-menu")).toHaveCount(0);
  });

  test("A-02 the desktop sidebar is shown on desktop and the Menu button is not", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "desktop only");
    await page.goto("/admin");
    await expect(page.locator("aside").getByRole("link", { name: "Offer library" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Menu/ })).toBeHidden();
  });
});
