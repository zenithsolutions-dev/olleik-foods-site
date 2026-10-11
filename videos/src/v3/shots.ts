import manifest from "../../public/footage/manifest.json";
import { Box, Key, onBeat, validateCamera, World } from "./camera";
import type { WorldShot } from "./World";

/** Boxes of a capture (page coordinates, full-page shot at scrollY 0). */
const boxesOf = (key: string): Record<string, Box> => {
  const raw = (manifest as { shots: Record<string, { boxes: Record<string, { x: number; y: number; w?: number; width?: number; h?: number; height?: number } | null> }> }).shots[key].boxes;
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => v).map(([k, v]) => [k, { x: v!.x, y: v!.y, w: v!.w ?? v!.width ?? 0, h: v!.h ?? v!.height ?? 0 }]));
};

// ——— Catalog world (portal "My catalog", desktop, 1440 × 3095 CSS px, real product photos) ———
const b0 = boxesOf("v3/catalog-0");
const b3 = boxesOf("v3/catalog-3");
const BTN_Y = [701, 720, 701]; // card 1 carries an extra offer line, so its button sits 19 px lower
const btn = (i: number): Box => ({ x: b3[`card${i}`].x + 16, y: BTN_Y[i], w: b3[`card${i}`].w - 32, h: 48 }); // button / "1 in cart" row
const catalogBoxes: Record<string, Box> = {
  ...b0,
  card0: b3.card0, card1: b3.card1, card2: b3.card2, // row 1 grows 2px once a card shows its stepper
  btn0: btn(0), btn1: btn(1), btn2: btn(2),
  cartWide: { x: 1158, y: 64, w: 118, h: 52 }, // cart link incl. the badge (the link widens leftwards when a badge appears)
  tagline: { x: 420, y: 162, w: 420, h: 34 },
};
export const CATALOG: World = { id: "catalog", w: 1440, h: 3095, boxes: catalogBoxes, anchors: ["nav", "headline", "search", "cart"] };

// 108 BPM grid: taps on beats 4, 8, 12; the cart badge lands on beat 14.
export const TAPS = [onBeat(4), onBeat(8), onBeat(12)];
export const BADGE_LAND = onBeat(14);
export const CAMERA_TEST_FRAMES = 300;

const keys: Key[] = [
  { f: 0, cx: 720, cy: 405, z: 1.0 },
  { f: 8, cx: 716, cy: 410, z: 1.01, ease: "linear" },
  { f: 52, cx: 560, cy: 470, z: 1.3, ease: "glide", eye: "card0" },
  { f: TAPS[0] + 3, cx: 572, cy: 470, z: 1.31, ease: "linear" },
  { f: 122, cx: 845, cy: 470, z: 1.3, ease: "inout", eye: "card1" },
  { f: TAPS[1] + 3, cx: 852, cy: 470, z: 1.31, ease: "linear" },
  { f: 188, cx: 886, cy: 470, z: 1.3, ease: "inout", eye: "card2" },
  { f: TAPS[2] + 4, cx: 886, cy: 466, z: 1.31, ease: "linear" },
  { f: 238, cx: 850, cy: 360, z: 1.18, ease: "glide", eye: "cartWide" },
  { f: 286, cx: 720, cy: 405, z: 1.0, ease: "glide" },
  { f: 300, cx: 720, cy: 402, z: 1.004, ease: "linear" },
];
validateCamera(CATALOG, keys, CAMERA_TEST_FRAMES);

const cursor = [
  { f: 0, x: 1330, y: 980 },
  { f: 58, x: btn(0).x + btn(0).w / 2 + 6, y: 726 },
  { f: TAPS[0], x: btn(0).x + btn(0).w / 2 + 6, y: 726, press: true },
  { f: 74, x: btn(0).x + btn(0).w / 2 + 10, y: 730 },
  { f: 125, x: btn(1).x + btn(1).w / 2 + 6, y: 745 },
  { f: TAPS[1], x: btn(1).x + btn(1).w / 2 + 6, y: 745, press: true },
  { f: 140, x: btn(1).x + btn(1).w / 2 + 10, y: 749 },
  { f: 192, x: btn(2).x + btn(2).w / 2 + 6, y: 726 },
  { f: TAPS[2], x: btn(2).x + btn(2).w / 2 + 6, y: 726, press: true },
  { f: 207, x: btn(2).x + btn(2).w / 2 + 10, y: 730 },
  { f: 245, x: 1236, y: 132 },
  { f: 300, x: 1240, y: 136 },
];

