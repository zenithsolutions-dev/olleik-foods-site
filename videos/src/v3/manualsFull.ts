/**
 * Part B: the complete usage videos in the V3.1 language: the full visitor manual "Marco's First Order" (five chapters)
 * and admin episodes 2-5 (Episode 1 is manuals.ts ADMIN_EP1). Same rules as manuals.ts: one continuous camera per
 * page, a tap switches to the real after-tap capture, typing reveals the real typed capture, whips only between pages,
 * no hold longer than a beat, captions in the lower band, no trailing periods. `forbid` boxes are never on screen
 * (validated every frame): the public footer's placeholder phone, every document header with the unset business
 * details, and the home page's sample stats (the home page is not used at all).
 * Lines are the approved EPISODE_PLAN_V2 captions without periods; new lines are marked Pending Review in the report.
 */
import { Box, Key, validateCamera, World } from "./camera";
import { assertLine } from "./lines";
import { CATALOG } from "./shots";
import { ADMIN_EP1, b, BAND_PX, cartShot, catalogShot, center, ckShot, Manual, manualEvents, placedShot, Seg, srtOf, worldOf } from "./manuals";
export { srtOf };
import type { CursorKey, Wipe, WorldShot } from "./World";

const K = (f: number, cx: number, cy: number, z: number, ease?: Key["ease"], eye?: string): Key => ({ f, cx, cy, z, ease, eye });
const press = (w: World, box: string, f: number, arrive: number, dx = 8, dy = 4): CursorKey[] => {
  const c = center(w.boxes[box], dx, dy);
  return [{ f: arrive, ...c }, { f, ...c, press: true }, { f: f + 7, x: c.x + 6, y: c.y + 6 }];
};
const typed = (box: string, field: string, f: number, dur: number, to: string, bg = "#ffffff"): Wipe => ({ box, field, bg, f, dur, to, hold: true });
/** Lay segments end to end. */
function sequence(parts: ({ kind: "world"; dur: number; shot: WorldShot; whipIn?: boolean; whipOut?: boolean } | { kind: "live"; dur: number; src: string; start: number; line?: string; lineAt?: number; punchAt?: number } | { kind: "next"; dur: number; line: string } | { kind: "end"; dur: number; line: string; cta?: string; url?: string })[]) {
  let t = 0;
  const segs = parts.map((p) => { const s = { ...p, from: t } as Seg; t += p.dur; return s; });
  return { segs, frames: t, at: (i: number) => segs[i].from };
}

