// One order through every admin status, captured at a given viewport (Gate F V3.1). Used for the V2 line so the
// warehouse monitor and admin episode show the SAME order Marco placed on his phone (visitor/p-placed).
//   node videos/capture/order-flow.mjs <order-id-prefix> <key-prefix e.g. admin/order> [width height]
// LOCAL demo stack only (videos/devstack); the order must be "new".
import { adminSignIn, blocked, context, go, launch, settle, shot } from "./lib.mjs";

const [prefix, keyPrefix, w = "1440", h = "900"] = process.argv.slice(2);
if (!prefix || !keyPrefix) throw new Error("usage: node capture/order-flow.mjs <order-id-prefix> <key-prefix> [w h]");
const browser = await launch();
try {
  const ctx = await context(browser, "desktop", { viewport: { width: Number(w), height: Number(h) } });
  const a = await adminSignIn(ctx);
  a.on("dialog", (d) => d.accept());
  await go(a, `/admin/orders`);
  await a.locator(`main a[href^='/admin/orders/${prefix}']`).first().click();
  await a.waitForURL(/\/admin\/orders\/.+/);
  await settle(a, 1200);
  const db = { headline: "main h1", status: "main h1 ~ * >> nth=0", note: "main :text('Back door') >> nth=0", items: "main table >> nth=0", total: "main :text('Totals') >> xpath=ancestor::tr[1]", confirm: "main button:has-text('Confirm order')", cancel: "main button:has-text('Cancel order')", invoice: "main a:has-text('Invoice') >> nth=0", profit: "main th:has-text('Profit')" };
  await shot(a, `${keyPrefix}-new`, "Order detail: new order with a delivery note", { boxes: db });
  await a.click("main button:has-text('Confirm order')"); await a.waitForTimeout(2500); await settle(a, 800);
  await shot(a, `${keyPrefix}-confirmed`, "Order detail: confirmed (stock deducted)", { boxes: { ...db, prepared: "main button:has-text('Mark prepared')" } });
  await a.click("main button:has-text('Mark prepared')"); await a.waitForTimeout(2500); await settle(a, 800);
  await shot(a, `${keyPrefix}-prepared`, "Order detail: prepared", { boxes: { ...db, complete: "main button:has-text('omplete') >> nth=0" } });
  await a.locator("main button:has-text('Complete')").first().click(); await a.waitForTimeout(2500); await settle(a, 800);
  await shot(a, `${keyPrefix}-completed`, "Order detail: completed", { boxes: db });
  await ctx.close();
} finally {
  await browser.close();
  console.log(`blocked requests: ${blocked.length}`);
}
