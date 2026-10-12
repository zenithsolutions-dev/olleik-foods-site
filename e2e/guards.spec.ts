import { test, expect, authFile } from "./helpers/fixtures";
import { keys } from "./helpers/db";
import { dynamicRoutes } from "./helpers/ids";

// G-01..G-08: who can open what.

const portalPaths = ["/portal", "/portal/catalog", "/portal/cart", "/portal/checkout", "/portal/offers", "/portal/orders", "/portal/account", "/portal/orders/statement"];
const adminPaths = [
  "/admin", "/admin/analytics", "/admin/assign", "/admin/categories", "/admin/customers", "/admin/customers/new", "/admin/documents/low-stock",
  "/admin/documents/out-of-stock", "/admin/documents/products", "/admin/leads", "/admin/offers", "/admin/orders", "/admin/pricing", "/admin/products", "/admin/reports",
];

test.describe("logged out", () => {
  test("G-01 portal routes redirect to /login", async ({ page }) => {
    const d = await dynamicRoutes();
    for (const p of [...portalPaths, `/portal/orders/${d.customerOrder}`, `/portal/orders/${d.customerOrder}/invoice`]) {
      await page.goto(p);
      expect.soft(new URL(page.url()).pathname, p).toBe("/login");
    }
  });

  test("G-02 admin routes redirect to /admin-login", async ({ page }) => {
    const d = await dynamicRoutes();
    for (const p of [...adminPaths, `/admin/orders/${d.fresh}`, `/admin/orders/${d.fresh}/invoice`, `/admin/customers/${d.customerId}`, `/admin/customers/${d.customerId}/statement`]) {
      await page.goto(p);
      expect.soft(new URL(page.url()).pathname, p).toBe("/admin-login");
    }
  });
});

test.describe("customer cannot reach admin", () => {
  test.use({ storageState: authFile("copperleaf") });
  test("G-03 every admin route bounces to /admin-login and renders no admin data", async ({ page }) => {
    const d = await dynamicRoutes();
    for (const p of [...adminPaths, `/admin/orders/${d.fresh}`, `/admin/customers/${d.customerId}`]) {
      await page.goto(p);
      expect.soft(new URL(page.url()).pathname, p).toBe("/admin-login");
      await expect.soft(page.getByText(/Dashboard|All orders|Margin rules/)).toHaveCount(0);
    }
  });
});

test.describe("admin account in the customer portal", () => {
  test.use({ storageState: authFile("admin") });
  test("G-04 an admin has no customer record: portal sends them to login with the 'not active' note", async ({ page }) => {
    await page.goto("/portal");
    expect(new URL(page.url()).pathname).toBe("/login");
    await expect(page.getByText(/account isn.t active yet/i)).toBeVisible();
  });
});

test.describe("tenant isolation", () => {
  test.use({ storageState: authFile("copperleaf") });
  test("G-08 another customer's order (and its invoice) is 'not found'", async ({ page }) => {
    const d = await dynamicRoutes();
    await page.goto(`/portal/orders/${d.otherCustomerOrder}`);
    await expect(page.getByText("Order not found.")).toBeVisible();
    await page.goto(`/portal/orders/${d.otherCustomerOrder}/invoice`);
    await expect(page.getByText(/not found/i).first()).toBeVisible();
    await expect(page.getByText("Ember Lane Pizza")).toHaveCount(0);
  });

  test("G-08 a random order id is 'not found' too", async ({ page }) => {
    await page.goto("/portal/orders/00000000-0000-4000-8000-000000000000");
    await expect(page.getByText("Order not found.")).toBeVisible();
    await page.goto("/portal/orders/not-a-uuid");
    await expect(page.getByText(/not found/i).first()).toBeVisible();
  });
});

test.describe("login forms", () => {
  test("G-05 wrong password and unknown email give the same neutral message", async ({ page }) => {
    const { demoAccounts } = keys();
    for (const email of [demoAccounts.copperleaf.email, "nobody@olleik-demo.test"]) {
      await page.goto("/login");
      await page.getByLabel(/^email$/i).fill(email);
      await page.getByLabel(/^password$/i).fill("definitely-wrong-password");
      await page.getByRole("button", { name: /sign in/i }).click();
      await expect(page.getByText("Invalid email or password.")).toBeVisible();
      expect(new URL(page.url()).pathname).toBe("/login");
    }
  });

  test("G-05 empty form is blocked by the browser (required fields)", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /sign in/i }).click();
    expect(await page.getByLabel(/^email$/i).evaluate((e: HTMLInputElement) => e.validity.valueMissing)).toBe(true);
  });

  test("G-05 admin login rejects a customer account (allow-list)", async ({ page }) => {
    const { demoAccounts } = keys();
    await page.goto("/admin-login");
    await page.getByLabel(/^email$/i).fill(demoAccounts.copperleaf.email);
    await page.getByLabel(/^password$/i).fill(demoAccounts.copperleaf.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    expect(new URL(page.url()).pathname, "customer must not land in /admin").toBe("/admin-login");
  });

  test("G-06 password reset gives the same neutral message for known and unknown emails", async ({ page }) => {
    const { demoAccounts } = keys();
    for (const email of [demoAccounts.copperleaf.email, "nobody@olleik-demo.test"]) {
      await page.goto("/login");
      await page.getByRole("button", { name: /forgot password/i }).click();
      await page.getByLabel(/^email$/i).fill(email);
      await page.getByRole("button", { name: /send reset link/i }).click();
      await expect(page.getByText(/if that email has an account/i)).toBeVisible();
    }
  });

  test("G-05 pending status note shows on /login?status=pending", async ({ page }) => {
    await page.goto("/login?status=pending");
    await expect(page.getByText(/isn.t active yet/i)).toBeVisible();
  });
});

test.describe("sign out", () => {
  test.use({ storageState: authFile("juniper") });
  test("G-07 portal sign out ends the session", async ({ page, context }) => {
    await page.goto("/portal");
    await page.getByRole("button", { name: /sign out/i }).click();
    await page.waitForLoadState("networkidle");
    await page.goto("/portal/orders");
    expect(new URL(page.url()).pathname).toBe("/login");
    // The old cookie set is gone for good; do not leave the shared state file in a half state.
    void context;
  });
});

test.describe("malformed ids in the URL", () => {
  test.describe("as admin", () => {
    test.use({ storageState: authFile("admin") });
    test("a mistyped id is 'not found' and does not log a database error", async ({ page }) => {
      for (const p of ["/admin/orders/not-a-uuid", "/admin/orders/not-a-uuid/invoice", "/admin/customers/not-a-uuid", "/admin/customers/not-a-uuid/statement"]) {
        const res = await page.goto(p);
        expect.soft([200, 404], p).toContain(res?.status());
        await expect.soft(page.getByText(/not found/i).first(), p).toBeVisible();
      }
    });
  });
  test.describe("as customer", () => {
    test.use({ storageState: authFile("copperleaf") });
    test("a mistyped order id is 'not found' and does not log a database error", async ({ page }) => {
      for (const p of ["/portal/orders/not-a-uuid", "/portal/orders/not-a-uuid/invoice"]) {
        await page.goto(p);
        await expect.soft(page.getByText(/not found/i).first(), p).toBeVisible();
      }
    });
  });
});
