// V-VISITOR footage: the public site (desktop), the application form, then a demo customer's portal on a phone.
// Everything runs against the local demo server; the application and the order land in the LOCAL database only.
//   node videos/capture/visitor.mjs [prefix]      (SHOTS=key1,key2 to re-record only some shots)
import { blocked, context, customerSignIn, go, launch, settle, shot, stepper, textBox, typeInto } from "./lib.mjs";

const { step, failures } = stepper(process.argv[2] ?? "");
const browser = await launch();
const APPLY = {
  businessName: "Riverbend Bistro",
  contactName: "Clara Morin",
  email: "riverbend@olleik-demo.test",
  phone: "(613) 555-0108",
};
try {
  const desk = await context(browser, "desktop");
  const phone = await context(browser, "phone");

  await step("site", async () => {
    const p = await desk.newPage();
    await go(p, "/");
    await shot(p, "visitor/home-hero", "Home hero: The supplier behind great kitchens", { boxes: { headline: "main h1", lead: "main h1 + p", openAccount: "main a:has-text('Open a wholesale account')", seeWhat: "main a:has-text('See what we carry')", headerCta: "header a:has-text('Become a customer')", nav: "header nav" } });
    await go(p, "/catalog");
    await shot(p, "visitor/catalog", "Catalog: categories", { boxes: { headline: "main h1", intro: "main h1 + p", firstCard: "main a[href^='/catalog/'] >> nth=0", secondCard: "main a[href^='/catalog/'] >> nth=1", thirdCard: "main a[href^='/catalog/'] >> nth=2" } });
    await p.evaluate(() => window.scrollTo(0, 380));
    await shot(p, "visitor/catalog-cards", "Catalog: category cards in view", { boxes: { firstCard: "main a[href^='/catalog/'] >> nth=0", secondCard: "main a[href^='/catalog/'] >> nth=1", thirdCard: "main a[href^='/catalog/'] >> nth=2" } });
    await go(p, "/catalog/produce");
    await p.evaluate(() => {
      const h = [...document.querySelectorAll("main h2")].find((x) => /carry here/i.test(x.textContent ?? ""));
      if (h) window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 140);
    });
    await shot(p, "visitor/category-products", "Produce category: products, prices after sign-in", { boxes: { heading: "main h2:has-text('carry here')", firstItem: "main li >> nth=0", signInNote: "main :text-matches('sign in', 'i') >> nth=0" } });
    await go(p, "/delivery");
    await p.evaluate(() => {
      const h = [...document.querySelectorAll("main h2")].find((x) => /cutoff to dock/i.test(x.textContent ?? ""));
      if (h) window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 160);
    });
    await shot(p, "visitor/delivery-steps", "Delivery: From cutoff to dock, three steps", { boxes: { heading: "main h2:has-text('cutoff to dock')" } });
    await p.close();
  });

  await step("apply", async () => {
    const p = await desk.newPage();
    await go(p, "/apply");
    const boxes = { headline: "main h1", form: "form", businessName: "input[name=businessName]", contactName: "input[name=contactName]", email: "input[name=email]", phone: "input[name=phone]", address: "input[name=address]", businessType: "select[name=businessType]", monthlyVolume: "select[name=monthlyVolume]", notes: "#notes", submit: "form button[type=submit]" };
    await shot(p, "visitor/apply-empty", "Apply: empty form", { boxes });
    for (const [k, v] of Object.entries(APPLY)) await typeInto(p, `input[name=${k}]`, v, 10);
    await typeInto(p, "input[name=address]", "14 Example Street, Ottawa, ON", 5);
    await p.selectOption("select[name=businessType]", { index: 1 }).catch(() => {});
    await p.selectOption("select[name=monthlyVolume]", { index: 2 }).catch(() => {});
    await typeInto(p, "#notes", "Produce and dairy, deliveries Tuesday and Friday.", 5);
    await shot(p, "visitor/apply-filled", "Apply: filled with a fictional business", { boxes });
    await p.click("form button[type=submit]");
    await p.waitForTimeout(2500);
    await settle(p);
    await shot(p, "visitor/apply-sent", "Apply: confirmation after submitting (local database)", { boxes: { card: "main form, main [role=status], main section >> nth=0", headline: "main h2, main h3 >> nth=0" } });
    await p.close();
  });

  await step("phone-apply", async () => {
    const m = await phone.newPage();
    await go(m, "/apply");
    await m.evaluate(() => {
      const f = document.querySelector("form");
      if (f) window.scrollTo(0, f.getBoundingClientRect().top + window.scrollY - 70);
    });
    const boxes = { form: "form", businessName: "input[name=businessName]", contactName: "input[name=contactName]", email: "input[name=email]", phone: "input[name=phone]", address: "input[name=address]", submit: "form button[type=submit]" };
    await shot(m, "visitor/p-apply-empty", "Apply on a phone: empty form", { boxes });
    for (const [k, v] of Object.entries(APPLY)) await typeInto(m, `input[name=${k}]`, v, 5);
    await typeInto(m, "input[name=address]", "14 Example Street, Ottawa, ON", 5);
    await shot(m, "visitor/p-apply-filled", "Apply on a phone: filled (not submitted)", { boxes });
    await m.close();
  });

  await step("portal", async () => {
    const m = await phone.newPage();
    await go(m, "/login");
    const lb = { email: "input[type=email] >> nth=0", password: "input[type=password]", submit: "button[type=submit] >> nth=0", card: "main form >> nth=0" };
    await shot(m, "visitor/p-login", "Customer sign in (phone)", { boxes: lb });
    await m.close();
    const ctx = await context(browser, "phone");
    const p = await customerSignIn(ctx);
    await shot(p, "visitor/p-portal", "Portal dashboard (phone): welcome, catalog count, offers", { boxes: { name: "main h1", catalogCard: "main a:has-text('products available') >> nth=0", offersCard: "main a:has-text('current promotion') >> nth=0" } });
    await go(p, "/portal/catalog");
    const cb = { headline: "main h1", search: "main input[type=search], main input[placeholder*='Search'] >> nth=0", category: "main select >> nth=0", yourPrice: textBox("main", "YOUR PRICE"), firstPrice: "main :text-matches('^\\$[0-9]') >> nth=0", addToCart: "main button:has-text('Add to cart') >> nth=0", firstCard: "main li, main article >> nth=0" };
    await shot(p, "visitor/p-catalog", "My catalog (phone): products at the account price", { boxes: cb });
    await p.evaluate(() => window.scrollTo(0, 260));
    await shot(p, "visitor/p-catalog-card", "My catalog (phone): a product card, Your price, Add to cart", { boxes: { ...cb, addToCart: "main button:has-text('Add to cart') >> nth=0", priceBadge: "main :text('Your price') >> nth=1" } });
    await p.locator("main button:has-text('Add to cart')").first().click();
    await p.waitForTimeout(700);
    await shot(p, "visitor/p-catalog-added", "My catalog (phone): 1 in cart", { boxes: { stepper: "main :text('in cart') >> nth=0", cart: "header a:has-text('Cart'), nav a:has-text('Cart') >> nth=0" } });
    await p.locator("main button:has-text('Add to cart')").nth(0).click().catch(() => {});
    await p.locator("main button:has-text('Add to cart')").nth(0).click().catch(() => {});
    await go(p, "/portal/cart");
    await p.evaluate(() => window.scrollTo(0, 90));
    await shot(p, "visitor/p-cart", "Cart (phone)", { boxes: { headline: "main h1", total: "main :text('Total') >> nth=0", checkout: "main a:has-text('Proceed to checkout'), main button:has-text('Proceed to checkout') >> nth=0" } });
    await go(p, "/portal/checkout");
    const ck = { headline: "main h1", delivery: "label:has-text('Delivery')", pickup: "label:has-text('Pickup')", notes: "textarea", submit: "button:has-text('Submit order')" };
    await shot(p, "visitor/p-checkout", "Checkout (phone): pickup or delivery, notes", { boxes: ck });
    await p.click("label:has-text('Delivery')");
    await typeInto(p, "textarea", "Back door, before 9 please", 10);
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await shot(p, "visitor/p-checkout-filled", "Checkout (phone): delivery chosen, note typed", { boxes: ck });
    await p.click("button:has-text('Submit order')");
    await p.waitForURL(/\/portal\/orders\/.+/, { timeout: 60000 });
    await settle(p, 1200);
    await shot(p, "visitor/p-placed", "Order placed (phone): order detail with status New", { boxes: { headline: "main h1", status: "main :text-matches('^(New|NEW)$') >> nth=0", banner: "main [role=status], main :text-matches('placed|received|submitted', 'i') >> nth=0", total: "main :text('Order total') >> nth=0" } });
    await go(p, "/portal/orders");
    await shot(p, "visitor/p-orders", "My orders (phone): statuses", { boxes: { headline: "main h1", first: "main a[href^='/portal/orders/'] >> nth=1", statement: "main a:has-text('statement') >> nth=0" } });
    await go(p, "/portal/offers");
    await shot(p, "visitor/p-offers", "Offers (phone)", { boxes: { headline: "main h1", offer: "main :text('Salmon Feature Week') >> xpath=ancestor::*[self::li or self::article or self::div][1]" } });
    await p.close();
  });

  await step("statement", async () => {
    const ctx = await context(browser, "desktop");
    const p = await customerSignIn(ctx);
    await go(p, "/portal/orders/statement");
    await shot(p, "visitor/statement", "Statement for a period (desktop), Print / Save as PDF", { boxes: { period: "select >> nth=0", print: "button:has-text('Print')", sheet: ".doc-sheet, main article >> nth=0" } });
    await p.close();
  });
} finally {
  await browser.close();
  console.log(`blocked requests: ${blocked.length}${blocked.length ? "\n  " + [...new Set(blocked)].slice(0, 20).join("\n  ") : ""}`);
  if (failures.length) console.log("FAILURES:\n" + failures.join("\n"));
}
