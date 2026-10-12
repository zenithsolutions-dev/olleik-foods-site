/**
 * V3.2 §10.2: the two VOICED user manuals (USER_MANUAL_VISITOR, USER_MANUAL_ADMIN), narration-led.
 *
 * One narration line = one STEP. A step holds for its line's spoken length plus one beat (and longer when its typing or
 * taps need it); the line starts 1 frame after the step's first frame and its first word within 3 more (brief: within 5). Same V3 rules as the other
 * manuals: one continuous camera per page, whips only between pages, a tap switches to the real after-tap capture on
 * the tap frame, typing reveals the real typed capture, no pasted overlays, zoom ≤ 1.6, anchors, no trailing periods on
 * our lines. The pace is calm: the camera glides to each step's target (22 frames, eased) and then keeps a slow push-in
 * (log-zoom rate RATE) for the rest of the step, so nothing is ever frozen while the narrator speaks. Taps that change
 * the page in place come early in the step; taps that open another page come at its end, right before the whip.
 * Admin pages: the 256 px sidebar is either whole in frame or fully out of it, on every frame (checked).
 * Narration timing comes from narration/audio/index.json (narration/check.py: speech bounds from the aligned transcript).
 */
import index from "../../narration/audio/index.json";
import VIS from "../../narration/VISITOR.json";
import ADM from "../../narration/ADMIN.json";
import { Box, cameraAt, insideFraction, Key, OUT_H, scaleAt, validateCamera, visibleFraction, World } from "./camera";
import { assertLine } from "./lines";
import { BAND_PX, catW, cartW, center, ckW, dashW, listW, orderW, ordersW, placedW, worldOf } from "./manuals";
import { accountW, admW, anaW, applyW, assignW, cat3W, catsW, custW, detW, leadsW, loginW, newW, offersW, portalW, pricesW, pricingW, prodW } from "./manualsFull";
import type { PlateState } from "./plates";
import type { CursorKey, Wipe, WorldShot } from "./World";

const BEAT = 1800 / 108;
const B = Math.round(BEAT); // 17 frames
const ARR = 22; // camera glide to a step's target
const LEAD = 1; // the line starts 1 frame into its step (its first word ≤ 3 frames later: within the brief's 5)
const RATE = 0.00062; // slow push-in during a step: log-zoom per frame (≈ 0.6 output px/frame at the frame edge)
const SIDEBAR = 256;

type Line = { id: string; chapter: number; text: string; speak?: string; caption: string };
const LINES: Record<string, Line> = Object.fromEntries([...VIS.lines, ...ADM.lines].map((l) => [l.id, l as Line]));
const IDX = index as Record<string, { speech_start: number; speech_end: number }>;
/** Spoken length of a line in frames (trimmed to the aligned speech). */
export const speechFrames = (id: string) => Math.ceil((IDX[id].speech_end - IDX[id].speech_start) * 30);

type Tap = { box: string; at: "early" | "late" | number; to?: string; fade?: number; dx?: number; dy?: number };
type Typing = { box: string; field: string; to: string; dur: number; bg?: string };
type Move = { eye: string; z?: number; sy?: number; dx?: number; side?: boolean; air?: number }; // air: CSS px of margin around the target at the end of its push (default 140)
type Step = Move & { id: string; taps?: Tap[]; typing?: Typing[]; typeAt?: number; then?: Move & { at: number }; min?: number; hover?: string };
type Mark = { id: string; from: number; dur: number };

const zEnd = (z: number, frames: number) => z * Math.exp(RATE * Math.max(0, frames));
/** The largest zoom at which the step's target (shifted by dx) still fits the frame above the caption band. */
function fitZoom(w: World, m: Move) {
  const b = w.boxes[m.eye];
  const zw = (w.frameW ?? w.w) / (b.w + 2 * Math.abs(m.dx ?? 0) + (m.air ?? 140)); // ≥ 70 CSS px of air each side at the end of the push
  const zh = ((OUT_H - BAND_PX) / (b.h + 30)) / (1920 / (w.frameW ?? w.w));
  return Math.min(zw, zh);
}
const ZMAIN = 1.226; // on a page with a sidebar, the view right of it needs ≥ 1440 / 1184

/** Arrival and end keys of one camera target held from `f0` (arrival) to `f1`.
 * Normally a slow push-in, re-aimed at the end zoom so the target keeps its place on screen. On a sidebar page a target
 * too wide to stay whole during a push is held at ZMAIN instead and the camera drifts down the page (a slow scroll). */
function holdKeys(w: World, m: Move, f0: number, f1: number, zWant: number): Key[] {
  const span = Math.max(1, f1 - f0);
  const E = Math.exp(RATE * span);
  const fit = fitZoom(w, m);
  if (w.boxes.sidebar && !m.side && fit < ZMAIN * E) {
    const z = Math.max(ZMAIN, Math.min(zWant, 1.6));
    const a = aimKey(w, m, f0, z);
    const s = scaleAt(w, z);
    const maxCy = w.h - OUT_H / s / 2, minCy = OUT_H / s / 2;
    const d = 0.32 * span; // ≈ 0.5 output px per frame
    const cyEnd = a.cy + d <= maxCy ? a.cy + d : Math.max(minCy, a.cy - d);
    const cyStart = cyEnd < a.cy ? a.cy : Math.min(a.cy, maxCy - d);
    return [{ ...a, cy: cyStart }, { f: f1, cx: a.cx, cy: cyEnd, z, ease: "linear" }];
  }
  const z1 = Math.min(zWant, 1.6 / E, fit / E);
  const zz = w.boxes.sidebar && !m.side ? Math.max(z1, ZMAIN) : z1;
  const a = aimKey(w, m, f0, zz);
  const b = aimKey(w, m, f1, zz * E);
  return [a, { f: f1, cx: b.cx, cy: b.cy, z: zz * E, ease: "linear" }];
}

