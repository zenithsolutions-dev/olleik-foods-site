/**
 * V3.2 §10.3: the final promo cuts, built from the approved 20 s promo (Gate F re-delivery) and new beat shots in the
 * same V3.1 language. A cut is a list of segments on the 108 BPM grid:
 *   promo  a range [a, b) of the 20 s promo, re-used as is (its own grid: every shift is a multiple of 3 beats = 50 frames)
 *   beat   one real page in 3 beats (50 frames): whip in, speed-ramp onto the target on beat 1, a real tap on beat 2
 *          (the plate switches to the real after-tap capture), drift, whip out. Nothing is patched over the UI.
 *   live   a Higgsfield clip with an optional line (lands on beat 1)
 *   card   a kinetic line on the brand colour (no UI)
 *   end    the end card (logo on the beat, line, button, olleik-foods-site.vercel.app)
 * Sound: promoEvents for the promo ranges (shifted), generated events for the rest, and the story pulse (box on the beat,
 * chop on the off-beat) re-generated over the whole cut; music bed C from the hook's snap in the music versions.
 * Every line is Pending Review and has no trailing period (assertLine).
 */
import { Key, validateCamera, World } from "./camera";
import { assertLine } from "./lines";
import { cartW, ckW, ordersW, placedW } from "./manuals";
import { offersW } from "./manualsFull";
import { hookA } from "./hookEvents";
import { promoEvents } from "./promoEvents";
import { g, P, PROMO_FRAMES } from "./promoTiming";
import { aimKey, anaA, applyV, catV, dashA, detA, invC, leadsA, listA, pricingA, prodA, repA, stmtC } from "./voiced";
import type { CursorKey, Wipe, WorldShot } from "./World";

const BEAT = 1800 / 108;
const lb = (j: number) => Math.round(j * BEAT); // beat j inside a segment
export const UNIT = 50; // 3 beats

type Tgt = { eye: string; z?: number; sy?: number; dx?: number; side?: boolean };
type BeatOpts = Tgt & { tap?: { box: string; beat: number; to?: string; dx?: number; dy?: number }; then?: Tgt & { beat: number }; typing?: Omit<Wipe, "hold">[]; line?: { text: string; box: string; dx: number; dy: number } };

/** One page in `len` frames on the beat (see header). */
export function beatShot(world: World, plate0: string, o: BeatOpts, len = UNIT): WorldShot {
  const z = o.z ?? 1.3;
  const arrive = aimKey(world, o, lb(1) - 3, z, "expo");
  const start = aimKey(world, o, 0, Math.max(world.boxes.sidebar && !o.side ? 1.226 : 1.0, z * 0.84));
  const side = !!world.boxes.sidebar && !o.side; // a page with a sidebar: the view hugs the sidebar's right edge
  const hug = (k: Key, z2: number): Key => (side ? { ...k, cx: 256 + 1920 / ((1920 / world.w) * z2) / 2 + 1 } : k);
  const keys: Key[] = [{ ...start, cx: side ? start.cx : start.cx + 40, ease: undefined, eye: undefined }, side ? hug(arrive, arrive.z) : arrive];
  if (o.then) {
    const f2 = lb(o.then.beat) - 3;
    keys.push({ f: f2 - 8, cx: arrive.cx + 6, cy: arrive.cy - 4, z: arrive.z * 1.015, ease: "linear" }, aimKey(world, o.then, f2, o.then.z ?? z, "snap"));
  }
  const last = keys[keys.length - 1];
  keys.push(side ? hug({ f: len, cx: last.cx, cy: last.cy - 10, z: last.z * 1.03, ease: "linear" }, last.z * 1.03) : { f: len, cx: last.cx + 10, cy: last.cy - 6, z: last.z * 1.04, ease: "linear" });
  const plate: [number, string, number?][] = [[0, plate0]];
  const cursor: CursorKey[] = [];
  if (o.tap) {
    const b = world.boxes[o.tap.box];
    const c = { x: b.x + b.w / 2 + (o.tap.dx ?? 0), y: b.y + b.h / 2 + (o.tap.dy ?? 0) };
    const at = lb(o.tap.beat);
    cursor.push({ f: 0, x: c.x + 220, y: c.y + 180 }, { f: at - 8, ...c }, { f: at, ...c, press: true }, { f: at + 8, x: c.x + 8, y: c.y + 8 });
    if (o.tap.to) plate.push([at, o.tap.to]);
  }
  const wipes = (o.typing ?? []).map((w) => ({ ...w, hold: true }));
  for (const to of new Set(wipes.map((w) => w.to))) if (!plate.some((p) => p[1] === to)) plate.push([Math.max(...wipes.filter((w) => w.to === to).map((w) => w.f + w.dur)), to]);
  plate.sort((a, b) => a[0] - b[0]);
  const shot: WorldShot = { world, plate: plate as WorldShot["plate"], keys, cursor: cursor.length ? cursor : undefined, wipes: wipes.length ? wipes : undefined };
  if (o.line) shot.type = [{ text: assertLine(o.line.text), box: o.line.box, dx: o.line.dx, dy: o.line.dy, from: lb(1) + 2, to: len + 4, size: 40 }];
  validateCamera(world, keys, len, 0);
  return shot;
}