// ═════════════════════════════ Visitor manual: Marco's First Order ═════════════════════════════
// Chapter 1 · Apply (the application form: typed in place, then sent)
const applyW = worldOf("apply-0", ["nav", "headline", "form"], {
  footer: { x: 0, y: 833, w: 1440, h: 700 }, // the site footer (placeholder phone) on the form page and the sent page
  tBn: { x: 701, y: 297, w: 125, h: 15 }, fBn: { x: 691, y: 284, w: 257, h: 38 },
  tCn: { x: 983, y: 297, w: 92, h: 13 }, fCn: { x: 972, y: 284, w: 257, h: 38 },
  tEm: { x: 702, y: 385, w: 158, h: 15 }, fEm: { x: 691, y: 372, w: 257, h: 38 },
  tPh: { x: 982, y: 384, w: 99, h: 15 }, fPh: { x: 972, y: 372, w: 257, h: 38 },
  tAd: { x: 701, y: 473, w: 181, h: 16 }, fAd: { x: 691, y: 460, w: 538, h: 38 },
  tNo: { x: 702, y: 649, w: 207, h: 16 }, fNo: { x: 691, y: 636, w: 520, h: 40 },
  received: { x: 650, y: 215, w: 620, h: 200 },
});
applyW.forbid = ["footer"];
const AP = { filled: 126, submit: 146, len: 200 };
const applyShot: WorldShot = {
  world: applyW,
  plate: [[0, "v3/apply-0"], [AP.filled, "v3/apply-1"], [AP.submit, "v3/apply-2"]],
  wipes: [
    typed("tBn", "fBn", 26, 14, "v3/apply-1"), typed("tCn", "fCn", 42, 12, "v3/apply-1"), typed("tEm", "fEm", 56, 16, "v3/apply-1"),
    typed("tPh", "fPh", 74, 12, "v3/apply-1"), typed("tAd", "fAd", 88, 16, "v3/apply-1"), typed("tNo", "fNo", 106, 18, "v3/apply-1"),
  ],
  keys: [K(0, 720, 420, 1.0), K(6, 716, 424, 1.01, "linear"), K(22, 700, 580, 1.35, "expo", "form"), K(118, 704, 576, 1.36, "linear"), K(AP.submit, 702, 580, 1.35, "linear"), K(AP.submit + 16, 720, 420, 1.3, "snap", "received"), K(AP.len, 724, 416, 1.31, "linear")],
  cursor: [{ f: 0, x: 1100, y: 760 }, { f: 24, x: 760, y: 303 }, { f: 40, x: 1050, y: 303 }, { f: 54, x: 760, y: 391 }, { f: 72, x: 1050, y: 391 }, { f: 86, x: 800, y: 479 }, { f: 104, x: 800, y: 668 }, ...press(applyW, "submit", AP.submit, AP.submit - 10)],
};
// Chapter 2 · Sign in, then the portal
const loginW = worldOf("login-0", ["headline", "card"], {
  footer: { x: 0, y: 734, w: 1440, h: 500 },
  tEm: { x: 565, y: 399, w: 188, h: 15 }, fEm: { x: 555, y: 388, w: 330, h: 34 },
  tPw: { x: 565, y: 478, w: 77, h: 8 }, fPw: { x: 555, y: 464, w: 330, h: 34 },
});
loginW.forbid = ["footer"];
const loginShot: WorldShot = {
  world: loginW,
  plate: [[0, "v3/login-0"], [48, "v3/login-1"]],
  wipes: [typed("tEm", "fEm", 18, 16, "v3/login-1", "#faf6ec"), typed("tPw", "fPw", 36, 10, "v3/login-1", "#faf6ec")],
  keys: [K(0, 720, 420, 1.0), K(14, 720, 470, 1.4, "expo", "card"), K(72, 724, 474, 1.41, "linear")],
  cursor: [{ f: 0, x: 980, y: 700 }, { f: 16, x: 820, y: 405 }, { f: 34, x: 820, y: 481 }, ...press(loginW, "submit", 58, 50)],
};
const portalW = worldOf("portal", ["nav", "headline", "catalogCard"]);
const portalShot: WorldShot = {
  world: portalW, plate: "v3/portal",
  keys: [K(0, 720, 405, 1.0), K(14, 720, 320, 1.27, "expo", "catalogCard"), K(62, 718, 316, 1.28, "linear")],
  cursor: [{ f: 0, x: 1000, y: 700 }, ...press(portalW, "catalogCard", 48, 40, -120, 10)],
};
// Chapter 3 · Your catalog: your price, search, offers
const cat3W: World = {
  ...CATALOG,
  boxes: { ...CATALOG.boxes, searchRow: { x: 168, y: 254, w: 622, h: 38 }, priceRow: { x: 184, y: 646, w: 330, h: 32 }, tSr: { x: 184, y: 267, w: 49, h: 14 }, fSr: { x: 172, y: 258, w: 276, h: 30 }, searchBtn: { x: 711, y: 255, w: 79, h: 36 }, card0: CATALOG.boxes.card0 },
  anchors: [...CATALOG.anchors, "searchRow", "card0", "card1", "card2"],
};
const searchShot: WorldShot = {
  world: cat3W,
  plate: [[0, "v3/catalog-0"], [62, "v3/search-1"], [72, "v3/search-2"]],
  wipes: [typed("tSr", "fSr", 44, 16, "v3/search-1")],
  keys: [K(0, 420, 600, 1.45, undefined, "priceRow"), K(10, 426, 606, 1.47, "linear"), K(36, 560, 360, 1.35, "snap", "searchRow"), K(70, 566, 364, 1.36, "linear"), K(84, 554, 553, 1.3, "snap", "card0"), K(110, 560, 550, 1.31, "linear")],
  cursor: [{ f: 0, x: 520, y: 760 }, { f: 30, x: 330, y: 276 }, ...press(cat3W, "searchBtn", 72, 64)],
};
const offersW = worldOf("offers", ["nav", "headline", "offerCard"], { offerCard: { x: 168, y: 255, w: 1104, h: 133 } });
const offersShot: WorldShot = { world: offersW, plate: "v3/offers", keys: [K(0, 720, 405, 1.0), K(14, 720, 330, 1.25, "expo", "offerCard"), K(66, 718, 324, 1.26, "linear")] };
// Chapter 5 · Follow up: the order's status, the statement, the account
const ordersW = worldOf("orders", ["nav", "headline", "first"]);
const ordersShot2: WorldShot = {
  world: ordersW, plate: "v3/orders",
  keys: [K(0, 720, 405, 1.0), K(16, 720, 444, 1.2, "expo", "first"), K(36, 740, 444, 1.22, "linear"), K(50, 558, 359, 1.45, "snap", "statement"), K(72, 562, 362, 1.46, "linear")],
  cursor: [{ f: 0, x: 1100, y: 700 }, ...press(ordersW, "statement", 62, 54, -40, 2)],
};
const stmtW = worldOf("statement", ["totals", "products"], { totals: { x: 377, y: 450, w: 686, h: 180 }, products: { x: 377, y: 690, w: 686, h: 300 } });
stmtW.forbid = ["docHeader", "docFooter"]; // the document header carries the unset business details
const stmtShot: WorldShot = { world: stmtW, plate: "v3/statement", keys: [K(0, 720, 760, 1.3, undefined, "totals"), K(20, 720, 800, 1.32, "linear"), K(40, 720, 860, 1.35, "snap", "products"), K(72, 716, 866, 1.36, "linear")] };
const accountW = worldOf("account", ["nav", "headline", "table"], { table: { x: 168, y: 255, w: 1104, h: 317 } });
const accountShot: WorldShot = { world: accountW, plate: "v3/account", keys: [K(0, 720, 405, 1.0), K(14, 720, 410, 1.25, "expo", "table"), K(66, 718, 406, 1.26, "linear")] };