/** Camera key that puts box `m.eye` at screen height sy (above the caption band) at zoom z; on worlds with a sidebar
 * the view is either flush left (sidebar whole, `side`) or starts right of the sidebar. */
export function aimKey(w: World, m: Move, f: number, z: number, ease: Key["ease"] = "inout"): Key {
  const bx = w.boxes[m.eye];
  if (!bx) throw new Error(`${w.id}: no box ${m.eye}`);
  const c = center(bx);
  const s = scaleAt(w, z);
  let cx = c.x + (m.dx ?? 0);
  if (w.boxes.sidebar) {
    const vw = 1920 / s;
    if (m.side) cx = 0; // clamps to the left edge: the sidebar is whole
    else cx = Math.max(cx, SIDEBAR + vw / 2 + 1);
  }
  return { f, cx, cy: c.y + (OUT_H / 2 - (m.sy ?? 450)) / s, z, ease, eye: m.eye };
}

/** One page: the steps laid end to end on one continuous camera. */
function page(world: World, plate0: string, steps: Step[], opts: { z0?: number } = {}) {
  let t = 0;
  const keys: Key[] = [];
  const cursor: CursorKey[] = [];
  const plate: PlateState[] = [[0, plate0]];
  const wipes: Wipe[] = [];
  const marks: Mark[] = [];
  steps.forEach((s, i) => {
    const speech = speechFrames(s.id);
    // typing, in order, from just after the camera lands
    let tt = s.typeAt ?? ARR + 4;
    for (const ty of s.typing ?? []) {
      wipes.push({ box: ty.box, field: ty.field, bg: ty.bg ?? "#ffffff", f: t + tt, dur: ty.dur, to: ty.to, hold: true });
      const fb = world.boxes[ty.field];
      cursor.push({ f: t + tt - 3, x: fb.x + Math.min(fb.w - 20, 60), y: fb.y + fb.h / 2 + 4 });
      tt += ty.dur + 5;
    }
    const nEarly = (s.taps ?? []).filter((tp) => tp.at === "early").length;
    let dur = Math.max(s.min ?? 0, LEAD + speech + B, tt + 12, ARR + 8 + nEarly * 24 + 12);
    if ((s.taps ?? []).some((tp) => tp.at === "late")) dur = Math.max(dur, LEAD + speech + 12);
    let early = Math.max(ARR + 6, tt + 2);
    for (const tp of s.taps ?? []) {
      const at = tp.at === "early" ? early : tp.at === "late" ? dur - 16 : tp.at;
      if (tp.at === "early") early += 24;
      const c = center(world.boxes[tp.box], tp.dx ?? 0, tp.dy ?? 0);
      cursor.push({ f: t + at - 10, ...c }, { f: t + at, ...c, press: true }, { f: t + at + 7, x: c.x + 6, y: c.y + 6 });
      if (tp.to) plate.push([t + at, tp.to, tp.fade ?? 0]);
    }
    if (s.hover) {
      const c = center(world.boxes[s.hover], 0, 6);
      cursor.push({ f: t + ARR + 10, ...c }, { f: t + dur - 6, x: c.x + 14, y: c.y + 8 });
    }
    // camera: glide in, then a slow push (or drift) for the rest of the step, and an optional second target
    const second = s.then;
    const end1 = t + (second ? second.at : dur);
    const k1 = holdKeys(world, s, t + ARR, end1, s.z ?? 1.3);
    if (i === 0) {
      // a world with a sidebar opens at ≥ ZMAIN: the view then fits right of the sidebar
      const k0 = aimKey(world, s, 0, Math.max(world.boxes.sidebar && !s.side ? ZMAIN : 1.0, k1[0].z * (opts.z0 ?? 0.88)));
      keys.push({ ...k0, cy: k1[0].cy + (k0.cy - aimKey(world, s, 0, k1[0].z).cy), ease: undefined, eye: undefined });
    }
    keys.push(...k1);
    if (second) keys.push(...holdKeys(world, second, t + second.at + ARR, t + dur, second.z ?? 1.3));
    marks.push({ id: s.id, from: t, dur });
    t += dur;
  });
  // a typed field's plate switch: when its last typing ends (held wipes show the typed text until then)
  for (const to of new Set(wipes.map((w) => w.to))) {
    if (!plate.some((p) => p[1] === to)) plate.push([Math.max(...wipes.filter((w) => w.to === to).map((w) => w.f + w.dur)), to, 0]);
  }
  plate.sort((p, q) => p[0] - q[0]);
  cursor.sort((p, q) => p.f - q.f);
  for (let k = 1; k < cursor.length; k++) if (cursor[k].f <= cursor[k - 1].f) cursor[k] = { ...cursor[k], f: cursor[k - 1].f + 1 };
  if (cursor.length) cursor.unshift({ f: 0, x: cursor[0].x + 260, y: cursor[0].y + 220 });
  const shot: WorldShot = { world, plate, keys, wipes, cursor: cursor.length ? cursor : undefined };
  return { shot, dur: t, marks };
}

// ——— segments ———————————————————————————————————————————————————————————————————————————————————————
export type VSeg =
  | { kind: "world"; from: number; dur: number; shot: WorldShot; whipIn?: boolean; whipOut?: boolean; marks: Mark[] }
  | { kind: "live"; from: number; dur: number; src: string; start: number }
  | { kind: "title"; from: number; dur: number; title: string; sub: string }
  | { kind: "chapter"; from: number; dur: number; n: number; title: string }
  | { kind: "end"; from: number; dur: number; line: string; cta?: string; url?: string };
