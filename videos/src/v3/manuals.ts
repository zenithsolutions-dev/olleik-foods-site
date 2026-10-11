/**
 * V3 manuals in the "one page, one world" language (CREATIVE_BRIEF_V3 §7): Visitor Chapter 4 "Ordering" and Admin
 * Episode 1 "Orders". Each opens with a 2 s live-action hook (a question or a small problem), then ONE continuous camera
 * per page; taps react in the shot (patches cut from the real after-tap capture, regions found by capture/diffs.py);
 * pages change only with a motivated whip pan. Captions are the approved EPISODE_PLAN_V2 lines (Pending Review);
 * the hooks' lines are new and Pending Review. Photos appear only where the app really renders them (catalog).
 */
import manifest from "../../public/footage/manifest.json";
import tiles from "../../public/footage/v3/tiles.json";
import { Box, Key, validateCamera, World } from "./camera";
import { CAMERA_TEST } from "./shots";
import type { CursorKey, Patch, WorldShot } from "./World";

const shots = (manifest as { shots: Record<string, { boxes: Record<string, { x: number; y: number; w?: number; width?: number; h?: number; height?: number } | null> }> }).shots;
const meta = tiles as Record<string, { wPx: number; hPx: number }>;
const boxesOf = (key: string): Record<string, Box> =>
  Object.fromEntries(Object.entries(shots[`v3/${key}`].boxes).filter(([, v]) => v).map(([k, v]) => [k, { x: v!.x, y: v!.y, w: v!.w ?? v!.width ?? 0, h: v!.h ?? v!.height ?? 0 }]));
const worldOf = (key: string, anchors: string[], extra: Record<string, Box> = {}): World => ({
  id: key, w: meta[key].wPx / 3, h: meta[key].hPx / 3, boxes: { ...boxesOf(key), ...extra }, anchors,
});
const center = (b: Box, dx = 0, dy = 0) => ({ x: b.x + b.w / 2 + dx, y: b.y + b.h / 2 + dy });
const tapAt = (w: World, box: string, f: number, arrive: number): CursorKey[] => {
  const c = center(w.boxes[box], 8, 4);
  return [{ f: arrive, ...c }, { f, ...c, press: true }, { f: f + 6, x: c.x + 6, y: c.y + 6 }];
};

export type Seg =
  | { kind: "world"; from: number; dur: number; shot: WorldShot; whipIn?: boolean; whipOut?: boolean }
  | { kind: "live"; from: number; dur: number; src: string; start: number; line?: string; lineAt?: number };
export type Caption = { from: number; to: number; text: string };
export type Manual = { id: string; frames: number; segs: Seg[]; captions: Caption[]; tag: string };

// ————————————————————————— Visitor Chapter 4: Ordering —————————————————————————
const catalogWorld: World = { ...CAMERA_TEST.world, boxes: { ...CAMERA_TEST.world.boxes, searchRow: { x: 168, y: 254, w: 612, h: 38 } }, anchors: [...CAMERA_TEST.world.anchors, "searchRow"] };
const catalogShot: WorldShot = {
  ...CAMERA_TEST,
  world: catalogWorld,
  keys: CAMERA_TEST.keys.map((k) => (Math.abs(k.cy - 470) < 8 ? { ...k, cy: k.cy + 64 } : k)),
  patches: [...CAMERA_TEST.patches, { box: "cartWide", f: 292, from: "v3/catalog-3", to: "v3/catalog-3", kind: "press", noRing: false }],
  cursor: [...(CAMERA_TEST.cursor ?? []).slice(0, -1), { f: 284, x: 1215, y: 92 }, { f: 292, x: 1215, y: 92, press: true }, { f: 300, x: 1220, y: 96 }],
};

