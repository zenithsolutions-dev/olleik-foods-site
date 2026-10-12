/**
 * V3 camera engine: "one page, one world" (docs/qa/2026-10-08-videos/CREATIVE_BRIEF_V3.md §2, MOTION_NOTES.md).
 *
 * A WORLD is one full-page capture of a real screen (CSS-pixel coordinates, captured at NATIVE density 3x).
 * The CAMERA travels over it continuously: keyframes {f, cx, cy, z} (centre in page CSS px, zoom relative to the
 * full-width framing). Between keyframes the move is eased; zoom is interpolated in log space. A tap never cuts the
 * camera; it patches only the changed region in the shot (World.tsx).
 *
 * Hard rules, enforced by validateCamera() (a failing check throws at render time, so a bad move cannot ship):
 *   1. zoom ≤ MAX_ZOOM (1.6x of the full-width framing)
 *   2. never above native density: output px per page CSS px ≤ NATIVE (3), so the UI never blurs or distorts
 *   3. the view never leaves the page (no empty margins)
 *   4. at least one structural anchor (nav / title / search / cart …) is ≥ 60% inside the frame on EVERY frame
 *
 * Parallax (2.5D): a layer of depth p with a home point is displaced by (camera − home) × p in page space. Since the
 * owner notes V3.1, the UI itself has NO parallax (cards lifted off the page read as pasted-on): only kinetic type
 * floats (0.07). The page and the pointer are depth 0, so every pixel of the UI is the real capture, in place.
 */
import { Easing } from "remotion";

export const NATIVE = 3;
export const MAX_ZOOM = 1.6;
export const OUT_W = 1920;
export const OUT_H = 1080;
export const FPS = 30;
export const DEPTH = { plate: 0, card: 0.035, chip: 0.07, cursor: 0.12 } as const;

export type Box = { x: number; y: number; w: number; h: number };
export type World = {
  id: string;
  w: number; // page width, CSS px
  h: number; // page height, CSS px
  frameW?: number; // CSS width that fills the frame at z = 1 (default: the page width)
  boxes: Record<string, Box>;
  anchors: string[]; // box names that count as structural anchors
  /** Boxes that must NEVER be visible (placeholder business details on documents, fake hero stats, a generated invite
   * URL, the public footer's placeholder phone). Checked on every frame; the caption band counts as covering. */
  forbid?: string[];
};
export type Ease = "arrive" | "inout" | "linear" | "glide" | "snap" | "expo";
export type Key = { f: number; cx: number; cy: number; z: number; ease?: Ease; eye?: string };
export type Cam = { cx: number; cy: number; z: number; s: number; vw: number; vh: number };

const EASES: Record<Ease, (t: number) => number> = {
  arrive: Easing.bezier(0.16, 1, 0.3, 1), // fast start, long settle (speed ramp into a hold)
  inout: Easing.bezier(0.65, 0, 0.35, 1), // symmetric travel between regions
  glide: Easing.bezier(0.45, 0, 0.2, 1), // gentle start, soft landing
  linear: (t) => t,
  snap: Easing.bezier(0.7, 0, 0.1, 1), // speed ramp: holds back, whips across, lands hard (V3.1 rhythm)
  expo: Easing.bezier(0.9, 0, 0.1, 1), // the fastest ramp: near-cut speed in the middle, soft both ends
};

/** Output pixels per page CSS pixel at zoom z. */
export const scaleAt = (world: World, z: number) => (OUT_W / (world.frameW ?? world.w)) * z;

export function cameraAt(world: World, keys: Key[], f: number): Cam {
  let a = keys[0];
  let b = keys[keys.length - 1];
  if (f <= a.f) b = a;
  else if (f >= b.f) a = b;
  else for (let i = 0; i < keys.length - 1; i++) if (f >= keys[i].f && f <= keys[i + 1].f) { a = keys[i]; b = keys[i + 1]; break; }
  const t = a === b ? 0 : EASES[b.ease ?? "inout"]((f - a.f) / (b.f - a.f));
  const z = Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * t);
  const s = scaleAt(world, z);
  const vw = OUT_W / s;
  const vh = OUT_H / s;
  // Keep the view inside the page.
  const cx = Math.min(Math.max(a.cx + (b.cx - a.cx) * t, vw / 2), world.w - vw / 2);
  const cy = Math.min(Math.max(a.cy + (b.cy - a.cy) * t, vh / 2), Math.max(vh / 2, world.h - vh / 2));
  return { cx, cy, z, s, vw, vh };
}

