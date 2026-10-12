// Gate F (V3.1): the admin order as Salma's warehouse monitor shows it. A 1152 × 720 CSS viewport (16:10, the monitor's
// screen) at 3x, so the real admin layout is captured at the size the monitor shows it: readable, nothing cropped or
// scaled up. The order must be "new" again in the LOCAL database first (videos/devstack only).
//   node videos/capture/monitor.mjs <order-id-prefix>
import { adminSignIn, blocked, context, go, launch, settle, shot } from "./lib.mjs";

const prefix = process.argv[2];
if (!prefix) throw new Error("usage: node capture/monitor.mjs <order-id-prefix>");
const browser = await launch();
try {
  const ctx = await context(browser, "desktop", { viewport: { width: 1152, height: 720 } });
  const a = await adminSignIn(ctx);
  a.on("dialog", (d) => d.accept());
  await go(a, "/admin/orders");
  await a.locator(`main a[href^='/admin/orders/${prefix}']`).first().click();
  await a.waitForURL(/\/admin\/orders\/.+/);
  await settle(a, 1200);
  const b = { headline: "main h1", confirm: "main button:has-text('Confirm order')", prepared: "main button:has-text('Mark prepared')", status: "main h1 ~ * >> nth=0" };
  await shot(a, "v3/m-order-new", "Admin order on Salma's monitor (1152 × 720): New", { boxes: b });
  await a.click("main button:has-text('Confirm order')");
  await a.waitForTimeout(2500);
  await settle(a, 800);
  await shot(a, "v3/m-order-confirmed", "Admin order on Salma's monitor (1152 × 720): Confirmed", { boxes: b });
  await ctx.close();
} finally {
  await browser.close();
  console.log(`blocked requests: ${blocked.length}`);
}
