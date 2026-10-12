// FULL SYSTEM film (feat/videos-full): every capture of the cause-and-effect story, taken IN STORY ORDER so each
// "before" and "after" is the real state of the LOCAL demo app at that moment (customer = phone, admin = desktop).
// LOCAL demo stack only (videos/devstack). The run changes the local demo data only: reseed before a full run.
//   node devstack/seed.mjs && node devstack/photos.mjs && node capture/full.mjs [stage,stage]
// Captures: public/footage/v3/f-*.png (+ manifest boxes). State between stages: out/full-state.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { adminSignIn, blocked, context, go, launch, settle, shot, stepper, typeInto } from "./lib.mjs";

const { step, failures } = stepper(process.argv[2] ?? "");
const STATE = "out/full-state.json";
const st = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
const save = () => writeFileSync(STATE, JSON.stringify(st, null, 1));
const browser = await launch();

// The new customer of the story (fictional, @olleik-demo.test).
export const NEW = { business: "Cedar Table Bistro", contact: "Amira Saleh", email: "cedartable@olleik-demo.test", phone: "(613) 555-0108", address: "18 Cedar Street, Ottawa, ON", notes: "Neighbourhood bistro, lunch and dinner service", password: "Cedar-Table-Demo-2026" };

const allImages = async (p) => {
  await p.evaluate(() => document.querySelectorAll("img").forEach((i) => { i.loading = "eager"; i.decoding = "sync"; }));
  await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 100)); } window.scrollTo(0, 0); });
  await p.waitForFunction(() => [...document.querySelectorAll("img")].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 60000 }).catch(() => {});
};
/** Full-page capture from the top, every image loaded; key "f-…" (stored as v3/f-…). */
const full = async (p, key, desc, boxes = {}, extra = {}) => {
  await allImages(p);
  await p.evaluate(() => window.scrollTo(0, 0));
  return shot(p, `v3/f-${key}`, desc, { boxes, full: true, wait: 900, ...extra });
};
const HDR = { nav: "header >> nth=0" };
const AS = { sidebar: "aside", headline: "main h1" };
const NAV = (label) => `aside a:has-text('${label}') >> nth=0`;
const DOC = { docHeader: ".doc-sheet header >> nth=0", docFooter: ".doc-sheet footer >> nth=0", sheet: ".doc-sheet >> nth=0", table: ".doc-sheet table >> nth=0" };
const card = (text) => `main :text('${text}') >> xpath=ancestor::*[self::li or self::article or self::div][2]`;

// Persistent contexts: the customer's phone (visitor first, then the invited customer) and the admin's desktop.
const phone = await context(browser, "phone");
const C = await phone.newPage();
const desk = await context(browser, "desktop");
const A = await adminSignIn(desk);
A.on("dialog", (d) => d.accept());
const reload = async (p) => { await p.reload({ waitUntil: "load" }); await settle(p, 900); };
// Later stages run in a new process: the customer signs in on the phone with the password set in S2.
if (st.signedUp) {
  await go(C, "/login");
  await typeInto(C, "input[type=email] >> nth=0", NEW.email, 2);
  await typeInto(C, "input[type=password]", NEW.password, 2);
  await C.click("button[type=submit] >> nth=0");
  await C.waitForURL(/\/portal/, { timeout: 60000 });
  await settle(C, 600);
  await go(C, "/portal/catalog");
}