export const CAMERA_TEST: WorldShot = {
  world: CATALOG,
  plate: "v3/catalog-bg",
  keys,
  radius: 16,
  cards: [
    { box: "card0", states: [[0, "v3/catalog-0"], [TAPS[0], "v3/catalog-1"]] },
    { box: "card1", states: [[0, "v3/catalog-0"], [TAPS[1], "v3/catalog-2"]] },
    { box: "card2", states: [[0, "v3/catalog-0"], [TAPS[2], "v3/catalog-3"]] },
    ...[3, 4, 5, 6, 7, 8].map((i) => ({ box: `card${i}`, states: [[0, "v3/catalog-0"]] as [number, string][] })),
  ],
  patches: [
    { box: "btn0", f: TAPS[0], from: "v3/catalog-0", to: "v3/catalog-1", kind: "press", radius: 22 },
    { box: "btn1", f: TAPS[1], from: "v3/catalog-1", to: "v3/catalog-2", kind: "press", radius: 22 },
    { box: "btn2", f: TAPS[2], from: "v3/catalog-2", to: "v3/catalog-3", kind: "press", radius: 22 },
    { box: "cartWide", f: TAPS[0] + 6, from: "v3/catalog-0", to: "v3/catalog-1", kind: "bump" },
    { box: "cartWide", f: TAPS[1] + 6, from: "v3/catalog-1", to: "v3/catalog-2", kind: "bump" },
    { box: "cartWide", f: BADGE_LAND, from: "v3/catalog-2", to: "v3/catalog-3", kind: "bump" },
  ],
  cursor,
  type: [{ text: "Your catalog. Your prices.", box: "tagline", dx: 0, dy: 0, from: 10, to: 60, size: 26 }],
};

/** Sound events for the camera test (audio/mix_v2.py format). Every reaction sits on the 108 BPM grid. */
export const cameraTestEvents = () => {
  const ev: { f: number; sfx: string; vel: number; pan?: number; pitch?: number; dur?: number; sweep?: number[]; note: string }[] = [];
  const panOf = (x: number) => Math.max(-0.6, Math.min(0.6, (x - 720) / 900));
  TAPS.forEach((f, i) => {
    ev.push({ f, sfx: "tap", vel: 0.85, pan: panOf(btn(i).x + btn(i).w / 2), note: `tap ${i + 1} on Add to cart` });
    ev.push({ f: f + 1, sfx: "snaplock", vel: 0.45, pan: panOf(btn(i).x + btn(i).w / 2), note: `button becomes "1 in cart"` });
  });
  [TAPS[0] + 6, TAPS[1] + 6].forEach((f, i) => ev.push({ f, sfx: "pop", vel: 0.22, pan: 0.5, pitch: i * 2, note: `cart badge ${i + 1} (off-frame, soft)` }));
  ev.push({ f: BADGE_LAND, sfx: "pop", vel: 0.7, pan: 0.45, pitch: 4, note: "cart badge 3 lands in frame" });
  ev.push({ f: BADGE_LAND, sfx: "chime", vel: 0.35, pan: 0.3, note: "result lands" });
  // camera travel (glides, no cuts)
  [[10, 40], [TAPS[0] + 4, 50], [TAPS[1] + 4, 50], [TAPS[2] + 5, 30], [240, 44]].forEach(([f, d], i) => ev.push({ f, sfx: "glide", vel: 0.22, dur: d, sweep: i % 2 ? [-0.3, 0.3] : [0.3, -0.3], note: "camera glide" }));
  // percussive pulse from story sounds on the grid: soft knife-on-board on every beat before the first tap, then the taps carry it
  for (let b = 0; b < 4; b++) ev.push({ f: onBeat(b), sfx: "chop", vel: b === 0 ? 0.5 : 0.3, pan: -0.2, note: `pulse beat ${b} (chop)` });
  for (let b = 5; b < 18; b++) if (![8, 12, 14].includes(b)) ev.push({ f: onBeat(b), sfx: "tick", vel: b % 4 === 0 ? 0.32 : 0.18, note: `pulse beat ${b}` });
  return ev.sort((a, b) => a.f - b.f);
};
