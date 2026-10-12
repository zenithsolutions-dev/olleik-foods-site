/**
 * The FULL SYSTEM film's story: chapters → steps (one narration line each, narration/FULL.json) → what each pane shows.
 * C = the visitor / customer phone, A = the admin desktop. Captures: capture/full.mjs (f-* in public/footage/v3).
 * A box is "capture.box" (manifest boxes, or EXTRA below: targets read off the capture images with qa/fgrid.py).
 */
import { Box } from "./camera";
import manifest from "../../public/footage/manifest.json";
import { Block, buildFull, checkFull, EXTRA, FStep, SideStep, union } from "./full";

const pageH = (k: string) => (manifest as unknown as { shots: Record<string, { pageHeight: number }> }).shots[`v3/f-${k}`].pageHeight;

const H = (k: string, h: number): Box => ({ x: 0, y: h, w: 390, h: 4000 });
// ——— camera targets read off the captures (CSS px) ——————————————————————————————————————————————————————————————
const phoneCard = (y: number): Box => ({ x: 22, y: y - 252, w: 346, h: 445 }); // a catalog card with its photo, from its info block's y
const catCards: Record<string, Record<string, number>> = {};
Object.assign(EXTRA, {
  "c-home": { hero: { x: 16, y: 200, w: 358, h: 555 }, heroTop: { x: 16, y: 60, w: 358, h: 520 }, cats: { x: 16, y: 4830, w: 358, h: 540 }, cta: { x: 183, y: 68, w: 183, h: 56 }, stats: { x: 0, y: 790, w: 390, h: 820 } },
  "c-pubcat": { tiles: { x: 16, y: 225, w: 358, h: 560 } },
  "c-about": { hero: { x: 16, y: 195, w: 358, h: 460 } },
  "c-delivery": { hero: { x: 16, y: 195, w: 358, h: 460 } },
  "c-faq": { hero: { x: 16, y: 195, w: 358, h: 560 } },
  "a-customers": { list: { x: 296, y: 180, w: 1104, h: 560 } },
  "a-products1": { stockRows: { x: 296, y: 1180, w: 1104, h: 400 } },
  "c-produce0": { basil: { x: 22, y: 1008, w: 346, h: 352 }, lemons: { x: 22, y: 1375, w: 346, h: 352 }, two: { x: 22, y: 800, w: 346, h: 560 } },
  "c-produce1": { basil: { x: 22, y: 1008, w: 346, h: 352 }, peppers: { x: 22, y: 1742, w: 346, h: 352 } },
  "c-produce2": { peppers: { x: 22, y: 1375, w: 346, h: 352 }, lemons: { x: 22, y: 1008, w: 346, h: 352 } },
  "c-apply0": { fields: union("c-apply0", ["businessName", "address"], 30), rest: union("c-apply0", ["businessType", "submit"], 30) },
  "c-apply1": { fields: union("c-apply1", ["businessName", "address"], 30), rest: union("c-apply1", ["businessType", "submit"], 30) },
  "c-contact": { form: { x: 16, y: 500, w: 358, h: 410 }, forbid: { x: 0, y: 1395, w: 390, h: 250 } },
  "c-vendor": { form: { x: 16, y: 1180, w: 358, h: 540 } },
  "c-setpw0": { card: { x: 40, y: 110, w: 310, h: 360 } },
  "c-setpw1": { card: { x: 40, y: 110, w: 310, h: 360 } },
  "c-portal0": { welcome: { x: 16, y: 135, w: 358, h: 160 }, cards: { x: 16, y: 460, w: 358, h: 300 }, both: { x: 16, y: 135, w: 358, h: 625 } },
  "c-cat0": { empty: { x: 16, y: 130, w: 358, h: 420 } },
  "c-cart": { lines: { x: 16, y: 280, w: 358, h: 560 }, total: { x: 16, y: 860, w: 358, h: 250 } },
  "c-ck0": { summary: { x: 16, y: 280, w: 358, h: 300 }, receive: { x: 16, y: 600, w: 358, h: 330 }, end: { x: 16, y: 600, w: 358, h: 430 } },
  "c-ck1": { summary: { x: 16, y: 280, w: 358, h: 300 }, receive: { x: 16, y: 600, w: 358, h: 330 }, end: { x: 16, y: 600, w: 358, h: 430 } },
  "c-offers1": { list: { x: 16, y: 240, w: 358, h: 190 } },
  "c-offers2": { list: { x: 16, y: 240, w: 358, h: 320 } },
  "c-account": { card: { x: 16, y: 250, w: 358, h: 220 } },
  "c-pending": { card: { x: 24, y: 195, w: 342, h: 350 }, forbid: { x: 0, y: 820, w: 390, h: 1300 } },
  "c-reset0": { card: { x: 24, y: 195, w: 342, h: 290 }, forbid: { x: 0, y: 770, w: 390, h: 1300 } },
  "c-reset1": { card: { x: 24, y: 195, w: 342, h: 290 }, forbid: { x: 0, y: 770, w: 390, h: 1300 } },
  "c-apply2": { received: { x: 16, y: 815, w: 358, h: 215 } },
  // admin
  "a-dash0": { today: { x: 296, y: 250, w: 1104, h: 190 }, leads: { x: 860, y: 1222, w: 540, h: 460 } },
  "a-dash1": { today: { x: 296, y: 250, w: 1104, h: 190 }, leads: { x: 860, y: 1222, w: 540, h: 460 } },
  "a-dash2": { today: { x: 296, y: 250, w: 1104, h: 190 } },
  "a-dash3": { todayH: { x: 296, y: 30, w: 1104, h: 610 }, today: { x: 296, y: 250, w: 1104, h: 380 }, attention: { x: 296, y: 690, w: 1104, h: 350 }, top: { x: 296, y: 465, w: 1104, h: 170 }, invited: { x: 296, y: 1040, w: 1104, h: 160 } },
  "a-alerts": { alerts: { x: 0, y: 470, w: 256, h: 100 }, side: { x: 0, y: 40, w: 256, h: 540 } },
  "a-cats": { wide: { x: 296, y: 150, w: 1104, h: 470 } },
  "a-cats1": { wide: { x: 296, y: 150, w: 1104, h: 470 } },
  "a-cats2": { wide: { x: 296, y: 150, w: 1104, h: 470 } },
  "a-products0": { rows: { x: 296, y: 960, w: 1104, h: 330 } },
  "a-leads0": { rows: { x: 296, y: 200, w: 1104, h: 380 } },
  "a-leads1": { rows: { x: 296, y: 200, w: 1104, h: 380 }, row: { x: 296, y: 280, w: 1104, h: 160 } },
  "a-leads2": { row: { x: 296, y: 280, w: 1104, h: 160 } },
  "a-new0": { panel: { x: 296, y: 90, w: 1104, h: 360 } },
  "a-new1": { panel: { x: 296, y: 90, w: 1104, h: 360 } },
  "a-new2": { panel: { x: 296, y: 90, w: 1104, h: 360 } },
  "a-cust0": { top: { x: 296, y: 40, w: 1104, h: 340 }, check: { x: 296, y: 380, w: 1104, h: 190 } },
  "a-cust2": { top: { x: 296, y: 40, w: 1104, h: 340 }, check: { x: 296, y: 380, w: 1104, h: 190 }, both: { x: 296, y: 40, w: 1104, h: 530 } },
  "a-cust10": { top: { x: 296, y: 40, w: 1104, h: 300 } },
  "a-cust3": { check: { x: 296, y: 380, w: 1104, h: 190 }, tools: { x: 296, y: 1240, w: 1104, h: 150 }, addBtn: { x: 795, y: 1302, w: 135, h: 36 } },
  "a-cust5": { setMargin: { x: 1273, y: 632, w: 106, h: 30 } },
  "a-margin0": { save: { x: 442, y: 689, w: 48, h: 22 } },
  "a-cust6": { selCats: { x: 1012, y: 838, w: 380, h: 70 } },
  "a-vis0": { bev: { x: 334, y: 976, w: 90, h: 18 }, saveVis: { x: 317, y: 1108, w: 125, h: 36 } },
  "a-hide0": { item: { x: 317, y: 1266, w: 384, h: 34 } },
  "a-price1": { save: { x: 1137, y: 1786, w: 32, h: 22 } },
  "a-recompute": { cancel: { x: 852, y: 228, w: 72, h: 34 } },
  "a-cust7": { recompute: { x: 419, y: 1556, w: 173, h: 38 }, copy: { x: 600, y: 1556, w: 188, h: 38 }, offersTop: { x: 296, y: 2380, w: 1104, h: 260 } },
  "a-cust8": { offersTop: { x: 296, y: 2380, w: 1104, h: 280 } },
  "a-rep1": { cost: { x: 317, y: 776, w: 250, h: 24 } },
  "c-search2": { salmonCard: phoneCard(634), salmonBtn: { x: 45, y: 778, w: 300, h: 36 } },
  "c-search3": { salmonCard: phoneCard(634) },
  "a-addp0": { item: { x: 420, y: 300, w: 560, h: 34 } },
  "a-order0": { customerCard: { x: 400, y: 250, w: 896, h: 135 } },
  "a-order1": { shortageBox: { x: 400, y: 228, w: 896, h: 170 } },
  "a-ana": { charts: { x: 296, y: 185, w: 1104, h: 410 }, bestTop: { x: 296, y: 600, w: 1104, h: 480 }, slowTop: { x: 296, y: 1440, w: 1104, h: 420 } },
  "a-rep0": { monthly: { x: 313, y: 235, w: 168, h: 30 }, left: { x: 296, y: 150, w: 320, h: 690 } },
  "a-rep2": { top: { x: 640, y: 180, w: 760, h: 520 } },

  "c-invoice": { top: { x: 24, y: 225, w: 342, h: 420 }, lines: { x: 24, y: 620, w: 342, h: 480 } },
  "c-statement": { top: { x: 24, y: 225, w: 342, h: 460 }, lines: { x: 24, y: 840, w: 342, h: 470 } },
  "c-invoice-x": { top: { x: 24, y: 225, w: 342, h: 520 } },
  "c-order3": { top2: { x: 16, y: 180, w: 358, h: 420 } },
  "c-placed": { banner: { x: 16, y: 180, w: 358, h: 66 }, top: { x: 16, y: 180, w: 358, h: 200 }, lines: { x: 16, y: 405, w: 358, h: 310 }, note: { x: 16, y: 600, w: 358, h: 260 } },
});
// the public footer (its contact card holds the placeholder phone number): never on screen
const PUBLIC = ["c-about", "c-delivery", "c-faq", "c-home", "c-pubcat", "c-produce0", "c-produce1", "c-produce2", "c-apply0", "c-apply1", "c-apply2", "c-contact", "c-vendor"];
for (const k of PUBLIC) EXTRA[k] = { ...(EXTRA[k] ?? {}), footer: { x: 0, y: pageH(k) - 360, w: 390, h: 360 } };
// dialogs whose own box was not measured: the area from their first field to their button
EXTRA["a-offer0"] = { ...(EXTRA["a-offer0"] ?? {}), dialog: union("a-offer0", ["title", "create"], 50) };
EXTRA["a-offer1"] = { ...(EXTRA["a-offer1"] ?? {}), dialog: union("a-offer1", ["title", "create"], 50) };
EXTRA["a-edit0"] = { ...(EXTRA["a-edit0"] ?? {}), dialog: union("a-edit0", ["status", "terms", "save"], 40) };
EXTRA["a-susp0"] = { ...(EXTRA["a-susp0"] ?? {}), dialog: union("a-susp0", ["status", "terms", "save"], 40) };
// catalog cards on the phone (the card with its photo) from the measured info blocks
for (const k of ["c-cat1", "c-cat2", "c-cat3", "c-cat4", "c-cat5", "c-cat6", "c-cat7", "c-cat8", "c-cat9", "c-cat10", "c-cat11", "c-add1", "c-add2", "c-add3", "c-search1"]) {
  const ex: Record<string, Box> = { ...(EXTRA[k] ?? {}) };
  for (const n of ["salmon", "lemons", "oat", "buns", "romaine", "cream", "cups", "first"]) {
    try {
      const b = union(k, [n]);
      if (b.h < 400) { ex[`${n}Card`] = phoneCard(b.y); ex[`${n}Btn`] = { x: 45, y: b.y + b.h - 48, w: 300, h: 36 }; }
    } catch { /* not on this capture */ }
  }
  EXTRA[k] = ex;
}
// cards whose info box was not measured (by their place in the alphabetical list: 443 CSS px apart)
EXTRA["c-cat4"].kraftCard = phoneCard(654 + 4 * 443);
EXTRA["c-cat5"].kraftCard = phoneCard(654 + 4 * 443);
EXTRA["c-cat9"].cupsCard = phoneCard(2506);
EXTRA["c-search1"].creamCard = phoneCard(2045);
EXTRA["c-search1"].creamBtn = { x: 45, y: 2045 + 192 - 48, w: 300, h: 36 };
// assigned-product tables (the header of the section + first rows), per capture
for (const k of ["a-cust4", "a-cust5", "a-cust6", "a-cust7", "a-cust8", "a-price0", "a-price1", "a-margin0", "a-vis0", "a-vis1", "a-hide0", "a-hide1", "a-recompute", "a-copy", "a-offer0", "a-offer1", "a-cust9", "a-cust10", "a-edit0", "a-susp0", "a-susp1"]) {
  const t = union(k, ["tools"]);
  EXTRA[k] = { ...(EXTRA[k] ?? {}), tableTop: { x: 296, y: t.y - 80, w: 1104, h: 520 }, lemonsRow: union(k, ["lemons"], 6), salmonRow: union(k, ["salmon"], 6) };
}
void H;
void catCards;
void phoneCard;