export type Voice = { f: number; id: string; s0: number; s1: number };
export type VStep = { from: number; to: number; n: number; caption: string; id: string };
export type VManual = { id: string; frames: number; tag: string; segs: VSeg[]; voice: Voice[]; steps: VStep[]; captions: { from: number; to: number; text: string }[]; chapters: { from: number; n: number; title: string }[] };

type Part =
  | { kind: "intro"; live: string; start: number; liveDur: number; title: string; sub: string; line: string }
  | { kind: "chapter"; n: number; title: string }
  | { kind: "page"; p: ReturnType<typeof page> }
  | { kind: "end"; line: string; id: string; cta?: string; url?: string };
const CHAPTER = 48;

function build(id: string, tag: string, parts: Part[]): VManual {
  const segs: VSeg[] = [], voice: Voice[] = [], steps: VStep[] = [], captions: VManual["captions"] = [], chapters: VManual["chapters"] = [];
  let t = 0, n = 0;
  const say = (lineId: string, at: number) => voice.push({ f: at, id: lineId, s0: IDX[lineId].speech_start, s1: IDX[lineId].speech_end });
  parts.forEach((p, i) => {
    const prev = parts[i - 1], next = parts[i + 1];
    if (p.kind === "intro") {
      const total = Math.max(p.liveDur + 60, 4 + speechFrames(p.line) + B);
      segs.push({ kind: "live", from: t, dur: p.liveDur, src: p.live, start: p.start }, { kind: "title", from: t + p.liveDur, dur: total - p.liveDur, title: p.title, sub: p.sub });
      say(p.line, t + 4);
      captions.push({ from: t + 4, to: t + total - 2, text: LINES[p.line].caption });
      t += total;
    } else if (p.kind === "chapter") {
      segs.push({ kind: "chapter", from: t, dur: CHAPTER, n: p.n, title: p.title });
      chapters.push({ from: t, n: p.n, title: p.title });
      t += CHAPTER;
    } else if (p.kind === "page") {
      segs.push({ kind: "world", from: t, dur: p.p.dur, shot: p.p.shot, whipIn: prev?.kind === "page", whipOut: next?.kind === "page", marks: p.p.marks });
      for (const m of p.p.marks) {
        n += 1;
        say(m.id, t + m.from + LEAD);
        steps.push({ from: t + m.from, to: t + m.from + m.dur, n, caption: LINES[m.id].caption, id: m.id });
        captions.push({ from: t + m.from + LEAD, to: t + m.from + m.dur - 2, text: LINES[m.id].caption });
      }
      t += p.p.dur;
    } else {
      const dur = Math.max(90, 4 + speechFrames(p.id) + 30);
      segs.push({ kind: "end", from: t, dur, line: p.line, cta: p.cta, url: p.url });
      say(p.id, t + 4);
      captions.push({ from: t + 4, to: t + dur - 2, text: LINES[p.id].caption });
      t += dur;
    }
  });
  return { id, frames: t, tag, segs, voice, steps, captions, chapters };
}

// ═════════════════════════════ USER_MANUAL_VISITOR ═════════════════════════════
export const homeW: World = { ...worldOf("home", ["nav", "cta", "headline"]), forbid: ["stats", "trusted"] };
homeW.boxes.stats = { x: 104, y: 662, w: 600, h: 90 }; // sample hero stats (claims): never on screen
homeW.boxes.trusted = { x: 0, y: 850, w: 1440, h: 150 }; // "trusted by" row (sample names)
homeW.boxes.ctaArea = { x: 900, y: 40, w: 440, h: 60 };
homeW.boxes.top = { x: 104, y: 34, w: 1236, h: 420 }; // the whole hero: headline, lead and the "Become a customer" button
export const applyV: World = { ...applyW, boxes: { ...applyW.boxes, fields: { x: 689, y: 282, w: 542, h: 218 }, notesArea: { x: 689, y: 634, w: 542, h: 170 } }, anchors: [...applyW.anchors, "fields", "notesArea", "received"] };
export const loginV: World = { ...loginW, boxes: { ...loginW.boxes, cardAll: { x: 553, y: 240, w: 334, h: 360 } }, anchors: [...loginW.anchors, "cardAll"] };
export const portalV: World = { ...portalW, boxes: { ...portalW.boxes, cards: { x: 168, y: 178, w: 1104, h: 230 } }, anchors: [...portalW.anchors, "cards"] };
export const catV: World = { ...cat3W, boxes: { ...cat3W.boxes, cardPrice: { x: 168, y: 324, w: 357, h: 458 } } };
export const catAdd: World = { ...catW, boxes: { ...catW.boxes, btnRow: { x: 168, y: 700, w: 1104, h: 90 } }, anchors: [...catW.anchors, "btnRow"] };
export const detailW: World = { ...worldOf("order-detail", ["nav", "headline", "detail"]), boxes: { ...worldOf("order-detail", []).boxes, detail: { x: 384, y: 200, w: 670, h: 420 }, items: { x: 384, y: 294, w: 670, h: 242 } } };
const docW = (key: string, extra: Record<string, Box> = {}) => {
  const w = worldOf(key, ["sheet", "docHeader", "table", "print"], extra);
  if (key.startsWith("doc-admin") || ["doc-products", "doc-low-stock", "doc-out-of-stock", "doc-reports"].includes(key)) w.boxes.sidebar = { x: 0, y: 0, w: 256, h: w.h };
  w.anchors = w.anchors.filter((a) => w.boxes[a]);
  return w;
};
export const invC = docW("doc-invoice", { top: { x: 336, y: 170, w: 768, h: 330 } });
export const stmtC = docW("doc-statement", { top: { x: 336, y: 216, w: 768, h: 300 }, products: { x: 377, y: 700, w: 686, h: 320 } });

