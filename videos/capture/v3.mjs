// V3 footage ("one page, one world"): FULL-PAGE captures at 3x so the camera can travel a whole page, plus
//   - tap states: the same page after each tap (the engine swaps only the changed region, in shot),
//   - layer plates for parallax: the page with the cards hidden (background) — cards/chips/cursor are cut from the
//     full capture by their measured boxes and float above it (see src/v3/README.md).
// Product photos come from the real image_url field (devstack/seed.mjs loads product-photos/, local demo stack only).
// Boxes are PAGE coordinates (captured at scrollY = 0, full page).
//   node videos/capture/v3.mjs [step]
import { adminSignIn, blocked, context, customerSignIn, demo, go, launch, settle, shot, stepper, typeInto } from "./lib.mjs";

const { step, failures } = stepper(process.argv[2] ?? "");
const browser = await launch();
const top = (p) => p.evaluate(() => window.scrollTo(0, 0));
// next/image lazy-loads below the fold: force every image to load before a full-page shot.
const allImages = async (p) => {
  await p.evaluate(() => document.querySelectorAll("img").forEach((i) => { i.loading = "eager"; i.decoding = "sync"; }));
  await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
  await p.waitForFunction(() => [...document.querySelectorAll("img")].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 60000 });
};
const full = async (p, key, desc, boxes, extra = {}) => {
  await top(p);
  return shot(p, key, desc, { boxes, full: true, wait: 900, ...extra });
};
// Hide the given elements (keeps their space) for a background plate.
const hide = (sel) => (p) => p.addStyleTag({ content: `${sel}{visibility:hidden!important}` });

const CARD = "main .grid > div.overflow-hidden";
const cardBoxes = (n = 9) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`card${i}`, `${CARD} >> nth=${i}`]));
const imgBoxes = (n = 9) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`img${i}`, `${CARD} >> nth=${i} >> img`]));
const btnBoxes = (n = 3) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`btn${i}`, `${CARD} >> nth=${i} >> div.mt-3, ${CARD} >> nth=${i} >> button.mt-3`]));