const cartW = worldOf("cart", ["nav", "headline", "total", "checkout"]);
const cartKeys: Key[] = [
  { f: 0, cx: 720, cy: 405, z: 1.0 },
  { f: 44, cx: 720, cy: 380, z: 1.22, ease: "glide", eye: "headline" },
  { f: 104, cx: 860, cy: 520, z: 1.42, ease: "glide", eye: "checkout" },
  { f: 180, cx: 868, cy: 524, z: 1.44, ease: "linear" },
];
const cartShot: WorldShot = {
  world: cartW, plate: "v3/cart", keys: cartKeys, cards: [],
  patches: [{ box: "checkout", f: 140, from: "v3/cart", to: "v3/cart", kind: "press", radius: 20 }],
  cursor: [{ f: 0, x: 1180, y: 760 }, ...tapAt(cartW, "checkout", 140, 120)],
};

const ckW = worldOf("checkout-0", ["headline", "summary", "delivery", "pickup", "notes", "submit"], { noteText: { x: 399, y: 686, w: 642, h: 90 }, choice: { x: 399, y: 574, w: 642, h: 78 } });
const CK = { delivery: 90, typeFrom: 150, typeDur: 42, submit: 300 };
const ckShot: WorldShot = {
  world: ckW,
  plate: [[0, "v3/checkout-0"], [CK.delivery, "v3/checkout-1"], [CK.typeFrom + CK.typeDur, "v3/checkout-2"]],
  keys: [
    { f: 0, cx: 720, cy: 451, z: 1.0 },
    { f: 60, cx: 850, cy: 560, z: 1.38, ease: "glide", eye: "delivery" },
    { f: 132, cx: 740, cy: 610, z: 1.38, ease: "glide", eye: "notes" },
    { f: 236, cx: 860, cy: 690, z: 1.34, ease: "glide", eye: "submit" },
    { f: 360, cx: 866, cy: 692, z: 1.35, ease: "linear" },
  ],
  cards: [],
  patches: [
    { box: "delivery", f: CK.delivery, from: "v3/checkout-0", to: "v3/checkout-1", kind: "press", radius: 12 },
    { box: "noteText", f: CK.typeFrom, from: "v3/checkout-1", to: "v3/checkout-2", kind: "wipe", dur: CK.typeDur, until: CK.typeFrom + CK.typeDur },
    { box: "submit", f: CK.submit, from: "v3/checkout-2", to: "v3/checkout-2", kind: "press", radius: 20 },
  ],
  cursor: [{ f: 0, x: 1240, y: 860 }, ...tapAt(ckW, "delivery", CK.delivery, 70), { f: 130, x: 470, y: 715 }, { f: CK.typeFrom + CK.typeDur, x: 480, y: 718 }, ...tapAt(ckW, "submit", CK.submit, 270)],
};

const placedW = worldOf("order-placed", ["nav", "banner", "headline"]);
const placedShot: WorldShot = {
  world: placedW, plate: "v3/order-placed", cards: [],
  keys: [
    { f: 0, cx: 720, cy: 405, z: 1.0 },
    { f: 60, cx: 720, cy: 300, z: 1.45, ease: "glide", eye: "banner" },
    { f: 180, cx: 760, cy: 330, z: 1.5, ease: "linear" },
  ],
  patches: [{ box: "status", f: 74, from: "v3/order-placed", to: "v3/order-placed", kind: "bump" }],
};

const ordersW = worldOf("orders", ["nav", "headline", "first"]);
const ordersShot: WorldShot = {
  world: ordersW, plate: "v3/orders", cards: [],
  keys: [
    { f: 0, cx: 720, cy: 405, z: 1.0 },
    { f: 70, cx: 760, cy: 380, z: 1.3, ease: "glide", eye: "first" },
    { f: 150, cx: 770, cy: 400, z: 1.32, ease: "linear" },
  ],
  patches: [],
};

