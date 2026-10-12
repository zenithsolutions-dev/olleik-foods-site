// Part B footage: every remaining screen of the full visitor manual and admin episodes 2-5 as FULL-PAGE captures at
// 3x (the V3 "one page, one world" camera travels over them), each interaction captured as its real "after" state.
// LOCAL demo stack only (videos/devstack). Actions change the local demo data only.
//   node videos/capture/v3-full.mjs [step,step]     steps: visitor, admin2, admin3, admin4, admin5
import { adminSignIn, blocked, context, customerSignIn, demo, go, launch, settle, shot, stepper, typeInto } from "./lib.mjs";

const { step, failures } = stepper(process.argv[2] ?? "");
const browser = await launch();
const top = (p) => p.evaluate(() => window.scrollTo(0, 0));
const allImages = async (p) => {
  await p.evaluate(() => document.querySelectorAll("img").forEach((i) => { i.loading = "eager"; i.decoding = "sync"; }));
  await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
  await p.waitForFunction(() => [...document.querySelectorAll("img")].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 60000 }).catch(() => {});
};
const full = async (p, key, desc, boxes, extra = {}) => { await top(p); return shot(p, key, desc, { boxes, full: true, wait: 900, ...extra }); };
const NAV = (label) => `aside a:has-text('${label}') >> nth=0`;
const DOC = { docHeader: ".doc-sheet header >> nth=0", docFooter: ".doc-sheet footer >> nth=0", sheet: ".doc-sheet >> nth=0" };
// The visitor's application (fictional, @olleik-demo.test): Marco applies for his restaurant
const APPLY = { businessName: "Copperleaf Kitchen", contactName: "Marco Bianchi", email: "marco@olleik-demo.test", phone: "(613) 555-0144" };

