// V3 footage ("one page, one world"): FULL-PAGE captures at 3x so the camera can travel a whole page, plus
//   - tap states: the same page after each tap (the engine swaps only the changed region, in shot),
//   - layer plates for parallax: the page with the cards hidden (background) — cards/chips/cursor are cut from the
//     full capture by their measured boxes and float above it (see src/v3/README.md).
// Product photos come from the real image_url field (devstack/photos.mjs, local demo stack only).
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
    await typeInto(p, "textarea", "Back door, before 9 please.", 5);
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
} finally {
  await browser.close();
  console.log(`blocked requests: ${blocked.length}${blocked.length ? "\n  " + [...new Set(blocked)].slice(0, 20).join("\n  ") : ""}`);
  if (failures.length) console.log("FAILURES:\n" + failures.join("\n"));
}
