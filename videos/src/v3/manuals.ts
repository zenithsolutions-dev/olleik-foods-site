/**
 * V3 manuals in the "one page, one world" language, Gate F V3.1 (owner notes CREATIVE_BRIEF_V3 §9): Visitor Chapter 4
 * "Ordering" and Admin Episode 1 "Orders". Each opens with a 2 s live-action hook, then ONE continuous camera per page.
 * A tap switches the page to the real after-tap capture on the tap frame (nothing is patched over the UI); typing is
 * the real typed text revealed inside the field. Pages change only with a motivated whip. Rhythm: the 108 BPM grid,
 * every camera move is a speed ramp ("snap"/"expo") into a short drift, no hold longer than one beat without movement.
 * Captions are the approved EPISODE_PLAN_V2 lines without trailing periods (Pending Review). Photos appear only where
 * the app shows them (the catalog).
 */
import manifest from "../../public/footage/manifest.json";
import tiles from "../../public/footage/v3/tiles.json";
import { Box, Key, OUT_H, scaleAt, validateCamera, World } from "./camera";
import { assertLine } from "./lines";
import { CATALOG } from "./shots";
import { plateChanges, states } from "./plates";
import type { CursorKey, WorldShot } from "./World";

const shots = (manifest as unknown as { shots: Record<string, { boxes: Record<string, { x: number; y: number; w?: number; width?: number; h?: number; height?: number } | null> }> }).shots;
const meta = tiles as Record<string, { wPx: number; hPx: number }>;
export const boxesOf = (key: string): Record<string, Box> =>
  Object.fromEntries(Object.entries(shots[`v3/${key}`].boxes).filter(([, v]) => v).map(([k, v]) => [k, { x: v!.x, y: v!.y, w: v!.w ?? v!.width ?? 0, h: v!.h ?? v!.height ?? 0 }]));
export const worldOf = (key: string, anchors: string[], extra: Record<string, Box> = {}): World => ({
  id: key, w: meta[key].wPx / 3, h: meta[key].hPx / 3, boxes: { ...boxesOf(key), ...extra }, anchors,
});
const BEAT = 1800 / 108;
/** Height of the caption band (Episode3.tsx BAND): forbidden boxes may sit under it, never above it. */
export const BAND_PX = 132;
export const b = (k: number) => Math.round(k * BEAT); // local beat k
export const center = (bx: Box, dx = 0, dy = 0) => ({ x: bx.x + bx.w / 2 + dx, y: bx.y + bx.h / 2 + dy });
/** Camera key that puts a box's centre at screen height `sy` (above the caption band) at zoom z. */
export const aim = (w: World, box: string, f: number, z: number, ease: Key["ease"] = "snap", sy = 450, dx = 0): Key => {
  const c = center(w.boxes[box]);
  return { f, cx: c.x + dx, cy: c.y + (OUT_H / 2 - sy) / scaleAt(w, z), z, ease, eye: box };
};
/** A short drift after a key (the camera never stops dead). */
export const drift = (k: Key, f: number, dz = 0.015, dx = 6, dy = -4): Key => ({ f, cx: k.cx + dx, cy: k.cy + dy, z: k.z + dz, ease: "linear" });
export const tapAt = (w: World, box: string, f: number, arrive: number): CursorKey[] => {
  const c = center(w.boxes[box], 8, 4);
  return [{ f: arrive, ...c }, { f, ...c, press: true }, { f: f + 7, x: c.x + 6, y: c.y + 6 }];
};

export type Seg =
  | { kind: "world"; from: number; dur: number; shot: WorldShot; whipIn?: boolean; whipOut?: boolean }
  | { kind: "live"; from: number; dur: number; src: string; start: number; line?: string; lineAt?: number; punchAt?: number }
  | { kind: "next"; from: number; dur: number; line: string }
  | { kind: "end"; from: number; dur: number; line: string; cta?: string; url?: string };
