import { Easing, interpolate } from "remotion";

/**
 * The camera over a captured screen, in the screen's CSS pixels. Pure (no fonts, no React), so the review and check
 * scripts use exactly what the render uses.
 *
 * A view (the browser frame's content area or the phone screen) shows the screen at `base × z` view px per screen px.
 * `base` is chosen per layout so that z = 1 is the reference framing the review talks about:
 *   horizontal desktop: z = 1 is the page's full width (1440 px) in the 1780 px frame;
 *   vertical desktop:   z = 1 is the page's full height (a 760 px wide column); the full page is z ≈ 0.53;
 *   phone:              z = 1 is the whole phone screen.
 * When the view shows more than the screen (z below the full-page zoom), the screen is centred on white.
 */
export type Size = { w: number; h: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Cam = { z: number; cx: number; cy: number };
export type Metric = { base: number; view: Size; screen: Size };
export type CamKey = { at: number; cam: Cam; dur?: number };

export const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/** The part of the screen in view at zoom z (screen px). */
export const visibleAt = (m: Metric, z: number): Size => ({ w: m.view.w / (m.base * z), h: m.view.h / (m.base * z) });

/** Keep the view on the screen: no empty band beyond an edge, unless the whole screen fits (then it is centred). */
export function clampCam(m: Metric, c: Cam): Cam {
  const v = visibleAt(m, c.z);
  const axis = (centre: number, vis: number, size: number) => (vis >= size ? size / 2 : Math.min(Math.max(centre, vis / 2), size - vis / 2));
  return { z: c.z, cx: axis(c.cx, v.w, m.screen.w), cy: axis(c.cy, v.h, m.screen.h) };
}

/** Camera at a frame: keys eased in turn (zoom in log space so pushes feel even). */
export function camAt(frame: number, keys: CamKey[], m: Metric): Cam {
  const sorted = [...keys].sort((a, b) => a.at - b.at);
  if (!sorted.length) return clampCam(m, { z: 1, cx: m.screen.w / 2, cy: m.screen.h / 2 });
  let cam = sorted[0].cam;
  for (const k of sorted.slice(1)) {
    if (frame < k.at) break;
    const t = interpolate(frame, [k.at, k.at + (k.dur ?? 30)], [0, 1], { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    cam = { z: Math.exp(Math.log(cam.z) + (Math.log(k.cam.z) - Math.log(cam.z)) * t), cx: cam.cx + (k.cam.cx - cam.cx) * t, cy: cam.cy + (k.cam.cy - cam.cy) * t };
  }
  return clampCam(m, cam);
}

/** Where a screen rect lands in the view at a camera (view px). */
export function toView(m: Metric, c: Cam, r: Rect): Rect {
  const s = m.base * c.z;
  return { x: m.view.w / 2 + s * (r.x - c.cx), y: m.view.h / 2 + s * (r.y - c.cy), w: r.w * s, h: r.h * s };
}
