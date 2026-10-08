import type { Beat, Shot } from "./data/types";
import { clampCam, type CamKey, type Metric, type Rect, visibleAt } from "./camera";

/**
 * Highlights and camera for one beat (QA review 2026-09-28). Pure, shared by BeatScene and the check/review scripts.
 *
 * Highlight: `beat.ring` names boxes measured by the capture for EACH screenshot (footage/manifest.json). A ring is
 *   "name" (one box), "a+b" (the box around several, all measured on that screenshot), or an array of those (drawn
 *   separately). A ring is drawn only on the screenshots that measured it, at that screenshot's own position, and
 *   only after that screenshot has faded in. A box outside its screenshot is an error: the render stops.
 * Camera: opens wide (horizontal: the page's full width; vertical: the whole page), then eases in on the highlight
 *   itself (never its container), at most 1.35× (horizontal) or 1.5× (vertical), keeping the box at least 10 % of the
 *   view away from every side. If the box cannot fit that way at the widest allowed framing, that is an error too
 *   (the beat must ring a smaller child).
 */
export type Orientation = "horizontal" | "vertical";
export type RingSeg = { spec: string; rect: Rect; from: number; to: number; out: number };
export type Plan = {
  screens: { from: number; src: string }[];
  rings: RingSeg[];
  camera: CamKey[];
  metric: Metric;
  target: Rect | null;
  zTarget: number;
};

export const CAP = { horizontal: 1.35, vertical: 1.5 } as const;
/** Margin kept around the highlight, as a share of the view on each side. */
export const MARGIN = 0.1;
/** How far the drawn ring sits outside its box (screen px, a little more than HighlightRing's padding). */
export const RING_OUT = 12;
const FADE = 8;
/** The vertical cut never settles wider than this (text stays readable on a phone). */
export const VERTICAL_FLOOR = 0.9;

export const grow = (r: Rect, p: number): Rect => ({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p });
export const unionOf = (rs: Rect[]): Rect => {
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
};
const same = (a: Rect, b: Rect) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h)) <= 2;

/** The rings of a beat in a cut: the vertical cut may name a smaller child (ringVertical) when a box is wider than its view. */
export const ringSpecs = (beat: Beat, o: Orientation = "horizontal"): string[] => {
  const r = o === "vertical" && beat.ringVertical !== undefined ? beat.ringVertical : beat.ring;
  return r === undefined ? [] : Array.isArray(r) ? r : [r];
};

/** A ring spec's rect on one screenshot, or null when that screenshot did not measure it. */
export function ringRect(spec: string, shot: Shot): Rect | null {
  const parts = spec.split("+").map((n) => shot.boxes?.[n.trim()]);
  if (parts.some((p) => !p)) return null;
  return unionOf(parts as Rect[]);
}

/** When each screenshot of a beat comes in (frames): the later ones at 45 % … 80 % of the beat, as before. */
export const screenFroms = (n: number, duration: number) => Array.from({ length: n }, (_, i) => (i === 0 ? 0 : Math.round(duration * Math.min(0.8, 0.15 + 0.3 * i))));

export function metricFor(device: "desktop" | "phone", o: Orientation, view: { w: number; h: number }): Metric {
  const screen = device === "phone" ? { w: 390, h: 844 } : { w: 1440, h: 900 };
  if (device === "phone") return { base: view.w / screen.w, view, screen };
  if (o === "horizontal") return { base: view.w / screen.w, view, screen };
  return { base: view.h / screen.h, view, screen };
}
/** The widest framing allowed: horizontal the page's full width (lower only when a box needs it, down to the full page), vertical the whole page. */
function zooms(m: Metric, o: Orientation, device: "desktop" | "phone") {
  const zFull = Math.min(m.view.w / (m.base * m.screen.w), m.view.h / (m.base * m.screen.h)); // whole screen in view
  if (device === "phone") return { zOpen: 1, zMin: 1, cap: 1 };
  // Horizontal never goes wider than the page's full width (no white bands). Vertical opens on the whole page and
  // settles no wider than 0.9× (a 845 px column), where product text is still about 17 px tall in the 1080 px frame.
  return o === "horizontal" ? { zOpen: 1, zMin: 1, cap: CAP.horizontal } : { zOpen: zFull, zMin: VERTICAL_FLOOR, cap: CAP.vertical };
}

export class HighlightError extends Error {}