export type Caption = { from: number; to: number; text: string };
/** chapters: a small label in the caption band (the full visitor manual names each chapter there). */
export type Manual = { id: string; frames: number; segs: Seg[]; captions: Caption[]; tag: string; chapters?: { from: number; label: string }[] };

// ————————————————————————— Visitor Chapter 4: Ordering —————————————————————————
export const catW: World = { ...CATALOG, boxes: { ...CATALOG.boxes, searchRow: { x: 168, y: 254, w: 612, h: 38 } }, anchors: [...CATALOG.anchors, "searchRow"] };
export const VC = { t0: b(3), t1: b(5), t2: b(7), cart: b(9), len: b(10) + 4 };
// the buttons sit 530 px below the search row: at z 1.15 and cy 600 both stay in frame (anchor rule) and the button row
// stays above the caption band
const btnKey = (box: string, f: number): Key => ({ f, cx: center(catW.boxes[box]).x, cy: 600, z: 1.15, ease: "snap", eye: box });
const vk0 = btnKey("btn0", VC.t0 - 8), vk1 = btnKey("btn1", VC.t1 - 8), vk2 = btnKey("btn2", VC.t2 - 8), vk3 = aim(catW, "cartWide", VC.cart - 8, 1.3, "snap", 400);
export const catalogShot: WorldShot = {
  world: catW,
  plate: [[0, "v3/catalog-0"], [VC.t0, "v3/catalog-1"], [VC.t1, "v3/catalog-2"], [VC.t2, "v3/catalog-3"]],
  keys: [{ f: 0, cx: 720, cy: 420, z: 1.0 }, { f: 10, cx: 716, cy: 430, z: 1.03, ease: "linear" }, vk0, drift(vk0, VC.t0 + 8), vk1, drift(vk1, VC.t1 + 8), vk2, drift(vk2, VC.t2 + 8), vk3, drift(vk3, VC.len, 0.03, 4, -6)],
  cursor: [{ f: 0, x: 1250, y: 980 }, ...tapAt(catW, "btn0", VC.t0, VC.t0 - 8), ...tapAt(catW, "btn1", VC.t1, VC.t1 - 8), ...tapAt(catW, "btn2", VC.t2, VC.t2 - 8), ...tapAt(catW, "cartWide", VC.cart, VC.cart - 7)],
  type: [{ text: "3 in the cart", box: "cartWide", dx: -300, dy: 70, from: VC.t2 + 12, to: VC.len + 4, size: 30 }],
};

const cartW = worldOf("cart", ["nav", "headline", "total", "checkout"]);
export const CT = { tap: b(4), len: b(5) + 2 };
const ck0: Key = { f: 14, cx: 720, cy: 400, z: 1.15, ease: "expo", eye: "headline" }, ck1 = aim(cartW, "checkout", CT.tap - 8, 1.4, "snap", 430, -60);
export const cartShot: WorldShot = {
  world: cartW, plate: "v3/cart",
  keys: [{ f: 0, cx: 720, cy: 420, z: 1.0 }, ck0, drift(ck0, 26), ck1, drift(ck1, CT.len)],
  cursor: [{ f: 0, x: 1180, y: 900 }, ...tapAt(cartW, "checkout", CT.tap, CT.tap - 8)],
};