const V = sequence([
  { kind: "live", dur: 60, src: "v3/clips/marco-169-t1.mp4", start: 0.4, line: "Running low again?", lineAt: 4, punchAt: 34 },
  { kind: "world", dur: AP.len, shot: applyShot, whipOut: true },
  { kind: "world", dur: 72, shot: loginShot, whipIn: true, whipOut: true },
  { kind: "world", dur: 62, shot: portalShot, whipIn: true, whipOut: true },
  { kind: "world", dur: 110, shot: searchShot, whipIn: true, whipOut: true },
  { kind: "world", dur: 66, shot: offersShot, whipIn: true, whipOut: true },
  { kind: "world", dur: b(10) + 4, shot: catalogShot, whipIn: true, whipOut: true },
  { kind: "world", dur: b(5) + 2, shot: cartShot, whipIn: true, whipOut: true },
  { kind: "world", dur: b(9) + 2, shot: ckShot, whipIn: true, whipOut: true },
  { kind: "world", dur: b(5), shot: placedShot, whipIn: true, whipOut: true },
  { kind: "world", dur: 72, shot: ordersShot2, whipIn: true, whipOut: true },
  { kind: "world", dur: 72, shot: stmtShot, whipIn: true, whipOut: true },
  { kind: "world", dur: 66, shot: accountShot, whipIn: true, whipOut: true },
  { kind: "end", dur: 75, line: "The supplier behind great kitchens", cta: "Become a customer →", url: "olleik-foods-site.vercel.app" },
]);
const va = V.at;
export const VISITOR_FULL: Manual = {
  id: "V3-VISITOR-FULL", frames: V.frames, tag: "Marco's First Order", segs: V.segs,
  chapters: [{ from: va(1), label: "1 · Apply" }, { from: va(2), label: "2 · Sign in" }, { from: va(4), label: "3 · Your catalog" }, { from: va(6), label: "4 · Ordering" }, { from: va(10), label: "5 · Follow up" }],
  captions: [
    { from: va(1) + 6, to: va(1) + AP.submit - 6, text: "Apply for a wholesale account" },
    { from: va(1) + AP.submit - 4, to: va(2) - 2, text: "Send it: the Olleik team reviews it" },
    { from: va(2) + 4, to: va(3) - 2, text: "Approved? Sign in with your email" },
    { from: va(3) + 4, to: va(4) - 2, text: "Your portal: your catalog and your offers" },
    { from: va(4) + 4, to: va(4) + 38, text: "Every item shows your account's price" },
    { from: va(4) + 40, to: va(5) - 2, text: "Search or filter your catalog" },
    { from: va(5) + 4, to: va(6) - 2, text: "Your offers, set up by your Olleik rep" },
    { from: va(6) + 6, to: va(7) - 2, text: "Add what you need to the cart" },
    { from: va(7) + 4, to: va(8) - 2, text: "Check the cart, then go to checkout" },
    { from: va(8) + 4, to: va(8) + 126, text: "Delivery or pickup, plus a note" },
    { from: va(8) + 128, to: va(9) - 2, text: "Submit: payment stays on your usual terms" },
    { from: va(9) + 4, to: va(10) - 2, text: "Received: the team confirms it next" },
    { from: va(10) + 4, to: va(11) - 2, text: "Follow it: received, confirmed, ready, completed" },
    { from: va(11) + 4, to: va(12) - 2, text: "Print a statement for any period" },
    { from: va(12) + 4, to: va(13) - 2, text: "Your account: contacts, address and terms" },
  ],
};

