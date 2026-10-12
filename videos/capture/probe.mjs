// Dev helper for writing capture scripts: lists the interactive elements of a page of the LOCAL demo app.
//   node capture/probe.mjs <admin|copperleaf|visitor> <path> [phone] [js-to-run-first]
import { adminSignIn, context, customerSignIn, go, launch } from "./lib.mjs";
const [who, path, dev, pre] = process.argv.slice(2);
const b = await launch();
const ctx = await context(b, dev === "phone" ? "phone" : "desktop");
const p = who === "admin" ? await adminSignIn(ctx) : who === "visitor" ? await ctx.newPage() : await customerSignIn(ctx, who);
await go(p, path);
if (pre) { await p.evaluate(pre).catch((e) => console.log("pre:", e.message)); await p.waitForTimeout(1500); }
const els = await p.evaluate(() => [...document.querySelectorAll("header a, header button, main button, main a, main input, main select, main textarea, [role=dialog] button, [role=dialog] input, [role=dialog] select, h1, h2, h3")].map((e) => {
  const r = e.getBoundingClientRect();
  return `${e.tagName.toLowerCase()}${e.getAttribute("type") ? "[" + e.getAttribute("type") + "]" : ""}${e.getAttribute("name") ? " name=" + e.getAttribute("name") : ""}${e.getAttribute("placeholder") ? " ph='" + e.getAttribute("placeholder") + "'" : ""} '${(e.innerText || e.value || "").replace(/\s+/g, " ").trim().slice(0, 70)}' @${Math.round(r.x)},${Math.round(r.y + scrollY)} ${Math.round(r.width)}x${Math.round(r.height)}`;
}));
console.log(els.join("\n"));
console.log("height", await p.evaluate(() => document.documentElement.scrollHeight));
await b.close();