// typed note: text extent and the field's inner box, measured on the real captures (checkout-1 → checkout-2)
const ckW = worldOf("checkout-0", ["headline", "summary", "delivery", "pickup", "notes", "submit"], { typed: { x: 417, y: 702, w: 174, h: 20 }, noteField: { x: 408, y: 695, w: 600, h: 54 } });
export const CK = { delivery: b(3), typeFrom: b(4), typeDur: b(2), submit: b(8), len: b(9) + 2 };
const kk0 = aim(ckW, "delivery", CK.delivery - 8, 1.35, "snap", 440, -120), kk1 = aim(ckW, "notes", CK.typeFrom - 2, 1.35, "snap", 450, -40), kk2 = aim(ckW, "submit", CK.submit - 8, 1.38, "snap", 430, -140);
export const ckShot: WorldShot = {
  world: ckW,
  plate: [[0, "v3/checkout-0"], [CK.delivery, "v3/checkout-1"], [CK.typeFrom + CK.typeDur, "v3/checkout-2"]],
  wipes: [{ box: "typed", field: "noteField", bg: "#ffffff", f: CK.typeFrom, dur: CK.typeDur, to: "v3/checkout-2" }],
  keys: [{ f: 0, cx: 720, cy: 520, z: 1.0 }, { f: 8, cx: 724, cy: 530, z: 1.03, ease: "linear" }, kk0, drift(kk0, CK.delivery + 6), kk1, drift(kk1, CK.typeFrom + CK.typeDur, 0.03, 30, 0), kk2, drift(kk2, CK.len)],
  cursor: [{ f: 0, x: 1240, y: 900 }, ...tapAt(ckW, "delivery", CK.delivery, CK.delivery - 7), { f: CK.typeFrom - 2, x: 760, y: 738 }, { f: CK.typeFrom + CK.typeDur, x: 790, y: 742 }, ...tapAt(ckW, "submit", CK.submit, CK.submit - 8)],
};

const placedW = worldOf("order-placed", ["nav", "banner", "headline"]);
const pk0 = aim(placedW, "banner", 16, 1.45, "expo", 380), pk1 = aim(placedW, "status", b(3), 1.5, "snap", 430, -200);
export const placedShot: WorldShot = {
  world: placedW, plate: "v3/order-placed",
  keys: [{ f: 0, cx: 720, cy: 405, z: 1.0 }, pk0, drift(pk0, b(2)), pk1, drift(pk1, b(5))],
};

const ordersW = worldOf("orders", ["nav", "headline", "first"]);
const ok0 = aim(ordersW, "first", 16, 1.2, "expo", 420, 0);
export const ordersShot: WorldShot = {
  world: ordersW, plate: "v3/orders",
  keys: [{ f: 0, cx: 720, cy: 405, z: 1.0 }, ok0, drift(ok0, b(3), 0.02, 20, 0), { ...aim(ordersW, "first", b(5), 1.3, "glide", 440, 120), eye: undefined }],
};

const V = { hook: 60, cat: VC.len, cart: CT.len, ck: CK.len, placed: b(5), orders: b(5), next: b(3) };
const vFrom: number[] = [];
{ let t = 0; for (const d of [V.hook, V.cat, V.cart, V.ck, V.placed, V.orders, V.next]) { vFrom.push(t); t += d; } }
export const VISITOR_CH4: Manual = {
  id: "V3-VISITOR-CH4", frames: vFrom[6] + V.next, tag: "Marco's First Order · Chapter 4: Ordering",
  segs: [
    { kind: "live", from: 0, dur: V.hook, src: "v3/clips/marco-169-t1.mp4", start: 0.4, line: "Running low again?", lineAt: 4, punchAt: 34 },
    { kind: "world", from: vFrom[1], dur: V.cat, shot: catalogShot, whipOut: true },
    { kind: "world", from: vFrom[2], dur: V.cart, shot: cartShot, whipIn: true, whipOut: true },
    { kind: "world", from: vFrom[3], dur: V.ck, shot: ckShot, whipIn: true, whipOut: true },
    { kind: "world", from: vFrom[4], dur: V.placed, shot: placedShot, whipIn: true, whipOut: true },
    { kind: "world", from: vFrom[5], dur: V.orders, shot: ordersShot, whipIn: true, whipOut: true },
    { kind: "next", from: vFrom[6], dur: V.next, line: "Next: your statement" },
  ],
  captions: [
    { from: vFrom[1] + 6, to: vFrom[2] - 2, text: "Add what you need to the cart" },
    { from: vFrom[2] + 4, to: vFrom[3] - 2, text: "Check the cart, then go to checkout" },
    { from: vFrom[3] + 4, to: vFrom[3] + CK.submit - 10, text: "Delivery or pickup, plus a note" },
    { from: vFrom[3] + CK.submit - 8, to: vFrom[4] - 2, text: "Submit: payment stays on your usual terms" },
    { from: vFrom[4] + 4, to: vFrom[5] - 2, text: "Received: the team confirms it next" },
    { from: vFrom[5] + 4, to: vFrom[6] - 2, text: "Follow it: received, confirmed, ready, completed" },
  ],
};

