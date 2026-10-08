// Exploration pass: signs in as the demo admin and a demo customer, visits every route and saves 1× desktop and phone
// screenshots to out/explore/ (not footage) to plan the storyboards.   node videos/capture/explore.mjs [prefix]
import { mkdirSync } from "node:fs";
import { adminSignIn, blocked, context, customerSignIn, go, launch, stepper } from "./lib.mjs";

const OUT = "videos/out/explore";
mkdirSync(OUT, { recursive: true });
const { step, failures } = stepper(process.argv[2] ?? "");
const browser = await launch();
const snap = async (page, name, full = true) => {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  const t = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 300);
  console.log(`${name}  ${page.url()}  | ${t}`);
};
try {
  const desk = await context(browser, "desktop", { deviceScaleFactor: 1 });
  const phone = await context(browser, "phone", { deviceScaleFactor: 1 });
  await step("site", async () => {
    const p = await desk.newPage();
    for (const r of ["/", "/catalog", "/catalog/produce", "/who-we-serve", "/delivery", "/about", "/faq", "/contact", "/apply", "/login", "/suppliers", "/resources", "/careers"]) {
      await go(p, r);
      await snap(p, `site${r.replace(/\//g, "_") || "_home"}`);
    }
    const m = await phone.newPage();
    for (const r of ["/", "/apply", "/catalog"]) {
      await go(m, r);
      await snap(m, `phone-site${r.replace(/\//g, "_")}`, false);
    }
  });
  await step("admin", async () => {
    const p = await adminSignIn(desk);
    for (const r of ["/admin", "/admin/orders", "/admin/products", "/admin/categories", "/admin/customers", "/admin/assign", "/admin/pricing", "/admin/offers", "/admin/leads", "/admin/analytics", "/admin/reports", "/admin/documents/products", "/admin/documents/low-stock", "/admin/customers/new"]) {
      await go(p, r);
      await snap(p, `admin${r.replace(/\//g, "_")}`);
    }
  });
  await step("portal", async () => {
    const ctx = await context(browser, "desktop", { deviceScaleFactor: 1 });
    const p = await customerSignIn(ctx);
    for (const r of ["/portal", "/portal/catalog", "/portal/offers", "/portal/cart", "/portal/orders", "/portal/account", "/portal/orders/statement"]) {
      await go(p, r);
      await snap(p, `portal${r.replace(/\//g, "_")}`);
    }
    const pctx = await context(browser, "phone", { deviceScaleFactor: 1 });
    const m = await customerSignIn(pctx);
    for (const r of ["/portal", "/portal/catalog", "/portal/orders"]) {
      await go(m, r);
      await snap(m, `phone-portal${r.replace(/\//g, "_")}`, false);
    }
  });
} finally {
  await browser.close();
  console.log(`blocked requests: ${blocked.length}${blocked.length ? "\n  " + [...new Set(blocked)].slice(0, 20).join("\n  ") : ""}`);
  if (failures.length) console.log("FAILURES:\n" + failures.join("\n"));
}
