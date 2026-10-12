import { test, expect, authFile, pageProblems } from "./helpers/fixtures";
import { select } from "./helpers/db";

// Route sweep: every page, as the role that should see it, at phone and desktop width.
// Per page: HTTP status, no console/page errors, no failed or 5xx requests (the auto `issues` fixture),
// no horizontal overflow, no broken or alt-less images, every form control labelled, every button/link named.

type Route = { path: string; heading?: RegExp | string; role: "public" | "admin" | "copperleaf" };

async function dynamicRoutes() {
  const orders = await select<{ id: string; status: string }>("orders?select=id,status&order=created_at.desc&limit=200");
  const completed = orders.find((o) => o.status === "completed")!.id;
  const fresh = orders.find((o) => o.status === "new")!.id;
  const cl = await select<{ id: string }>("customers?select=id&business_name=eq.Copperleaf%20Kitchen");
  const clOrders = await select<{ id: string }>(`orders?select=id&customer_id=eq.${cl[0].id}&order=created_at.desc&limit=1`);
  const tpl = await select<{ id: string }>("offer_templates?select=id&limit=1");
  return { completed, fresh, customerId: cl[0].id, customerOrder: clOrders[0].id, templateId: tpl[0].id };
}

const PUBLIC: Route[] = [
  "/", "/about", "/apply", "/careers", "/catalog", "/contact", "/delivery", "/faq", "/login", "/resources",
  "/resources/how-wholesale-food-pricing-works", "/resources/cut-food-cost-without-cutting-quality",
  "/resources/questions-before-choosing-a-wholesale-food-supplier", "/suppliers", "/who-we-serve", "/admin-login",
].map((path) => ({ path, role: "public" as const }));

test.describe("public pages", () => {
  for (const r of PUBLIC) {
    test(`${r.path}`, async ({ page }) => {
      const res = await page.goto(r.path);
      expect(res?.status(), "http status").toBe(200);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("h1").first()).toBeVisible();
      expect(await pageProblems(page)).toEqual([]);
    });
  }

  test("catalog category pages", async ({ page }) => {
    await page.goto("/catalog");
    const hrefs = [...new Set(await page.locator('a[href^="/catalog/"]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!)))];
    expect(hrefs.length).toBeGreaterThan(3);
    for (const h of hrefs) {
      const res = await page.goto(h);
      expect.soft(res?.status(), h).toBe(200);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("h1").first()).toBeVisible();
      expect.soft(await pageProblems(page), h).toEqual([]);
    }
  });

  test("unknown route is a real 404 page", async ({ page }) => {
    const res = await page.goto("/definitely-not-here");
    expect(res?.status()).toBe(404);
    expect(await pageProblems(page)).toEqual([]);
  });
});

type Ids = Awaited<ReturnType<typeof dynamicRoutes>>;
let ids: Ids;
test.beforeAll(async () => {
  ids = await dynamicRoutes();
});

const portalPaths: ((d: Ids) => string)[] = [
  () => "/portal", () => "/portal/catalog", () => "/portal/cart", () => "/portal/checkout", () => "/portal/offers",
  () => "/portal/orders", () => "/portal/account", () => "/portal/orders/statement",
  (d) => `/portal/orders/${d.customerOrder}`, (d) => `/portal/orders/${d.customerOrder}/invoice`,
];
const adminPaths: ((d: Ids) => string)[] = [
  () => "/admin", () => "/admin/analytics", () => "/admin/assign", () => "/admin/categories", () => "/admin/customers",
  () => "/admin/customers/new", (d) => `/admin/customers/${d.customerId}`, (d) => `/admin/customers/${d.customerId}/statement`,
  (d) => `/admin/customers/${d.customerId}/statement/internal`, () => "/admin/documents/low-stock",
  () => "/admin/documents/out-of-stock", () => "/admin/documents/products", () => "/admin/leads", () => "/admin/offers",
  () => "/admin/offers?tab=running", (d) => `/admin/offers/apply/${d.templateId}`, () => "/admin/orders",
  (d) => `/admin/orders/${d.fresh}`, (d) => `/admin/orders/${d.completed}`, (d) => `/admin/orders/${d.completed}/invoice`,
  () => "/admin/pricing", () => "/admin/products", () => "/admin/reports",
];

for (const [role, group, paths] of [
  ["copperleaf", "customer portal", portalPaths],
  ["admin", "admin", adminPaths],
] as const) {
  test.describe(`${group} pages`, () => {
    test.use({ storageState: authFile(role) });
    for (const mk of paths) {
      test(mk({ completed: "<completed-order>", fresh: "<new-order>", customerId: "<customer>", customerOrder: "<own-order>", templateId: "<template>" }), async ({ page }) => {
        const p = mk(ids);
        const res = await page.goto(p);
        expect(res?.status(), "http status").toBe(200);
        await page.waitForLoadState("networkidle");
        expect.soft(await pageProblems(page)).toEqual([]);
      });
    }
  });
}
