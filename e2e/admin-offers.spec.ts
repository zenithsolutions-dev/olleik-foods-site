import { test, expect, authFile, pageProblems } from "./helpers/fixtures";
import { del, select } from "./helpers/db";
import { customerByKey, productBySku, setOffers } from "./helpers/data";
import type { Page } from "@playwright/test";

// A-10: the offer library (percent / amount off / fixed price), Running now (regression: it crashed server-side for
// amount-off and fixed-price offers) and bulk apply with undo.
test.use({ storageState: authFile("admin") });

const stamp = () => `QA ${Date.now().toString(36)}`;
const DAY = 86_400_000;

async function newTemplate(page: Page, name: string, kind: "Percent off" | "Fixed price" | "Amount off", value: string) {
  await page.getByRole("button", { name: /New template/ }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Name").fill(name);
  await dlg.getByLabel("Discount type").selectOption({ label: kind });
  await dlg.locator("input[type=number]").fill(value);
  await dlg.getByRole("button", { name: "Create template" }).click();
  await expect(dlg).toHaveCount(0);
}

test.describe("offer library", () => {
  test("A-10 create one template of each kind; the list shows the right wording", async ({ page }) => {
    const base = stamp();
    await page.goto("/admin/offers");
    await newTemplate(page, `${base} pct`, "Percent off", "15");
    await newTemplate(page, `${base} amt`, "Amount off", "3.25");
    await newTemplate(page, `${base} fix`, "Fixed price", "12.50");
    const li = (n: string) => page.locator("li", { hasText: `${base} ${n}` });
    await expect(li("pct")).toContainText("15% off");
    await expect(li("amt")).toContainText("$3.25 off");
    await expect(li("fix")).toContainText("$12.50 fixed price");
    const rows = await select<{ name: string; discount_kind: string; discount_value: number }>(`offer_templates?select=name,discount_kind,discount_value&name=like.${base}*&order=name`);
    expect(rows.map((r) => [r.discount_kind, r.discount_value])).toEqual([["amount_off", 325], ["fixed_price", 1250], ["percent", 15]]);
    await del("offer_templates", `name=like.${base}*`);
  });

  test("A-10 validation: a name is required, percent is capped at 100, amounts cannot be negative", async ({ page }) => {
    await page.goto("/admin/offers");
    await page.getByRole("button", { name: /New template/ }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByRole("button", { name: "Create template" }).click();
    expect(await dlg.getByLabel("Name").evaluate((e: HTMLInputElement) => e.validity.valueMissing)).toBe(true);
    await dlg.getByLabel("Name").fill(stamp());
    await dlg.locator("input[type=number]").fill("150");
    expect(await dlg.locator("input[type=number]").evaluate((e: HTMLInputElement) => e.validity.rangeOverflow)).toBe(true);
    await dlg.locator("input[type=number]").fill("-5");
    expect(await dlg.locator("input[type=number]").evaluate((e: HTMLInputElement) => e.validity.rangeUnderflow)).toBe(true);
    await dlg.getByRole("button", { name: "Cancel" }).click();
    await expect(dlg).toHaveCount(0);
  });

  test("A-10 edit, archive (with confirmation) and restore", async ({ page }) => {
    page.on("dialog", (d) => void d.accept());
    const name = stamp();
    await page.goto("/admin/offers");
    await newTemplate(page, name, "Percent off", "10");
    await page.locator("li", { hasText: name }).getByRole("button", { name: /Edit/ }).click();
    await page.getByRole("dialog").locator("input[type=number]").fill("20");
    await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator("li", { hasText: name })).toContainText("20% off");
    await page.locator("li", { hasText: name }).getByRole("button", { name: /Archive/ }).click();
    await expect(page.locator("li", { hasText: name })).toHaveCount(0);
    await page.getByRole("button", { name: /^Archived/ }).click();
    await expect(page.locator("li", { hasText: name })).toBeVisible();
    await page.locator("li", { hasText: name }).getByRole("button", { name: /Restore/ }).click();
    await page.getByRole("button", { name: /^Active/ }).click();
    await expect(page.locator("li", { hasText: name })).toBeVisible();
    await del("offer_templates", `name=eq.${encodeURIComponent(name)}`);
  });
});

test.describe("Running now", () => {
  test.beforeEach(async () => {
    await setOffers("ember", []); // the seed gives Ember a live offer that would change the group counts
  });

  test("A-10 REGRESSION: amount-off and fixed-price offers render (this page crashed server-side)", async ({ page }) => {
    await setOffers("copperleaf", [
      { title: "QA running percent", kind: "percent", value: 10, sku: "PRD-001", endsAt: new Date(Date.now() + 20 * DAY).toISOString() },
      { title: "QA running amount", kind: "amount_off", value: 300, sku: "DRY-101", endsAt: new Date(Date.now() + 20 * DAY).toISOString() },
      { title: "QA running fixed", kind: "fixed_price", value: 1250, sku: "MEAT-201", endsAt: new Date(Date.now() + 2 * DAY).toISOString() },
    ]);
    const res = await page.goto("/admin/offers?tab=running");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Running now" })).toBeVisible();
    await expect(page.getByText("QA running percent")).toBeVisible();
    await expect(page.getByText("QA running amount")).toBeVisible();
    await expect(page.getByText("QA running fixed")).toBeVisible();
    await expect(page.getByText("10% off", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("$3.00 off")).toBeVisible();
    await expect(page.getByText("$12.50 fixed price")).toBeVisible();
    await expect(page.getByText("Application error")).toHaveCount(0);
    await expect(page.getByText(/ENDING SOON/).first()).toBeVisible(); // the fixed-price one ends in 2 days
    expect(await pageProblems(page)).toEqual([]);
  });

  test("A-10 groups by urgency: ending soon, running, open-ended, scheduled, recently ended", async ({ page }) => {
    await setOffers("copperleaf", [
      { title: "QA soon", kind: "percent", value: 5, sku: "PRD-001", endsAt: new Date(Date.now() + 2 * DAY).toISOString() },
      { title: "QA later", kind: "amount_off", value: 100, sku: "DRY-101", endsAt: new Date(Date.now() + 30 * DAY).toISOString() },
      { title: "QA open", kind: "fixed_price", value: 900, sku: "DRY-104" },
      { title: "QA scheduled", kind: "percent", value: 5, sku: "PRD-002", startsAt: new Date(Date.now() + 5 * DAY).toISOString() },
      { title: "QA ended", kind: "amount_off", value: 100, sku: "PRD-003", startsAt: new Date(Date.now() - 20 * DAY).toISOString(), endsAt: new Date(Date.now() - 3 * DAY).toISOString() },
    ]);
    await page.goto("/admin/offers?tab=running");
    for (const h of [/Ending within 7 days \(1\)/, /^Running \(1\)/, /Open-ended \(1\)/, /Scheduled \(1\)/, /Ended in the last 14 days \(1\)/]) {
      await expect(page.getByRole("heading", { name: h })).toBeVisible();
    }
    await expect(page.getByText(/3 offers are live right now/)).toBeVisible();
  });

  test("A-10 empty state when nothing is running, scheduled or recently ended", async ({ page }) => {
    for (const k of ["copperleaf", "ember"]) await setOffers(k, []);
    await page.goto("/admin/offers?tab=running");
    await expect(page.getByText(/No offer is live right now/)).toBeVisible();
    await expect(page.getByText(/Nothing running, scheduled, or recently ended/)).toBeVisible();
  });
});

test.describe("apply a template", () => {
  test("A-10 apply to one customer from their page: the offer exists and shows on their Running now row", async ({ page }) => {
    const c = await customerByKey("copperleaf");
    await setOffers("copperleaf", []);
    const name = stamp();
    await page.goto("/admin/offers");
    await newTemplate(page, name, "Amount off", "2");
    await page.goto(`/admin/customers/${c.id}`);
    await page.getByRole("button", { name: /Apply template/ }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel(/Template/i).selectOption({ label: new RegExp(name) as unknown as string }).catch(async () => {
      const opts = await dlg.getByLabel(/Template/i).locator("option").allTextContents();
      await dlg.getByLabel(/Template/i).selectOption({ label: opts.find((o) => o.includes(name))! });
    });
    await dlg.getByRole("button", { name: "Apply template" }).click();
    await expect(dlg).toHaveCount(0);
    const rows = await select<{ title: string; discount_kind: string; discount_value: number }>(`customer_offers?select=title,discount_kind,discount_value&customer_id=eq.${c.id}`);
    expect(rows.some((r) => r.title === name && r.discount_kind === "amount_off" && r.discount_value === 200)).toBe(true);
    await page.goto("/admin/offers?tab=running");
    await expect(page.getByText(name)).toBeVisible();
    await expect(page.getByText("$2.00 off")).toBeVisible();
    await del("offer_templates", `name=eq.${encodeURIComponent(name)}`);
    await setOffers("copperleaf", []);
  });

  test("A-10 bulk apply previews exactly what happens, applies once, and Undo removes exactly that batch", async ({ page }) => {
    page.on("dialog", (d) => void d.accept());
    const name = stamp();
    for (const k of ["copperleaf", "ember", "juniper", "bluestone", "harbourline"]) await setOffers(k, []);
    await page.goto("/admin/offers");
    await newTemplate(page, name, "Percent off", "7");
    const tpl = (await select<{ id: string }>(`offer_templates?select=id&name=eq.${encodeURIComponent(name)}`))[0];
    await page.goto(`/admin/offers/apply/${tpl.id}`);
    await page.getByRole("button", { name: "All active customers" }).click();
    await expect(page.getByText(/5 customers get the offer/)).toBeVisible();
    await page.getByRole("button", { name: /^Apply to 5 customers/ }).click();
    await expect(page.getByText(/Applied|applied/).first()).toBeVisible({ timeout: 20_000 });
    expect(await select(`customer_offers?select=id&title=eq.${encodeURIComponent(name)}`)).toHaveLength(5);
    await page.goto("/admin/offers?tab=running");
    await page.getByRole("button", { name: /Undo batch \(5\)/ }).click();
    await expect(page.getByRole("button", { name: /Undo batch/ })).toHaveCount(0, { timeout: 15_000 });
    expect(await select(`customer_offers?select=id&title=eq.${encodeURIComponent(name)}`)).toHaveLength(0);
    await del("offer_templates", `name=eq.${encodeURIComponent(name)}`);
  });
});

void productBySku;