// ═════════════════════════════ Admin Episode 2 · Customers and approvals ═════════════════════════════
const leadsW = worldOf("leads-0", ["headline", "first"]);
const leadsShot: WorldShot = {
  world: leadsW, plate: [[0, "v3/leads-0"], [52, "v3/leads-1"]],
  keys: [K(0, 720, 405, 1.0), K(14, 848, 421, 1.3, "expo", "first"), K(86, 852, 424, 1.3, "linear")],
  cursor: [{ f: 0, x: 900, y: 720 }, ...press(leadsW, "firstStatus", 52, 42)],
};
const newW = worldOf("cust-new-0", ["headline", "lead"]);
const newShot: WorldShot = {
  world: newW, plate: [[0, "v3/cust-new-0"], [30, "v3/cust-new-1"]],
  keys: [K(0, 720, 405, 1.0), K(12, 848, 410, 1.3, "expo", "lead"), K(70, 852, 406, 1.3, "linear")],
  cursor: [{ f: 0, x: 700, y: 700 }, ...press(newW, "check", 30, 20, 0, 0), ...press(newW, "convert", 56, 46)],
};
const custW = worldOf("customers", ["headline", "newOne"]);
const custShot: WorldShot = { world: custW, plate: "v3/customers", keys: [K(0, 720, 405, 1.0), K(14, 848, 584, 1.3, "expo", "newOne"), K(66, 852, 580, 1.3, "linear")] };
const pricesW = worldOf("cust-prices", ["prices", "firstPrice"]);
const pricesShot: WorldShot = { world: pricesW, plate: "v3/cust-prices", keys: [K(0, 720, 1500, 1.0), K(14, 848, 1600, 1.3, "snap", "prices"), K(66, 852, 1610, 1.3, "linear")] };
const E2 = sequence([
  { kind: "live", dur: 60, src: "v3/clips/f2/ep2.mp4", start: 1.6, line: "A new restaurant wants an account", lineAt: 4, punchAt: 34 },
  { kind: "world", dur: 86, shot: leadsShot, whipOut: true },
  { kind: "world", dur: 70, shot: newShot, whipIn: true, whipOut: true },
  { kind: "world", dur: 66, shot: custShot, whipIn: true, whipOut: true },
  { kind: "world", dur: 66, shot: pricesShot, whipIn: true, whipOut: true },
  { kind: "next", dur: 54, line: "Next: products and prices" },
]);
export const ADMIN_EP2: Manual = {
  id: "V3-EP2", frames: E2.frames, tag: "Admin Episode 2 · Customers and approvals", segs: E2.segs,
  chapters: [{ from: E2.at(1), label: "Episode 2 · Customers" }],
  captions: [
    { from: E2.at(1) + 4, to: E2.at(1) + 48, text: "Applications land in Leads" },
    { from: E2.at(1) + 50, to: E2.at(2) - 2, text: "Set the status: approved" },
    { from: E2.at(2) + 4, to: E2.at(3) - 2, text: "Add the customer from the approved lead" },
    { from: E2.at(3) + 4, to: E2.at(4) - 2, text: "Every customer, with status and terms" },
    { from: E2.at(4) + 4, to: E2.at(5) - 2, text: "Each customer has their own prices" },
  ],
};