export const VISITOR_CH4: Manual = {
  id: "V3-VISITOR-CH4", frames: 1326, tag: "Marco's First Order · Chapter 4: Ordering",
  segs: [
    { kind: "live", from: 0, dur: 66, src: "v3/clips/marco-169-t1.mp4", start: 0.4, line: "Running low again?", lineAt: 6 },
    { kind: "world", from: 66, dur: 300, shot: catalogShot, whipOut: true },
    { kind: "world", from: 366, dur: 180, shot: cartShot, whipIn: true, whipOut: true },
    { kind: "world", from: 546, dur: 360, shot: ckShot, whipIn: true, whipOut: true },
    { kind: "world", from: 906, dur: 180, shot: placedShot, whipIn: true, whipOut: true },
    { kind: "world", from: 1086, dur: 150, shot: ordersShot, whipIn: true },
    { kind: "live", from: 1236, dur: 90, src: "v3/clips/marco-morning.mp4", start: 0.3 },
  ],
  captions: [
    { from: 76, to: 360, text: "Add what you need to the cart." },
    { from: 372, to: 540, text: "Check the cart, then go to checkout." },
    { from: 552, to: 760, text: "Delivery or pickup, plus a note." },
    { from: 764, to: 900, text: "Submit. Payment stays on your usual terms." },
    { from: 912, to: 1080, text: "Received: the team confirms it next." },
    { from: 1090, to: 1232, text: "Follow it: received, confirmed, ready, completed." },
    { from: 1240, to: 1320, text: "Next: your statement." },
  ],
};

// ————————————————————————— Admin Episode 1: Orders —————————————————————————
const dashW = worldOf("admin-dashboard", ["headline", "newOrders", "ordersNav"]);
const dashShot: WorldShot = {
  world: dashW, plate: "v3/admin-dashboard", cards: [],
  keys: [
    { f: 0, cx: 720, cy: 405, z: 1.0 },
    { f: 50, cx: 580, cy: 330, z: 1.42, ease: "glide", eye: "newOrders" },
    { f: 118, cx: 470, cy: 300, z: 1.4, ease: "glide", eye: "ordersNav" },
    { f: 180, cx: 466, cy: 300, z: 1.41, ease: "linear" },
  ],
  patches: [
    { box: "newOrders", f: 66, from: "v3/admin-dashboard", to: "v3/admin-dashboard", kind: "bump", depth: 0.03 },
    { box: "ordersNav", f: 150, from: "v3/admin-dashboard", to: "v3/admin-dashboard", kind: "press", radius: 10 },
  ],
  cursor: [{ f: 0, x: 900, y: 700 }, { f: 60, x: 440, y: 330 }, ...tapAt(dashW, "ordersNav", 150, 128)],
};

const listW = worldOf("admin-orders", ["headline", "tabNew", "firstRow"], { listArea: { x: 290, y: 214, w: 1116, h: 690 } });
const OL = { tabNew: 64, row: 160 };
const listShot: WorldShot = {
  world: listW, plate: [[0, "v3/admin-orders"], [OL.tabNew + 10, "v3/admin-orders-new"]], cards: [],
  keys: [
    { f: 0, cx: 720, cy: 405, z: 1.0 },
    { f: 44, cx: 700, cy: 330, z: 1.35, ease: "glide", eye: "tabNew" },
    { f: 124, cx: 850, cy: 340, z: 1.3, ease: "glide", eye: "firstRow" },
    { f: 210, cx: 856, cy: 342, z: 1.31, ease: "linear" },
  ],
  patches: [
    { box: "tabNew", f: OL.tabNew, from: "v3/admin-orders", to: "v3/admin-orders-new", kind: "press", radius: 17 },
    { box: "listArea", f: OL.tabNew + 2, from: "v3/admin-orders", to: "v3/admin-orders-new", kind: "swap", dur: 8, until: OL.tabNew + 10 },
    { box: "firstRow", f: OL.row, from: "v3/admin-orders-new", to: "v3/admin-orders-new", kind: "press", radius: 8, noRing: true },
  ],
  cursor: [{ f: 0, x: 1100, y: 720 }, ...tapAt(listW, "tabNew", OL.tabNew, 46), ...tapAt(listW, "firstRow", OL.row, 140)],
};