const vPages = {
  home: page(homeW, "v3/home", [{ id: "v01", eye: "top", z: 1.16, sy: 450, air: 16, taps: [{ box: "cta", at: "late" }], then: { at: 0, eye: "ctaArea", z: 1.45, sy: 330, dx: -60 } }], { z0: 1.0 }),
  apply: page(applyV, "v3/apply-0", [
    { id: "v02", eye: "fields", z: 1.3, sy: 430, dx: -250, typing: [
      { box: "tBn", field: "fBn", to: "v3/apply-1", dur: 14 }, { box: "tCn", field: "fCn", to: "v3/apply-1", dur: 12 },
      { box: "tEm", field: "fEm", to: "v3/apply-1", dur: 16 }, { box: "tPh", field: "fPh", to: "v3/apply-1", dur: 12 },
      { box: "tAd", field: "fAd", to: "v3/apply-1", dur: 16 }] },
    { id: "v03", eye: "notesArea", z: 1.35, sy: 800, dx: -250, typing: [{ box: "tNo", field: "fNo", to: "v3/apply-1", dur: 18 }], taps: [{ box: "submit", at: "late", to: "v3/apply-2" }] },
    { id: "v04", eye: "received", z: 1.3, sy: 420, dx: -220 },
  ]),
  login: page(loginV, "v3/login-0", [{ id: "v05", eye: "cardAll", z: 1.4, sy: 470, typing: [{ box: "tEm", field: "fEm", to: "v3/login-1", dur: 16, bg: "#faf6ec" }, { box: "tPw", field: "fPw", to: "v3/login-1", dur: 10, bg: "#faf6ec" }], taps: [{ box: "submit", at: "late" }] }], { z0: 0.98 }),
  portal: page(portalV, "v3/portal", [{ id: "v06", eye: "cards", z: 1.2, sy: 420, taps: [{ box: "catalogCard", at: "late", dx: -120, dy: 10 }] }]),
  catalog: page(catV, "v3/catalog-0", [
    { id: "v07", eye: "cardPrice", z: 1.15, sy: 480, dx: 374 },
    { id: "v08", eye: "searchRow", z: 1.15, sy: 330, dx: 241, typing: [{ box: "tSr", field: "fSr", to: "v3/search-1", dur: 16 }], taps: [{ box: "searchBtn", at: "early", to: "v3/search-2" }] },
  ]),
  add: page(catAdd, "v3/catalog-0", [{ id: "v09", eye: "btnRow", z: 1.2, sy: 560, taps: [{ box: "btn0", at: "early", to: "v3/catalog-1" }, { box: "btn1", at: "early", to: "v3/catalog-2" }, { box: "btn2", at: "early", to: "v3/catalog-3" }, { box: "cartWide", at: "late" }], then: { at: 0, eye: "cartWide", z: 1.3, sy: 400 } }]),
  cart: page(cartW, "v3/cart", [{ id: "v10", eye: "total", z: 1.3, sy: 420, dx: 200, taps: [{ box: "checkout", at: "late" }] }]),
  checkout: page(ckW, "v3/checkout-0", [
    { id: "v11", eye: "delivery", z: 1.35, sy: 420, dx: -160, taps: [{ box: "delivery", at: ARR + 6, to: "v3/checkout-1" }], typeAt: 82, typing: [{ box: "typed", field: "noteField", to: "v3/checkout-2", dur: 24 }], then: { at: 0, eye: "notes", z: 1.35, sy: 450, dx: -40 } },
    { id: "v12", eye: "submit", z: 1.38, sy: 430, dx: -140, taps: [{ box: "submit", at: "late" }] },
  ]),
  placed: page(placedW, "v3/order-placed", [{ id: "v13", eye: "banner", z: 1.4, sy: 400 }]),
  orders: page(ordersW, "v3/orders", [{ id: "v14", eye: "first", z: 1.25, sy: 440, taps: [{ box: "first", at: "late", dx: -300 }] }]),
  detail: page(detailW, "v3/order-detail", [{ id: "v15", eye: "detail", z: 1.25, sy: 470, taps: [{ box: "invoice", at: "late" }] }]),
  invoice: page(invC, "v3/doc-invoice", [{ id: "v16", eye: "top", z: 1.3, sy: 420, hover: "print", then: { at: 0, eye: "table", z: 1.3, sy: 450 } }]),
  statement: page(stmtC, "v3/doc-statement", [{ id: "v17", eye: "top", z: 1.3, sy: 440, then: { at: 0, eye: "products", z: 1.3, sy: 450 } }]),
  offers: page(offersW, "v3/offers", [{ id: "v18", eye: "offerCard", z: 1.25, sy: 420 }]),
  account: page(accountW, "v3/account", [{ id: "v19", eye: "table", z: 1.25, sy: 440 }]),
};
// steps with a second target: it comes at about 55 % of the step (computed after the first build)
function withSecond(p: ReturnType<typeof page>, world: World, plate0: string, steps: Step[], frac = 0.55, opts: { z0?: number } = {}) {
  const s2 = steps.map((s, i) => (s.then ? { ...s, then: { ...s.then, at: Math.round(p.marks[i].dur * frac) } } : s));
  return page(world, plate0, s2, opts);
}
const vStepsOf = {
  add: [{ id: "v09", eye: "btnRow", z: 1.2, sy: 560, taps: [{ box: "btn0", at: "early" as const, to: "v3/catalog-1" }, { box: "btn1", at: "early" as const, to: "v3/catalog-2" }, { box: "btn2", at: "early" as const, to: "v3/catalog-3" }, { box: "cartWide", at: "late" as const }], then: { at: 0, eye: "cartWide", z: 1.3, sy: 400 } }],
};
vPages.home = withSecond(vPages.home, homeW, "v3/home", [{ id: "v01", eye: "top", z: 1.16, sy: 450, air: 16, taps: [{ box: "cta", at: "late" }], then: { at: 0, eye: "ctaArea", z: 1.45, sy: 330, dx: -60 } }], 0.5, { z0: 1.0 });
vPages.add = withSecond(vPages.add, catAdd, "v3/catalog-0", vStepsOf.add, 0.62);
vPages.checkout = withSecond(vPages.checkout, ckW, "v3/checkout-0", [
  { id: "v11", eye: "delivery", z: 1.35, sy: 420, dx: -160, taps: [{ box: "delivery", at: ARR + 6, to: "v3/checkout-1" }], typeAt: 82, typing: [{ box: "typed", field: "noteField", to: "v3/checkout-2", dur: 24 }], then: { at: 0, eye: "notes", z: 1.35, sy: 450, dx: -40 } },
  { id: "v12", eye: "submit", z: 1.38, sy: 430, dx: -140, taps: [{ box: "submit", at: "late" }] },
], 0.4);
vPages.invoice = withSecond(vPages.invoice, invC, "v3/doc-invoice", [{ id: "v16", eye: "top", z: 1.3, sy: 420, hover: "print", then: { at: 0, eye: "table", z: 1.3, sy: 450 } }]);
vPages.statement = withSecond(vPages.statement, stmtC, "v3/doc-statement", [{ id: "v17", eye: "top", z: 1.3, sy: 440, then: { at: 0, eye: "products", z: 1.3, sy: 450 } }]);