// ————————————————————————— Admin Episode 1: Orders —————————————————————————
const dashW = worldOf("admin-dashboard", ["headline", "newOrders", "ordersNav"]);
const DB = { nav: b(4), len: b(5) + 2 };
// the sidebar (256 px) is either whole in frame or fully out: a cut sliver of it reads as a stray chip
const dk0 = aim(dashW, "newOrders", 14, 1.3, "expo", 448, 420), dk1 = aim(dashW, "ordersNav", DB.nav - 8, 1.3, "snap", 430, 426);
const dashShot: WorldShot = {
  world: dashW, plate: "v3/admin-dashboard",
  keys: [{ f: 0, cx: 720, cy: 405, z: 1.0 }, dk0, drift(dk0, 30), dk1, drift(dk1, DB.len, 0.015, -6, -4)],
  cursor: [{ f: 0, x: 900, y: 760 }, { f: 30, x: 440, y: 330 }, ...tapAt(dashW, "ordersNav", DB.nav, DB.nav - 8)],
};

const listW = worldOf("admin-orders", ["headline", "tabNew", "firstRow"]);
const OL = { tabNew: b(2), row: b(4), len: b(5) + 2 };
const lk0 = aim(listW, "tabNew", OL.tabNew - 8, 1.35, "expo", 420, 386), lk1 = aim(listW, "firstRow", OL.row - 8, 1.3, "snap", 430, 0);
const listShot: WorldShot = {
  world: listW, plate: [[0, "v3/admin-orders"], [OL.tabNew, "v3/admin-orders-new"]], // a hard switch, as the app does (no double image)
  keys: [{ f: 0, cx: 720, cy: 405, z: 1.0 }, lk0, drift(lk0, OL.tabNew + 6), lk1, drift(lk1, OL.len)],
  cursor: [{ f: 0, x: 1100, y: 760 }, ...tapAt(listW, "tabNew", OL.tabNew, OL.tabNew - 8), ...tapAt(listW, "firstRow", OL.row, OL.row - 8)],
};

const orderW = worldOf("admin-order-new", ["headline", "items", "customer", "note", "actions"], {
  actions: { x: 405, y: 146, w: 330, h: 62 }, badge: { x: 1185, y: 30, w: 121, h: 44 },
});
const OD = { confirm: b(6), prepared: b(9), complete: b(11), invoice: b(13), len: b(14) + 4 };
const odItems = aim(orderW, "items", 14, 1.3, "expo", 470, 0), odNote = aim(orderW, "note", b(3), 1.4, "snap", 430, 0);
// z 1.6 centred at x 720: the frame sits exactly between the sidebar and the status badge (neither is cut at an edge)
const odAct = aim(orderW, "actions", OD.confirm - 9, 1.6, "snap", 430, 150);
const odBadge = aim(orderW, "badge", OD.confirm + 9, 1.45, "snap", 420, -420);
const odAct2 = aim(orderW, "actions", OD.prepared - 8, 1.6, "snap", 430, 150); // at the page top the view is clamped, so its drift goes down, never up
const odInv = aim(orderW, "invoice", OD.invoice - 8, 1.3, "snap", 430, 300); // Invoice button and the COMPLETED badge, both whole
const orderShot: WorldShot = {
  world: orderW,
  plate: [[0, "v3/admin-order-new"], [OD.confirm, "v3/admin-order-confirmed"], [OD.prepared, "v3/admin-order-prepared"], [OD.complete, "v3/admin-order-completed"]],
  keys: [
    { f: 0, cx: 720, cy: 420, z: 1.0 }, odItems, drift(odItems, b(2), 0.02, 30, 0), odNote, drift(odNote, b(4)),
    odAct, drift(odAct, OD.confirm + 2, 0, 0, 40), odBadge, drift(odBadge, b(8) - 2), odAct2, drift(odAct2, OD.complete + 6, 0, 0, 64), odInv, drift(odInv, OD.len, 0.02, -6, -4),
  ],
  cursor: [
    { f: 0, x: 1100, y: 780 }, { f: b(2), x: 760, y: 560 },
    ...tapAt(orderW, "confirm", OD.confirm, OD.confirm - 8),
    { f: OD.prepared - 8, x: 480, y: 181 }, { f: OD.prepared, x: 480, y: 181, press: true },
    { f: OD.complete - 6, x: 486, y: 181 }, { f: OD.complete, x: 486, y: 181, press: true },
    ...tapAt(orderW, "invoice", OD.invoice, OD.invoice - 8),
  ],
};