// ——— step helpers ———————————————————————————————————————————————————————————————————————————————————————————————
const c = (plate: string, eye: string, o: Partial<SideStep> = {}): SideStep => ({ plate, eye: eye.includes(".") ? eye : `${plate}.${eye}`, z: 1.0, ...o });
const a = (plate: string, eye: string, o: Partial<SideStep> = {}): SideStep => ({ plate, eye: eye.includes(".") ? eye : `${plate}.${eye}`, z: 1.35, ...o });

const blocks: Block[] = [
  { chapter: 1, title: "The public site", steps: [
    { id: "f01", C: c("c-home", "hero", { z: 1.0 }), A: a("a-dash0", "today", { z: 1.3 }) },
    { id: "f02", C: c("c-home", "cats", { page: "home-cats" }), A: { ...a("a-cats", "wide", { z: 1.3 }), taps: [{ box: "a-cats.produce", at: 0.45, press: false, thread: { box: "c-home.cats" } }] } },
    { id: "f02b", C: c("c-pubcat", "tiles", { z: 1.0 }), A: a("a-cats", "wide", { z: 1.35 }) },
    { id: "f03", C: c("c-produce0", "two", { z: 1.0 }), A: { ...a("a-products0", "rows", { z: 1.3 }), taps: [{ box: "a-products0.basil", at: 0.3, press: false, thread: { box: "c-produce0.basil" } }] } },
  ] },
  { chapter: 2, title: "Applying for an account", steps: [
    { id: "f04", cRole: "Visitor", C: { ...c("c-home", "heroTop"), taps: [{ box: "c-home.cta", at: "late" }] }, A: a("a-leads0", "rows") },
    { id: "f05", C: { ...c("c-apply0", "fields", { z: 1.05 }), typing: [{ cap: "c-apply1", field: "businessName", dur: 14 }, { cap: "c-apply1", field: "contactName", dur: 12 }, { cap: "c-apply1", field: "email", dur: 16 }, { cap: "c-apply1", field: "phone", dur: 12 }, { cap: "c-apply1", field: "address", dur: 16 }] } },
    { id: "f06", C: { ...c("c-apply1", "rest", { page: "c-apply0", z: 1.05 }), typing: [{ cap: "c-apply1", field: "notes", dur: 18 }], taps: [{ box: "c-apply1.submit", at: 0.3, to: "c-apply2", thread: { box: "a-leads1.row", to: "a-leads1" } }], then: { at: 0.31, eye: "c-apply2.received", z: 1.0 } }, A: a("a-leads0", "rows", { then: { at: 0.55, eye: "a-leads1.row", z: 1.4 } }) },
    { id: "f07", A: a("a-dash1", "leads", { z: 1.35 }) },
    { id: "f07b", A: a("a-leads1", "rows", { z: 1.3 }) },
    { id: "f08", C: [c("c-contact", "form", { z: 1.0 }), { ...c("c-vendor", "form", { z: 1.0 }), start: 130 }] },
    { id: "f08b", C: [c("c-about", "hero"), { ...c("c-delivery", "hero"), start: 70 }, { ...c("c-faq", "hero"), start: 140 }] },
  ] },
  { chapter: 3, title: "Approval and invitation", steps: [
    { id: "f09", C: c("c-apply2", "received"), A: { ...a("a-leads1", "row", { z: 1.4 }), taps: [{ box: "a-leads1.firstStatus", at: "early", to: "a-leads2" }] } },
    { id: "f10", A: { ...a("a-new0", "panel", { z: 1.35 }), taps: [{ box: "a-new0.check", at: "early", to: "a-new1" }, { box: "a-new1.convert", at: "early", to: "a-new2" }] } },
    { id: "f10b", A: a("a-new2", "panel", { page: "a-new0", z: 1.35 }) },
    { id: "f11", A: a("a-cust0", "top", { z: 1.3, then: { at: 0.5, eye: "a-cust0.check", z: 1.3 } }) },
    { id: "f12", cRole: "Customer", C: [c("c-apply2", "received"), { ...c("c-setpw0", "card", { z: 1.05 }), start: 76 }], A: { ...a("a-cust0", "top", { page: "a-cust0" }), taps: [{ box: "a-cust0.copyLink", at: 60, thread: { box: "c-setpw0.card" } }] } },
    { id: "f13", C: [{ ...c("c-setpw0", "card", { z: 1.05 }), typing: [{ cap: "c-setpw1", field: "pw", dur: 12 }, { cap: "c-setpw1", field: "pw2", dur: 12 }], taps: [{ box: "c-setpw1.save", at: 70, thread: { box: "a-cust2.top", to: "a-cust2" } }] }, { ...c("c-portal0", "both", { z: 1.0 }), start: 76 }], A: a("a-cust0", "top", { page: "a-cust0" }) },
    { id: "f13b", C: c("c-portal0", "welcome", { page: "c-portal0", z: 1.1 }), A: a("a-cust2", "check", { page: "a-cust0" }) },
    { id: "f14", C: c("c-cat0", "empty"), A: a("a-cust2", "check", { page: "a-cust0" }) },
  ] },
  { chapter: 4, title: "Catalog and prices", steps: [
    { id: "f15", A: { ...a("a-cust3", "tools", { page: "a-cust3" }), taps: [{ box: "a-cust3.addBtn", at: "early", to: "a-addp0" }], then: { at: 31, eye: "a-addp0.dialog", z: 1.4 } } },
    { id: "f16", C: c("c-cat0", "empty", { then: { at: 0.5, eye: "c-cat1.salmonCard" } }), A: { ...a("a-addp0", "dialog", { page: "a-cust3", z: 1.4 }), taps: [{ box: "a-addp0.item", at: "early", to: "a-addp1" }, { box: "a-addp1.addBtn", at: "early", to: "a-cust4", thread: { box: "c-cat1.salmonCard", to: "c-cat1" } }], then: { at: 55, eye: "a-cust4.tableTop", z: 1.3 } } },
    { id: "f17", C: c("c-cat1", "salmonCard", { page: "c-cat0" }), A: a("a-cust4", "tableTop", { page: "a-cust3", z: 1.3, then: { at: 0.5, eye: "a-cust4.salmonRow", z: 1.5 } }) },
    { id: "f18", C: c("c-cat1", "lemonsCard", { page: "c-cat-lemons" }), A: { ...a("a-cust4", "lemonsRow", { page: "a-cust3", z: 1.5 }), taps: [{ box: "a-cust4.lemonsPrice", at: "early", to: "a-price0" }, { box: "a-price1.save", at: 80, to: "a-cust5", thread: { box: "c-cat2.lemonsCard", to: "c-cat2" } }], typing: [{ cap: "a-price1", field: "priceInput", dur: 14, at: 56 }] } },
    { id: "f19", C: c("c-cat2", "salmonCard", { page: "c-cat-top" }), A: { ...a("a-cust5", "margin", { page: "a-cust3", z: 1.4 }), taps: [{ box: "a-cust5.setMargin", at: "early", to: "a-margin0" }, { box: "a-margin0.save", at: "early", to: "a-cust6", thread: { box: "c-cat3.salmonCard", to: "c-cat3" } }] } },
    { id: "f20", C: c("c-cat3", "c-cat4.oatCard", { page: "c-cat-oat" }), A: { ...a("a-cust6", "visibility", { page: "a-cust3", z: 1.3 }), taps: [{ box: "a-cust6.selCats", at: "early", to: "a-vis0" }, { box: "a-vis0.saveVis", at: "early", to: "a-vis1", thread: { box: "c-cat4.oatCard", to: "c-cat4" } }] } },
    { id: "f21", C: c("c-cat4", "kraftCard", { page: "c-cat-kraft" }), A: { ...a("a-vis1", "hide", { page: "a-cust3", z: 1.4, sy: 330 }), typing: [{ cap: "a-hide0", field: "hide", dur: 12 }], taps: [{ box: "a-hide0.item", at: "early", to: "a-hide1", thread: { box: "c-cat5.kraftCard", to: "c-cat5" } }] } },
    { id: "f22", A: { ...a("a-assign0", "pickP", { z: 1.3 }), typing: [{ cap: "a-assign1", field: "searchP", dur: 12 }, { cap: "a-assign1", field: "searchC", dur: 10 }], taps: [{ box: "a-assign1.assignBtn", at: "early", to: "a-assign2", thread: { box: "c-cat6.bunsCard", to: "c-cat6" } }] }, C: c("c-cat5", "c-cat6.bunsCard", { page: "c-cat-buns" }) },
    { id: "f23", A: { ...a("a-pricing0", "category", { z: 1.35 }), taps: [{ box: "a-pricing0.catForm", at: "early", to: "a-pricing1", dx: -380 }, { box: "a-pricing1.catForm", at: "early", to: "a-pricing2", dx: 10, thread: { box: "c-cat7.romaineCard", to: "c-cat7" } }], then: { at: 0.6, eye: "a-pricing2.notice", z: 1.4 } }, C: c("c-cat6", "romaineCard", { page: "c-cat-romaine" }) },
    { id: "f24", A: { ...a("a-cust7", "tools", { z: 1.4 }), taps: [{ box: "a-cust7.recompute", at: 110, to: "a-recompute" }], then: { at: 125, eye: "a-recompute.dialog", z: 1.4 } } },
  ] },
  { chapter: 5, title: "Offers", steps: [
    { id: "f25", C: c("c-cat7", "romaineCard", { page: "c-cat-romaine" }), A: { ...a("a-cust7", "offersTop", { page: "a-cust7b", z: 1.35 }), taps: [{ box: "a-cust7.addOffer", at: 30, to: "a-offer0" }], typing: [{ cap: "a-offer1", field: "title", dur: 18, at: 84 }], then: { at: 40, eye: "a-offer0.dialog", z: 1.4 } } },
    { id: "f26", A: { ...a("a-offer1", "dialog", { page: "a-cust7b", z: 1.4 }), taps: [{ box: "a-offer1.create", at: 40, to: "a-cust8", thread: { box: "c-offers1.list" } }], then: { at: 42, eye: "a-cust8.offersTop", z: 1.35 } }, C: [c("c-cat7", "romaineCard", { page: "c-cat-romaine" }), { ...c("c-offers1", "list"), start: 63 }] },
    { id: "f27", C: c("c-cat8", "salmonCard"), A: a("a-cust8", "salmonRow", { page: "a-cust7b", z: 1.5 }) },
    { id: "f29b", A: a("a-tpl0", "rows", { z: 1.4 }) },
    { id: "f28", A: [{ ...a("a-tpl0", "rows", { z: 1.4 }), taps: [{ box: "a-tpl0.pizza", at: 34, dx: 353, dy: -16 }] }, { ...a("a-bulk0", "what", { z: 1.3 }), start: 46, taps: [{ box: "a-bulk0.apply", at: 70, to: "a-bulk1", thread: { box: "c-offers2.list" } }], then: { at: 72, eye: "a-bulk1.done", z: 1.5 } }], C: [c("c-cat8", "salmonCard"), { ...c("c-offers2", "list"), start: 139 }] },
    { id: "f29", A: a("a-running", "batches", { z: 1.3 }) },
  ] },
  { chapter: 6, title: "Placing an order", steps: [
    { id: "f30", A: a("a-orders0", "first", { z: 1.4 }), C: [{ ...c("c-search1", "search", { z: 1.1 }), typing: [{ cap: "c-search1", field: "search", dur: 14 }], taps: [{ box: "c-search1.search", at: 50, to: "c-search2", dx: 190 }] }, { ...c("c-search2", "salmonCard", { page: "c-search2" }), start: 60, taps: [{ box: "c-search2.salmonBtn", at: 50, to: "c-search3" }] }] },
    { id: "f31", C: { ...c("c-search1", "creamCard", { page: "c-add" }), taps: [{ box: "c-search1.creamBtn", at: 32, to: "c-add1" }, { box: "c-add1.cupsBtn", at: 100, to: "c-add2" }, { box: "c-add2.oatBtn", at: 190, to: "c-add3" }], then: [{ at: 56, eye: "c-add1.cupsCard" }, { at: 146, eye: "c-add2.oatCard" }] } },
    { id: "f32", C: c("c-cart", "lines", { then: { at: 0.55, eye: "c-cart.total" } }) },
    { id: "f33", C: { ...c("c-ck0", "receive"), taps: [{ box: "c-ck0.delivery", at: "early", to: "c-ck1" }], typing: [{ cap: "c-ck1", field: "notes", dur: 22, at: 60 }] } },
    { id: "f34", C: [{ ...c("c-ck1", "end", { page: "c-ck0" }), taps: [{ box: "c-ck1.submit", at: 40, thread: { box: "a-orders1.mine", to: "a-orders1", bell: true } }] }, { ...c("c-placed", "top"), start: 50 }], A: a("a-orders0", "first", { then: { at: 0.4, eye: "a-orders1.mine", z: 1.45 } }) },
    { id: "f35", C: c("c-placed", "top"), A: a("a-dash2", "today", { z: 1.3 }) },
  ] },
  { chapter: 7, title: "Fulfilment", steps: [
    { id: "f36", A: a("a-order0", "lines", { z: 1.3 }) },
    { id: "f36b", C: c("c-placed", "note"), A: a("a-order0", "customerCard", { page: "a-order", z: 1.45 }) },
    { id: "f37", A: { ...a("a-order0", "top", { page: "a-order", z: 1.35, sy: 260 }), taps: [{ box: "a-order0.confirm", at: "early", to: "a-order1" }], then: { at: 30, eye: "a-order1.shortageBox", z: 1.4 } } },
    { id: "f38", A: { ...a("a-order1", "shortageBox", { page: "a-order", z: 1.4 }), taps: [{ box: "a-order1.oversell", at: "early", to: "a-order2", thread: { box: "c-order1.top", to: "c-order1" } }], then: { at: 30, eye: "a-order2.notice", z: 1.4 } }, C: c("c-placed", "top", { then: { at: 0.4, eye: "c-order1.top" } }) },
    { id: "f39", C: c("c-cat9", "cupsCard", { then: { at: 0.5, eye: "c-cat9.oatCard" } }), A: a("a-order2", "lines", { page: "a-order", z: 1.3 }) },
    { id: "f40", C: c("c-order1", "top", { page: "c-order" }), A: { ...a("a-order2", "top", { page: "a-order", z: 1.4, sy: 260 }), taps: [{ box: "a-order2.prepared", at: "early", to: "a-order3", thread: { box: "c-order2.top", to: "c-order2" } }] } },
    { id: "f41", C: c("c-order2", "top", { page: "c-order" }), A: { ...a("a-order3", "top", { page: "a-order", z: 1.4, sy: 260 }), taps: [{ box: "a-order3.complete", at: "early", to: "a-order4", thread: { box: "c-order3.top", to: "c-order3" } }] } },
    { id: "f41b", C: c("c-order3", "top2", { page: "c-order" }), A: a("a-order4", "top", { page: "a-order", z: 1.35 }) },
    { id: "f42", C: c("c-placed2", "top"), A: { ...a("a-order5", "top", { z: 1.35 }), taps: [{ box: "a-order5.cancel", at: "early", to: "a-cancel0" }, { box: "a-cancel0.yes", at: 110, to: "a-cancel1", thread: { box: "c-order4.top", to: "c-order4" } }], then: { at: 30, eye: "a-cancel0.dialog", z: 1.4 } } },
    { id: "f43", C: c("c-orders", "first"), A: a("a-orders-today", "tabs", { z: 1.3 }) },
  ] },
  { chapter: 8, title: "Invoices and statements", steps: [
    { id: "f44", C: c("c-invoice", "top", { then: { at: 0.5, eye: "c-invoice.lines" } }), A: a("a-invoice", "sheet", { z: 1.3 }) },
    { id: "f45", C: c("c-statement", "top", { then: { at: 0.5, eye: "c-statement.lines" } }), A: a("a-stmt", "docHeader", { z: 1.3, then: { at: 0.5, eye: "a-stmt.table", z: 1.3 } }) },
    { id: "f45b", C: c("c-statement", "period", { z: 1.2, eye: "c-statement.top" }) },
    { id: "f46", A: a("a-stmt-int", "banner", { z: 1.35, then: { at: 0.45, eye: "a-stmt-int.table", z: 1.35 } }) },
    { id: "f47", C: c("c-invoice-x", "top"), A: a("a-cancel1", "top", { z: 1.35 }) },
  ] },
  { chapter: 9, title: "Stock, margins and reports", steps: [
    { id: "f48", C: c("c-order3", "top"), A: a("a-products1", "cups", { z: 1.4 }) },
    { id: "f49", A: a("a-dash3", "todayH", { z: 1.3, then: { at: 0.5, eye: "a-dash3.attention", z: 1.3 } }) },
    { id: "f49b", A: a("a-dash3", "invited", { z: 1.35 }) },
    { id: "f48b", A: a("a-dash3", "top", { z: 1.35 }) },
    { id: "f50", A: [a("a-doc-low", "sheet", { z: 1.3 }), { ...a("a-doc-out", "sheet", { z: 1.3 }), start: 100 }] },
    { id: "f50b", A: a("a-products1", "stockRows", { z: 1.3 }) },
    { id: "f51", C: c("c-cat9", "cupsCard"), A: { ...a("a-products1", "cups", { z: 1.25, page: "a-recv" }), taps: [{ box: "a-products1.cups", at: 30, dx: 524, to: "a-recv0" }, { box: "a-recv1.save", at: 120, to: "a-recv2", thread: { box: "c-cat10.cupsCard", to: "c-cat10" } }], typing: [{ cap: "a-recv1", field: "qty", dur: 8, at: 86 }], then: { at: 32, eye: "a-recv0.stock", z: 1.4 } } },
    { id: "f52", A: a("a-ana", "charts", { z: 1.3 }) },
    { id: "f52b", A: [a("a-ana", "bestTop", { z: 1.3, page: "a-ana-best" }), { ...a("a-ana", "slowTop", { z: 1.3, page: "a-ana-slow" }), start: 150 }] },
    { id: "f53", A: { ...a("a-rep0", "left", { z: 1.3, side: true }), taps: [{ box: "a-rep0.monthly", at: "early", to: "a-rep1" }, { box: "a-rep1.cost", at: "early", to: "a-rep2", dx: -100 }], then: { at: 56, eye: "a-rep2.top", z: 1.3 } } },
    { id: "f54", A: a("a-doc-prod", "toggle", { z: 1.35, then: { at: 0.4, eye: "a-doc-prod.docHeader", z: 1.3 } }) },
  ] },
  { chapter: 10, title: "Managing the catalog", steps: [
    { id: "f55", C: c("c-cat10", "cupsCard"), A: { ...a("a-np0", "name", { z: 1.4 }), typing: [{ cap: "a-np1", field: "sku", dur: 10 }, { cap: "a-np1", field: "name", dur: 14 }], then: { at: 0.5, eye: "a-np1.photo", z: 1.4 } } },
    { id: "f56", cRole: "Visitor", C: c("c-produce0", "c-produce1.peppers", { page: "c-produce" }), A: { ...a("a-np1", "create", { z: 1.4, page: "a-np0" }), taps: [{ box: "a-np1.create", at: 40, to: "a-products3", thread: { box: "c-produce1.peppers", to: "c-produce1" } }], then: { at: 42, eye: "a-products3.peppers", z: 1.45 } } },
    { id: "f57", C: c("c-produce1", "basil", { page: "c-produce" }), A: { ...a("a-products3", "basil", { page: "a-np0", z: 1.45 }), taps: [{ box: "a-products3.basil", at: "early", dx: 524, to: "a-basil0" }, { box: "a-basil0.save", at: 110, to: "a-products4", thread: { box: "c-produce2.lemons", to: "c-produce2" } }], then: { at: 30, eye: "a-basil0.active", z: 1.4 } } },
    { id: "f58", cRole: "Customer", C: c("c-cat11", "creamCard"), A: a("a-products4", "basil", { page: "a-np0", z: 1.45 }) },
    { id: "f59", A: { ...a("a-cats1", "wide", { z: 1.3 }), taps: [{ box: "a-cats1.add", at: "early", dy: 140, to: "a-cats2" }], then: { at: 30, eye: "a-cats2.herbs", z: 1.5 } } },
  ] },
  { chapter: 11, title: "Accounts and access", steps: [
    { id: "f60", A: { ...a("a-edit0", "dialog", { z: 1.35 }), taps: [{ box: "a-edit0.save", at: 40, to: "a-cust9", thread: { box: "c-account.card" } }] }, C: [c("c-cat11", "creamCard"), { ...c("c-account", "card"), start: 63 }] },
    { id: "f61", A: { ...a("a-susp0", "dialog", { z: 1.35 }), taps: [{ box: "a-susp0.save", at: 40, to: "a-susp1", thread: { box: "c-pending.card" } }] }, C: [c("c-account", "card"), { ...c("c-pending", "card"), start: 63 }] },
    { id: "f62", A: { ...a("a-cust10", "top", { z: 1.3 }), taps: [{ box: "a-cust10.badge", at: 40, press: false, thread: { box: "c-cat11.creamCard" } }] }, C: [c("c-pending", "card"), { ...c("c-cat11", "creamCard"), start: 63 }] },
    { id: "f62b", A: a("a-customers", "list", { z: 1.3 }) },
    { id: "f63", C: { ...c("c-reset0", "card"), typing: [{ cap: "c-reset1", field: "email", dur: 18 }], taps: [{ box: "c-reset0.send", at: "early", to: "c-reset1" }] }, A: a("a-login", "form", { z: 1.3 }) },
    { id: "f64", A: a("a-alerts", "alerts", { z: 1.5, side: true, hover: "a-alerts.alerts" }) },
  ] },
];

const intro = { line: "f00", title: "The whole system", sub: "Visitor, customer and admin, one order at a time" };
const end = { line: "f65", text: "One system for customers and the team" };

export const FULL_FILM = buildFull("FULL-SYSTEM", intro, blocks, end);
const FORBID: Record<string, string[]> = { "c-home": ["stats", "footer"], "c-contact": ["forbid", "footer"], "c-pending": ["forbid"], "c-reset0": ["forbid"], "c-reset1": ["forbid"] };
for (const k of PUBLIC) FORBID[k] = [...(FORBID[k] ?? []), "footer"];
export const FULL_PROBLEMS = checkFull(FULL_FILM, FORBID);
if (FULL_PROBLEMS.length && !(globalThis as { FULL_LENIENT?: boolean }).FULL_LENIENT) throw new Error(FULL_PROBLEMS.join("\n"));
export type { FStep };
export { fullEvents } from "./full";