export const VISITOR_VOICED = build("V32-VISITOR", "Olleik Foods · Customer guide", [
  { kind: "intro", live: "v3/clips/marco-169-t1.mp4", start: 0.4, liveDur: 96, title: "Customer guide", sub: "Open an account and place your first order", line: "v00" },
  { kind: "chapter", n: 1, title: "Apply" }, { kind: "page", p: vPages.home }, { kind: "page", p: vPages.apply },
  { kind: "chapter", n: 2, title: "Sign in" }, { kind: "page", p: vPages.login }, { kind: "page", p: vPages.portal },
  { kind: "chapter", n: 3, title: "Your catalog" }, { kind: "page", p: vPages.catalog },
  { kind: "chapter", n: 4, title: "Cart and checkout" }, { kind: "page", p: vPages.add }, { kind: "page", p: vPages.cart }, { kind: "page", p: vPages.checkout },
  { kind: "chapter", n: 5, title: "Order status" }, { kind: "page", p: vPages.placed }, { kind: "page", p: vPages.orders }, { kind: "page", p: vPages.detail },
  { kind: "chapter", n: 6, title: "Invoice and statement" }, { kind: "page", p: vPages.invoice }, { kind: "page", p: vPages.statement },
  { kind: "chapter", n: 7, title: "Offers and account" }, { kind: "page", p: vPages.offers }, { kind: "page", p: vPages.account },
  { kind: "end", id: "v20", line: "Everything you need to place and follow orders", cta: "Become a customer →", url: "olleik-foods-site.vercel.app" },
]);

// ═════════════════════════════ USER_MANUAL_ADMIN ═════════════════════════════
const admLogin: World = { ...admW, boxes: { ...admW.boxes, form: { x: 553, y: 250, w: 334, h: 380 } }, anchors: [...admW.anchors, "form"] };
export const dashA: World = { ...dashW, boxes: { ...dashW.boxes, sideNav: { x: 0, y: 100, w: 256, h: 400 } }, anchors: [...dashW.anchors, "sideNav"] };
export const listA: World = { ...listW, boxes: { ...listW.boxes, rowsTop: { x: 297, y: 150, w: 1102, h: 330 } }, anchors: [...listW.anchors, "rowsTop"] };
// prepBtn / compBtn: the Prepared and Complete buttons (same place as Confirm on the next states; measured in Part B)
export const orderA: World = { ...orderW, boxes: { ...orderW.boxes, top: { x: 400, y: 60, w: 900, h: 140 }, body: { x: 400, y: 280, w: 900, h: 420 }, prepBtn: { x: 476, y: 177, w: 8, h: 8 }, compBtn: { x: 482, y: 177, w: 8, h: 8 } }, anchors: [...orderW.anchors, "top", "body"] };
export const invA = docW("doc-admin-invoice", { top: { x: 464, y: 56, w: 768, h: 330 }, lines: { x: 505, y: 380, w: 686, h: 300 } });
export const leadsA: World = { ...leadsW, boxes: { ...leadsW.boxes, row: { x: 317, y: 293, w: 1062, h: 131 } }, anchors: [...leadsW.anchors, "row"] };
export const newA: World = { ...newW, boxes: { ...newW.boxes, panel: { x: 296, y: 200, w: 1104, h: 230 } }, anchors: [...newW.anchors, "panel"] };
export const custA: World = { ...custW, boxes: { ...custW.boxes, list: { x: 296, y: 200, w: 1104, h: 360 } }, anchors: [...custW.anchors, "list"] };
export const detA: World = { ...detW, boxes: { ...detW.boxes, access: { x: 317, y: 221, w: 1062, h: 120 } }, anchors: [...detW.anchors, "access"] };
const pricesA = pricesW;
export const prodA: World = { ...prodW, boxes: { ...prodW.boxes, topTable: { x: 297, y: 300, w: 1102, h: 330 }, form1: { x: 457, y: 170, w: 526, h: 440 } }, anchors: [...prodW.anchors, "topTable", "form1"] };
export const prodDlg: World = { ...prodA, id: "product-add-0", forbid: ["belowModal"], boxes: { ...prodA.boxes, belowModal: { x: 0, y: 895, w: 1440, h: 1400 }, priceCreate: { x: 457, y: 480, w: 526, h: 280 } }, anchors: [...prodA.anchors, "priceCreate"] };
export const prodNew: World = { ...prodA, boxes: { ...prodA.boxes, newRow: { x: 297, y: 1574, w: 1102, h: 46 }, newArea: { x: 297, y: 1420, w: 1102, h: 360 } }, anchors: [...prodA.anchors, "newArea"] };
const catsA: World = { ...catsW, boxes: { ...catsW.boxes, wide: { x: 296, y: 100, w: 1104, h: 480 } }, anchors: [...catsW.anchors, "wide"] };
const assignA = assignW;
export const pricingA: World = { ...pricingW, boxes: { ...pricingW.boxes, rulesTop: { x: 296, y: 280, w: 1104, h: 330 } }, anchors: [...pricingW.anchors, "rulesTop"] };
export const anaA = anaW;
export const repA = docW("doc-reports", { left: { x: 296, y: 156, w: 320, h: 520 }, top: { x: 640, y: 180, w: 760, h: 300 } });
repA.anchors = [...repA.anchors, "left", "top", "headline"];
export const stmtA = docW("doc-admin-statement", { top: { x: 464, y: 194, w: 768, h: 330 }, products: { x: 505, y: 580, w: 686, h: 320 } });
export const prodDoc = docW("doc-products", { top: { x: 464, y: 208, w: 768, h: 300 } });
export const lowDoc = docW("doc-low-stock", { top: { x: 464, y: 124, w: 768, h: 431 } });
const outDoc = docW("doc-out-of-stock", { top: { x: 464, y: 124, w: 768, h: 373 } });