const orderW = worldOf("admin-order-new", ["headline", "items", "customer", "note", "actions"], {
  actions: { x: 405, y: 146, w: 330, h: 62 }, badge: { x: 1185, y: 30, w: 121, h: 44 }, content: { x: 390, y: 140, w: 920, h: 760 },
  stockCol: { x: 401, y: 424, w: 894, h: 267 },
});
const OD = { confirm: 176, prepared: 304, complete: 356, invoice: 404 };
const orderShot: WorldShot = {
  world: orderW,
  plate: [[0, "v3/admin-order-new"], [OD.confirm, "v3/admin-order-confirmed"], [OD.prepared, "v3/admin-order-prepared"], [OD.complete + 10, "v3/admin-order-completed"]],
  cards: [],
  keys: [
    { f: 0, cx: 720, cy: 405, z: 1.0 },
    { f: 46, cx: 860, cy: 560, z: 1.3, ease: "glide", eye: "items" },
    { f: 130, cx: 640, cy: 270, z: 1.45, ease: "glide", eye: "actions" },
    { f: 200, cx: 900, cy: 580, z: 1.32, ease: "glide", eye: "items" },
    { f: 270, cx: 640, cy: 270, z: 1.45, ease: "glide", eye: "actions" },
    { f: 380, cx: 640, cy: 250, z: 1.45, ease: "glide", eye: "invoice" },
    { f: 450, cx: 646, cy: 254, z: 1.48, ease: "linear" },
  ],
  patches: [
    { box: "actions", f: OD.confirm, from: "v3/admin-order-new", to: "v3/admin-order-confirmed", kind: "press", radius: 14 },
    { box: "badge", f: OD.confirm + 5, from: "v3/admin-order-new", to: "v3/admin-order-confirmed", kind: "bump" },
    { box: "actions", f: OD.prepared, from: "v3/admin-order-confirmed", to: "v3/admin-order-prepared", kind: "press", radius: 14 },
    { box: "badge", f: OD.prepared + 5, from: "v3/admin-order-confirmed", to: "v3/admin-order-prepared", kind: "bump" },
    { box: "actions", f: OD.complete, from: "v3/admin-order-prepared", to: "v3/admin-order-prepared", kind: "press", radius: 14, until: OD.complete + 4 },
    { box: "content", f: OD.complete + 2, from: "v3/admin-order-prepared", to: "v3/admin-order-completed", kind: "swap", dur: 8, until: OD.complete + 10 },
    { box: "badge", f: OD.complete + 10, from: "v3/admin-order-prepared", to: "v3/admin-order-completed", kind: "bump" },
    { box: "invoice", f: OD.invoice, from: "v3/admin-order-completed", to: "v3/admin-order-completed", kind: "press", radius: 13 },
  ],
  cursor: [
    { f: 0, x: 1100, y: 780 }, { f: 100, x: 700, y: 560 },
    ...tapAt(orderW, "confirm", OD.confirm, 150), { f: 240, x: 1040, y: 520 },
    { f: 286, x: 480, y: 181 }, { f: OD.prepared, x: 480, y: 181, press: true }, { f: 330, x: 486, y: 186 },
    { f: OD.complete - 8, x: 480, y: 181 }, { f: OD.complete, x: 480, y: 181, press: true },
    ...tapAt(orderW, "invoice", OD.invoice, 384),
  ],
};

export const ADMIN_EP1: Manual = {
  id: "V3-EP1", frames: 996, tag: "Admin Episode 1 · Orders",
  segs: [
    { kind: "live", from: 0, dur: 66, src: "v3/clips/salma-169-t1.mp4", start: 0.2, line: "Three new orders, and the day just started.", lineAt: 4 },
    { kind: "world", from: 66, dur: 180, shot: dashShot, whipOut: true },
    { kind: "world", from: 246, dur: 210, shot: listShot, whipIn: true, whipOut: true },
    { kind: "world", from: 456, dur: 450, shot: orderShot, whipIn: true },
    { kind: "live", from: 906, dur: 90, src: "v3/clips/salma-169-t1.mp4", start: 2.6 },
  ],
  captions: [
    { from: 72, to: 240, text: "New orders show first on your dashboard." },
    { from: 252, to: 450, text: "Open the New tab." },
    { from: 462, to: 630, text: "Read the items, the profit and the customer's note." },
    { from: 632, to: 756, text: "Confirm: the stock is deducted." },
    { from: 758, to: 836, text: "Packed? Mark it prepared, then complete it." },
    { from: 840, to: 904, text: "Every order has an invoice to print or save." },
    { from: 912, to: 990, text: "Next: a new customer." },
  ],
};

