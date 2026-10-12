// Exploration of detail screens and flows (1×, to out/explore/): order detail, customer detail, product editor, leads,
// the portal's add-to-cart → cart → checkout.   node videos/capture/explore2.mjs
import { adminSignIn, blocked, context, customerSignIn, go, launch, stepper } from "./lib.mjs";

const OUT = "videos/out/explore";
const { step, failures } = stepper(process.argv[2] ?? "");
const browser = await launch();
const snap = async (page, name, full = true) => {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/d-${name}.png`, fullPage: full });
  const btns = await page.locator("button:visible, a:visible").evaluateAll((els) => els.map((e) => e.textContent?.trim()).filter((t) => t && t.length < 40));
  console.log(`${name}  ${page.url()}\n   buttons: ${[...new Set(btns)].slice(0, 40).join(" | ")}`);
};
try {
  const desk = await context(browser, "desktop", { deviceScaleFactor: 1 });
  await step("admin", async () => {
    const p = await adminSignIn(desk);
    await go(p, "/admin/orders");
    await p.getByText("Harbourline Catering").first().click();
    await p.waitForURL(/\/admin\/orders\/.+/);
    await go(p, p.url());
    await snap(p, "order-detail");
    await go(p, "/admin/customers");
    await p.getByText("Copperleaf Kitchen").first().click();
    await p.waitForURL(/\/admin\/customers\/.+/);
    await go(p, p.url());
    await snap(p, "customer-detail");
    await go(p, "/admin/customers");
    await p.getByText("Saffron Courtyard").first().click();
    await p.waitForURL(/\/admin\/customers\/.+/);
    await go(p, p.url());
    await snap(p, "customer-pending");
    await go(p, "/admin/products");
    await p.getByRole("button", { name: /Add product/ }).click();
    await snap(p, "product-add", false);
    await go(p, "/admin/offers");
    await snap(p, "offers");
    await p.getByRole("link", { name: /Apply to many/ }).first().click().catch(() => p.getByText(/Apply to many/).first().click());
    await p.waitForTimeout(1500);
    await snap(p, "offers-apply");
  });
  await step("portal", async () => {
    const pctx = await context(browser, "phone", { deviceScaleFactor: 1 });
    const m = await customerSignIn(pctx);
    await go(m, "/portal/catalog");
    await m.getByRole("button", { name: /Add to cart/ }).first().click();
    await m.waitForTimeout(800);
    await snap(m, "p-added", false);
    await go(m, "/portal/cart");
    await snap(m, "p-cart");
    await go(m, "/portal/checkout");
    await snap(m, "p-checkout");
    await go(m, "/portal/orders");
    await m.locator("a[href^='/portal/orders/']").filter({ hasText: "#" }).first().click();
    await m.waitForTimeout(1500);
    await snap(m, "p-order-detail");
    await go(m, "/portal/offers");
    await snap(m, "p-offers", false);
  });
} finally {
  await browser.close();
  console.log(`blocked requests: ${blocked.length}`);
  if (failures.length) console.log("FAILURES:\n" + failures.join("\n"));
}