type PageArgs = [World, string, Step[], number?];
const A: Record<string, PageArgs> = {
  login: [admLogin, "v3/admin-login", [{ id: "a01", eye: "form", z: 1.3, sy: 460 }]],
  dash: [dashA, "v3/admin-dashboard", [{ id: "a02", eye: "newOrders", z: 1.3, sy: 440, side: true }, { id: "a03", eye: "sideNav", z: 1.3, sy: 420, side: true, taps: [{ box: "ordersNav", at: "late" }] }]],
  list: [listA, "v3/admin-orders", [{ id: "a04", eye: "rowsTop", z: 1.3, sy: 440, taps: [{ box: "tabNew", at: "early", to: "v3/admin-orders-new" }, { box: "firstRow", at: "late" }] }]],
  order: [orderA, "v3/admin-order-new", [
    { id: "a05", eye: "body", z: 1.25, sy: 470 },
    { id: "a06", eye: "top", z: 1.4, sy: 330, taps: [{ box: "confirm", at: "early", to: "v3/admin-order-confirmed" }] },
    { id: "a07", eye: "top", z: 1.4, sy: 330, taps: [{ box: "prepBtn", at: "early", to: "v3/admin-order-prepared" }, { box: "compBtn", at: "early", to: "v3/admin-order-completed" }] },
    { id: "a08", eye: "top", z: 1.35, sy: 330, taps: [{ box: "invoice", at: "late" }] },
  ]],
  inv: [invA, "v3/doc-admin-invoice", [{ id: "a09", eye: "top", z: 1.3, sy: 420, hover: "print", then: { at: 0, eye: "lines", z: 1.3, sy: 450 } }]],
  leads: [leadsA, "v3/leads-0", [{ id: "a10", eye: "row", z: 1.3, sy: 430, taps: [{ box: "firstStatus", at: "early", to: "v3/leads-1" }] }]],
  new: [newA, "v3/cust-new-0", [{ id: "a11", eye: "panel", z: 1.3, sy: 420, taps: [{ box: "check", at: "early", to: "v3/cust-new-1" }, { box: "convert", at: "late" }] }]],
  cust: [custA, "v3/customers", [{ id: "a12", eye: "list", z: 1.25, sy: 440 }]],
  det: [detA, "v3/cust-detail-0", [
    { id: "a13", eye: "access", z: 1.3, sy: 400, taps: [{ box: "sendEmail", at: "early", to: "v3/cust-detail-2" }] },
    { id: "a14", eye: "copyLinkB", z: 1.35, sy: 420, hover: "copyLinkB" },
    { id: "a15", eye: "visibilityB", z: 1.3, sy: 430 },
  ]],
  prices: [pricesA, "v3/cust-prices", [{ id: "a16", eye: "firstPrice", z: 1.3, sy: 420 }]],
  prod: [prodA, "v3/products-0", [{ id: "a17", eye: "topTable", z: 1.25, sy: 450, taps: [{ box: "add", at: "late" }] }]],
  // the dialog: the capture's modal is cut at the viewport (y 900) and the page below it is not dimmed, so that area
  // never shows; its Create button is below the cut (the next page shows the result: the new product in the list)
  dlg: [prodDlg, "v3/product-add-0", [
    { id: "a18", eye: "form1", z: 1.25, sy: 430, typing: [{ box: "tSku", field: "fSku", to: "v3/product-add-1", dur: 10, bg: "#faf6ec" }, { box: "tName", field: "fName", to: "v3/product-add-1", dur: 14, bg: "#faf6ec" }, { box: "tSize", field: "fSize", to: "v3/product-add-1", dur: 8, bg: "#faf6ec" }] },
    { id: "a19", eye: "priceCreate", z: 1.35, sy: 520 },
  ]],
  prod2: [prodNew, "v3/products-1", [{ id: "a20", eye: "newArea", z: 1.25, sy: 450 }]],
  cats: [catsA, "v3/categories", [{ id: "a21", eye: "wide", z: 1.25, sy: 450 }]],
  assign: [assignA, "v3/assign", [{ id: "a22", eye: "pickProducts", z: 1.25, sy: 450 }]],
  pricing: [pricingA, "v3/pricing", [{ id: "a23", eye: "global", z: 1.3, sy: 400 }, { id: "a24", eye: "rulesTop", z: 1.25, sy: 470 }]],
  ana: [anaA, "v3/analytics", [{ id: "a25", eye: "trend", z: 1.25, sy: 440 }, { id: "a26", eye: "tableTop", z: 1.25, sy: 440 }]],
  rep: [repA, "v3/doc-reports", [{ id: "a27", eye: "left", z: 1.25, sy: 420, side: true }]],
  repDoc: [repA, "v3/doc-reports", [{ id: "a28", eye: "top", z: 1.3, sy: 420 }]],
  stmt: [stmtA, "v3/doc-admin-statement", [{ id: "a29", eye: "top", z: 1.3, sy: 430, then: { at: 0, eye: "products", z: 1.3, sy: 450 } }]],
  prodDoc: [prodDoc, "v3/doc-products", [{ id: "a30", eye: "top", z: 1.3, sy: 430 }]],
  low: [lowDoc, "v3/doc-low-stock", [{ id: "a31", eye: "top", z: 1.25, sy: 460 }]],
  out: [outDoc, "v3/doc-out-of-stock", [{ id: "a32", eye: "top", z: 1.25, sy: 450 }]],
};
const mk = (k: string) => {
  const [w, p0, st] = A[k];
  const first = page(w, p0, st);
  return st.some((s) => s.then) ? withSecond(first, w, p0, st) : first;
};
// the report builder and its sheet are one page: the sheet step continues the same camera
const repBoth = (() => {
  const st = [...A.rep[2], ...A.repDoc[2]];
  return page(repA, "v3/doc-reports", st);
})();