// ═════════════════════════════ Admin Episode 3 · Products and prices ═════════════════════════════
const prodW = worldOf("products-0", ["headline", "stockCol", "add", "sku", "priceFields", "newRow", "rowsA", "rowsB", "rowsC"], {
  rowsA: { x: 297, y: 700, w: 1102, h: 400 }, rowsB: { x: 297, y: 1100, w: 1102, h: 400 }, rowsC: { x: 297, y: 1500, w: 1102, h: 400 }, // the table itself, as anchors along the long move
  priceFields: { x: 457, y: 600, w: 526, h: 180 },
  tSku: { x: 470, y: 191, w: 63, h: 14 }, fSku: { x: 459, y: 181, w: 251, h: 34 },
  tName: { x: 470, y: 268, w: 132, h: 15 }, fName: { x: 459, y: 257, w: 522, h: 34 },
  tSize: { x: 740, y: 574, w: 28, h: 13 }, fSize: { x: 730, y: 563, w: 251, h: 34 },
  create: { x: 850, y: 1035, w: 133, h: 38 }, newRow: { x: 297, y: 1574, w: 1102, h: 46 },
  sku: { x: 457, y: 179, w: 255, h: 38 },
});
const PR = { add: 52, filled: 104, create: 156, len: 196 };
const prodShot: WorldShot = {
  world: prodW,
  plate: [[0, "v3/products-0"], [PR.add, "v3/product-add-0"], [PR.filled, "v3/product-add-1"], [PR.create, "v3/products-1"]],
  wipes: [typed("tSku", "fSku", 66, 10, "v3/product-add-1", "#faf6ec"), typed("tName", "fName", 78, 14, "v3/product-add-1", "#faf6ec"), typed("tSize", "fSize", 94, 8, "v3/product-add-1", "#faf6ec")],
  keys: [K(0, 720, 405, 1.0), K(14, 848, 449, 1.3, "expo", "stockCol"), K(40, 848, 420, 1.3, "snap", "add"), K(PR.add + 2, 852, 424, 1.3, "linear"), K(62, 844, 300, 1.35, "snap", "sku"), K(100, 840, 304, 1.36, "linear"), K(112, 720, 690, 1.35, "snap", "priceFields"), K(136, 724, 694, 1.36, "linear"), K(146, 850, 860, 1.35, "snap", "create"), K(PR.create + 2, 852, 862, 1.35, "linear"), K(172, 760, 1655, 1.1, "snap", "newRow"), K(PR.len, 756, 1660, 1.12, "linear")],
  cursor: [{ f: 0, x: 900, y: 700 }, ...press(prodW, "add", PR.add, 44), { f: 64, x: 520, y: 200 }, { f: 92, x: 780, y: 582 }, ...press(prodW, "create", PR.create, 148)],
};
const catsW = worldOf("categories", ["headline", "produce"]);
const catsShot: WorldShot = { world: catsW, plate: "v3/categories", keys: [K(0, 720, 405, 1.0), K(14, 848, 547, 1.3, "expo", "produce"), K(62, 852, 544, 1.3, "linear")] };
const assignW = worldOf("assign", ["headline", "pickProducts"]);
const assignShot: WorldShot = { world: assignW, plate: "v3/assign", keys: [K(0, 720, 405, 1.0), K(14, 848, 380, 1.3, "expo", "pickProducts"), K(66, 844, 376, 1.32, "linear")] };
const E3 = sequence([
  { kind: "live", dur: 60, src: "v3/clips/f2/ep3.mp4", start: 2.6, line: "A new item comes in on Monday", lineAt: 4, punchAt: 34 },
  { kind: "world", dur: PR.len, shot: prodShot, whipOut: true },
  { kind: "world", dur: 62, shot: catsShot, whipIn: true, whipOut: true },
  { kind: "world", dur: 66, shot: assignShot, whipIn: true, whipOut: true },
  { kind: "next", dur: 54, line: "Next: margins and reports" },
]);
export const ADMIN_EP3: Manual = {
  id: "V3-EP3", frames: E3.frames, tag: "Admin Episode 3 · Products and prices", segs: E3.segs,
  chapters: [{ from: E3.at(1), label: "Episode 3 · Products" }],
  captions: [
    { from: E3.at(1) + 4, to: E3.at(1) + PR.add - 2, text: "Stock, cost and price in one list" },
    { from: E3.at(1) + PR.add, to: E3.at(1) + 108, text: "Add the product" },
    { from: E3.at(1) + 110, to: E3.at(1) + PR.create - 2, text: "Cost stays private; customers see the sale price" },
    { from: E3.at(1) + PR.create, to: E3.at(2) - 2, text: "It's in the list, ready to assign" },
    { from: E3.at(2) + 4, to: E3.at(3) - 2, text: "Put it in a category" },
    { from: E3.at(3) + 4, to: E3.at(4) - 2, text: "Assign it to the customers who buy it" },
  ],
};