try {
  await step("catalog", async () => {
    const ctx = await context(browser, "desktop");
    const p = await customerSignIn(ctx);
    await go(p, "/portal/catalog");
    await p.waitForSelector(`${CARD} img`);
    await allImages(p);
    const base = { nav: "header", headline: "main h1", search: "main input >> nth=0", cart: "header a:has-text('Cart')", ...cardBoxes(), ...imgBoxes(), ...btnBoxes() };
    await full(p, "v3/catalog-0", "Portal catalog (desktop, full page), real product photos, cart empty", base);
    await full(p, "v3/catalog-bg", "Portal catalog background plate: cards hidden (parallax layer 0)", base, { before: hide(CARD) });
    await go(p, "/portal/catalog"); // drop the hiding style before tapping
    await allImages(p);
    for (let i = 0; i < 3; i++) {
      await top(p);
      await p.locator(`${CARD} >> nth=${i}`).locator("button:has-text('Add to cart')").click();
      await p.waitForTimeout(600);
      await full(p, `v3/catalog-${i + 1}`, `Portal catalog after tap ${i + 1} (card ${i} in cart, badge ${i + 1})`, base);
    }
    await go(p, "/portal/cart");
    await full(p, "v3/cart", "Cart (desktop, full page) with three items", { nav: "header", headline: "main h1", lines: "main ul, main table >> nth=0", total: "main :text('Total') >> nth=0", checkout: "main a:has-text('Proceed to checkout'), main button:has-text('Proceed to checkout') >> nth=0" });
    await go(p, "/portal/checkout");
    const ck = { nav: "header", headline: "main h1", delivery: "label:has-text('Delivery')", pickup: "label:has-text('Pickup')", notes: "textarea", submit: "button:has-text('Submit order')" };
    await p.click("label:has-text('Delivery')");
    await typeInto(p, "textarea", "Back door, before 9 please", 5);
    await full(p, "v3/checkout", "Checkout (desktop, full page): delivery, note typed", ck);
    await p.click("button:has-text('Submit order')");
    await p.waitForURL(/\/portal\/orders\/.+/, { timeout: 60000 });
    await settle(p, 1200);
    await full(p, "v3/order-placed", "Order detail (customer, desktop, full page): New", { nav: "header", headline: "main h1", total: "main :text('Order total') >> nth=0" });
    await ctx.close();
  });

  await step("public", async () => {
    const ctx = await context(browser, "desktop");
    const p = await ctx.newPage();
    await go(p, "/catalog/produce");
    await allImages(p);
    await full(p, "v3/public-produce", "Public catalog, Produce (desktop, full page) with photos", { nav: "header", headline: "main h1" });
    await ctx.close();
  });

  await step("admin", async () => {
    const ctx = await context(browser, "desktop");
    const p = await adminSignIn(ctx);
    p.on("dialog", (d) => d.accept());
    await go(p, "/admin/orders");
    await full(p, "v3/admin-orders", "Admin orders (desktop, full page): the new order on top", { nav: "aside, nav >> nth=0", headline: "main h1", firstRow: "main tbody tr >> nth=0, main a[href^='/admin/orders/'] >> nth=0" });
    await p.locator("main a[href^='/admin/orders/']").first().click();
    await p.waitForURL(/\/admin\/orders\/.+/);
    await settle(p, 1200);
    await full(p, "v3/admin-order", "Admin order detail (desktop, full page): New, Confirm", { headline: "main h1", items: "main table >> nth=0", confirm: "main button:has-text('Confirm')" });
    await go(p, "/admin/products");
    await p.locator("main tr:has-text('Vine-Ripe Tomatoes')").locator("button, a").filter({ hasText: /edit/i }).first().click()
      .catch(() => p.locator("main tr:has-text('Vine-Ripe Tomatoes')").first().click());
    await p.waitForTimeout(900);
    await allImages(p);
    await shot(p, "v3/product-editor", "Product editor (desktop): Vine-Ripe Tomatoes with its photo", { boxes: { dialog: "[role=dialog], form:has(button:has-text('Save')) >> nth=0", photo: "img[alt='Product photo']", replace: "button:has-text('Replace photo')" }, wait: 900 });
    await ctx.close();
  });

  // ——— Gate F: one consistent run for the promo and both manuals (desktop full pages + the phone catalog) ———
  await step("manuals", async () => {
    // phone: the portal catalog with photos, for the promo's phone composite
    const pctx = await context(browser, "phone");
    const m = await customerSignIn(pctx);
    await go(m, "/portal/catalog");
    await allImages(m);
    await full(m, "v3/p-catalog", "Portal catalog on a phone (full page, photos)", { nav: "header", headline: "main h1", firstCard: `${CARD} >> nth=0`, firstImg: `${CARD} >> nth=0 >> img`, add0: `${CARD} >> nth=0 >> button:has-text('Add to cart')` });
    await m.locator(`${CARD} >> nth=0`).locator("button:has-text('Add to cart')").click();
    await m.waitForTimeout(600);
    await full(m, "v3/p-catalog-1", "Portal catalog on a phone after one tap", { nav: "header", firstCard: `${CARD} >> nth=0`, cart: "header a:has-text('Cart'), nav a:has-text('Cart') >> nth=0" });
    await pctx.close();

    // desktop customer: three items, cart, checkout states, submit
    const ctx = await context(browser, "desktop");
    const p = await customerSignIn(ctx);
    await go(p, "/portal/catalog");
    await allImages(p);
    for (let i = 0; i < 3; i++) { await p.locator(`${CARD} >> nth=${i}`).locator("button:has-text('Add to cart')").click(); await p.waitForTimeout(500); }
    await go(p, "/portal/cart");
    await full(p, "v3/cart", "Cart (desktop, full page) with three items", { nav: "header", headline: "main h1", line0: "main li >> nth=0", plus0: "main button[aria-label*='ncrease'] >> nth=0", total: "main :text('Total') >> nth=0", checkout: "main a:has-text('Proceed to checkout'), main button:has-text('Proceed to checkout') >> nth=0", keep: "main a:has-text('Keep browsing')" });
    await go(p, "/portal/checkout");
    const ck = { nav: "header", headline: "main h1", summary: "main :text('Order total') >> xpath=ancestor::div[2]", delivery: "label:has-text('Delivery')", pickup: "label:has-text('Pickup')", notes: "textarea", submit: "button:has-text('Submit order')", back: "main a:has-text('Back to cart')" };
    await full(p, "v3/checkout-0", "Checkout (desktop): fresh", ck);
    await p.click("label:has-text('Delivery')");
    await full(p, "v3/checkout-1", "Checkout (desktop): Delivery chosen", ck);
    await typeInto(p, "textarea", "Back door, before 9 please", 5);
    await full(p, "v3/checkout-2", "Checkout (desktop): note typed", ck);
    await p.click("button:has-text('Submit order')");
    await p.waitForURL(/\/portal\/orders\/.+/, { timeout: 60000 });
    await settle(p, 1200);
    await full(p, "v3/order-placed", "Order detail (customer, desktop): Received", { nav: "header", banner: "main [role=status], main :text-matches('Order received', 'i') >> nth=0", headline: "main h1", status: "main :text-matches('^received$', 'i') >> nth=0", lines: "main ul, main table >> nth=0", total: "main :text('Order total') >> nth=0", back: "main a:has-text('My orders')" });
    await go(p, "/portal/orders");
    await full(p, "v3/orders", "My orders (customer, desktop, full page)", { nav: "header", headline: "main h1", first: "main a[href^='/portal/orders/'] >> nth=1", statement: "main a:has-text('statement') >> nth=0" });
    await ctx.close();

    // admin: dashboard, orders (All, New), the new order through every status, invoice
    const actx = await context(browser, "desktop");
    const a = await adminSignIn(actx);
    a.on("dialog", (d) => d.accept());
    await go(a, "/admin");
    await full(a, "v3/admin-dashboard", "Admin dashboard (desktop, full page)", { sidebar: "aside", headline: "main h1", newOrders: "main :text-matches('New orders', 'i') >> nth=0 >> xpath=ancestor::*[self::a or self::div][1]", ordersNav: "aside a:has-text('Orders')" });
    await go(a, "/admin/orders");
    const ob = { sidebar: "aside", headline: "main h1", tabAll: "main button:has-text('All') >> nth=0", tabNew: "main button:has-text('New') >> nth=0", firstRow: "main a[href^='/admin/orders/'] >> nth=0" };
    await full(a, "v3/admin-orders", "Admin orders: All tab", ob);
    await a.locator("main button:has-text('New')").first().click();
    await a.waitForTimeout(500);
    await full(a, "v3/admin-orders-new", "Admin orders: New tab", ob);
    await a.locator("main a[href^='/admin/orders/']").first().click();
    await a.waitForURL(/\/admin\/orders\/.+/);
    await settle(a, 1200);
    const db = { sidebar: "aside", headline: "main h1", status: "main h1 ~ * >> nth=0", confirm: "main button:has-text('Confirm order')", prepared: "main button:has-text('Mark prepared')", complete: "main button:has-text('Complete order')", invoice: "main a:has-text('Invoice'), main button:has-text('Invoice') >> nth=0", note: "main :text('Back door') >> nth=0", items: "main table >> nth=0", customer: "main :text('Copperleaf Kitchen') >> nth=0" };
    await full(a, "v3/admin-order-new", "Admin order: New", db);
    await a.click("main button:has-text('Confirm order')"); await a.waitForTimeout(2500); await settle(a, 800);
    await full(a, "v3/admin-order-confirmed", "Admin order: Confirmed", db);
    await a.click("main button:has-text('Mark prepared')"); await a.waitForTimeout(2500); await settle(a, 800);
    await full(a, "v3/admin-order-prepared", "Admin order: Prepared", db);
    await a.click("main button:has-text('Complete order')"); await a.waitForTimeout(2500); await settle(a, 800);
    await full(a, "v3/admin-order-completed", "Admin order: Completed", db);
    await a.locator("main a:has-text('Invoice')").first().click();
    await a.waitForURL(/invoice/);
    await settle(a, 1200);
    await full(a, "v3/admin-invoice", "Invoice (desktop, full page)", { sheet: ".doc-sheet >> nth=0", print: "button:has-text('Print')" });
    await actx.close();
  });
} finally {
  await browser.close();
  console.log(`blocked requests: ${blocked.length}${blocked.length ? "\n  " + [...new Set(blocked)].slice(0, 20).join("\n  ") : ""}`);
  if (failures.length) console.log("FAILURES:\n" + failures.join("\n"));
}