export const ADMIN_VOICED = build("V32-ADMIN", "Olleik Foods · Admin guide", [
  { kind: "intro", live: "v3/clips/salma-169-t1.mp4", start: 0.2, liveDur: 96, title: "Admin guide", sub: "Orders, customers, products and documents", line: "a00" },
  { kind: "chapter", n: 1, title: "Dashboard and orders" }, { kind: "page", p: mk("login") }, { kind: "page", p: mk("dash") }, { kind: "page", p: mk("list") }, { kind: "page", p: mk("order") }, { kind: "page", p: mk("inv") },
  { kind: "chapter", n: 2, title: "Customers and approvals" }, { kind: "page", p: mk("leads") }, { kind: "page", p: mk("new") }, { kind: "page", p: mk("cust") }, { kind: "page", p: mk("det") }, { kind: "page", p: mk("prices") },
  { kind: "chapter", n: 3, title: "Products and prices" }, { kind: "page", p: mk("prod") }, { kind: "page", p: mk("dlg") }, { kind: "page", p: mk("prod2") }, { kind: "page", p: mk("cats") }, { kind: "page", p: mk("assign") },
  { kind: "chapter", n: 4, title: "Margins and reports" }, { kind: "page", p: mk("pricing") }, { kind: "page", p: mk("ana") },
  { kind: "chapter", n: 5, title: "Documents" }, { kind: "page", p: repBoth }, { kind: "page", p: mk("stmt") }, { kind: "page", p: mk("prodDoc") }, { kind: "page", p: mk("low") }, { kind: "page", p: mk("out") },
  { kind: "end", id: "a33", line: "Every document has a Print button", cta: "", url: "olleik-foods-site.vercel.app/admin" },
]);

// ——— validation (throws at import: a bad move cannot render) ———————————————————————————————————————————
/** Extra checks for the voiced manuals: the sidebar is whole or out on every frame; every tap point is visible above
 * the caption band at its tap frame; no stretch longer than a beat without camera or pointer movement. */