// ═════════════════════════════ Admin Episode 4 · Margins and reports ═════════════════════════════
const pricingW = worldOf("pricing", ["headline", "global", "rules"], { rules: { x: 296, y: 330, w: 1104, h: 400 } });
const pricingShot: WorldShot = { world: pricingW, plate: "v3/pricing", keys: [K(0, 720, 405, 1.0), K(14, 834, 305, 1.3, "expo", "global"), K(40, 838, 310, 1.3, "linear"), K(54, 834, 565, 1.3, "snap", "rules"), K(80, 838, 570, 1.3, "linear")] };
const anaW = worldOf("analytics", ["headline", "trend", "tableTop"], { tableTop: { x: 297, y: 704, w: 1102, h: 300 } });
const anaShot: WorldShot = { world: anaW, plate: "v3/analytics", keys: [K(0, 720, 405, 1.0), K(14, 848, 460, 1.25, "expo", "trend"), K(44, 852, 464, 1.25, "linear"), K(58, 848, 900, 1.25, "snap", "tableTop"), K(96, 844, 906, 1.26, "linear")] };
const repW = worldOf("reports", ["sectionsList", "print"], { sectionsList: { x: 296, y: 520, w: 320, h: 280 } });
repW.forbid = ["docHeader", "docFooter"]; // the report sheet's header carries the unset business details
const repShot: WorldShot = { world: repW, plate: "v3/reports", keys: [// top edge at y ≈ 340: between the sheet header rule (327) and "Revenue summary" (352), so no line is sliced
K(0, 812, 670, 1.25), K(16, 812, 652, 1.3, "expo", "print"), K(66, 816, 655, 1.3, "linear")] };
const lowW = worldOf("products-0", ["headline", "lowBanner"], { lowBanner: { x: 297, y: 240, w: 1102, h: 44 }, printLinks: { x: 296, y: 196, w: 520, h: 24 } });
const lowShot: WorldShot = { world: lowW, plate: "v3/products-0", keys: [K(0, 848, 380, 1.0), K(14, 848, 328, 1.25, "expo", "lowBanner"), K(66, 852, 331, 1.27, "linear")] };
const E4 = sequence([
  { kind: "live", dur: 60, src: "v3/clips/f2/ep4.mp4", start: 0.5, line: "Are the prices still right?", lineAt: 4, punchAt: 34 },
  { kind: "world", dur: 80, shot: pricingShot, whipOut: true },
  { kind: "world", dur: 96, shot: anaShot, whipIn: true, whipOut: true },
  { kind: "world", dur: 66, shot: repShot, whipIn: true, whipOut: true },
  { kind: "world", dur: 66, shot: lowShot, whipIn: true, whipOut: true },
  { kind: "next", dur: 54, line: "Next: invites and access" },
]);
export const ADMIN_EP4: Manual = {
  id: "V3-EP4", frames: E4.frames, tag: "Admin Episode 4 · Margins and reports", segs: E4.segs,
  chapters: [{ from: E4.at(1), label: "Episode 4 · Margins" }],
  captions: [
    { from: E4.at(1) + 4, to: E4.at(2) - 2, text: "Margin rules turn cost into each price" },
    { from: E4.at(2) + 4, to: E4.at(2) + 54, text: "See what sells, by period" },
    { from: E4.at(2) + 56, to: E4.at(3) - 2, text: "Units, revenue and profit per product" },
    { from: E4.at(3) + 4, to: E4.at(4) - 2, text: "Build a report, then print it" },
    { from: E4.at(4) + 4, to: E4.at(5) - 2, text: "Low stock is one click away" },
  ],
};