const E = { hook: 60, dash: DB.len, list: OL.len, order: OD.len, out: 60 };
const eFrom: number[] = [];
{ let t = 0; for (const d of [E.hook, E.dash, E.list, E.order, E.out]) { eFrom.push(t); t += d; } }
export const ADMIN_EP1: Manual = {
  id: "V3-EP1", frames: eFrom[4] + E.out, tag: "Admin Episode 1 · Orders",
  segs: [
    { kind: "live", from: 0, dur: E.hook, src: "v3/clips/salma-169-t1.mp4", start: 0.2, line: "Three new orders, and the day just started", lineAt: 4, punchAt: 34 },
    { kind: "world", from: eFrom[1], dur: E.dash, shot: dashShot, whipOut: true },
    { kind: "world", from: eFrom[2], dur: E.list, shot: listShot, whipIn: true, whipOut: true },
    { kind: "world", from: eFrom[3], dur: E.order, shot: orderShot, whipIn: true },
    { kind: "live", from: eFrom[4], dur: E.out, src: "v3/clips/salma-169-t1.mp4", start: 2.6, line: "Next: a new customer", lineAt: 6 },
  ],
  captions: [
    { from: eFrom[1] + 4, to: eFrom[2] - 2, text: "New orders show first on your dashboard" },
    { from: eFrom[2] + 4, to: eFrom[3] - 2, text: "Open the New tab" },
    { from: eFrom[3] + 4, to: eFrom[3] + OD.confirm - 12, text: "Read the items, the profit and the customer's note" },
    { from: eFrom[3] + OD.confirm - 10, to: eFrom[3] + OD.prepared - 10, text: "Confirm: the stock is deducted" },
    { from: eFrom[3] + OD.prepared - 8, to: eFrom[3] + OD.invoice - 10, text: "Packed? Mark it prepared, then complete it" },
    { from: eFrom[3] + OD.invoice - 8, to: eFrom[4] - 2, text: "Every order has an invoice to print or save" },
  ],
};

export const MANUALS = { "V3-VISITOR-CH4": VISITOR_CH4, "V3-EP1": ADMIN_EP1 } as const;
for (const m of Object.values(MANUALS)) {
  for (const s of m.segs) if (s.kind === "world") validateCamera(s.shot.world, s.shot.keys, s.dur, BAND_PX);
  for (const c of m.captions) assertLine(c.text);
  for (const s of m.segs) if (s.kind !== "world" && s.line) assertLine(s.line);
}