/** Screen-space speed of the camera in output px per frame (for motion blur sample count). */
export function speedAt(world: World, keys: Key[], f: number) {
  const a = cameraAt(world, keys, f - 0.5);
  const b = cameraAt(world, keys, f + 0.5);
  const pan = Math.hypot((b.cx - a.cx) * b.s, (b.cy - a.cy) * b.s);
  const zoom = Math.abs(b.s - a.s) / b.s * OUT_W * 0.5; // edge displacement from scale change
  return pan + zoom;
}

/** Page point → screen point for a layer of depth p with home (hx, hy). */
export function project(cam: Cam, x: number, y: number, p = 0, hx = cam.cx, hy = cam.cy) {
  const ox = -(cam.cx - hx) * p;
  const oy = -(cam.cy - hy) * p;
  return { x: (x + ox - cam.cx) * cam.s + OUT_W / 2, y: (y + oy - cam.cy) * cam.s + OUT_H / 2 };
}

export const insideFraction = (cam: Cam, b: Box) => {
  const l = cam.cx - cam.vw / 2, t = cam.cy - cam.vh / 2;
  const ix = Math.max(0, Math.min(b.x + b.w, l + cam.vw) - Math.max(b.x, l));
  const iy = Math.max(0, Math.min(b.y + b.h, t + cam.vh) - Math.max(b.y, t));
  return (ix * iy) / (b.w * b.h);
};

/** Fraction of box b inside the VISIBLE part of the frame (the bottom `coveredPx` output pixels are a caption band). */
export const visibleFraction = (cam: Cam, b: Box, coveredPx = 0) => {
  const l = cam.cx - cam.vw / 2, t = cam.cy - cam.vh / 2;
  const vis = cam.vh - coveredPx / cam.s;
  const ix = Math.max(0, Math.min(b.x + b.w, l + cam.vw) - Math.max(b.x, l));
  const iy = Math.max(0, Math.min(b.y + b.h, t + vis) - Math.max(b.y, t));
  return (ix * iy) / (b.w * b.h);
};

export function validateCamera(world: World, keys: Key[], frames: number, coveredPx = 0) {
  const errors: string[] = [];
  for (const name of world.forbid ?? []) if (!world.boxes[name]) errors.push(`${world.id}: forbidden box ${name} is not measured`);
  for (let f = 0; f < frames; f++) {
    const c = cameraAt(world, keys, f);
    for (const name of world.forbid ?? []) {
      const b = world.boxes[name];
      if (b && visibleFraction(c, b, coveredPx) > 0) { errors.push(`${world.id} frame ${f}: forbidden ${name} visible (${(visibleFraction(c, b, coveredPx) * 100).toFixed(1)}%)`); f = frames; break; }
    }
  }
  for (const k of keys) {
    if (k.z > MAX_ZOOM + 1e-6) errors.push(`key f${k.f}: zoom ${k.z} > ${MAX_ZOOM}`);
    if (scaleAt(world, k.z) > NATIVE + 1e-6) errors.push(`key f${k.f}: ${scaleAt(world, k.z).toFixed(2)} px/CSS px > native ${NATIVE}`);
    if (k.eye && world.boxes[k.eye]) {
      const c = cameraAt(world, keys, k.f);
      if (insideFraction(c, world.boxes[k.eye]) < 0.95) errors.push(`key f${k.f}: eye target ${k.eye} not in frame at arrival`);
    }
  }
  for (let f = 0; f < frames; f++) {
    const c = cameraAt(world, keys, f);
    const best = Math.max(0, ...world.anchors.filter((a) => world.boxes[a]).map((a) => insideFraction(c, world.boxes[a])));
    if (best < 0.6) { errors.push(`${world.id} frame ${f}: no structural anchor in frame (best ${(best * 100).toFixed(0)}%)`); break; }
  }
  if (errors.length) throw new Error("camera rules violated:\n" + errors.join("\n"));
  return true;
}

/** Shutter samples for camera motion blur (180°: half a frame, centred). 1 sample when still, up to 14 at speed. */
export function shutterSamples(speedPx: number) {
  const n = Math.max(1, Math.min(14, Math.ceil(speedPx / 1.5)));
  if (n === 1) return [0];
  return Array.from({ length: n }, (_, i) => (i / (n - 1) - 0.5) * 0.5);
}

/** 108 BPM grid helpers (one beat = 16.667 frames at 30 fps). */
export const BPM = 108;
export const BEAT = (FPS * 60) / BPM;
export const onBeat = (beat: number) => Math.round(beat * BEAT);
