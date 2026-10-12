// Shared helpers for the footage captures. Adapted from the reference video toolkit (generic parts only).
// Captures run against the LOCAL demo server (devstack: http://localhost:3100 + the local database), never production.
//   node videos/capture/<part>.mjs   (from the project root, with devstack/stack.mjs and the demo dev server running)
// Shots land in videos/public/footage/<group>/<shotId>.png; manifest.json is merged part by part.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const SITE = "http://localhost:3100";
/** The address shown in the video's browser bar (the real public host; the pictures come from the local copy). */
export const PUBLIC_HOST = "olleik-foods-site.vercel.app";
const keys = JSON.parse(readFileSync(join(HERE, "..", "devstack", "_keys.json"), "utf8"));
export const demo = keys.demoAccounts;

const OUT = join(HERE, "..", "public", "footage");
const MANIFEST = join(OUT, "manifest.json");
export const DESKTOP = { width: 1440, height: 900 };
export const PHONE = { width: 390, height: 844 };
export const SCALE = Number(process.env.SCALE ?? 3);

export const FREEZE = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important} ::-webkit-scrollbar{display:none} html{scrollbar-width:none;scroll-behavior:auto!important} nextjs-portal{display:none!important}";
/** The app's focus rings would read as the video's own highlight: hide them in every shot. */
export const NOFOCUS = "*:focus,*:focus-visible{outline:none!important} input:focus,textarea:focus,select:focus{box-shadow:none!important}";
const ONLY_SHOTS = (process.env.SHOTS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/** Only the local demo server (and the site's own public stock photos, read-only) can be reached from the capture browser. */
const ALLOWED = [/^http:\/\/localhost:3100\//, /^http:\/\/127\.0\.0\.1:54321\//, /^https:\/\/images\.unsplash\.com\//, /^data:/, /^blob:/];
export const blocked = [];

export const launch = () => chromium.launch({ channel: "chrome", headless: process.env.HEADED !== "1" });
export async function context(browser, device = "desktop", extra = {}) {
  const phone = device === "phone";
  const ctx = await browser.newContext({
    viewport: phone ? PHONE : DESKTOP,
    deviceScaleFactor: SCALE,
    colorScheme: "light",
    locale: "en-CA",
    timezoneId: "America/Toronto",
    ...(phone ? { isMobile: true, hasTouch: true } : {}),
    ...extra,
  });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (ALLOWED.some((re) => re.test(u))) return route.continue();
    blocked.push(u.slice(0, 120));
    return route.abort();
  });
  await ctx.addInitScript((css) => {
    const add = () => {
      if (document.getElementById("__cap_css")) return;
      const s = document.createElement("style");
      s.id = "__cap_css";
      s.textContent = css;
      (document.head || document.documentElement).appendChild(s);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add);
    else add();
  }, "::-webkit-scrollbar{display:none} html{scrollbar-width:none} nextjs-portal{display:none!important}");
  return ctx;
}

export async function typeInto(page, selector, value, delay = 15) {
  await page.fill(selector, "");
  await page.focus(selector);
  await page.keyboard.type(String(value), { delay });
}

export async function settle(page, ms = 700) {
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(ms);
}
export async function go(page, path, waitFor = null) {
  await page.goto(path.startsWith("http") ? path : SITE + path, { waitUntil: "load", timeout: 120000 });
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 60000 }).catch(() => {});
  await settle(page);
}

/** Admin sign-in (demo admin of the local database). */
export async function adminSignIn(ctx) {
  const page = await ctx.newPage();
  await go(page, "/admin-login");
  await typeInto(page, "input[type=email] >> nth=0", demo.admin.email, 5);
  await typeInto(page, "input[type=password]", demo.admin.password, 5);
  await page.click("button[type=submit] >> nth=0");
  await page.waitForURL(/\/admin(\/|$)/, { timeout: 60000 });
  await settle(page);
  return page;
}
/** Customer sign-in on /login (a demo customer of the local database). */
export async function customerSignIn(ctx, key = "copperleaf") {
  const page = await ctx.newPage();
  await go(page, "/login");
  await typeInto(page, "input[type=email] >> nth=0", demo[key].email, 5);
  await typeInto(page, "input[type=password]", demo[key].password, 5);
  await page.click("button[type=submit] >> nth=0");
  await page.waitForURL(/\/portal/, { timeout: 60000 });
  await settle(page);
  return page;
}

