/** Sound events for the 20 s promo proof (mix_v2 format). Rhythm-led: every reaction sits on the 108 BPM grid that the
 * first chop starts (origin frame 6); the story-sound pulse (box thud on the beat, knife chop on the off-beat) runs
 * from hook A's snap to the end card; music bed C (Higgsfield, conformed to 108 BPM) sits under it in the music version. */
import { hookA, hookD } from "./hookEvents";
import { BEAT, g, P, PROMO_FRAMES } from "./promoTiming";

type Ev = { f: number; sfx: string; vel: number; pan?: number; pitch?: number; dur?: number; sweep?: number[]; note: string };
export { PROMO_FRAMES };
export const promoEvents = (): Ev[] => {
  const ev: Ev[] = [];
  ev.push(...hookD().filter((e) => e.f < P.aFrom));
  ev.push(...hookA().filter((e) => !e.note.startsWith("pulse")).map((e) => ({ ...e, f: e.f + P.aFrom })).filter((e) => e.f < P.otsFrom));
  ev.push({ f: P.otsTap, sfx: "tap", vel: 0.85, pan: 0.25, note: "Marco's thumb: Add to cart (phone)" });
  ev.push({ f: P.otsTap + 1, sfx: "snaplock", vel: 0.45, pan: 0.25, note: "phone: 1 in cart" });
  ev.push({ f: P.pushFrom, sfx: "whoosh", vel: 0.55, dur: 16, sweep: [0, 0], note: "push through the screen" });
  ev.push({ f: P.catFrom, sfx: "whip", vel: 0.4, note: "match cut: phone card → catalog card" });
  ev.push({ f: P.catFrom + 4, sfx: "glide", vel: 0.2, dur: 22, sweep: [-0.3, 0.3], note: "camera pulls back" });
  for (const [f, pan, n] of [[P.tap1, 0.0, 2], [P.tap2, 0.25, 3]] as [number, number, number][]) {
    ev.push({ f, sfx: "tap", vel: 0.85, pan, note: `tap: Add to cart (${n})` });
    ev.push({ f: f + 1, sfx: "snaplock", vel: 0.45, pan, note: "button becomes 1 in cart" });
    ev.push({ f: f + 6, sfx: "pop", vel: n === 2 ? 0.28 : 0.3, pan: 0.5, pitch: n, note: `cart badge ${n}` });
  }
  ev.push({ f: P.badge, sfx: "pop", vel: 0.7, pan: 0.45, pitch: 4, note: "cart badge 3 lands" });
  ev.push({ f: P.badge, sfx: "chime", vel: 0.35, pan: 0.3, note: "Three taps." });
  ev.push({ f: P.slip, sfx: "printer", vel: 0.6, dur: 8, pan: 0.4, note: "the slip prints out of the cart (story prop)" });
  ev.push({ f: P.slip + 8, sfx: "whip", vel: 0.45, note: "slip shoots up: cut to the warehouse" });
  ev.push({ f: P.salmaFrom + 9, sfx: "slide", vel: 0.55, note: "the slip lands on Salma's bench" });
  ev.push({ f: P.stamp, sfx: "stamp_big", vel: 0.95, note: "stamp hits the slip = monitor flips to Confirmed" });
  ev.push({ f: P.driverFrom + 2, sfx: "box", vel: 0.6, note: "the driver squares the box" });
  ev.push({ f: P.sent, sfx: "stamp_big", vel: 1.0, note: "SENT" });
  ev.push({ f: P.morningFrom - 6, sfx: "whoosh", vel: 0.3, dur: 8, sweep: [0, 0], note: "light change: night to morning" });
  ev.push({ f: P.morning + 6, sfx: "mug", vel: 0.45, note: "coffee mug" });
  ev.push({ f: P.logo, sfx: "bell", vel: 0.55, note: "end card" });
  ev.push({ f: P.logo + 2, sfx: "pop", vel: 0.4, note: "logo lands" });
  // the pulse: from hook A's snap (beat 8) to the beat before the end card
  const busy = new Set(ev.map((e) => e.f));
  for (let k = 8; g(k) < P.endFrom; k++) {
    const f = g(k);
    ev.push({ f, sfx: "box", vel: busy.has(f) ? 0.25 : k % 4 === 0 ? 0.5 : 0.36, note: `pulse beat ${k} (box thud)` });
    const off = Math.round(6 + (k + 0.5) * BEAT);
    if (off < P.endFrom) ev.push({ f: off, sfx: "chop", vel: 0.2, pan: -0.15, note: `pulse off-beat ${k} (chop)` });
  }
  return ev.filter((e) => e.f >= 0 && e.f < PROMO_FRAMES).sort((a, b) => a.f - b.f);
};