export type CSeg =
  | { kind: "promo"; from: number; dur: number; a: number }
  | { kind: "beat"; from: number; dur: number; shot: WorldShot; whipIn?: boolean; whipOut?: boolean }
  | { kind: "live"; from: number; dur: number; src: string; start: number; line?: string; vertical?: boolean }
  | { kind: "card"; from: number; dur: number; line: string; sub?: string }
  | { kind: "end"; from: number; dur: number; line?: string };
export type Cut = { id: string; w: number; h: number; frames: number; segs: CSeg[]; bedFrom: number; bedOffset?: number; loop?: boolean };
type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type Part = { kind: "promo"; a: number; b: number } | (Omit<Extract<CSeg, { kind: "beat" }>, "from" | "dur" | "whipIn" | "whipOut"> & { dur?: number }) | (DistOmit<Extract<CSeg, { kind: "live" | "card" | "end" }>, "from" | "dur"> & { dur?: number });

function lay(id: string, parts: Part[], o: { w?: number; h?: number; bedFrom?: number; loop?: boolean } = {}): Cut {
  let t = 0;
  const segs: CSeg[] = [];
  parts.forEach((p, i) => {
    const dur = p.kind === "promo" ? p.b - p.a : (p as { dur?: number }).dur ?? UNIT;
    if (p.kind === "promo") {
      if ((t - p.a) % UNIT !== 0 && !o.loop) throw new Error(`${id}: promo range [${p.a}, ${p.b}) shifted by ${t - p.a}, not a multiple of 3 beats`);
      segs.push({ kind: "promo", from: t, dur, a: p.a });
    } else if (p.kind === "beat") {
      const prev = parts[i - 1], next = parts[i + 1];
      segs.push({ ...p, from: t, dur, whipIn: prev?.kind === "beat", whipOut: next?.kind === "beat" } as CSeg);
    } else segs.push({ ...(p as object), from: t, dur } as CSeg);
    t += dur;
  });
  for (const s of segs) if (s.kind === "live" && s.line) assertLine(s.line); else if (s.kind === "card") { assertLine(s.line); if (s.sub) assertLine(s.sub); } else if (s.kind === "end" && s.line) assertLine(s.line);
  return { id, w: o.w ?? 1920, h: o.h ?? 1080, frames: t, segs, bedFrom: o.bedFrom ?? P.snap, loop: o.loop };
}

// ——— the beat shots (real captures, local demo stack) ———
const S = {
  cart: beatShot(cartW, "v3/cart", { eye: "total", z: 1.3, sy: 460, dx: 220, tap: { box: "checkout", beat: 2 } }),
  checkout: beatShot(ckW, "v3/checkout-1", { eye: "submit", z: 1.35, sy: 470, dx: -200, tap: { box: "submit", beat: 2 } }),
  placed: beatShot(placedW, "v3/order-placed", { eye: "banner", z: 1.45, sy: 430 }),
  dash: beatShot(dashA, "v3/admin-dashboard", { eye: "newOrders", z: 1.3, sy: 460, side: true, tap: { box: "ordersNav", beat: 2 } }),
  list: beatShot(listA, "v3/admin-orders", { eye: "tabNew", z: 1.3, sy: 400, tap: { box: "tabNew", beat: 1.5, to: "v3/admin-orders-new" } }),
  invoice: beatShot(invC, "v3/doc-invoice", { eye: "top", z: 1.3, sy: 470 }),
  orders: beatShot(ordersW, "v3/orders", { eye: "first", z: 1.25, sy: 460 }),
  statement: beatShot(stmtC, "v3/doc-statement", { eye: "products", z: 1.3, sy: 520 }),
  products: beatShot(prodA, "v3/products-0", { eye: "topTable", z: 1.25, sy: 520, tap: { box: "add", beat: 2, to: "v3/product-add-1" } }),
  pricing: beatShot(pricingA, "v3/pricing", { eye: "global", z: 1.23, sy: 420 }),
  analytics: beatShot(anaA, "v3/analytics", { eye: "trend", z: 1.25, sy: 520 }),
  report: beatShot(repA, "v3/doc-reports", { eye: "top", z: 1.23, sy: 460 }),
  apply: beatShot(applyV, "v3/apply-1", { eye: "fields", z: 1.3, sy: 470, dx: -250 }),
  leads: beatShot(leadsA, "v3/leads-0", { eye: "row", z: 1.23, sy: 460, tap: { box: "firstStatus", beat: 2, to: "v3/leads-1" } }),
  invite: beatShot(detA, "v3/cust-detail-0", { eye: "access", z: 1.23, sy: 430, tap: { box: "sendEmail", beat: 2, to: "v3/cust-detail-2" } }),
  catalog: beatShot(catV, "v3/catalog-0", { eye: "cardPrice", z: 1.15, sy: 520, dx: 374 }),
  search: beatShot(catV, "v3/search-1", { eye: "searchRow", z: 1.2, sy: 380, dx: 241, tap: { box: "searchBtn", beat: 1.5, to: "v3/search-2" } }),
  offers: beatShot(offersW, "v3/offers", { eye: "offerCard", z: 1.15, sy: 440 }),
};