export const MANUALS = { "V3-VISITOR-CH4": VISITOR_CH4, "V3-EP1": ADMIN_EP1 } as const;
for (const m of Object.values(MANUALS)) for (const s of m.segs) if (s.kind === "world") validateCamera(s.shot.world, s.shot.keys, s.dur);

/** SRT text for a manual (same lines as the burned-in captions). */
export const srtOf = (m: Manual) => {
  const ts = (f: number) => { const ms = Math.round((f / 30) * 1000); const h = Math.floor(ms / 3600000), mi = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
  const hooks = m.segs.filter((s): s is Extract<Seg, { kind: "live" }> => s.kind === "live" && !!s.line).map((s) => ({ from: s.from + (s.lineAt ?? 0), to: s.from + s.dur, text: s.line! }));
  return [...hooks, ...m.captions].sort((a, b) => a.from - b.from).map((c, i) => `${i + 1}\n${ts(c.from)} --> ${ts(c.to)}\n${c.text}\n`).join("\n");
};

/** Sound events for a manual (mix_v2 format): taps, reactions, typing, whips, glides. Manuals are sound design only. */
export const manualEvents = (m: Manual) => {
  type Ev = { f: number; sfx: string; vel: number; pan?: number; pitch?: number; dur?: number; sweep?: number[]; note: string };
  const ev: Ev[] = [];
  for (const s of m.segs) {
    if (s.kind === "live") {
      if (s.line) ev.push({ f: s.from + (s.lineAt ?? 0), sfx: "pluck", vel: 0.6, note: "hook line" });
      continue;
    }
    const w = s.shot.world.w;
    const panOf = (b: Box) => Math.max(-0.6, Math.min(0.6, (b.x + b.w / 2 - w / 2) / (w * 0.8)));
    if (s.whipIn) ev.push({ f: s.from, sfx: "whip", vel: 0.45, note: "whip in (page change)" });
    if (s.whipOut) ev.push({ f: s.from + s.dur - 6, sfx: "whoosh", vel: 0.35, dur: 6, sweep: [0.5, -0.5], note: "whip out" });
    for (const p of s.shot.patches) {
      const b = s.shot.world.boxes[p.box];
      const f = s.from + p.f;
      if (f >= s.from + s.dur) continue;
      if (p.kind === "press") ev.push({ f, sfx: "tap", vel: 0.8, pan: panOf(b), note: `tap ${p.box}` });
      if (p.kind === "bump") ev.push({ f, sfx: "pop", vel: 0.45, pan: panOf(b), note: `${p.box} reacts` });
      if (p.kind === "swap") ev.push({ f, sfx: "snaplock", vel: 0.4, pan: panOf(b), note: `${p.box} updates` });
      if (p.kind === "wipe") for (let k = 0; k < (p.dur ?? 30); k += 3) ev.push({ f: f + k, sfx: "key", vel: 0.35 + ((k * 7) % 5) / 20, pan: panOf(b), note: "typing" });
    }
    for (let k = 1; k < s.shot.keys.length; k++) {
      const a = s.shot.keys[k - 1], b = s.shot.keys[k];
      if (Math.hypot(b.cx - a.cx, b.cy - a.cy) > 60 || Math.abs(b.z - a.z) > 0.1) ev.push({ f: s.from + a.f + 2, sfx: "glide", vel: 0.18, dur: Math.max(10, b.f - a.f - 4), sweep: b.cx > a.cx ? [-0.3, 0.3] : [0.3, -0.3], note: "camera travel" });
    }
  }
  return ev.filter((e) => e.f < m.frames).sort((a, b) => a.f - b.f);
};
export const VISITOR_CH4_FRAMES = VISITOR_CH4.frames;
export const ADMIN_EP1_FRAMES = ADMIN_EP1.frames;
export const visitorEvents = () => manualEvents(VISITOR_CH4);
export const ep1Events = () => manualEvents(ADMIN_EP1);