try {
  // ——— S0: the public site is built from the admin's catalog ———————————————————————————————————————————
  await step("s0", async () => {
    await go(A, "/admin");
    await full(A, "a-dash0", "Admin dashboard (start of the story)", { ...AS, newOrders: "main :text('New orders') >> xpath=ancestor::div[2]", leads: "main :text('Recent leads') >> xpath=ancestor::div[2]", sideNav: "aside nav >> nth=0" });
    await go(A, "/admin/categories");
    await full(A, "a-cats", "Categories", { ...AS, table: "main table >> nth=0", produce: "main tr:has-text('Produce') >> nth=0", seafood: "main tr:has-text('Seafood') >> nth=0", add: "main form >> nth=0" });
    await go(A, "/admin/products");
    await full(A, "a-products0", "Products: cost, list price, stock, status", { ...AS, table: "main table >> nth=0", add: "main button:has-text('Add product')", stockCol: "main th:has-text('Stock')", basil: "main tr:has-text('Fresh Basil')", cups: "main tr:has-text('Hot Cups')", print: "main :text('Print:') >> xpath=ancestor::div[1]" });
    await go(C, "/");
    await full(C, "c-home", "Public home (phone)", { ...HDR, headline: "main h1", cta: "header a:has-text('Become a customer')", open: "main a:has-text('Open a wholesale account') >> nth=0", catHead: "main h2:has-text('Everything your kitchen needs')", tiles: "main a[href^='/catalog/'] >> nth=0", tile2: "main a[href^='/catalog/'] >> nth=1" });
    await go(C, "/catalog");
    await full(C, "c-pubcat", "Public catalog: categories (phone)", { ...HDR, headline: "main h1", tile0: "main a[href^='/catalog/'] >> nth=0", tile1: "main a[href^='/catalog/'] >> nth=1" });
    await go(C, "/catalog/produce");
    await full(C, "c-produce0", "Public category: Produce, no prices (phone)", { ...HDR, headline: "main h1", first: "main :text('Romaine Hearts') >> xpath=ancestor::div[3]", basil: "main :text('Fresh Basil') >> xpath=ancestor::div[3]" });
  });

  // ——— S1: a visitor applies; the lead appears for the admin ———————————————————————————————————————————
  await step("s1", async () => {
    await go(A, "/admin/leads");
    await full(A, "a-leads0", "Leads before the application", { ...AS, tabs: "main button:has-text('New') >> nth=0 >> xpath=..", first: card("Riverside Noodle Bar"), leadsNav: NAV("Leads") });
    await go(C, "/apply");
    const fb = { ...HDR, headline: "main h1", form: "main form", businessName: "input[name=businessName]", contactName: "input[name=contactName]", email: "input[name=email]", phone: "input[name=phone]", address: "input[name=address]", businessType: "select[name=businessType]", monthlyVolume: "select[name=monthlyVolume]", notes: "textarea[name=notes]", submit: "main form button[type=submit]" };
    await full(C, "c-apply0", "Apply (phone): empty", fb);
    await typeInto(C, "input[name=businessName]", NEW.business, 4);
    await typeInto(C, "input[name=contactName]", NEW.contact, 4);
    await typeInto(C, "input[name=email]", NEW.email, 4);
    await typeInto(C, "input[name=phone]", NEW.phone, 4);
    await typeInto(C, "input[name=address]", NEW.address, 4);
    await C.selectOption("select[name=businessType]", { label: "Restaurant" });
    await C.selectOption("select[name=monthlyVolume]", { index: 2 });
    await typeInto(C, "textarea[name=notes]", NEW.notes, 4);
    await C.locator("textarea[name=notes]").blur();
    await full(C, "c-apply1", "Apply (phone): filled", fb);
    await C.click("main form button[type=submit]");
    await C.waitForSelector("main :text('Application received')", { timeout: 30000 });
    await settle(C, 800);
    await full(C, "c-apply2", "Apply (phone): application received", { ...HDR, headline: "main h1", received: "main :text('Application received') >> xpath=ancestor::div[2]" });
    await reload(A);
    await full(A, "a-leads1", "Leads: the new application at the top, marked new", { ...AS, first: card(NEW.business), firstStatus: "main select >> nth=1", leadsNav: NAV("Leads") });
    await go(A, "/admin");
    await full(A, "a-dash1", "Dashboard: Recent leads shows the application", { ...AS, leads: "main :text('Recent leads') >> xpath=ancestor::div[2]", newLead: `main :text('${NEW.business}') >> nth=0`, sideNav: "aside nav >> nth=0" });
    // the two other public forms: stored, no admin screen (reported)
    await go(C, "/contact");
    await full(C, "c-contact", "Contact form (phone)", { ...HDR, headline: "main h1", form: "main form >> nth=0" });
    await go(C, "/suppliers");
    await full(C, "c-vendor", "Become a vendor form (phone)", { ...HDR, headline: "main h1", form: "main form >> nth=0" });
  });

  // ——— S2: approve, convert, invite; the customer accepts and signs in ———————————————————————————————————
  await step("s2", async () => {
    await go(A, "/admin/leads");
    const row = A.locator(`main h3:has-text('${NEW.business}') >> xpath=ancestor::*[.//select][1]`);
    await row.locator("select").selectOption("approved");
    await A.waitForTimeout(1500);
    await reload(A);
    await full(A, "a-leads2", "Leads: Cedar Table Bistro approved", { ...AS, first: card(NEW.business), firstStatus: "main select >> nth=1" });
    await go(A, "/admin/customers/new");
    const nb = { ...AS, panel: "main table >> nth=0", row: `main tr:has-text('${NEW.business}')`, check: `main tr:has-text('${NEW.business}') input[type=checkbox]`, convert: "main button:has-text('Convert')" };
    await full(A, "a-new0", "Add a customer: the approved lead is waiting", nb);
    await A.locator(`main tr:has-text('${NEW.business}') input[type=checkbox]`).check();
    await A.waitForTimeout(400);
    await full(A, "a-new1", "Add a customer: lead selected", nb);
    await A.click("main button:has-text('Convert')");
    await A.waitForSelector("main :text('invite them now')", { timeout: 30000 });
    await settle(A, 800);
    await full(A, "a-new2", "Created 1 customer: invite them now", { ...AS, created: "main :text('invite them now') >> xpath=ancestor::div[2]", open: "main a:has-text('Open account')" });
    st.customerId = (await A.locator("main a:has-text('Open account')").first().getAttribute("href")).split("/").pop();
    save();
    await go(A, `/admin/customers/${st.customerId}`);
    const cb = { ...AS, badge: "main h1 + * >> nth=0", portal: "main h2:has-text('Portal access') >> xpath=ancestor::div[2]", sendEmail: "main button:has-text('Send email')", copyLink: "main button:has-text('Copy link')", checklist: "main h2:has-text('Setup checklist') >> xpath=ancestor::div[2]", top: "main h1 >> xpath=ancestor::div[2]" };
    await full(A, "a-cust0", "New customer: not invited, setup checklist", cb);
    await A.click("main button:has-text('Copy link')");
    await A.waitForSelector("main input[readonly]", { timeout: 30000 });
    await settle(A, 800);
    st.link = await A.locator("main input[readonly]").first().inputValue();
    save();
    await full(A, "a-cust1", "Invite link generated (badge Invited)", { ...cb, linkBox: "main input[readonly]" }, { notes: "the one-time link is a local-only URL; it is kept off screen (forbid box)" });
    // the customer opens the link on the phone
    await go(C, st.link.replace(/^https?:\/\/[^/]+/, ""));
    await C.waitForURL(/set-password/, { timeout: 60000 });
    await settle(C, 900);
    const pb = { ...HDR, headline: "main h1, h1 >> nth=0", form: "form >> nth=0", pw: "input[type=password] >> nth=0", pw2: "input[type=password] >> nth=1", save: "button[type=submit] >> nth=0" };
    await full(C, "c-setpw0", "Welcome page: set a password (phone)", pb);
    await typeInto(C, "input[type=password] >> nth=0", NEW.password, 4);
    await typeInto(C, "input[type=password] >> nth=1", NEW.password, 4);
    await full(C, "c-setpw1", "Welcome page: password typed", pb);
    await C.click("button[type=submit] >> nth=0");
    await C.waitForURL(/\/portal/, { timeout: 60000 });
    await settle(C, 1200);
    await full(C, "c-portal0", "Portal with the welcome banner (phone)", { ...HDR, headline: "main h1", banner: "main :text('Welcome to your') >> xpath=ancestor::div[2]", cards: "main a:has-text('products available') >> xpath=..", catalogCard: "main a:has-text('products available') >> nth=0" });
    st.signedUp = true;
    save();
    await reload(A);
    await full(A, "a-cust2", "Customer now Active, checklist ticks Activated", cb);
    await go(C, "/portal/catalog");
    await full(C, "c-cat0", "My catalog: nothing set up yet (phone)", { ...HDR, headline: "main h1", empty: "main :text('No products are set up') >> xpath=ancestor::div[1]" });
  });

  // ——— S3: the admin builds this customer's catalog and prices; the customer's catalog follows ——————————————————
  const CUST = () => `/admin/customers/${st.customerId}`;
  const DLG = { dialog: "[role=dialog] > div >> nth=0", search: "[role=dialog] input[type=search]", list: "[role=dialog] ul", addBtn: "[role=dialog] button:has-text('Add')" };
  const TBL = { ...AS, assigned: "main h2:has-text('Assigned products') >> xpath=ancestor::section[1]", tools: "main button:has-text('Export CSV') >> xpath=..", table: "main h2:has-text('Assigned products') >> xpath=ancestor::section[1] >> table", lemons: "main tr:has-text('Lemons')", lemonsPrice: "main tr:has-text('Lemons') td:nth-child(6)", salmon: "main tr:has-text('Atlantic Salmon')", margin: "main h2:has-text('Customer margin') >> xpath=ancestor::section[1]", visibility: "main h2:has-text('Catalog visibility') >> xpath=ancestor::section[1]", hide: "main input[placeholder='Search a product to hide…']", checklist: "main h2:has-text('Setup checklist') >> xpath=ancestor::div[2]", badge: "main h1 + * >> nth=0", addProduct: "main button:has-text('Add product')", offers: "main h2:has-text('Offers') >> xpath=ancestor::section[1]", addOffer: "main button:has-text('Add offer')", applyTpl: "main button:has-text('Apply template')" };
  const CAT = (extra = {}) => ({ ...HDR, headline: "main h1", search: "main input >> nth=0", first: "main h3 >> nth=0 >> xpath=ancestor::div[.//button][1]", tabs: "header nav >> nth=0", ...extra });
  const catCard = (name) => `main h3:text-is('${name}') >> xpath=ancestor::div[.//button][1]`;
  const PICK = ["Romaine Hearts", "Lemons", "Fresh Basil", "Large Eggs, Grade A", "Unsalted Butter", "Heavy Cream 36%", "Atlantic Salmon Fillet", "Long Grain Rice", "Hot Cups 12 oz", "Kraft Takeout Bags"];
  await step("s3", async () => {
    await go(A, CUST());
    await full(A, "a-cust3", "Customer page before products are assigned", TBL);
    await A.click("main button:has-text('Add product')");
    await A.waitForSelector("[role=dialog] ul");
    await full(A, "a-addp0", "Add products to catalog (picker open)", { ...TBL, ...DLG });
    for (const n of PICK) await A.locator(`[role=dialog] li:has(p:text-is('${n}')) input[type=checkbox]`).check();
    await full(A, "a-addp1", "Picker: 10 products selected", { ...TBL, ...DLG });
    await A.click("[role=dialog] button:has-text('Add (')");
    await A.waitForSelector("main tr:has-text('Lemons')", { timeout: 30000 });
    await settle(A, 1500);
    await reload(A);
    await full(A, "a-cust4", "Assigned products with prices and their source", TBL);
    await go(C, "/portal/catalog");
    await full(C, "c-cat1", "My catalog: assigned products, Your price (phone)", CAT({ lemons: catCard("Lemons"), salmon: catCard("Atlantic Salmon Fillet") }));
    // a manual price
    await A.locator("main tr:has-text('Lemons') td:nth-child(6) button").first().click();
    const pin = A.locator("main tr:has-text('Lemons') input[type=number]");
    await pin.fill("");
    await full(A, "a-price0", "Editing Lemons' price", TBL);
    await pin.type("41.50", { delay: 20 });
    await full(A, "a-price1", "Lemons' price typed", TBL);
    await A.locator("main tr:has-text('Lemons') button:has-text('Save')").click();
    await A.waitForTimeout(2500);
    await reload(A);
    await full(A, "a-cust5", "Lemons now a manual price", TBL);
    await reload(C);
    await full(C, "c-cat2", "Lemons' new price in the customer's catalog", CAT({ lemons: catCard("Lemons"), salmon: catCard("Atlantic Salmon Fillet") }));
    // a customer margin: every computed price is recomputed
    await A.click("main button:has-text('Set a margin')");
    await A.locator("main input[placeholder='15']").fill("26");
    await full(A, "a-margin0", "Customer margin: 26 %", TBL);
    await A.locator("main h2:has-text('Customer margin') >> xpath=ancestor::section[1] >> button:has-text('Save')").click();
    await A.waitForTimeout(3000);
    await reload(A);
    await full(A, "a-cust6", "Customer margin cost + 26 %, prices recomputed (manual Lemons kept)", TBL);
    await reload(C);
    await full(C, "c-cat3", "Catalog after the customer margin", CAT({ lemons: catCard("Lemons"), salmon: catCard("Atlantic Salmon Fillet") }));
    // visibility: open a whole category
    await A.locator("main input[name=visibility-mode] >> nth=2").check();
    await A.waitForTimeout(500);
    await A.locator("main label:has(span:text-is('Beverages')) input[type=checkbox]").check();
    await full(A, "a-vis0", "Catalog visibility: Selected categories, Beverages ticked", TBL);
    await A.click("main button:has-text('Save visibility')");
    await A.waitForTimeout(2500);
    await reload(A);
    await full(A, "a-vis1", "Visibility saved: can browse more products", TBL);
    await reload(C);
    await full(C, "c-cat4", "Catalog with Beverages at list price (phone)", CAT({ oat: catCard("Oat Barista Milk"), lemons: catCard("Lemons") }));
    // hide a product
    await A.locator("main input[placeholder='Search a product to hide…']").type("Kraft", { delay: 30 });
    await A.waitForTimeout(600);
    await full(A, "a-hide0", "Hide a product: Kraft Takeout Bags", TBL);
    await A.locator("main button:has-text('Kraft Takeout Bags')").first().click();
    await A.waitForTimeout(2500);
    await reload(A);
    await full(A, "a-hide1", "Kraft Takeout Bags hidden from this customer", TBL);
    await reload(C);
    await full(C, "c-cat5", "Catalog without the hidden product (phone)", CAT({ oat: catCard("Oat Barista Milk"), lemons: catCard("Lemons") }));
  });

  // ——— S4: catalog-wide tools: bulk assign, margin rules, recompute / copy ————————————————————————————————————
  await step("s4", async () => {
    await go(A, "/admin/assign");
    const ab = { ...AS, pickP: "main h2:has-text('Pick products') >> xpath=ancestor::div[2]", pickC: "main h2:has-text('Pick customers') >> xpath=ancestor::div[2]", searchP: "main input[placeholder='Search name or SKU']", searchC: "main input[placeholder='Search business or email']", assignNav: NAV("Assign products") };
    await full(A, "a-assign0", "Assign products to customers (empty)", ab);
    await A.locator("main input[placeholder='Search name or SKU']").type("Brioche", { delay: 30 });
    await A.waitForTimeout(500);
    await A.click("main button:has-text('Select shown (1)') >> nth=0");
    await A.locator("main input[placeholder='Search business or email']").type("Cedar", { delay: 30 });
    await A.waitForTimeout(500);
    await A.locator("main button:has-text('Select shown (1)')").last().click();
    await A.waitForTimeout(1200);
    await full(A, "a-assign1", "Assign: Brioche Burger Buns to Cedar Table Bistro, preview", { ...ab, preview: "main h2:has-text('Preview') >> xpath=ancestor::div[2]", assignBtn: "main button:has-text('Assign ')" });
    await A.click("main button:has-text('Assign ') >> nth=-1");
    await A.waitForTimeout(3000);
    await settle(A, 800);
    await full(A, "a-assign2", "Assign: applied", { ...ab, preview: "main h2:has-text('Preview') >> xpath=ancestor::div[2]", done: "main :text-matches('Assigned|assigned', '') >> nth=0" });
    await go(C, "/portal/catalog");
    await full(C, "c-cat6", "Catalog with Brioche Burger Buns (phone)", CAT({ buns: catCard("Brioche Burger Buns"), romaine: catCard("Romaine Hearts") }));
    // margin rules: a priority category rule for Produce reprices computed rows everywhere
    await go(A, "/admin/pricing");
    const pb = { ...AS, global: "main h2:has-text('Global default margin') >> xpath=ancestor::section[1]", product: "main h2:has-text('Product margins') >> xpath=ancestor::section[1]", category: "main h2:has-text('Category margins') >> xpath=ancestor::section[1]", customer: "main h2:has-text('Customer margins') >> xpath=ancestor::section[1]", catForm: "main select:has(option:text('Choose a category…')) >> xpath=..", pricingNav: NAV("Pricing") };
    await full(A, "a-pricing0", "Margin rules (the waterfall)", pb);
    await A.locator("main select:has(option:text('Choose a category…'))").selectOption({ label: "Produce" });
    await A.locator("main input[placeholder='40']").fill("34");
    await A.locator("main select:has(option:text('Choose a category…')) >> xpath=.. >> input[type=checkbox]").check();
    await full(A, "a-pricing1", "New category rule: Produce 34 %, overrides customer margins", pb);
    await A.locator("main select:has(option:text('Choose a category…')) >> xpath=.. >> button:has-text('Add rule')").click();
    await A.waitForSelector("main :text('prices updated automatically')", { timeout: 30000 }).catch(() => {});
    await settle(A, 800);
    await full(A, "a-pricing2", "Saved: prices updated automatically across customers", { ...pb, notice: "main :text('updated automatically') >> nth=0" });
    await go(C, "/portal/catalog");
    await full(C, "c-cat7", "Catalog after the Produce rule (phone)", CAT({ buns: catCard("Brioche Burger Buns"), romaine: catCard("Romaine Hearts"), lemons: catCard("Lemons") }));
    // the table's other tools (shown, then closed): recompute and copy from customer
    await go(A, CUST());
    await full(A, "a-cust7", "Customer page after the Produce rule", TBL);
    await A.click("main button:has-text('Recompute prices')");
    await A.waitForSelector("[role=dialog]");
    await A.waitForTimeout(1500);
    await full(A, "a-recompute", "Recompute prices dialog", { ...TBL, dialog: "[role=dialog] > div >> nth=0" });
    await A.keyboard.press("Escape");
    await A.locator("[role=dialog] button:has-text('Cancel'), [role=dialog] button:has-text('Close')").first().click().catch(() => {});
    await A.waitForTimeout(500);
    await A.click("main button:has-text('Copy from customer')");
    await A.waitForSelector("[role=dialog]");
    await A.waitForTimeout(800);
    await full(A, "a-copy", "Copy from customer dialog", { ...TBL, dialog: "[role=dialog] > div >> nth=0" });
  });

  // ——— S5: offers: one for this customer, one template applied to many; the customer's prices and Offers page follow ——
  const ymd = (days) => new Date(Date.now() + days * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  await step("s5", async () => {
    await go(A, CUST());
    await A.click("main button:has-text('Add offer')");
    await A.waitForSelector("[role=dialog] input[placeholder='10% off seasonal produce']");
    const ob = { ...TBL, dialog: "[role=dialog] > div >> nth=0", title: "[role=dialog] input[placeholder='10% off seasonal produce']", create: "[role=dialog] button:has-text('Create offer')" };
    await full(A, "a-offer0", "New offer dialog (empty)", ob);
    await typeInto(A, "[role=dialog] input[placeholder='10% off seasonal produce']", "Opening week salmon", 6);
    await typeInto(A, "[role=dialog] textarea", "A welcome offer on salmon fillets", 4);
    await A.locator("[role=dialog] select >> nth=0").selectOption({ label: "Atlantic Salmon Fillet" });
    await A.locator("[role=dialog] select >> nth=1").selectOption({ label: "Percent off" });
    await A.waitForTimeout(300);
    await A.locator("[role=dialog] input[type=number]").first().fill("10");
    await A.locator("[role=dialog] input[type=date] >> nth=0").fill(ymd(0));
    await A.locator("[role=dialog] input[type=date] >> nth=1").fill(ymd(14));
    await A.locator("[role=dialog] h3").first().click();
    await full(A, "a-offer1", "New offer: 10 % off salmon, two weeks", ob);
    await A.click("[role=dialog] button:has-text('Create offer')");
    await A.waitForTimeout(2500);
    await reload(A);
    await full(A, "a-cust8", "Customer page: the offer is running", TBL);
    await go(C, "/portal/offers");
    const OF = { ...HDR, headline: "main h1", first: "main h3 >> nth=0 >> xpath=ancestor::*[self::li or self::article or self::div][1]", list: "main ul, main section >> nth=0" };
    await full(C, "c-offers1", "Offers page with the new offer (phone)", OF);
    await go(C, "/portal/catalog");
    await full(C, "c-cat8", "Catalog: salmon at the offer price (phone)", CAT({ salmon: catCard("Atlantic Salmon Fillet"), lemons: catCard("Lemons") }));
    // a template applied to many customers at once
    await go(A, "/admin/offers");
    const lb = { ...AS, tabs: "main a:has-text('Templates') >> xpath=..", rows: "main a:has-text('Apply to many') >> nth=0 >> xpath=ancestor::*[self::li or self::div][2]", pizza: "main :text('Weekend Pizza Night') >> xpath=ancestor::*[.//a[contains(., 'Apply to many')]][1]", applyMany: "main div:has(> * :text('Brunch Starter')) a:has-text('Apply to many'), main a:has-text('Apply to many') >> nth=0", offersNav: NAV("Offer library") };
    await full(A, "a-tpl0", "Offer library: templates", lb);
    await A.locator("main :text('Weekend Pizza Night') >> xpath=ancestor::*[.//a[contains(., 'Apply to many')]][1] >> a:has-text('Apply to many')").first().click();
    await A.waitForURL(/offers\/apply\//);
    await settle(A, 900);
    const bb = { ...AS, who: "main h2:has-text('Who gets it') >> xpath=ancestor::section[1]", when: "main h2:has-text('When') >> xpath=ancestor::section[1]", what: "main h2:has-text('Exactly what will happen') >> xpath=ancestor::section[1]", apply: "main button:has-text('Apply to ')" };
    await A.locator("main input[type=date] >> nth=1").fill(ymd(10));
    await A.locator("main h1").click();
    await A.waitForTimeout(1500);
    await full(A, "a-bulk0", "Apply Weekend Pizza Night to all active customers: preview", bb);
    await A.click("main button:has-text('Apply to ')");
    await A.waitForSelector("main :text('Batch applied')", { timeout: 30000 }).catch(() => {});
    await settle(A, 800);
    await full(A, "a-bulk1", "Batch applied", { ...bb, done: "main :text('Batch applied') >> nth=0" });
    await go(A, "/admin/offers?tab=running");
    await full(A, "a-running", "Running now: the applied batch with Undo batch", { ...AS, batches: "main :text('Applied batches') >> xpath=ancestor::*[self::section or self::div][2]", undo: "main button:has-text('Undo batch') >> nth=0" });
    await go(C, "/portal/offers");
    await full(C, "c-offers2", "Offers page with both offers (phone)", OF);
  });

  // ——— S6: the customer orders; the order lands in the admin's New tab and dashboard ————————————————————————————
  const ORD = { ...AS, tabs: "main button:has-text('New') >> nth=0 >> xpath=..", first: "main a[href*='/admin/orders/'] >> nth=0", ordersNav: NAV("Orders"), range: "main select[name=range]" };
  const addCard = async (name, qty = 1) => {
    const cardSel = catCard(name);
    await C.locator(`${cardSel} >> button:has-text('Add to cart')`).click();
    await C.waitForTimeout(500);
    for (let i = 1; i < qty; i++) { await C.locator(`${cardSel} >> button[aria-label='Increase quantity']`).click(); await C.waitForTimeout(250); }
    await C.waitForTimeout(400);
  };
  await step("s6", async () => {
    await go(A, "/admin/orders");
    await full(A, "a-orders0", "Orders before the customer's order", ORD);
    await go(C, "/portal/catalog");
    await typeInto(C, "main input[name=q]", "salmon", 25);
    await full(C, "c-search1", "Catalog: 'salmon' typed (phone)", CAT());
    await C.click("main button:has-text('Search')");
    await C.waitForURL(/q=salmon/);
    await settle(C, 900);
    const SR = CAT({ salmon: catCard("Atlantic Salmon Fillet") });
    await full(C, "c-search2", "Search results: salmon (phone)", SR);
    await addCard("Atlantic Salmon Fillet", 2);
    await full(C, "c-search3", "Salmon: 2 in cart (phone)", SR);
    await go(C, "/portal/catalog");
    const CB = () => CAT({ cream: catCard("Heavy Cream 36%"), cups: catCard("Hot Cups 12 oz"), oat: catCard("Oat Barista Milk") });
    await addCard("Heavy Cream 36%", 1);
    await full(C, "c-add1", "Heavy Cream added (phone)", CB());
    await addCard("Hot Cups 12 oz", 5);
    await full(C, "c-add2", "Hot Cups: 5 in cart (phone)", CB());
    await addCard("Oat Barista Milk", 2);
    await full(C, "c-add3", "Oat Barista Milk: 2 in cart (phone)", CB());
    await go(C, "/portal/cart");
    const CT = { ...HDR, headline: "main h1", lines: "main ul >> nth=0", total: "main :text('Total (') >> xpath=ancestor::div[1]", checkout: "main a:has-text('Proceed to checkout'), main button:has-text('Proceed to checkout') >> nth=0" };
    await full(C, "c-cart", "Cart with exact prices (phone)", CT);
    await go(C, "/portal/checkout");
    const CK = { ...HDR, headline: "main h1", terms: "main :text('Settlement stays') >> nth=0", delivery: "main label:has(input[type=radio]):has-text('Delivery')", pickup: "main label:has(input[type=radio]):has-text('Pickup')", notes: "main textarea", submit: "main button:has-text('Submit order')", total: "main :text('Order total') >> xpath=ancestor::div[1]" };
    await full(C, "c-ck0", "Checkout (phone)", CK);
    await C.locator("main label:has(input[type=radio]):has-text('Delivery') input").check();
    await typeInto(C, "main textarea", "Back entrance on Cedar Lane", 20);
    await C.locator("main h1").click();
    await full(C, "c-ck1", "Checkout: delivery, note typed (phone)", CK);
    await C.click("main button:has-text('Submit order')");
    await C.waitForURL(/\/portal\/orders\/[0-9a-f-]+/, { timeout: 60000 });
    await settle(C, 1200);
    st.orderId = new URL(C.url()).pathname.split("/").pop();
    save();
    const OD = { ...HDR, headline: "main h1", banner: "main :text('Order received') >> xpath=ancestor::div[1]", status: "main :text-matches('^(Received|Confirmed|Ready|Completed|Cancelled)$') >> nth=0", items: "main table >> nth=0", invoice: "main a:has-text('Invoice') >> nth=0", top: "main h1 >> xpath=ancestor::div[2]" };
    await full(C, "c-placed", "Order received: status Received (phone)", OD);
    await reload(A);
    await full(A, "a-orders1", "Orders: the new order in New, badge in the sidebar", { ...ORD, mine: `main a:has-text('${NEW.business}') >> nth=0` });
    await A.click("main button:has-text('New') >> nth=0");
    await A.waitForTimeout(900);
    await full(A, "a-orders2", "Orders: New tab", { ...ORD, mine: `main a:has-text('${NEW.business}') >> nth=0` });
    await go(A, "/admin");
    await full(A, "a-dash2", "Dashboard: new orders right now, awaiting confirmation", { ...AS, newOrders: "main :text('New orders') >> xpath=ancestor::div[2]", awaiting: "main :text('Awaiting confirmation') >> xpath=ancestor::div[1]", row1: "main :text('New orders') >> xpath=ancestor::div[3]" });
  });

  // ——— S7: confirm (shortage → oversell), prepared, completed; a second order cancelled ————————————————————————
  const AO = { ...AS, top: "main h1 >> xpath=ancestor::div[2]", confirm: "main button:has-text('Confirm order')", cancel: "main button:has-text('Cancel order')", lines: "main table >> nth=0", customer: `main a:has-text('${NEW.business}') >> xpath=ancestor::div[2]`, invoice: "main a:has-text('Invoice') >> nth=0" };
  const OD2 = { ...HDR, headline: "main h1", status: "main :text-matches('^(Received|Confirmed|Ready|Completed|Cancelled)$') >> nth=0", items: "main table >> nth=0", invoice: "main a:has-text('Invoice') >> nth=0", top: "main h1 >> xpath=ancestor::div[2]" };
  await step("s7", async () => {
    await go(A, `/admin/orders/${st.orderId}`);
    await full(A, "a-order0", "Order detail: lines with cost and profit", AO);
    await A.click("main button:has-text('Confirm order')");
    await A.waitForSelector("main :text('Not enough stock')", { timeout: 30000 });
    await settle(A, 600);
    await full(A, "a-order1", "Not enough stock: Hot Cups", { ...AO, shortage: "main :text('Not enough stock') >> xpath=ancestor::div[2]", oversell: "main button:has-text('Confirm anyway')" });
    await A.click("main button:has-text('Confirm anyway')");
    await A.waitForSelector("main button:has-text('Mark prepared')", { timeout: 30000 });
    await settle(A, 900);
    await full(A, "a-order2", "Confirmed (oversold), newly ordered product added to the catalog", { ...AO, prepared: "main button:has-text('Mark prepared')", notice: "main :text('newly ordered') >> nth=0" });
    await go(C, `/portal/orders/${st.orderId}`);
    await full(C, "c-order1", "Order: Confirmed (phone)", OD2);
    await go(C, "/portal/catalog");
    await full(C, "c-cat9", "Catalog: Hot Cups unavailable, Oat milk now Your price (phone)", CAT({ cups: catCard("Hot Cups 12 oz"), oat: catCard("Oat Barista Milk") }));
    await reload(A);
    await A.click("main button:has-text('Mark prepared')");
    await A.waitForSelector("main button:has-text('Complete order')", { timeout: 30000 });
    await settle(A, 800);
    await full(A, "a-order3", "Prepared", { ...AO, complete: "main button:has-text('Complete order')" });
    await go(C, `/portal/orders/${st.orderId}`);
    await full(C, "c-order2", "Order: Ready (phone)", OD2);
    await A.click("main button:has-text('Complete order')");
    await A.waitForSelector("main :text('no further actions')", { timeout: 30000 });
    await settle(A, 800);
    await full(A, "a-order4", "Completed", { ...AO, done: "main :text('no further actions') >> nth=0" });
    await reload(C);
    await full(C, "c-order3", "Order: Completed (phone)", OD2);
    // a second order, cancelled by the admin
    await go(C, "/portal/catalog");
    await addCard("Lemons", 2);
    await go(C, "/portal/checkout");
    await C.locator("main label:has(input[type=radio]):has-text('Pickup') input").check();
    await C.click("main button:has-text('Submit order')");
    await C.waitForURL(/\/portal\/orders\/[0-9a-f-]+/, { timeout: 60000 });
    await settle(C, 1000);
    st.order2Id = new URL(C.url()).pathname.split("/").pop();
    save();
    await full(C, "c-placed2", "Second order received (phone)", OD2);
    await go(A, `/admin/orders/${st.order2Id}`);
    await full(A, "a-order5", "Second order (new)", AO);
    await A.click("main button:has-text('Cancel order')");
    await A.waitForSelector("[role=dialog], main :text('Cancel this order?')");
    await A.locator("input[placeholder^='Reason']").first().type("Customer called to cancel", { delay: 15 });
    await full(A, "a-cancel0", "Cancel this order? with a reason", { ...AO, dialog: "input[placeholder^='Reason'] >> xpath=ancestor::div[2]", reason: "input[placeholder^='Reason']", yes: "button:has-text('Yes, cancel it')" });
    await A.click("button:has-text('Yes, cancel it')");
    await A.waitForSelector("main :text('no further actions')", { timeout: 30000 });
    await settle(A, 800);
    await full(A, "a-cancel1", "Cancelled", { ...AO, done: "main :text('no further actions') >> nth=0" });
    await reload(C);
    await full(C, "c-order4", "Second order: Cancelled (phone)", OD2);
    await go(C, "/portal/orders");
    await full(C, "c-orders", "My orders: completed and cancelled (phone)", { ...HDR, headline: "main h1", first: "main a[href*='/portal/orders/'] >> nth=0", second: "main a[href*='/portal/orders/'] >> nth=1", statement: "main a:has-text('statement')" });
  });

  // ——— S8: documents on both sides ————————————————————————————————————————————————————————————————————————
  await step("s8", async () => {
    const SH = { headline: "main h1, h1 >> nth=0", print: "button:has-text('Print') >> nth=0", ...DOC };
    await go(C, `/portal/orders/${st.orderId}/invoice`);
    await full(C, "c-invoice", "Invoice (phone)", SH);
    await go(A, `/admin/orders/${st.orderId}/invoice`);
    await full(A, "a-invoice", "Invoice (admin)", { ...SH, ...AS });
    await go(C, "/portal/orders/statement");
    await full(C, "c-statement", "Statement (phone)", { ...SH, period: "main select >> nth=0" });
    await go(A, `/admin/customers/${st.customerId}/statement`);
    await full(A, "a-stmt", "Customer copy of the statement (admin)", { ...SH, ...AS });
    await go(A, `/admin/customers/${st.customerId}/statement/internal`);
    await full(A, "a-stmt-int", "My copy: internal statement with cost and profit", { ...SH, ...AS, banner: "main :text('INTERNAL DOCUMENT') >> nth=0" });
    await go(C, `/portal/orders/${st.order2Id}/invoice`);
    await full(C, "c-invoice-x", "Cancelled order's invoice (phone)", SH);
  });

  // ——— S9: stock, dashboard, stock statements, receive stock, analytics, reports —————————————————————————————————
  await step("s9", async () => {
    await go(A, "/admin/products");
    const PB = { ...AS, table: "main table >> nth=0", cups: "main tr:has-text('Hot Cups')", salmon: "main tr:has-text('Atlantic Salmon')", cream: "main tr:has-text('Heavy Cream')", banner: "main :text-matches('low|Low') >> nth=0 >> xpath=ancestor::div[1]", print: "main :text('Print:') >> xpath=ancestor::div[1]", productsNav: NAV("Products") };
    await full(A, "a-products1", "Products: stock after the order (Hot Cups oversold)", PB);
    await go(A, "/admin");
    await full(A, "a-dash3", "Dashboard: today's revenue and profit, low stock needs attention", { ...AS, row1: "main :text('Today') >> nth=0 >> xpath=ancestor::div[3]", attention: "main :text('Needs your attention') >> xpath=ancestor::*[self::section or self::div][1]", low: "main :text('Low stock') >> nth=0 >> xpath=ancestor::div[2]", offers: "main :text('Active offers') >> nth=0 >> xpath=ancestor::div[2]" });
    await go(A, "/admin/documents/low-stock");
    await full(A, "a-doc-low", "Low-stock statement", { headline: "h1 >> nth=0", print: "button:has-text('Print') >> nth=0", ...DOC });
    await go(A, "/admin/documents/out-of-stock");
    await full(A, "a-doc-out", "Unavailable products statement", { headline: "h1 >> nth=0", print: "button:has-text('Print') >> nth=0", ...DOC });
    await go(A, "/admin/products");
    await A.locator("main tr:has-text('Hot Cups') button:has-text('Edit')").click();
    await A.waitForSelector("[role=dialog] button:has-text('Receive stock')");
    await A.click("[role=dialog] button:has-text('Receive stock')");
    const RB = { ...PB, dialog: "[role=dialog] > div >> nth=0", stock: "[role=dialog] button:has-text('Receive stock') >> xpath=ancestor::div[3]", qty: "[role=dialog] input[placeholder='e.g. 10']", save: "[role=dialog] button:has-text('Save changes')" };
    await full(A, "a-recv0", "Hot Cups: receive stock", RB);
    await typeInto(A, "[role=dialog] input[placeholder='e.g. 10']", "20", 40);
    await full(A, "a-recv1", "Receive 20: the deficit is settled", RB);
    await A.click("[role=dialog] button:has-text('Save changes')");
    await A.waitForTimeout(2500);
    await settle(A, 800);
    await full(A, "a-recv2", "Saved: goods arrived for the oversold order", { ...PB, notice: "main :text('Goods arrived') >> nth=0 >> xpath=ancestor::div[1]" });
    await go(C, "/portal/catalog");
    await full(C, "c-cat10", "Catalog: Hot Cups available again (phone)", CAT({ cups: catCard("Hot Cups 12 oz"), oat: catCard("Oat Barista Milk") }));
    await go(A, "/admin/orders");
    await A.locator("main select[name=range]").selectOption({ label: "Today" });
    await settle(A, 1200);
    await full(A, "a-orders-today", "Orders filtered to Today", ORD);
    await go(A, "/admin/analytics");
    await settle(A, 1500);
    await full(A, "a-ana", "Analytics: this month", { ...AS, period: "main select >> nth=0", trend: "main :text('Revenue trend') >> xpath=ancestor::div[2]", best: "main :text('Best sellers') >> nth=0 >> xpath=ancestor::div[2]", top: "main :text('Top customers') >> nth=0 >> xpath=ancestor::div[2]", quiet: "main :text('Gone quiet') >> nth=0 >> xpath=ancestor::div[2]", slow: "main :text('Slow') >> nth=0 >> xpath=ancestor::div[2]" });
    await go(A, "/admin/reports");
    const RP = { ...AS, presets: "main h2:has-text('Presets') >> xpath=..", sections: "main h2:has-text('Sections') >> xpath=..", print: "main button:has-text('Print')", ...DOC };
    await full(A, "a-rep0", "Report builder", RP);
    await A.click("main a:has-text('Monthly business review')");
    await settle(A, 1500);
    await full(A, "a-rep1", "Monthly business review preset", RP);
    await A.locator("main label:has-text('Cost & profit') input[type=checkbox]").check();
    await settle(A, 1200);
    await full(A, "a-rep2", "Cost & profit ticked: the report becomes internal", { ...RP, banner: "main :text('INTERNAL') >> nth=0" });
    await go(A, "/admin/documents/products");
    await full(A, "a-doc-prod", "Product list document", { headline: "h1 >> nth=0", print: "button:has-text('Print') >> nth=0", toggle: "main label:has-text('Include cost')", ...DOC });
  });

  // ——— S10: catalog management reaches the public site and the portal ——————————————————————————————————————————
  await step("s10", async () => {
    await go(A, "/admin/products");
    await A.click("main button:has-text('Add product')");
    await A.waitForSelector("[role=dialog] input[placeholder='PRD-005']");
    const NP = { ...AS, dialog: "[role=dialog] > div >> nth=0", sku: "[role=dialog] input[placeholder='PRD-005']", name: "[role=dialog] input[placeholder='Vine-Ripe Tomatoes']", photo: "[role=dialog] :text-matches('Upload photo|Replace photo') >> xpath=ancestor::div[2]", create: "[role=dialog] button:has-text('Create product')", prices: "[role=dialog] input[placeholder='Leave blank if unknown'] >> xpath=ancestor::div[2]" };
    await full(A, "a-np0", "New product dialog", NP);
    await typeInto(A, "[role=dialog] input[placeholder='PRD-005']", "PRD-007", 10);
    await A.locator("[role=dialog] select >> nth=0").selectOption({ label: "Produce" });
    await typeInto(A, "[role=dialog] input[placeholder='Vine-Ripe Tomatoes']", "Red Bell Peppers", 10);
    await A.locator("[role=dialog] input[type=file]").setInputFiles("higgsfield/products/web/PRD-007.jpg");
    await A.waitForSelector("[role=dialog] :text('Replace photo')", { timeout: 60000 }).catch(() => {});
    await A.locator("[role=dialog] select >> nth=1").selectOption("case");
    await typeInto(A, "[role=dialog] input[placeholder='25 lb']", "11 lb", 10);
    await A.locator("[role=dialog] input[placeholder='Leave blank if unknown']").fill("24.00");
    await A.locator("[role=dialog] input[type=number] >> nth=1").fill("36.50");
    await A.locator("[role=dialog] input[placeholder='Leave blank to skip tracking']").fill("40");
    await A.locator("[role=dialog] input[placeholder='0']").fill("10");
    await A.locator("[role=dialog] h3").first().click();
    await full(A, "a-np1", "New product filled: Red Bell Peppers with its photo", NP);
    await A.click("[role=dialog] button:has-text('Create product')");
    await A.waitForTimeout(3000);
    await settle(A, 900);
    await full(A, "a-products3", "Products with Red Bell Peppers", { ...AS, table: "main table >> nth=0", peppers: "main tr:has-text('Red Bell Peppers')", basil: "main tr:has-text('Fresh Basil')" });
    const V = await context(browser, "phone");
    const P = await V.newPage();
    await go(P, "/catalog/produce");
    await full(P, "c-produce1", "Public Produce page with Red Bell Peppers (phone)", { ...HDR, headline: "main h1", peppers: "main :text('Red Bell Peppers') >> xpath=ancestor::div[3]", basil: "main :text('Fresh Basil') >> xpath=ancestor::div[3]" });
    // deactivate Fresh Basil: it leaves the public site and the customer's catalog
    await A.locator("main tr:has-text('Fresh Basil') button:has-text('Edit')").click();
    await A.waitForSelector("[role=dialog] button:has-text('Save changes')");
    await A.locator("[role=dialog] label:has-text('Active') input[type=checkbox]").uncheck();
    await full(A, "a-basil0", "Fresh Basil: Active unticked", { ...AS, dialog: "[role=dialog] > div >> nth=0", active: "[role=dialog] label:has-text('Active')", save: "[role=dialog] button:has-text('Save changes')" });
    await A.click("[role=dialog] button:has-text('Save changes')");
    await A.waitForTimeout(2500);
    await settle(A, 800);
    await full(A, "a-products4", "Fresh Basil inactive", { ...AS, table: "main table >> nth=0", peppers: "main tr:has-text('Red Bell Peppers')", basil: "main tr:has-text('Fresh Basil')" });
    await reload(P);
    await full(P, "c-produce2", "Public Produce page without Fresh Basil (phone)", { ...HDR, headline: "main h1", peppers: "main :text('Red Bell Peppers') >> xpath=ancestor::div[3]" });
    await V.close();
    await go(C, "/portal/catalog");
    await full(C, "c-cat11", "Customer catalog without Fresh Basil (phone)", CAT({ cream: catCard("Heavy Cream 36%"), lemons: catCard("Lemons") }));
    // a subcategory: the portal filter shows it as "Parent · Child"
    await go(A, "/admin/categories");
    const form = A.locator("main form").last();
    await form.locator("input >> nth=0").fill("Fresh Herbs");
    await form.locator("select").selectOption({ label: "Under: Produce" });
    await full(A, "a-cats1", "Add a category: Fresh Herbs under Produce", { ...AS, table: "main table >> nth=0", add: "main form >> nth=-1" });
    await form.locator("button:has-text('Add category')").click();
    await A.waitForTimeout(2000);
    await settle(A, 800);
    await full(A, "a-cats2", "Categories with Fresh Herbs under Produce", { ...AS, table: "main table >> nth=0", herbs: "main tr:has-text('Fresh Herbs')", add: "main form >> nth=-1" });
  });

  // ——— S11: account and access ——————————————————————————————————————————————————————————————————————————————
  await step("s11", async () => {
    await go(A, CUST());
    await A.click("main button:has-text('Edit account')");
    await A.waitForSelector("[role=dialog] button:has-text('Save changes')");
    const EB = { ...TBL, dialog: "[role=dialog] > div >> nth=0", status: "[role=dialog] label:has-text('Status')", terms: "[role=dialog] label:has-text('Payment terms')", save: "[role=dialog] button:has-text('Save changes')" };
    await A.locator("[role=dialog] label:has-text('Payment terms') select").selectOption("net-30");
    await full(A, "a-edit0", "Edit account: payment terms Net 30", EB);
    await A.click("[role=dialog] button:has-text('Save changes')");
    await A.waitForTimeout(2500);
    await reload(A);
    await full(A, "a-cust9", "Payment terms Net 30", { ...TBL, info: "main :text('Payment terms') >> nth=0 >> xpath=ancestor::div[2]" });
    await go(C, "/portal/account");
    await full(C, "c-account", "Account page: Net 30 (phone)", { ...HDR, headline: "main h1", card: "main dl, main section >> nth=0", terms: "main :text('Payment terms') >> xpath=ancestor::div[1]" });
    await A.click("main button:has-text('Edit account')");
    await A.waitForSelector("[role=dialog] button:has-text('Save changes')");
    await A.locator("[role=dialog] label:has-text('Status') select").selectOption("suspended");
    await full(A, "a-susp0", "Edit account: status Suspended", EB);
    await A.click("[role=dialog] button:has-text('Save changes')");
    await A.waitForTimeout(2500);
    await reload(A);
    await full(A, "a-susp1", "Customer suspended", TBL);
    await go(C, "/portal");
    await C.waitForURL(/login/, { timeout: 30000 }).catch(() => {});
    await settle(C, 800);
    await full(C, "c-pending", "Locked out: account isn't active (phone)", { ...HDR, headline: "main h1, h1 >> nth=0", notice: "main :text('active yet') >> xpath=ancestor::div[1]", form: "main form >> nth=0" });
    await A.click("main button:has-text('Edit account')");
    await A.waitForSelector("[role=dialog] button:has-text('Save changes')");
    await A.locator("[role=dialog] label:has-text('Status') select").selectOption("active");
    await A.click("[role=dialog] button:has-text('Save changes')");
    await A.waitForTimeout(2500);
    await reload(A);
    await full(A, "a-cust10", "Customer active again", TBL);
    // password reset from the sign-in page (no email leaves this machine)
    const R = await context(browser, "phone");
    const RP = await R.newPage();
    await go(RP, "/login");
    await RP.click("main :text('Forgot password?')");
    await RP.waitForTimeout(600);
    const LB = { ...HDR, headline: "main h1, h1 >> nth=0", form: "main form >> nth=0", email: "main input[type=email]", send: "main button:has-text('Send reset link')" };
    await full(RP, "c-reset0", "Reset password (phone)", LB);
    await typeInto(RP, "main input[type=email]", NEW.email, 4);
    await RP.click("main button:has-text('Send reset link')");
    await RP.waitForTimeout(2000);
    await full(RP, "c-reset1", "Reset link: neutral notice (phone)", { ...LB, notice: "main :text('If that email has an account') >> xpath=ancestor::div[1]" });
    await R.close();
    const L = await context(browser, "desktop");
    const LP = await L.newPage();
    await go(LP, "/admin-login");
    await full(LP, "a-login", "Admin sign in", { headline: "h1 >> nth=0", form: "form >> nth=0" });
    await L.close();
    await go(A, "/admin");
    await A.click("aside button:has-text('Enable order alerts')");
    await A.waitForTimeout(800);
    await full(A, "a-alerts", "Order alerts enabled (sound on)", { ...AS, alerts: "aside :text('Order alerts') >> xpath=ancestor::div[2]", sideNav: "aside nav >> nth=0" });
  });

  // ——— S12 (read-only): the static public pages and the admin's customer list at the end of the story ————————————
  await step("s12", async () => {
    const V = await context(browser, "phone");
    const P = await V.newPage();
    for (const [path, key] of [["/about", "c-about"], ["/delivery", "c-delivery"], ["/faq", "c-faq"]]) {
      await go(P, path);
      await full(P, key, `Public page ${path} (phone)`, { ...HDR, headline: "main h1", first: "main section >> nth=1" });
    }
    await V.close();
    await go(A, "/admin/customers");
    await full(A, "a-customers", "Customers list (end of the story)", { ...AS, list: "main a:has-text('View account') >> nth=0 >> xpath=ancestor::div[3]", cedar: `main a:has-text('${NEW.business}') >> nth=0`, search: "main input >> nth=0" });
  });
} finally {
  await browser.close();
  save();
  console.log(`blocked requests: ${blocked.length}`);
  if (failures.length) console.log("FAILURES:\n" + failures.join("\n"));
}