// ═════════════ 60 s hero: Marco orders at night → Salma confirms at dawn → it's sent → the documents → the rest of the
// business (products, margins, reports, new customers) → end card ═════════════
export const HERO60 = lay("V32-HERO60", [
  { kind: "promo", a: 0, b: P.monFrom },
  { kind: "beat", shot: S.cart }, { kind: "beat", shot: S.checkout }, { kind: "beat", shot: S.placed },
  { kind: "live", src: "v3/clips/salma-169-t1.mp4", start: 0.4, line: "New orders, first thing" },
  { kind: "beat", shot: S.dash }, { kind: "beat", shot: S.list },
  { kind: "promo", a: P.monFrom, b: P.endFrom },
  { kind: "beat", shot: S.invoice }, { kind: "beat", shot: S.orders }, { kind: "beat", shot: S.statement },
  { kind: "live", src: "v3/clips/f2/ep3.mp4", start: 2.6, line: "One place for the whole business" },
  { kind: "beat", shot: S.products }, { kind: "beat", shot: S.pricing }, { kind: "beat", shot: S.analytics }, { kind: "beat", shot: S.report },
  { kind: "live", src: "v3/clips/f2/ep2.mp4", start: 1.6, line: "New customers apply online" },
  { kind: "beat", shot: S.apply }, { kind: "beat", shot: S.leads }, { kind: "beat", shot: S.invite },
  { kind: "card", line: "Your catalog, your prices", sub: "For restaurants and food businesses" },
  { kind: "beat", shot: S.catalog }, { kind: "beat", shot: S.search }, { kind: "beat", shot: S.offers },
  { kind: "end", dur: 161, line: "The supplier behind great kitchens" }, // from frame 1639 = beat 98 to 60.0 s
]);

// ═════════════ 30 s ═════════════
export const CUT30 = lay("V32-CUT30", [
  { kind: "promo", a: 0, b: P.monFrom },
  { kind: "beat", shot: S.checkout }, { kind: "beat", shot: S.placed },
  { kind: "live", src: "v3/clips/salma-169-t1.mp4", start: 0.4, line: "New orders, first thing" },
  { kind: "promo", a: P.monFrom, b: P.endFrom },
  { kind: "beat", shot: S.invoice }, { kind: "beat", shot: S.statement },
  { kind: "end", dur: 111, line: "The supplier behind great kitchens" }, // from frame 789 = beat 47 to 30.0 s
]);

// ═════════════ 6 s bumper: three chops, the chop is the tap, the end card ═════════════
export const BUMPER6 = lay("V32-BUMPER6", [
  { kind: "promo", a: 0, b: P.ui2From },
  { kind: "end", dur: 180 - P.ui2From, line: "The supplier behind great kitchens" },
], { bedFrom: P.tapA });

// ═════════════ 10 s loop: catalog → confirm → stamp → tape → van → SENT → (back to the catalog, seamless) ═════════════
export const LOOP_XF = 8;
export const LOOP10 = lay("V32-LOOP10", [{ kind: "promo", a: P.catFrom + LOOP_XF, b: P.endFrom }, { kind: "promo", a: P.catFrom, b: P.catFrom + LOOP_XF }], { loop: true, bedFrom: 0 });

