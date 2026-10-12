/** Sound events for the 20 s promo proof, Gate F V3.1 (mix_v2 format). Rhythm-led: every hit sits on the 108 BPM grid
 * of promoTiming.ts (origin frame 6, the first chop). The story-sound pulse (box thud on the beat, knife chop on the
 * off-beat) runs from hook A's snap to the end card; music bed C sits under it in the music version. */
import { hookA } from "./hookEvents";
import { g, P, PROMO_FRAMES } from "./promoTiming";

type Ev = { f: number; sfx: string; vel: number; pan?: number; pitch?: number; dur?: number; sweep?: number[]; note: string };
export { PROMO_FRAMES };
export const promoEvents = (): Ev[] => {
  const ev: Ev[] = [];
  const add = (f: number, sfx: string, vel: number, note: string, x: Partial<Ev> = {}) => ev.push({ f, sfx, vel, note, ...x });
  // D: three chops (no UI), then each chop is a tap
  P.chops.forEach((f, i) => add(f, "chop", 0.85, `chop ${i + 1} (picture re-timed onto the beat)`, { pan: -0.25 }));
  add(P.ui1From, "whip", 0.35, "match cut: knife → catalog", { sweep: [-0.4, 0.4] });
  add(P.tapA, "chop", 0.6, "the chop is the tap (off-screen knife)", { pan: -0.3 });
  add(P.tapA, "tap", 0.85, "tap: Add to cart (cheddar)", { pan: -0.2 });
  add(P.tapA + 1, "snaplock", 0.45, "button becomes 1 in cart", { pan: -0.2 });
  add(P.chop2From, "whip", 0.3, "cut back to the knife", { sweep: [0.4, -0.4] });
  add(P.chop4, "chop", 0.85, "chop 4", { pan: -0.25 });
  add(P.ui2From, "whip", 0.35, "match cut: knife → catalog", { sweep: [-0.4, 0.4] });
  add(P.tapB, "chop", 0.6, "the chop is the tap (off-screen knife)", { pan: -0.3 });
  add(P.tapB, "tap", 0.85, "tap: Add to cart (salmon)", { pan: 0.05 });
  add(P.tapB + 1, "snaplock", 0.45, "button becomes 1 in cart", { pan: 0.05 });
  // A: the 11:04 PM text (its own events, shifted)
  ev.push(...hookA().filter((e) => !e.note.startsWith("pulse")).map((e) => ({ ...e, f: e.f + P.aFrom })).filter((e) => e.f < P.phoneFrom));
  add(P.aPunch, "whoosh", 0.25, "punch-in on Marco's thumb", { dur: 6, sweep: [0, 0] });
  // the phone
  add(P.phoneFrom, "whip", 0.3, "cut to Marco's phone", { sweep: [0.3, -0.3] });
  add(P.phonePunch, "tick", 0.3, "punch-in", { pitch: 2 });
  add(P.phoneTap, "tap", 0.9, "Marco's thumb: Add to cart", { pan: 0.25 });
  add(P.phoneTap + 1, "snaplock", 0.45, "phone: 1 in cart", { pan: 0.25 });
  add(P.pushFrom, "whoosh", 0.55, "push through the screen", { dur: 17, sweep: [0, 0] });
  // the desktop catalog
  add(P.catFrom, "whip", 0.4, "match cut: phone 1 in cart → desktop 1 in cart");
  add(P.catFrom + 2, "glide", 0.22, "camera pulls back", { dur: 14, sweep: [-0.3, 0.3] });
  for (const [f, pan, n] of [[P.tap1, 0.0, "salmon"], [P.tap2, 0.25, "chicken"]] as [number, number, string][]) {
    add(f, "tap", 0.85, `tap: Add to cart (${n})`, { pan });
    add(f + 1, "snaplock", 0.45, "button becomes 1 in cart", { pan });
  }
  add(P.cart3, "pop", 0.7, "cart shows 3", { pan: 0.45, pitch: 4 });
  add(P.cart3, "chime", 0.35, "Three taps", { pan: 0.3 });
  add(P.monFrom - 7, "whoosh", 0.5, "whip pan: catalog → warehouse", { dur: 14, sweep: [0.7, -0.7] });
  // the warehouse
  add(P.monPunch, "tick", 0.3, "punch-in on Confirm", { pitch: 1 });
  add(P.confirm, "click", 0.85, "Salma clicks Confirm order", { pan: 0.2 });
  add(P.confirm + 1, "snaplock", 0.5, "screen: Confirmed", { pan: 0.2 });
  add(P.strike, "stamp_big", 0.95, "the stamp strikes the slip");
  add(P.tapeFrom + 2, "tapeRip", 0.6, "tape pulled across the box");
  add(P.pat, "box", 0.75, "flat hand pats the sealed box");
  add(P.slam, "box", 0.95, "the van door slams (body)");
  add(P.slam, "door", 0.7, "the van door latch");
  add(P.sent, "stamp_big", 1.0, "SENT");
  add(P.logo, "pop", 0.45, "logo lands");
  add(P.logo + 1, "bell", 0.5, "end card");
  add(P.endFrom + 21, "pop", 0.3, "button", { pitch: 2 });
  add(P.endFrom + 29, "tick", 0.25, "address", { pitch: 3 });
  add(P.endFrom + 42, "tick", 0.2, "button answers the beat", { pitch: 5 });
  add(P.endFrom + 54, "tick", 0.18, "button answers the beat", { pitch: 7 });
  // the pulse: from hook A's snap (beat 8) to the beat before the end card
  const busy = new Set(ev.map((e) => e.f));
  for (let k = 8; g(k) < P.endFrom; k++) {
    const f = g(k);
    add(f, "box", busy.has(f) ? 0.22 : k % 4 === 0 ? 0.5 : 0.36, `pulse beat ${k} (box thud)`);
    const off = Math.round(6 + (k + 0.5) * (1800 / 108));
    if (off < P.endFrom) add(off, "chop", 0.2, `pulse off-beat ${k} (chop)`, { pan: -0.15 });
  }
  return ev.filter((e) => e.f >= 0 && e.f < PROMO_FRAMES).sort((a, b) => a.f - b.f);
};
