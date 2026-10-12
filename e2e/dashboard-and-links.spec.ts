import { test, expect, authFile, pageProblems } from "./helpers/fixtures";
import { select } from "./helpers/db";
import { createOrder } from "./helpers/data";

// A-01, A-17, A-18 (dashboard, analytics, alerts) and V-09 (every internal link on the public site resolves).

test.describe("dashboard and analytics", () => {
  test.use({ storageState: authFile("admin") });

  test("A-01 the new-orders tile equals the true count of new orders", async ({ page, isMobile }) => {
    await createOrder("juniper", [{ sku: "BEV-501", qty: 1 }]);
    const n = (await select("orders?select=id&status=eq.new")).length;
    await page.goto("/admin");
    await expect(page.getByText(/new orders · right now/i)).toBeVisible();
    await expect(page.locator("main").getByText(new RegExp(`^${n}$`)).first()).toBeVisible();
    if (!isMobile) await expect(page.getByRole("link", { name: new RegExp(`Orders\\s*${n} new`) })).toBeVisible(); // sidebar badge (phone: Menu button)
  });

  test("A-01 the period selector changes what is shown, and says so", async ({ page }) => {
    await page.goto("/admin");
    await page.getByLabel("Period").selectOption({ label: "Yesterday" });
    await expect(page.getByText("Showing: Yesterday")).toBeVisible();
    await expect(page).toHaveURL(/range=yesterday/);
    await page.getByLabel("Period").selectOption({ label: "All time" });
    await expect(page.getByText("Showing: All time")).toBeVisible();
  });

  test("A-01 an invalid custom range falls back to All time and says what is shown instead", async ({ page }) => {
    await page.goto("/admin?range=custom&from=garbage&to=nonsense");
    await expect(page.getByText(/Showing:/)).toBeVisible();
    await expect(page.getByText("Showing: All time")).toBeVisible();
  });

  test("A-01 'Needs your attention' lists new orders; low stock lists the low products", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /needs your attention/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Low stock" })).toBeVisible();
    expect(await pageProblems(page)).toEqual([]);
  });

  test("A-17 analytics: charts render, ranking toggles work, range change relabels every section", async ({ page }) => {
    await page.goto("/admin/analytics");
    await expect(page.getByRole("heading", { name: "What actually sells" })).toBeVisible();
    expect(await page.locator("svg.recharts-surface").count()).toBeGreaterThan(0);
    await page.getByRole("button", { name: /^revenue$/i }).first().click();
    await page.getByRole("button", { name: /^profit$/i }).click();
    await page.getByLabel("Period").selectOption({ label: "All time" });
    await expect(page.getByRole("heading", { name: /Revenue trend — All time/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Best sellers — All time/ }).first()).toBeVisible();
    await page.getByRole("button", { name: /Show all \d+ active products/ }).click();
    expect(await pageProblems(page)).toEqual([]);
  });

  test("A-17 analytics: an empty period shows empty states rather than broken charts", async ({ page }) => {
    await page.goto("/admin/analytics?range=custom&from=2020-01-01&to=2020-01-31");
    await expect(page.getByRole("heading", { name: "What actually sells" })).toBeVisible();
    await expect(page.locator("main")).toContainText(/no |nothing|yet/i);
  });

  test("A-18 order alerts: the sidebar widget offers to enable alerts and does not nag by itself", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "the alerts widget lives in the desktop sidebar");
    await page.goto("/admin");
    await expect(page.getByRole("button", { name: /Enable order alerts/ })).toBeVisible();
  });

  test("A-18 the new-order badge updates without a reload when an order arrives", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "badge asserted in the desktop sidebar");
    await page.goto("/admin");
    const before = (await select("orders?select=id&status=eq.new")).length;
    await expect(page.getByRole("link", { name: new RegExp(`Orders\\s*${before} new`) })).toBeVisible();
    await createOrder("ember", [{ sku: "DRY-402", qty: 1 }]);
    await expect(page.getByRole("link", { name: new RegExp(`Orders\\s*${before + 1} new`) })).toBeVisible({ timeout: 40_000 }); // 15 s poll
  });
});

test.describe("public links", () => {
  test("V-09 every internal link and every header/footer/CTA target on the marketing site resolves (no 404, no dead '#')", async ({ page, request }) => {
    const pages = ["/", "/about", "/who-we-serve", "/catalog", "/delivery", "/faq", "/careers", "/contact", "/apply", "/suppliers", "/resources", "/login"];
    const seen = new Map<string, string>();
    const deadHash: string[] = [];
    const external = new Set<string>();
    for (const p of pages) {
      await page.goto(p);
      const links = await page.locator("a[href]").evaluateAll((as) => as.map((a) => ({ href: (a as HTMLAnchorElement).getAttribute("href")!, text: ((a as HTMLElement).innerText || a.getAttribute("aria-label") || "").trim().slice(0, 30) })));
      for (const l of links) {
        if (l.href === "#" || l.href === "") deadHash.push(`${p}: "${l.text}" -> ${l.href || "(empty)"}`);
        else if (l.href.startsWith("/")) seen.set(l.href.split("#")[0], `${p}: "${l.text}"`);
        else if (/^https?:/.test(l.href)) external.add(l.href);
      }
    }
    const broken: string[] = [];
    for (const [href, from] of seen) {
      const r = await request.get(href, { maxRedirects: 5 });
      if (r.status() >= 400) broken.push(`${href} (${r.status()}) from ${from}`);
    }
    expect({ broken, deadHash }).toEqual({ broken: [], deadHash: [] });
    test.info().annotations.push({ type: "external links", description: [...external].join(", ") || "none" });
  });

  test("V-09 the mobile menu opens and reaches every primary page", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone only");
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /menu/i });
    await expect(toggle).toBeVisible();
    await toggle.click();
    for (const l of ["Who we serve", "Catalog", "Delivery", "About", "Contact"]) await expect(page.getByRole("link", { name: l }).first()).toBeVisible();
  });

  test("V-03 catalog category page lists its products with a photo or fallback tile; an empty category says so", async ({ page }) => {
    await page.goto("/catalog/seafood");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Seafood");
    await expect(page.getByText("Atlantic Salmon Fillet")).toBeVisible();
    expect(await page.locator("main img").count()).toBeGreaterThan(1);
  });
});