function checkShot(m: VManual, s: Extract<VSeg, { kind: "world" }>, problems: string[]) {
  const { world, keys } = s.shot;
  try { validateCamera(world, keys, s.dur, BAND_PX); } catch (e) { problems.push(`${m.id} @${s.from} ${world.id}: ${(e as Error).message}`); }
  let still = 0;
  for (let f = 0; f < s.dur; f++) {
    const c = cameraAt(world, keys, f);
    const c1 = cameraAt(world, keys, f + 1);
    const speed = Math.hypot((c1.cx - c.cx) * c.s, (c1.cy - c.cy) * c.s);
    if (world.boxes.sidebar && speed < 3) { // a sliver may cross the frame edge during a move, never during a hold
      const l = c.cx - c.vw / 2;
      if (l > 0.5 && l < SIDEBAR - 0.5) { problems.push(`${m.id} @${s.from + f} ${world.id}: sidebar cut at the frame edge (left ${l.toFixed(0)})`); break; }
    }
    const c2 = cameraAt(world, keys, f + 1);
    const move = Math.hypot((c2.cx - c.cx) * c.s, (c2.cy - c.cy) * c.s) + (Math.abs(c2.s - c.s) / c.s) * 960;
    const cur = s.shot.cursor ?? [];
    const curMoves = cur.some((k, i) => i > 0 && f >= cur[i - 1].f && f < k.f && Math.hypot(k.x - cur[i - 1].x, k.y - cur[i - 1].y) > 2);
    still = move < 0.35 && !curMoves ? still + 1 : 0;
    if (still > B && f > 8 && f < s.dur - 8) { problems.push(`${m.id} @${s.from + f} ${world.id}: no movement for more than a beat`); break; }
  }
  for (const w of s.shot.wipes ?? []) for (const f of [w.f, w.f + w.dur]) {
    if (visibleFraction(cameraAt(world, keys, f), world.boxes[w.field], BAND_PX) < 0.9) problems.push(`${m.id} @${s.from + f} ${world.id}: typed field ${w.field} not fully visible`);
  }
  for (const k of s.shot.cursor ?? []) {
    if (!k.press) continue;
    const c = cameraAt(world, keys, k.f);
    const pt = { x: k.x - 2, y: k.y - 2, w: 4, h: 4 };
    if (visibleFraction(c, pt, BAND_PX) < 1) problems.push(`${m.id} @${s.from + k.f} ${world.id}: tap at (${k.x.toFixed(0)}, ${k.y.toFixed(0)}) not visible`);
  }
  for (const k of keys) if (k.eye && insideFraction(cameraAt(world, keys, k.f), world.boxes[k.eye]) < 0.95) problems.push(`${m.id} ${world.id}: eye ${k.eye} not in frame`);
}
export const VOICED = { "V32-VISITOR": VISITOR_VOICED, "V32-ADMIN": ADMIN_VOICED } as const;
const problems: string[] = [];
for (const m of Object.values(VOICED)) {
  for (const s of m.segs) if (s.kind === "world") checkShot(m, s, problems);
  for (const c of m.captions) assertLine(c.text);
  for (const c of m.chapters) assertLine(c.title);
  for (const s of m.segs) if (s.kind === "title") { assertLine(s.title); assertLine(s.sub); } else if (s.kind === "end") assertLine(s.line);
  // narration: each line starts within 5 frames of its step and ends before the next line starts
  const v = [...m.voice].sort((a, b) => a.f - b.f);
  for (let i = 0; i < v.length; i++) {
    const end = v[i].f + Math.ceil((v[i].s1 - v[i].s0) * 30);
    if (i + 1 < v.length && end >= v[i + 1].f) problems.push(`${m.id}: line ${v[i].id} overlaps ${v[i + 1].id}`);
  }
  for (const st of m.steps) {
    const vo = m.voice.find((x) => x.id === st.id)!;
    if (vo.f - st.from > 5 || vo.f < st.from) problems.push(`${m.id}: ${st.id} starts ${vo.f - st.from} frames into its step`);
  }
}
export const VOICED_PROBLEMS = problems;
if (problems.length && !(globalThis as { VOICED_LENIENT?: boolean }).VOICED_LENIENT) throw new Error(problems.join("\n"));
export const VISITOR_VOICED_FRAMES = VISITOR_VOICED.frames;
export const ADMIN_VOICED_FRAMES = ADMIN_VOICED.frames;

/** Sound events for a voiced manual (mix_v2 format, under the narration): taps, real page updates, typing, whips, the
 * chapter cards and the end card. Quieter and sparser than the promo: the voice leads. */
export const voicedEvents = (m: VManual) => {
  type Ev = { f: number; sfx: string; vel: number; pan?: number; pitch?: number; dur?: number; sweep?: number[]; note: string };
  const ev: Ev[] = [];
  for (const s of m.segs) {
    if (s.kind === "title") ev.push({ f: s.from + 2, sfx: "pop", vel: 0.35, note: "logo lands" });
    else if (s.kind === "chapter") ev.push({ f: s.from, sfx: "whip", vel: 0.35, note: "to the chapter card" }, { f: s.from + 4, sfx: "pluck", vel: 0.45, note: "chapter" }, { f: s.from + s.dur - 6, sfx: "whoosh", vel: 0.3, dur: 6, sweep: [0.5, -0.5], note: "out of the chapter card" });
    else if (s.kind === "end") ev.push({ f: s.from, sfx: "whip", vel: 0.35, note: "to the end card" }, { f: s.from + 2, sfx: "pop", vel: 0.4, note: "logo lands" }, { f: s.from + 3, sfx: "bell", vel: 0.4, note: "end card" });
    else if (s.kind === "world") {
      const w = s.shot.world.w;
      const panX = (x: number) => Math.max(-0.6, Math.min(0.6, (x - w / 2) / (w * 0.8)));
      if (s.whipIn) ev.push({ f: s.from, sfx: "whip", vel: 0.35, note: "whip in (page change)" });
      if (s.whipOut) ev.push({ f: s.from + s.dur - 6, sfx: "whoosh", vel: 0.3, dur: 6, sweep: [0.5, -0.5], note: "whip out" });
      for (const c of s.shot.cursor ?? []) if (c.press && c.f < s.dur) ev.push({ f: s.from + c.f, sfx: "tap", vel: 0.6, pan: panX(c.x), note: "tap" });
      const st = typeof s.shot.plate === "string" ? [] : s.shot.plate;
      for (const p of st.slice(1)) if (p[0] < s.dur) ev.push({ f: s.from + p[0] + 1, sfx: "snaplock", vel: 0.3, note: "the page updates (real after-tap capture)" });
      for (const wp of s.shot.wipes ?? []) for (let k = 0; k < wp.dur; k += 3) ev.push({ f: s.from + wp.f + k, sfx: "key", vel: 0.28 + ((k * 7) % 5) / 25, pan: panX(s.shot.world.boxes[wp.box].x), note: "typing" });
    }
  }
  return ev.filter((e) => e.f < m.frames).sort((a, b) => a.f - b.f);
};
