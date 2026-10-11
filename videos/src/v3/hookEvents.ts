/**
 * Sound events for the five hook tests (audio/mix_v2.py format, frames at 30 fps). No remotion imports, so v3.mjs can
 * bundle this for node. Every hook: one sound + one picture for the first 1.5 s, then the snap (frame 45) starts the
 * 108 BPM pulse built from story sounds (box thud on the beat, knife chop on the off-beat).
 */
type Ev = { f: number; sfx: string; vel: number; pan?: number; pitch?: number; dur?: number; sweep?: number[]; note: string };
export const HOOK_TEST_FRAMES = 90;
const SNAP = 45;
const BEAT = 1800 / 108;
const pulse = (from = SNAP, to = 90): Ev[] => {
  const ev: Ev[] = [];
  for (let k = 0; from + k * BEAT < to - 2; k++) {
    ev.push({ f: Math.round(from + k * BEAT), sfx: "box", vel: k === 0 ? 0.85 : 0.55, note: `pulse beat ${k} (box thud)` });
    const off = Math.round(from + (k + 0.5) * BEAT);
    if (off < to - 2) ev.push({ f: off, sfx: "chop", vel: 0.28, pan: -0.15, note: `pulse off-beat ${k} (chop)` });
  }
  return ev;
};
const sort = (ev: Ev[]) => ev.sort((a, b) => a.f - b.f);

export const hookA = () => sort([
  { f: 1, sfx: "buzz", vel: 0.8, dur: 20, note: "phone buzz on the counter" },
  ...Array.from({ length: 8 }, (_, i) => ({ f: 4 + i * 5, sfx: "notif", vel: 0.18 + 0.03 * i, pan: 0.35, pitch: i % 3, note: `message ${i + 1}` })),
  { f: 24, sfx: "buzz", vel: 0.55, dur: 14, note: "buzz again" },
  { f: SNAP, sfx: "tap", vel: 0.9, note: "the thumb taps: snap" },
  { f: SNAP + 4, sfx: "whoosh", vel: 0.3, dur: 8, sweep: [0.3, -0.3], note: "screen light floods" },
  ...pulse(SNAP + Math.round(BEAT)),
]);

export const hookB = () => {
  const ev: Ev[] = [];
  const TARGET = 48;
  let last = -1;
  for (let f = 0; f < SNAP; f++) {
    const r = Math.floor(TARGET * (1 - Math.pow(1 - f / SNAP, 3)));
    if (r !== last && f - (ev[ev.length - 1]?.f ?? -9) >= 1) ev.push({ f, sfx: "tick", vel: 0.25 + 0.4 * (f / SNAP), pan: 0.4, pitch: -2, note: "reel ratchet" });
    last = r;
  }
  ev.push({ f: SNAP, sfx: "snaplock", vel: 0.9, pan: 0.4, note: "reel locks on your price: snap" });
  ev.push({ f: SNAP, sfx: "chime", vel: 0.35, note: "lock" });
  ev.push({ f: 51, sfx: "pop", vel: 0.45, note: "becomes the real catalog card" });
  return sort([...ev, ...pulse(SNAP + Math.round(BEAT))]);
};

export const hookC = () => sort([
  ...[0, 4, 9, 13, 18, 22, 27, 31, 36].map((f, i) => ({ f, sfx: "flip", vel: 0.3 + (i % 3) * 0.1, pan: ((i * 37) % 10) / 10 - 0.5, pitch: i % 4, note: "paper flutter" })),
  { f: 42, sfx: "slide", vel: 0.6, note: "hero slip skids flat" },
  { f: SNAP, sfx: "tap", vel: 0.85, note: "slip lands: snap" },
  { f: SNAP + 2, sfx: "whoosh", vel: 0.3, dur: 10, sweep: [0, 0], note: "slip becomes the order screen" },
  { f: 62, sfx: "chime", vel: 0.35, note: "Order received" },
  ...pulse(SNAP + Math.round(BEAT)),
]);

const BEATS_D = [11, 27, 51, 66, 90, 106].map((_, k) => 6 + k * BEAT);
export const hookD = () => sort([
  ...BEATS_D.filter((b) => b < 88).map((b, k) => ({ f: Math.round(b), sfx: "chop", vel: 0.85, pan: -0.25, note: `chop ${k + 1} (picture re-timed onto the beat)` })),
  ...BEATS_D.filter((b) => b > SNAP && b < 88).flatMap((b, i) => [
    { f: Math.round(b) + 1, sfx: "snaplock", vel: 0.5, pan: 0.45, note: `card ${i + 1} drops into the cart` },
    { f: Math.round(b) + 2, sfx: "pop", vel: 0.45, pan: 0.6, pitch: i * 2, note: `cart badge ${i + 1}` },
  ]),
  ...BEATS_D.filter((b) => b > SNAP && b < 88).map((b, k) => ({ f: Math.round(b), sfx: "box", vel: 0.5, note: `pulse beat ${k} (box thud under the chop)` })),
]);

export const hookE = () => sort([
  ...[2, 11, 19, 28, 36].map((f, i) => ({ f, sfx: "flip", vel: 0.18 + 0.05 * i, pan: (i % 2 ? 0.4 : -0.4), note: "notes flutter" })),
  { f: SNAP, sfx: "tapeRip", vel: 0.8, note: "the wall peels: snap" },
  { f: SNAP + 6, sfx: "tear", vel: 0.45, pan: 0.3, note: "peel wave" },
  { f: SNAP + 12, sfx: "whoosh", vel: 0.35, dur: 12, sweep: [-0.5, 0.5], note: "notes fall away" },
  { f: 72, sfx: "chime", vel: 0.35, note: "the catalog is there" },
  ...pulse(SNAP + Math.round(BEAT)),
]);