// ═════════════ 1:1: the 20 s promo, letterboxed in the square, the end card full frame ═════════════
export const SQUARE = lay("V32-SQUARE", [{ kind: "promo", a: 0, b: P.endFrom }, { kind: "end", dur: PROMO_FRAMES - P.endFrom, line: "The supplier behind great kitchens" }], { w: 1080, h: 1080 });

// ═════════════ 15 s vertical 9:16, hook A ═════════════
// its own grid: hook A's snap on frame 45 is beat 0 (gv(k)); live 9:16 takes of Marco and the driver; the real phone
// catalog (390 px wide capture, native density at full width); Salma's monitor cropped from the 2x composite
export const VSNAP = 45;
export const gv = (k: number) => Math.round(VSNAP + k * BEAT);
export const VERT = { phoneA: gv(3), phoneB: gv(6), mon: gv(9), confirm: gv(10), sent: gv(12), sentAt: gv(13), end: gv(16), frames: 450 };
export const VERTICAL15: Cut = {
  id: "V32-VERTICAL15", w: 1080, h: 1920, frames: VERT.frames, bedFrom: VSNAP,
  segs: [
    { kind: "live", from: 0, dur: VERT.phoneA, src: "v3/clips/v/marco-916.mp4", start: 0, line: "One more text", vertical: true },
    { kind: "card", from: VERT.phoneA, dur: VERT.phoneB - VERT.phoneA, line: "v-phone-scroll" },
    { kind: "card", from: VERT.phoneB, dur: VERT.mon - VERT.phoneB, line: "v-phone-tap" },
    { kind: "live", from: VERT.mon, dur: VERT.sent - VERT.mon, src: "v3/clips/f2/monitor-confirmed-2x.mp4", start: 1.0, vertical: true },
    { kind: "live", from: VERT.sent, dur: VERT.end - VERT.sent, src: "v3/clips/v/driver-916.mp4", start: 1.35, vertical: true },
    { kind: "end", from: VERT.end, dur: VERT.frames - VERT.end, line: "The supplier behind great kitchens" },
  ],
};
// the vertical's phone shots are drawn by Cuts.tsx (VPhone): the real 390 px phone capture at full width
export const V_PHONE_TAP = lb(2); // "Add to cart" → "1 in cart" on beat 2 of the second phone shot
export const CUTS = { HERO60, CUT30, BUMPER6, LOOP10, SQUARE, VERTICAL15 };