export function planBeat(beat: Beat, shots: Shot[], keys: string[], o: Orientation, view: { w: number; h: number }, duration: number, fromsIn?: number[]): Plan {
  const device = shots[0].device;
  const metric = metricFor(device, o, view);
  const froms = fromsIn ?? screenFroms(shots.length, duration);
  const screens = shots.map((s, i) => ({ from: froms[i], src: s.file }));

  // Rings per screenshot, each at that screenshot's own position; checked against the screenshot's bounds.
  const rings: RingSeg[] = [];
  const all: Rect[] = [];
  for (const spec of ringSpecs(beat, o)) {
    let found = false;
    let open: RingSeg | null = null;
    shots.forEach((shot, i) => {
      const r = ringRect(spec, shot);
      const vw = shot.viewport.w, vh = shot.viewport.h;
      if (r) {
        found = true;
        if (r.x < 0 || r.y < 0 || r.x + r.w > vw || r.y + r.h > vh)
          throw new HighlightError(`${beat.id}: ring "${spec}" on ${keys[i]} is outside the screenshot (${JSON.stringify(r)} in ${vw}×${vh})`);
        all.push(grow(r, Math.max(2, Math.min(RING_OUT, r.x, r.y, vw - r.x - r.w, vh - r.y - r.h))));
      }
      // After its screenshot has faded in; on the first one, after the camera has settled (it eases 8 → 38).
      const settle = i === 0 ? 40 : froms[i] + FADE + 6;
      const endOfScreen = i + 1 < shots.length ? froms[i + 1] - 12 : duration - 6;
      if (open && r && same(open.rect, r)) {
        open.to = endOfScreen; // same place on the next screenshot: the ring stays
        return;
      }
      if (open) rings.push(open);
      // The ring sits RING_OUT outside its box, less where the box is close to the screenshot's edge: it is never cut off.
      const out = r ? Math.max(2, Math.min(RING_OUT, r.x, r.y, vw - r.x - r.w, vh - r.y - r.h)) : 0;
      open = r && endOfScreen - settle >= 12 ? { spec, rect: r, from: settle, to: endOfScreen, out } : null;
    });
    if (open) rings.push(open);
    if (!found) throw new HighlightError(`${beat.id}: ring "${spec}" is not measured on any of its screenshots (${keys.join(", ")})`);
  }

  // Camera target: every highlight of the beat; without one, the beat's focus boxes on the first screenshot.
  let target: Rect | null = all.length ? unionOf(all) : null;
  if (!target && beat.focus?.length) {
    const fb = beat.focus.map((n) => shots[0].boxes?.[n]).filter(Boolean) as Rect[];
    if (fb.length) target = grow(unionOf(fb), beat.focusPad ?? 24);
  }
  const { zOpen, zMin, cap } = zooms(metric, o, device);
  const v1 = visibleAt(metric, 1);
  let zTarget = zOpen;
  if (target) {
    const fit = Math.min(((1 - 2 * MARGIN) * v1.w) / target.w, ((1 - 2 * MARGIN) * v1.h) / target.h);
    zTarget = Math.min(cap, fit);
    // A phone cannot zoom: a ring wider than 80 % of its screen needs a smaller child. On desktop the margin search
    // below decides (at the widest framing a box may run to the page's own edges).
    if (zTarget < zMin - 1e-6 && device === "phone") {
      // A phone cannot zoom out either: a ring as wide as a full-width card is fine as long as it stays on the screen
      // (the ring is pulled in at the screen's edge, see RING_OUT); only a ring larger than the screen is an error.
      if (all.length && (target.w > metric.screen.w + 2 * RING_OUT || target.h > metric.screen.h)) throw new HighlightError(`${beat.id}: the highlight (${Math.round(target.w)}×${Math.round(target.h)} with its ring) is larger than the phone screen; ring a smaller child element`);
      zTarget = zMin; // widest framing
    }
    zTarget = Math.max(zTarget, zMin);
  }
  const c = target ? { cx: target.x + target.w / 2, cy: target.y + target.h / 2 } : { cx: metric.screen.w / 2, cy: metric.screen.h / 2 };
  if (target && device === "desktop") {
    // The camera stops at the page's edge. On a side where it does, the margin cannot grow (there is no more page to
    // show): that side only has to keep the ring inside. Every other side keeps 10 %. Take the largest zoom, up to the
    // one that fits, where that holds.
    const t = target;
    const ok = (z: number) => {
      const cam = clampCam(metric, { z, ...c });
      const v = visibleAt(metric, z);
      const l = cam.cx - v.w / 2, top = cam.cy - v.h / 2;
      const edge = [l <= 0.5, top <= 0.5, l + v.w >= metric.screen.w - 0.5, top + v.h >= metric.screen.h - 0.5];
      const m = [(t.x - l) / v.w, (t.y - top) / v.h, (l + v.w - t.x - t.w) / v.w, (top + v.h - t.y - t.h) / v.h];
      return m.every((mm, i) => mm >= (edge[i] ? 0 : MARGIN) - 1e-6);
    };
    let z = zTarget;
    while (z > zMin + 1e-9 && !ok(z)) z = Math.max(zMin, z - 0.01);
    if (!ok(z) && all.length) throw new HighlightError(`${beat.id}: no framing between ${zMin.toFixed(2)}× and ${zTarget.toFixed(2)}× keeps the highlight inside the ${o} view with ${MARGIN * 100} % margins; ring a smaller child element`);
    zTarget = z;
  }
  const zStart = Math.min(zOpen, Math.max(zTarget, zMin));
  const camera: CamKey[] = [
    { at: 0, cam: clampCam(metric, { z: zStart, ...c }) },
    { at: 8, cam: clampCam(metric, { z: zTarget, ...c }), dur: 30 },
  ];
  return { screens, rings, camera, metric, target, zTarget };
}