/** All on-screen lines of a manual in time order (captions, hook lines, the closing "Next" line). */
const linesOf = (m: Manual) => {
  const extra = m.segs.flatMap((s) => (s.kind === "live" && s.line ? [{ from: s.from + (s.lineAt ?? 0), to: s.from + s.dur, text: s.line }] : s.kind === "next" || s.kind === "end" ? [{ from: s.from + 4, to: s.from + s.dur, text: s.line }] : []));
  return [...extra, ...m.captions].sort((a, c) => a.from - c.from);
};
/** SRT text for a manual (the same lines as on screen). */
export const srtOf = (m: Manual) => {
  const ts = (f: number) => { const ms = Math.round((f / 30) * 1000); const h = Math.floor(ms / 3600000), mi = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
  return linesOf(m).map((c, i) => `${i + 1}\n${ts(c.from)} --> ${ts(c.to)}\n${c.text}\n`).join("\n");
};

/** Sound events for a manual (mix_v2 format): taps, real page updates, typing, whips, camera ramps. */
export const manualEvents = (m: Manual) => {
  type Ev = { f: number; sfx: string; vel: number; pan?: number; pitch?: number; dur?: number; sweep?: number[]; note: string };
  const ev: Ev[] = [];
  for (const s of m.segs) {
    if (s.kind === "live") {
      if (s.line) ev.push({ f: s.from + (s.lineAt ?? 0), sfx: "pluck", vel: 0.6, note: "hook line" });
      if (s.punchAt) ev.push({ f: s.from + s.punchAt, sfx: "tick", vel: 0.3, pitch: 2, note: "punch-in" });
      continue;
    }
    if (s.kind === "next") { ev.push({ f: s.from, sfx: "whip", vel: 0.4, note: "whip to the closing line" }, { f: s.from + 6, sfx: "pluck", vel: 0.5, note: "Next line" }); continue; }
    if (s.kind === "end") { ev.push({ f: s.from, sfx: "whip", vel: 0.4, note: "whip to the end card" }, { f: s.from + 2, sfx: "pop", vel: 0.45, note: "logo lands" }, { f: s.from + 3, sfx: "bell", vel: 0.5, note: "end card" }); if (s.cta) ev.push({ f: s.from + 22, sfx: "pop", vel: 0.3, pitch: 2, note: "button" }); continue; }
    const w = s.shot.world.w;
    const panX = (x: number) => Math.max(-0.6, Math.min(0.6, (x - w / 2) / (w * 0.8)));
    if (s.whipIn) ev.push({ f: s.from, sfx: "whip", vel: 0.45, note: "whip in (page change)" });
    if (s.whipOut) ev.push({ f: s.from + s.dur - 6, sfx: "whoosh", vel: 0.35, dur: 6, sweep: [0.5, -0.5], note: "whip out" });
    for (const c of s.shot.cursor ?? []) if (c.press && c.f < s.dur) ev.push({ f: s.from + c.f, sfx: "tap", vel: 0.8, pan: panX(c.x), note: "tap" });
    for (const f of plateChanges(s.shot)) if (f < s.dur) ev.push({ f: s.from + f + 1, sfx: "snaplock", vel: 0.4, note: "the page updates (real after-tap capture)" });
    for (const wp of s.shot.wipes ?? []) for (let k = 0; k < wp.dur; k += 3) ev.push({ f: s.from + wp.f + k, sfx: "key", vel: 0.35 + ((k * 7) % 5) / 20, pan: panX(s.shot.world.boxes[wp.box].x), note: "typing" });
    for (let k = 1; k < s.shot.keys.length; k++) {
      const a = s.shot.keys[k - 1], c = s.shot.keys[k];
      if ((c.ease === "snap" || c.ease === "expo") && (Math.hypot(c.cx - a.cx, c.cy - a.cy) > 60 || Math.abs(c.z - a.z) > 0.1)) ev.push({ f: s.from + a.f + 1, sfx: "glide", vel: 0.2, dur: Math.max(6, c.f - a.f - 2), sweep: c.cx > a.cx ? [-0.3, 0.3] : [0.3, -0.3], note: "camera ramp" });
    }
  }
  return ev.filter((e) => e.f < m.frames).sort((a, c) => a.f - c.f);
};
export const VISITOR_CH4_FRAMES = VISITOR_CH4.frames;
export const ADMIN_EP1_FRAMES = ADMIN_EP1.frames;
export const visitorEvents = () => manualEvents(VISITOR_CH4);
export const ep1Events = () => manualEvents(ADMIN_EP1);
export { states };