// ——— sound ———
type Ev = { f: number; sfx: string; vel: number; pan?: number; pitch?: number; dur?: number; sweep?: number[]; note: string };
const PROMO_EV = () => promoEvents().filter((e) => !e.note.startsWith("pulse"));
export function cutEvents(c: Cut, extra: (c: Cut) => Ev[] = () => []): Ev[] {
  const ev: Ev[] = [];
  let endFrom = c.frames;
  for (const s of c.segs) {
    if (s.kind === "promo") {
      for (const e of PROMO_EV()) if (e.f >= s.a && e.f < s.a + s.dur) ev.push({ ...e, f: e.f - s.a + s.from });
    } else if (s.kind === "beat" && s.shot) {
      if (s.whipIn) ev.push({ f: s.from, sfx: "whip", vel: 0.4, note: "whip in" }); else ev.push({ f: s.from, sfx: "whip", vel: 0.4, note: "cut in on the beat" });
      ev.push({ f: s.from + 2, sfx: "glide", vel: 0.22, dur: 12, sweep: [-0.3, 0.3], note: "speed ramp onto the target" });
      for (const k of s.shot.cursor ?? []) if (k.press) ev.push({ f: s.from + k.f, sfx: "tap", vel: 0.85, note: "tap" });
      const st = typeof s.shot.plate === "string" ? [] : s.shot.plate;
      for (const p of st.slice(1)) ev.push({ f: s.from + p[0] + 1, sfx: "snaplock", vel: 0.45, note: "the page updates (real after-tap capture)" });
      if (s.shot.type?.length) ev.push({ f: s.from + lb(1) + 2, sfx: "pluck", vel: 0.45, note: "kinetic line" });
    } else if (s.kind === "live" && s.src.includes("marco-916")) {
      // the vertical hook is hook A on its own 90-frame timing (snap on frame 45): its own events
      ev.push(...hookA().filter((e) => !e.note.startsWith("pulse")).map((e) => ({ ...e, f: e.f + s.from })).filter((e) => e.f < s.from + s.dur));
    } else if (s.kind === "live" && !s.src.includes("monitor") && !s.src.includes("driver-916")) {
      ev.push({ f: s.from, sfx: "whip", vel: 0.35, note: "cut to live action" });
      if (s.line) ev.push({ f: s.from + lb(1), sfx: "pluck", vel: 0.6, note: `line: ${s.line}` });
    } else if (s.kind === "card" && s.line === "v-phone-scroll") {
      ev.push({ f: s.from, sfx: "whip", vel: 0.4, note: "cut to the phone" }, { f: s.from + 2, sfx: "glide", vel: 0.3, dur: 12, sweep: [0, 0], note: "fast scroll through the catalog photos" });
    } else if (s.kind === "card" && s.line === "v-phone-tap") {
      ev.push({ f: s.from, sfx: "whip", vel: 0.3, note: "scroll back to the first card" }, { f: s.from + V_PHONE_TAP, sfx: "tap", vel: 0.85, note: "thumb: Add to cart" }, { f: s.from + V_PHONE_TAP + 1, sfx: "snaplock", vel: 0.45, note: "1 in cart" });
    } else if (s.kind === "live" && s.src.includes("monitor")) {
      ev.push({ f: s.from, sfx: "whip", vel: 0.35, note: "cut to Salma's monitor" }, { f: VERT.confirm, sfx: "click", vel: 0.85, note: "Salma clicks Confirm order" }, { f: VERT.confirm + 1, sfx: "snaplock", vel: 0.5, note: "screen: Confirmed" });
    } else if (s.kind === "live" && s.src.includes("driver-916")) {
      ev.push({ f: s.from, sfx: "whip", vel: 0.35, note: "cut to the van" }, { f: VERT.sentAt, sfx: "box", vel: 0.95, note: "the van door slams" }, { f: VERT.sentAt, sfx: "door", vel: 0.7, note: "door latch" }, { f: VERT.sentAt + 1, sfx: "stamp_big", vel: 1.0, note: "SENT" });
    } else if (s.kind === "card") {
      ev.push({ f: s.from, sfx: "whip", vel: 0.4, note: "to the card" }, { f: s.from + 4, sfx: "pluck", vel: 0.6, note: "card line" }, { f: s.from + s.dur - 6, sfx: "whoosh", vel: 0.3, dur: 6, sweep: [0.5, -0.5], note: "out of the card" });
    } else if (s.kind === "end") {
      endFrom = s.from;
      ev.push({ f: s.from, sfx: "pop", vel: 0.45, note: "logo lands" }, { f: s.from + 1, sfx: "bell", vel: 0.5, note: "end card" }, { f: s.from + 21, sfx: "pop", vel: 0.3, pitch: 2, note: "button" }, { f: s.from + 29, sfx: "tick", vel: 0.25, pitch: 3, note: "address" }, { f: s.from + 42, sfx: "tick", vel: 0.2, pitch: 5, note: "button answers the beat" }, { f: s.from + 54, sfx: "tick", vel: 0.18, pitch: 7, note: "button answers the beat" });
    }
  }
  ev.push(...extra(c));
  // the story pulse over the whole cut: from the bed's start (the hook's snap) to the end card
  const busy = new Set(ev.map((e) => e.f));
  const origin = c.id === "V32-VERTICAL15" ? VSNAP : 6;
  for (let k = 0; ; k++) {
    const f = Math.round(origin + k * BEAT);
    if (f >= endFrom) break;
    if (f < c.bedFrom) continue;
    ev.push({ f, sfx: "box", vel: busy.has(f) ? 0.22 : k % 4 === 0 ? 0.5 : 0.36, note: `pulse beat ${k} (box thud)` });
    const off = Math.round(origin + (k + 0.5) * BEAT);
    if (off < endFrom) ev.push({ f: off, sfx: "chop", vel: 0.2, pan: -0.15, note: `pulse off-beat ${k} (chop)` });
  }
  return ev.filter((e) => e.f >= 0 && e.f < c.frames).sort((a, b) => a.f - b.f);
}
export { g, PROMO_FRAMES };

// per-cut exports for v3.mjs audio (events function + frame count)
export const evHERO60 = () => cutEvents(HERO60);
export const evCUT30 = () => cutEvents(CUT30);
export const evBUMPER6 = () => cutEvents(BUMPER6);
export const evLOOP10 = () => cutEvents(LOOP10);
export const evSQUARE = () => cutEvents(SQUARE);
export const evVERTICAL15 = () => cutEvents(VERTICAL15);
export const FR_HERO60 = HERO60.frames, FR_CUT30 = CUT30.frames, FR_BUMPER6 = BUMPER6.frames, FR_LOOP10 = LOOP10.frames, FR_SQUARE = SQUARE.frames, FR_VERTICAL15 = VERTICAL15.frames;