// ═════════════════════════════ Admin Episode 5 · Invites and access ═════════════════════════════
const detW = worldOf("cust-detail-0", ["headline", "portalCard", "copyLinkB", "visibilityB"], {
  portalCard: { x: 317, y: 221, w: 1062, h: 120 }, copyLinkB: { x: 463, y: 275, w: 111, h: 38 }, visibilityB: { x: 317, y: 753, w: 1062, h: 120 },
});
const detShot: WorldShot = {
  world: detW, plate: [[0, "v3/cust-detail-0"], [44, "v3/cust-detail-2"]],
  keys: [K(0, 720, 405, 1.0), K(14, 848, 350, 1.3, "expo", "portalCard"), K(46, 850, 353, 1.31, "linear"), K(60, 848, 400, 1.3, "snap", "copyLinkB"), K(92, 852, 404, 1.3, "linear"), K(104, 822, 855, 1.3, "snap", "visibilityB"), K(140, 820, 860, 1.3, "linear")],
  cursor: [{ f: 0, x: 900, y: 700 }, ...press(detW, "sendEmail", 44, 36), { f: 66, x: 530, y: 300 }, { f: 96, x: 536, y: 304 }],
};
const admW = worldOf("admin-login", ["headline", "email"]);
const admShot: WorldShot = { world: admW, plate: "v3/admin-login", keys: [K(0, 720, 405, 1.0), K(14, 720, 470, 1.4, "expo", "email"), K(66, 716, 474, 1.41, "linear")] };
const E5 = sequence([
  { kind: "live", dur: 60, src: "v3/clips/f2/ep5.mp4", start: 1.0, line: "The new customer can't sign in yet", lineAt: 4, punchAt: 34 },
  { kind: "world", dur: 140, shot: detShot, whipOut: true },
  { kind: "world", dur: 66, shot: admShot, whipIn: true, whipOut: true },
  { kind: "end", dur: 75, line: "That's the tour", cta: "", url: "olleik-foods-site.vercel.app/admin" },
]);
export const ADMIN_EP5: Manual = {
  id: "V3-EP5", frames: E5.frames, tag: "Admin Episode 5 · Invites and access", segs: E5.segs,
  chapters: [{ from: E5.at(1), label: "Episode 5 · Access" }],
  captions: [
    { from: E5.at(1) + 4, to: E5.at(1) + 56, text: "Invite them to the portal from their page" },
    { from: E5.at(1) + 58, to: E5.at(1) + 100, text: "No email? Copy the invite link and send it yourself" },
    { from: E5.at(1) + 102, to: E5.at(2) - 2, text: "Choose which products they can see" },
    { from: E5.at(2) + 4, to: E5.at(3) - 2, text: "Only emails on the admin list can open the admin" },
  ],
};

export const EP1_FULL: Manual = { ...ADMIN_EP1, id: "V3-EP1-FULL", chapters: [{ from: ADMIN_EP1.segs[1].from, label: "Episode 1 · Orders" }] };
export const FULL_MANUALS = { "V3-VISITOR-FULL": VISITOR_FULL, "V3-EP1-FULL": EP1_FULL, "V3-EP2": ADMIN_EP2, "V3-EP3": ADMIN_EP3, "V3-EP4": ADMIN_EP4, "V3-EP5": ADMIN_EP5 } as const;
const problems: string[] = [];
for (const m of Object.values(FULL_MANUALS)) {
  for (const s of m.segs) if (s.kind === "world") { try { validateCamera(s.shot.world, s.shot.keys, s.dur, BAND_PX); } catch (e) { problems.push(`${m.id} @${s.from}: ${(e as Error).message}`); } }
  for (const c of m.captions) assertLine(c.text);
  for (const s of m.segs) if (s.kind !== "world" && s.line) assertLine(s.line);
  for (const c of m.chapters ?? []) assertLine(c.label);
}
if (problems.length) throw new Error(problems.join(" | "));
export type { Box };
export const fullEvents = Object.fromEntries(Object.entries(FULL_MANUALS).map(([k, m]) => [k, () => manualEvents(m)]));
export const visitorFullEvents = () => manualEvents(VISITOR_FULL);
export const ep1FullEvents = () => manualEvents(EP1_FULL);
export const ep2Events = () => manualEvents(ADMIN_EP2);
export const ep3Events = () => manualEvents(ADMIN_EP3);
export const ep4Events = () => manualEvents(ADMIN_EP4);
export const ep5Events = () => manualEvents(ADMIN_EP5);
export const FRAMES = Object.fromEntries(Object.entries(FULL_MANUALS).map(([k, m]) => [k, m.frames]));
export const VISITOR_FULL_FRAMES = VISITOR_FULL.frames;
export const EP1_FULL_FRAMES = EP1_FULL.frames;
export const EP2_FRAMES = ADMIN_EP2.frames;
export const EP3_FRAMES = ADMIN_EP3.frames;
export const EP4_FRAMES = ADMIN_EP4.frames;
export const EP5_FRAMES = ADMIN_EP5.frames;