/** A box around an element's own text (not its full-width block); with `phrase`, around just that phrase. */
export const textBox = (target, phrase) => async (page) => {
  const loc = typeof target === "string" ? page.locator(target).first() : target.first();
  return loc.evaluate((el, ph) => {
    const r = document.createRange();
    if (!ph) r.selectNodeContents(el);
    else {
      const nodes = [];
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let text = "";
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        nodes.push({ n, at: text.length });
        text += n.textContent;
      }
      const i = text.indexOf(ph);
      if (i < 0) return null;
      const find = (pos) => {
        const hit = [...nodes].reverse().find((x) => x.at <= pos);
        return [hit.n, pos - hit.at];
      };
      r.setStart(...find(i));
      r.setEnd(...find(i + ph.length));
    }
    const b = r.getBoundingClientRect();
    return b.width > 0 ? { x: b.x, y: b.y, width: b.width, height: b.height } : null;
  }, phrase ?? null);
};

export async function boxesOf(page, map = {}) {
  const out = {};
  for (const [name, target] of Object.entries(map)) {
    try {
      const b = typeof target === "function" ? await target(page) : await (typeof target === "string" ? page.locator(target).first() : target.first()).boundingBox({ timeout: 2000 });
      if (b && b.width > 0 && b.height > 0) out[name] = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
    } catch {
      // not on screen
    }
  }
  return out;
}

function readManifest() {
  if (!existsSync(MANIFEST)) return { shots: {} };
  return JSON.parse(readFileSync(MANIFEST, "utf8"));
}
/**
 * One shot: settles, screenshots the viewport (or full page), records boxes and the manifest entry.
 *   key "visitor/home-hero", desc, { boxes: {name: selector}, full, noSettle, wait, before(page), notes }
 */
export async function shot(page, key, desc, opts = {}) {
  if (ONLY_SHOTS.length && !ONLY_SHOTS.includes(key)) return null;
  const [group, id] = key.split("/");
  const file = join(OUT, group, `${id}.png`);
  mkdirSync(dirname(file), { recursive: true });
  if (!opts.noSettle) await settle(page, opts.wait ?? 600);
  await page.addStyleTag({ content: FREEZE + NOFOCUS }).catch(() => {});
  await page.evaluate(() => {
    window.getSelection()?.removeAllRanges();
    const a = document.activeElement;
    if (a instanceof HTMLElement && a.tagName === "BUTTON") a.blur();
  }).catch(() => {});
  if (opts.before) await opts.before(page);
  const boxes = await boxesOf(page, opts.boxes ?? {});
  const H = opts.full ? await page.evaluate(() => document.documentElement.scrollHeight) : 0;
  if (opts.full && H * SCALE > 15000) {
    // Chrome garbles one screenshot taller than ~16k px: capture 4000-CSS-px chunks and stitch them (capture/stitch.py)
    const parts = [];
    for (let y = 0, i = 0; y < H; y += 4000, i++) {
      const part = file.replace(/\.png$/, `.part${i}.png`);
      await page.screenshot({ path: part, fullPage: true, clip: { x: 0, y, width: page.viewportSize().width, height: Math.min(4000, H - y) }, animations: "disabled", caret: "initial" });
      parts.push(part);
    }
    execFileSync("python", [join(HERE, "stitch.py"), file, ...parts]);
  } else await page.screenshot({ path: file, fullPage: Boolean(opts.full), animations: "disabled", caret: "initial" });
  const vp = page.viewportSize();
  const url = new URL(page.url());
  const entry = {
    file: `footage/${group}/${id}.png`,
    device: vp.width < 600 ? "phone" : "desktop",
    viewport: { w: vp.width, h: vp.height },
    scale: SCALE,
    url: `${PUBLIC_HOST}${url.pathname}`,
    desc,
    boxes,
  };
  if (opts.full) entry.pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  if (opts.notes) entry.notes = opts.notes;
  const m = readManifest();
  m.shots[key] = entry;
  const sorted = Object.fromEntries(Object.entries(m.shots).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true })));
  mkdirSync(OUT, { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify({ ...m, shots: sorted }, null, 2));
  console.log(`shot ${key}  (${Object.keys(boxes).length} boxes)`);
  return entry;
}

/** Runs named steps; a failing step is logged and the rest continue. */
export function stepper(only = "") {
  const failures = [];
  const step = async (name, fn) => {
    if (only && !only.split(",").some((o) => name.startsWith(o))) return; // "a,b" runs several steps
    try {
      await fn();
    } catch (e) {
      const msg = `${name}: ${String(e?.message ?? e).split("\n")[0].slice(0, 220)}`;
      failures.push(msg);
      console.log(`FAIL ${msg}`);
    }
  };
  return { step, failures };
}