try {
  await step("visitor", async () => {
    const desk = await context(browser, "desktop");
    const p = await desk.newPage();
    await go(p, "/");
    await allImages(p);
    await full(p, "v3/home", "Public home (desktop, full page)", { nav: "header >> nth=0", headline: "main h1", lead: "main h1 + p", cta: "header a:has-text('Become a customer')", openAccount: "main a:has-text('Open a wholesale account') >> nth=0", hero: "main section >> nth=0" });
    await go(p, "/apply");
    const ab = { nav: "header >> nth=0", headline: "main h1", form: "form", businessName: "input[name=businessName]", contactName: "input[name=contactName]", email: "input[name=email]", phone: "input[name=phone]", address: "input[name=address]", businessType: "select[name=businessType]", monthlyVolume: "select[name=monthlyVolume]", notes: "#notes", submit: "form button[type=submit]" };
    await full(p, "v3/apply-0", "Apply: empty form", ab);
    for (const [k, v] of Object.entries(APPLY)) await typeInto(p, `input[name=${k}]`, v, 5);
    await typeInto(p, "input[name=address]", "41 Copper Lane, Ottawa, ON", 5);
    await p.selectOption("select[name=businessType]", { index: 1 }).catch(() => {});
    await p.selectOption("select[name=monthlyVolume]", { index: 2 }).catch(() => {});
    await typeInto(p, "#notes", "Bistro, dinner service Tue to Sun", 5);
    await full(p, "v3/apply-1", "Apply: filled", ab);
    await p.click("form button[type=submit]");
    await p.waitForTimeout(2500);
    await settle(p);
    await full(p, "v3/apply-2", "Apply: sent", { nav: "header >> nth=0", card: "main form, main [role=status], main section >> nth=0", headline: "main h1, main h2 >> nth=0" });
    await p.close();
    // sign in (desktop)
    const l = await desk.newPage();
    await go(l, "/login");
    const lb = { nav: "header >> nth=0", headline: "main h1", email: "input[type=email] >> nth=0", password: "input[type=password]", submit: "button[type=submit] >> nth=0", card: "main form >> nth=0" };
    await full(l, "v3/login-0", "Customer sign in (empty)", lb);
    await typeInto(l, "input[type=email] >> nth=0", demo.copperleaf.email, 5);
    await typeInto(l, "input[type=password]", demo.copperleaf.password, 5);
    await full(l, "v3/login-1", "Customer sign in (email typed, password dots)", lb);
    await l.close();
    await desk.close();
    const ctx = await context(browser, "desktop");
    const c = await customerSignIn(ctx);
    await settle(c, 1200);
    await allImages(c);
    await full(c, "v3/portal", "Portal dashboard (desktop)", { nav: "header >> nth=0", headline: "main h1", catalogCard: "main a:has-text('products available') >> nth=0", offersCard: "main a:has-text('promotion') >> nth=0", ordersCard: "main a:has-text('order') >> nth=0" });
    await go(c, "/portal/catalog");
    await allImages(c);
    const sb = { nav: "header >> nth=0", headline: "main h1", search: "main input >> nth=0", category: "main select >> nth=0", searchBtn: "main button:has-text('Search') >> nth=0", card0: "main .grid > div.overflow-hidden >> nth=0" };
    await typeInto(c, "main input >> nth=0", "salmon", 8);
    await full(c, "v3/search-1", "Catalog: 'salmon' typed in search", sb);
    await c.click("main button:has-text('Search') >> nth=0");
    await c.waitForTimeout(1500);
    await settle(c, 800);
    await allImages(c);
    await full(c, "v3/search-2", "Catalog: search results for salmon", sb);
    await go(c, "/portal/orders/statement");
    await settle(c, 1000);
    await full(c, "v3/statement", "Statement for a period (desktop)", { nav: "header >> nth=0", period: "main select >> nth=0", print: "button:has-text('Print')", ...DOC });
    await ctx.close();
  });

  const admin = async () => {
    const ctx = await context(browser, "desktop");
    const a = await adminSignIn(ctx);
    a.on("dialog", (d) => d.accept());
    return { ctx, a };
  };

  await step("admin2", async () => {
    const { ctx, a } = await admin();
    await go(a, "/admin/leads");
    const lb = { sidebar: "aside", headline: "main h1", first: "main :text('Riverside Noodle Bar') >> xpath=ancestor::*[self::li or self::article or self::div][2]", firstStatus: "main select:has(option[value=approved]) >> nth=0", leadsNav: NAV("Leads") };
    await full(a, "v3/leads-0", "Leads: a new application from last night", lb);
    await a.locator("main select:has(option[value=approved])").first().selectOption("approved");
    await a.waitForTimeout(1500);
    await settle(a, 600);
    await full(a, "v3/leads-1", "Leads: marked approved", lb);
    await go(a, "/admin/customers/new");
    const nb = { sidebar: "aside", headline: "main h1", fromLeads: "main button:has-text('approved leads')", lead: "main input[type=checkbox] >> nth=0 >> xpath=ancestor::*[self::label or self::li or self::div][1]", check: "main input[type=checkbox] >> nth=0", convert: "main button:has-text('Convert')" };
    await full(a, "v3/cust-new-0", "Add a customer from approved leads", nb);
    await a.locator("main input[type=checkbox]").first().check();
    await a.waitForTimeout(400);
    await full(a, "v3/cust-new-1", "Add a customer: lead selected", nb);
    await a.click("main button:has-text('Convert')");
    await a.waitForTimeout(3000);
    await settle(a, 1000);
    await go(a, "/admin/customers");
    await settle(a, 1000);
    await full(a, "v3/customers", "Customers (the new one included)", { sidebar: "aside", headline: "main h1", newOne: "main :text('Riverside Noodle Bar') >> xpath=ancestor::*[self::a or self::div][2]", first: "main :text('Copperleaf Kitchen') >> xpath=ancestor::*[self::a or self::div][2]", search: "main input >> nth=0" });
    await a.getByText("Copperleaf Kitchen").first().click();
    await a.waitForURL(/\/admin\/customers\/.+/);
    await settle(a, 1200);
    await full(a, "v3/cust-prices", "Customer detail: assigned products with their own prices", { sidebar: "aside", headline: "main h1", prices: "main h2:has-text('Assigned products'), main h3:has-text('Assigned products') >> nth=0", table: "main table >> nth=0", firstPrice: "main table tbody tr >> nth=0" });
    await ctx.close();
  });

  await step("admin3", async () => {
    const { ctx, a } = await admin();
    await go(a, "/admin/products");
    const pb = { sidebar: "aside", headline: "main h1", table: "main table >> nth=0", add: "main button:has-text('Add product')", stockCol: "main th:has-text('Stock')", lowRow: "main tr:has-text('Atlantic Salmon')" };
    await full(a, "v3/products-0", "Products: stock, cost, price, status", pb);
    await a.click("main button:has-text('Add product')");
    await a.waitForTimeout(900);
    const fb = { ...pb, dialog: "[role=dialog], form:has(button:has-text('Create product')) >> nth=0", sku: "input[placeholder='PRD-005']", name: "input[placeholder='Vine-Ripe Tomatoes']", size: "input[placeholder='25 lb']", create: "button:has-text('Create product')" };
    await full(a, "v3/product-add-0", "New product form (empty)", fb);
    await typeInto(a, "input[placeholder='PRD-005']", "PRD-032", 8);
    await typeInto(a, "input[placeholder='Vine-Ripe Tomatoes']", "Mini Sweet Peppers", 8);
    await typeInto(a, "input[placeholder='25 lb']", "5 lb", 8);
    await a.locator("form:has(button:has-text('Create product')) select, [role=dialog] select").first().selectOption({ label: "Produce" }).catch(() => {});
    const nums = a.locator("form:has(button:has-text('Create product')) input[type=number], [role=dialog] input[type=number]");
    const vals = ["21.50", "32.00", "60", "10"];
    for (let i = 0; i < Math.min(await nums.count(), vals.length); i++) await nums.nth(i).fill(vals[i]).catch(() => {});
    await full(a, "v3/product-add-1", "New product form (filled)", fb);
    await a.click("button:has-text('Create product')");
    await a.waitForTimeout(2500);
    await settle(a, 800);
    await full(a, "v3/products-1", "Products with Mini Sweet Peppers added", { ...pb, newRow: "main tr:has-text('Mini Sweet Peppers')" });
    await go(a, "/admin/categories");
    await full(a, "v3/categories", "Categories", { sidebar: "aside", headline: "main h1", table: "main table >> nth=0", produce: "main tr:has-text('Produce') >> nth=0" });
    await go(a, "/admin/assign");
    await full(a, "v3/assign", "Assign products to customers", { sidebar: "aside", headline: "main h1", pickProducts: "main :text('Pick products') >> xpath=ancestor::div[2]", pickCustomers: "main :text('Pick customers') >> xpath=ancestor::div[2]" });
    await ctx.close();
  });

  await step("admin4", async () => {
    const { ctx, a } = await admin();
    await go(a, "/admin/pricing");
    await full(a, "v3/pricing", "Margin rules", { sidebar: "aside", headline: "main h1", global: "main :text('Global default margin') >> xpath=ancestor::div[2]", product: "main :text('Product margins') >> xpath=ancestor::div[1]", category: "main :text('Category margins') >> xpath=ancestor::div[1]", customer: "main :text('Customer margins') >> xpath=ancestor::div[1]" });
    await go(a, "/admin/analytics");
    await a.locator("main select").first().selectOption({ label: "This month" }).catch(() => {});
    await settle(a, 1500);
    await full(a, "v3/analytics", "Analytics: revenue trend and best sellers", { sidebar: "aside", headline: "main h1", period: "main select >> nth=0", trend: "main :text('Revenue trend') >> xpath=ancestor::div[2]", best: "main :text('Best sellers') >> nth=0 >> xpath=ancestor::div[2]", table: "main table >> nth=0" });
    await go(a, "/admin/reports");
    await settle(a, 1200);
    await full(a, "v3/reports", "Report builder", { sidebar: "aside", headline: "main h1", presets: "main :text('Presets') >> xpath=ancestor::div[1]", sections: "main :text('Sections') >> xpath=ancestor::div[1]", print: "main button:has-text('Print')", ...DOC });
    await go(a, "/admin/documents/low-stock");
    await settle(a, 1200);
    await full(a, "v3/low-stock", "Low-stock statement", { print: "button:has-text('Print')", table: ".doc-sheet table >> nth=0", ...DOC });
    await ctx.close();
  });

  await step("admin5", async () => {
    const { ctx, a } = await admin();
    await go(a, "/admin/customers");
    await a.getByText("Riverside Noodle Bar").first().click();
    await a.waitForURL(/\/admin\/customers\/.+/);
    await settle(a, 1200);
    const db = { sidebar: "aside", headline: "main h1", portal: "main h2:has-text('Portal access') >> xpath=ancestor::div[2]", sendEmail: "main button:has-text('Send email')", copyLink: "main button:has-text('Copy link')", visibility: "main :text('Catalog visibility') >> xpath=ancestor::div[2]", checklist: "main :text('Setup checklist') >> xpath=ancestor::div[2]" };
    await full(a, "v3/cust-detail-0", "New customer: portal access not invited yet", db);
    await a.click("main button:has-text('Copy link')");
    await a.waitForTimeout(3000);
    await settle(a, 800);
    await full(a, "v3/cust-detail-1", "New customer: invite link generated", { ...db, linkBox: "main input[readonly], main code >> nth=0", copy: "main button:has-text('Copy') >> nth=1" });
    await ctx.close();
    const lctx = await context(browser, "desktop");
    const l = await lctx.newPage();
    await go(l, "/admin-login");
    const lb = { headline: "main h1, h1 >> nth=0", email: "input[type=email] >> nth=0", password: "input[type=password]", submit: "button[type=submit] >> nth=0", card: "main form >> nth=0, form >> nth=0" };
    await full(l, "v3/admin-login", "Admin sign in (only emails on the admin list)", lb);
    await lctx.close();
  });
  await step("portal2", async () => {
    const ctx = await context(browser, "desktop");
    const c = await customerSignIn(ctx);
    await go(c, "/portal/offers");
    await settle(c, 1000);
    await allImages(c);
    await full(c, "v3/offers", "Offers (desktop)", { nav: "header >> nth=0", headline: "main h1", offer: "main :text('Salmon Feature Week') >> xpath=ancestor::*[self::li or self::article or self::div][2]" });
    await go(c, "/portal/account");
    await settle(c, 1000);
    await full(c, "v3/account", "Account (desktop)", { nav: "header >> nth=0", headline: "main h1", card: "main section, main form >> nth=0" });
    await ctx.close();
  });

  await step("admin5b", async () => {
    const { ctx, a } = await admin();
    await go(a, "/admin/customers");
    await a.getByText("Riverside Noodle Bar").first().click();
    await a.waitForURL(/\/admin\/customers\/.+/);
    await settle(a, 1200);
    const db = { sidebar: "aside", headline: "main h1", badge: "main h1 + * >> nth=0", portal: "main h2:has-text('Portal access') >> xpath=ancestor::div[2]", sendEmail: "main button:has-text('Send email'), main button:has-text('Resend email') >> nth=0", copyLink: "main button:has-text('Copy link')", visibility: "main :text('Catalog visibility') >> xpath=ancestor::div[2]", status: "main :text-matches('Invite this customer|Invited', 'i') >> nth=0" };
    await full(a, "v3/cust-detail-0", "New customer: portal access not invited yet", db);
    await a.click("main button:has-text('Send email')");
    await a.waitForTimeout(3000);
    await settle(a, 800);
    await full(a, "v3/cust-detail-2", "New customer: invite email sent", db);
    await ctx.close();
  });
  // V3.2 §10.1: every document screen, now with the fictional demo business details in the header (dev.mjs env),
  // plus the customer's order page (status) for the voiced visitor manual.
  await step("docs", async () => {
    const SHEET = { headline: "main h1, h1 >> nth=0", print: "button:has-text('Print') >> nth=0", ...DOC, table: ".doc-sheet table >> nth=0" };
    const ctx = await context(browser, "desktop");
    const c = await customerSignIn(ctx);
    await go(c, "/portal/orders");
    const firstHref = await c.locator("main a[href*='/portal/orders/']:not([href$='statement'])").first().getAttribute("href");
    await go(c, firstHref);
    await settle(c, 1000);
    await allImages(c);
    await full(c, "v3/order-detail", "Customer order page: status and items", { nav: "header >> nth=0", headline: "main h1", status: "main :text-matches('received|confirmed|ready|completed|prepared', 'i') >> nth=0", items: "main table >> nth=0, main ul >> nth=0", invoice: "main a:has-text('Invoice'), main button:has-text('Invoice') >> nth=0" });
    await go(c, firstHref.replace(/\/$/, "") + "/invoice");
    await settle(c, 1200);
    await full(c, "v3/doc-invoice", "Customer invoice (demo business details)", SHEET);
    await go(c, "/portal/orders/statement");
    await settle(c, 1200);
    await full(c, "v3/doc-statement", "Customer statement (demo business details)", { ...SHEET, period: "main select >> nth=0" });
    await ctx.close();

    const { ctx: actx, a } = await admin();
    await go(a, "/admin/orders");
    const ah = await a.locator("main a[href*='/admin/orders/']").first().getAttribute("href");
    await go(a, ah.replace(/\/$/, "") + "/invoice");
    await settle(a, 1200);
    await full(a, "v3/doc-admin-invoice", "Admin invoice (demo business details)", SHEET);
    await go(a, "/admin/customers");
    await a.getByText("Copperleaf Kitchen").first().click();
    await a.waitForURL(/\/admin\/customers\/.+/);
    const cu = a.url().replace(/[?#].*$/, "").replace(/\/$/, "");
    await go(a, cu + "/statement");
    await settle(a, 1200);
    await full(a, "v3/doc-admin-statement", "Admin customer statement (demo business details)", SHEET);
    await go(a, "/admin/documents/products");
    await settle(a, 1200);
    await full(a, "v3/doc-products", "Products statement (demo business details)", SHEET);
    await go(a, "/admin/documents/low-stock");
    await settle(a, 1200);
    await full(a, "v3/doc-low-stock", "Low-stock statement (demo business details)", SHEET);
    await go(a, "/admin/documents/out-of-stock");
    await settle(a, 1200);
    await full(a, "v3/doc-out-of-stock", "Out-of-stock statement (demo business details)", SHEET);
    await go(a, "/admin/reports");
    await settle(a, 1500);
    await full(a, "v3/doc-reports", "Report builder (demo business details)", { sidebar: "aside", headline: "main h1", presets: "main :text('Presets') >> xpath=ancestor::div[1]", sections: "main :text('Sections') >> xpath=ancestor::div[1]", print: "main button:has-text('Print')", ...DOC });
    await actx.close();
  });
} finally {
  await browser.close();
  console.log(`blocked requests: ${blocked.length}`);
  if (failures.length) console.log("FAILURES:\n" + failures.join("\n"));
}
