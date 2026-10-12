// V-ADMIN footage (desktop, 3×), demo admin of the LOCAL database. Actions (confirm an order, add a product, approve a
// lead) change the local demo data only; re-seed with devstack/seed.mjs to repeat.
//   node videos/capture/admin.mjs [prefix]
import { blocked, context, demo, go, launch, settle, shot, stepper, textBox, typeInto } from "./lib.mjs";

const { step, failures } = stepper(process.argv[2] ?? "");
const browser = await launch();
const accept = (p) => p.on("dialog", (d) => d.accept());
const top = (p) => p.evaluate(() => window.scrollTo(0, 0));
const scrollToText = (p, re, off = 140) =>
  p.evaluate(([src, o]) => {
    const r = new RegExp(src, "i");
    const el = [...document.querySelectorAll("main h1, main h2, main h3, main p, main span, main div")].find((x) => x.children.length === 0 && r.test(x.textContent ?? ""));
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - o);
  }, [re, off]);
const NAV = (label) => `aside a:has-text('${label}'), nav a:has-text('${label}') >> nth=0`;
try {
  const ctx = await context(browser, "desktop");
  let p;

  await step("login", async () => {
    p = await ctx.newPage();
    accept(p);
    await go(p, "/admin-login");
    const b = { email: "input[type=email] >> nth=0", password: "input[type=password]", submit: "button[type=submit] >> nth=0", card: "main form >> nth=0, form >> nth=0" };
    await shot(p, "admin/login", "Admin sign in (empty)", { boxes: b });
    await typeInto(p, "input[type=email] >> nth=0", demo.admin.email, 5);
    await typeInto(p, "input[type=password]", demo.admin.password, 5);
    await shot(p, "admin/login-filled", "Admin sign in (demo admin, password dots)", { boxes: b });
    await p.click("button[type=submit] >> nth=0");
    await p.waitForURL(/\/admin(\/|$)/, { timeout: 60000 });
    await settle(p, 1500);
  });

  await step("dashboard", async () => {
    await go(p, "/admin");
    await shot(p, "admin/dashboard", "Dashboard: today", { boxes: { headline: "main h1", newOrders: "main :text-matches('New orders', 'i') >> xpath=ancestor::*[self::div or self::a][1]", revenue: "main :text-matches('Today.s revenue', 'i') >> xpath=ancestor::div[1]", profit: "main :text-matches('Today.s profit', 'i') >> xpath=ancestor::div[1]", awaiting: "main :text-matches('Awaiting confirmation', 'i') >> nth=0", period: "main select >> nth=0", ordersNav: NAV("Orders"), sidebar: "aside >> nth=0" } });
    await scrollToText(p, "Needs your attention", 120);
    await shot(p, "admin/dashboard-attention", "Dashboard: needs your attention (low stock)", { boxes: { attention: "main :text-matches('Needs your attention', 'i') >> nth=0", lowStock: "main :text('Low stock') >> xpath=ancestor::div[2]", manageStock: "main a:has-text('Manage stock') >> nth=0" } });
    await top(p);
    await go(p, "/admin");
    await scrollToText(p, "Top products", 160);
    await shot(p, "admin/dashboard-top", "Dashboard: top products and customers today", { boxes: { topProducts: "main :text-matches('Top products', 'i') >> xpath=ancestor::div[1]", topCustomers: "main :text-matches('Top customers', 'i') >> xpath=ancestor::div[1]" } });
  });

  await step("orders", async () => {
    await go(p, "/admin/orders");
    const ob = { headline: "main h1", newTab: "main button:has-text('New'), main a:has-text('New') >> nth=0", firstRow: "main a[href^='/admin/orders/'] >> nth=0", list: "main ul, main table >> nth=0", newBadge: NAV("Orders") };
    await shot(p, "admin/orders", "Orders: all, with new ones on top", { boxes: ob });
    await p.locator("main button:has-text('New'), main a:has-text('New')").first().click().catch(() => {});
    await p.waitForTimeout(700);
    await shot(p, "admin/orders-new", "Orders: New tab", { boxes: ob });
    await p.getByText("Harbourline Catering").first().click();
    await p.waitForURL(/\/admin\/orders\/.+/);
    await settle(p, 1000);
    const db = { headline: "main h1", status: "main h1 ~ * :text-matches('^new$', 'i'), main :text-matches('^NEW$') >> nth=0", note: "main :text('Corporate lunch') >> nth=0", items: "main table >> nth=0", total: "main :text('Totals') >> xpath=ancestor::tr[1]", confirm: "main button:has-text('Confirm order')", cancel: "main button:has-text('Cancel order')", invoice: "main a:has-text('Invoice') >> nth=0", profit: "main th:has-text('Profit')" };
    await shot(p, "admin/order-new", "Order detail: new order with a delivery note", { boxes: db });
    await p.click("main button:has-text('Confirm order')");
    await p.waitForTimeout(2500);
    await settle(p, 800);
    await shot(p, "admin/order-confirmed", "Order detail: confirmed (stock deducted)", { boxes: { ...db, prepared: "main button:has-text('Mark prepared')", message: "main :text-matches('Confirmed', 'i') >> nth=0" } });
    await p.click("main button:has-text('Mark prepared')");
    await p.waitForTimeout(2500);
    await settle(p, 800);
    const done = p.locator("main button:has-text('complete'), main button:has-text('Complete')").first();
    await shot(p, "admin/order-prepared", "Order detail: prepared", { boxes: { ...db, complete: "main button:has-text('omplete') >> nth=0" } });
    if (await done.count()) {
      await done.click();
      await p.waitForTimeout(2500);
      await settle(p, 800);
      await shot(p, "admin/order-completed", "Order detail: completed", { boxes: db });
    }
    const inv = p.locator("main a:has-text('Invoice')").first();
    await inv.click();
    await p.waitForURL(/invoice/);
    await settle(p, 1000);
    await shot(p, "admin/invoice", "Invoice for the order (print / PDF)", { boxes: { print: "button:has-text('Print')", sheet: ".doc-sheet >> nth=0", lines: ".doc-sheet table >> nth=0" } });
  });

  await step("leads", async () => {
    await go(p, "/admin/leads");
    const lb = { headline: "main h1", tabs: "main :text('All') >> xpath=ancestor::div[1]", first: "main :text('Riverbend Bistro'), main :text('Riverside Noodle Bar') >> nth=0 >> xpath=ancestor::*[self::li or self::article or self::div][2]", firstStatus: "main select:has(option[value=approved]) >> nth=0" };
    await shot(p, "admin/leads", "Leads: website applications (incl. the one sent in the visitor video)", { boxes: lb });
    await p.locator("main select:has(option[value=approved])").first().selectOption("approved");
    await p.waitForTimeout(1500);
    await settle(p, 600);
    await shot(p, "admin/leads-approved", "Leads: the newest application marked approved", { boxes: lb });
    await go(p, "/admin/customers/new");
    await shot(p, "admin/customer-new", "Add a customer: from approved leads", { boxes: { headline: "main h1", fromLeads: "main button:has-text('approved leads')", manual: "main button:has-text('Manual entry')", lead: "main input[type=checkbox] >> nth=0 >> xpath=ancestor::*[self::label or self::li or self::div][1]", convert: "main button:has-text('Convert')" } });
  });

  await step("customers", async () => {
    await go(p, "/admin/customers");
    await shot(p, "admin/customers", "Customers: cards with status, terms, catalog size", { boxes: { headline: "main h1", first: "main :text('Bluestone Bakehouse') >> xpath=ancestor::*[self::a or self::div][2]", add: "main a:has-text('Add customer'), main button:has-text('Add customer') >> nth=0", search: "main input >> nth=0" } });
    await p.getByText("Copperleaf Kitchen").first().click();
    await p.waitForURL(/\/admin\/customers\/.+/);
    await settle(p, 1000);
    const cb = { headline: "main h1", portal: "main :text('Portal access') >> xpath=ancestor::div[2]", checklist: "main :text('Setup checklist') >> xpath=ancestor::div[2]", visibility: "main :text('Catalog visibility') >> xpath=ancestor::div[2]" };
    await shot(p, "admin/customer-detail", "Customer detail: portal access, setup checklist, visibility", { boxes: cb });
    await p.evaluate(() => {
      const h = [...document.querySelectorAll("main h2, main h3")].find((x) => /^Assigned products/i.test(x.textContent?.trim() ?? ""));
      if (h) window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 90);
    });
    await shot(p, "admin/customer-prices", "Customer detail: assigned products with their own prices", { boxes: { heading: "main h2:has-text('Assigned products'), main h3:has-text('Assigned products') >> nth=0", table: "main table >> nth=0", firstPrice: "main table tbody tr >> nth=0" } });
  });

  await step("products", async () => {
    await go(p, "/admin/products");
    const pb = { headline: "main h1", table: "main table >> nth=0", lowNote: "main :text-matches('low-stock', 'i') >> nth=0", add: "main button:has-text('Add product')", search: "main input[placeholder*='Search'] >> nth=0", stockCol: "main th:has-text('Stock')", outRow: "main tr:has-text('Atlantic Salmon')" };
    await shot(p, "admin/products", "Products: stock, cost, price, status", { boxes: pb });
    await p.click("main button:has-text('Add product')");
    await p.waitForTimeout(800);
    const fb = { dialog: "[role=dialog], form:has(button:has-text('Create product')) >> nth=0", sku: "input[placeholder='PRD-005']", name: "input[placeholder='Vine-Ripe Tomatoes']", size: "input[placeholder='25 lb']", price: "input[placeholder='e.g. 10'], input[placeholder='0'] >> nth=0", create: "button:has-text('Create product')" };
    await shot(p, "admin/product-add", "New product form (empty)", { boxes: fb });
    await typeInto(p, "input[placeholder='PRD-005']", "PRD-007", 10);
    await typeInto(p, "input[placeholder='Vine-Ripe Tomatoes']", "Red Bell Peppers", 10);
    await typeInto(p, "input[placeholder='25 lb']", "11 lb", 10);
    await p.locator("form:has(button:has-text('Create product')) select, [role=dialog] select").first().selectOption({ label: "Produce" }).catch(() => {});
    const nums = p.locator("form:has(button:has-text('Create product')) input[type=number], [role=dialog] input[type=number]");
    const vals = ["21.50", "32.00", "60", "10"];
    for (let i = 0; i < Math.min(await nums.count(), vals.length); i++) await nums.nth(i).fill(vals[i]).catch(() => {});
    await shot(p, "admin/product-filled", "New product form (filled, demo values)", { boxes: fb });
    await p.click("button:has-text('Create product')");
    await p.waitForTimeout(2500);
    await settle(p, 800);
    await shot(p, "admin/product-created", "Products after adding Red Bell Peppers", { boxes: { ...pb, newRow: "main tr:has-text('Red Bell Peppers')" } });
    await go(p, "/admin/categories");
    await shot(p, "admin/categories", "Categories", { boxes: { headline: "main h1", table: "main table >> nth=0", add: "main :text('Add a category') >> xpath=ancestor::div[1]" } });
  });

  await step("pricing", async () => {
    await go(p, "/admin/assign");
    await shot(p, "admin/assign", "Assign products to customers", { boxes: { headline: "main h1", pickProducts: "main :text('Pick products') >> xpath=ancestor::div[2]", pickCustomers: "main :text('Pick customers') >> xpath=ancestor::div[2]" } });
    await go(p, "/admin/pricing");
    await shot(p, "admin/pricing", "Margin rules", { boxes: { headline: "main h1", global: "main :text('Global default margin') >> xpath=ancestor::div[2]", product: "main :text('Product margins') >> xpath=ancestor::div[1]", category: "main :text('Category margins') >> xpath=ancestor::div[1]", customer: "main :text('Customer margins') >> xpath=ancestor::div[1]" } });
    await go(p, "/admin/offers");
    await shot(p, "admin/offers", "Offer library", { boxes: { headline: "main h1", templates: "main ul, main table >> nth=0", applyMany: "main :text('Apply to many') >> nth=0", newTemplate: "main button:has-text('New template')" } });
    await p.getByText(/Apply to many/).first().click();
    await p.waitForURL(/offers\/apply/);
    await settle(p, 1200);
    await shot(p, "admin/offers-apply", "Apply an offer template to many customers", { boxes: { headline: "main h1", who: "main :text('Who gets it') >> xpath=ancestor::div[2]", when: "main :text-matches('^When$') >> xpath=ancestor::div[2]", preview: "main :text('Exactly what will happen') >> xpath=ancestor::div[2]", apply: "main button:has-text('Apply to')" } });
  });

  await step("numbers", async () => {
    await go(p, "/admin/analytics");
    await p.locator("main select").first().selectOption({ label: "Last month" }).catch(() => {});
    await p.waitForTimeout(500);
    await p.locator("main select").first().selectOption({ label: "This month" }).catch(() => {});
    await settle(p, 1500);
    await shot(p, "admin/analytics", "Analytics: revenue trend and best sellers", { boxes: { headline: "main h1", trend: "main :text('Revenue trend') >> xpath=ancestor::div[2]", best: "main :text('Best sellers') >> nth=0 >> xpath=ancestor::div[2]", period: "main select >> nth=0" } });
    await scrollToText(p, "Best sellers", 60);
    await p.evaluate(() => window.scrollBy(0, 300));
    await shot(p, "admin/analytics-table", "Analytics: best sellers table (units, revenue, profit)", { boxes: { table: "main table >> nth=0" } });
    await go(p, "/admin/reports");
    await shot(p, "admin/reports", "Report builder", { boxes: { headline: "main h1", presets: "main :text('Presets') >> xpath=ancestor::div[1]", sections: "main :text('Sections') >> xpath=ancestor::div[1]", print: "main button:has-text('Print')", sheet: ".doc-sheet >> nth=0" } });
    await go(p, "/admin/documents/low-stock");
    await shot(p, "admin/low-stock", "Low-stock statement", { boxes: { sheet: ".doc-sheet >> nth=0", table: ".doc-sheet table >> nth=0", print: "button:has-text('Print')" } });
  });
} finally {
  await browser.close();
  console.log(`blocked requests: ${blocked.length}${blocked.length ? "\n  " + [...new Set(blocked)].slice(0, 20).join("\n  ") : ""}`);
  if (failures.length) console.log("FAILURES:\n" + failures.join("\n"));
}
void textBox;
