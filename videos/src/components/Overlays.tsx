import React from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, ease, EASE, F, type Rect } from "../theme";
import { useStageZoom } from "./Stage";

type Pt = { x: number; y: number };

/**
 * The pointer: glides between points (ease-out, never linear), presses on `clicks` frames with a ripple.
 * path: [{ at, x, y }] in screen px; the pointer keeps its on-screen size whatever the camera zoom.
 */
export function Cursor({ path, clicks = [], hideAfter }: { path: { at: number; x: number; y: number; dur?: number }[]; clicks?: number[]; hideAfter?: number }) {
  const frame = useCurrentFrame();
  const zoom = useStageZoom();
  let p: Pt = path[0];
  for (let i = 1; i < path.length; i++) {
    const k = path[i];
    const dur = k.dur ?? 18;
    if (frame < k.at - dur) break;
    const t = interpolate(frame, [k.at - dur, k.at], [0, 1], { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    p = { x: p.x + (k.x - p.x) * t, y: p.y + (k.y - p.y) * t };
  }
  const appear = interpolate(frame, [path[0].at, path[0].at + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const vanish = hideAfter !== undefined ? interpolate(frame, [hideAfter, hideAfter + 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const press = clicks.reduce((m, c) => Math.max(m, frame >= c && frame < c + 6 ? 1 - Math.abs(frame - c - 3) / 3 : 0), 0);
  const inv = 1 / zoom;
  return (
    <>
      {clicks.map((c) => (
        <Ripple key={c} at={c} x={p.x} y={p.y} />
      ))}
      <div style={{ position: "absolute", left: p.x, top: p.y, transform: `scale(${inv * 1.05 * (1 - press * 0.12)})`, transformOrigin: "0 0", opacity: appear * vanish, filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.25))", zIndex: 40 }}>
        <svg width="34" height="40" viewBox="0 0 34 40">
          <path d="M3 2 L3 31 L10.5 24.5 L15.5 36 L21 33.5 L16 22.5 L26 22.5 Z" fill="#111" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
        </svg>
      </div>
    </>
  );
}

function Ripple({ at, x, y }: { at: number; x: number; y: number }) {
  const frame = useCurrentFrame();
  const zoom = useStageZoom();
  if (frame < at || frame > at + 22) return null;
  const t = ease(frame, [at, at + 22], [0, 1]);
  const r = (14 + 46 * t) / zoom;
  return (
    <div
      style={{
        position: "absolute",
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: "50%",
        border: `${3 / zoom}px solid ${C.orange}`,
        background: "rgba(200,122,42,0.12)",
        opacity: 1 - t,
        zIndex: 39,
      }}
    />
  );
}

/** Orange ring around a control: springs in, breathes gently, fades out. */
export function HighlightRing({ rect, from, to, radius = 12, padding = 8, maxOut = Infinity }: { rect: Rect; from: number; to: number; radius?: number; padding?: number; maxOut?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoom = useStageZoom();
  if (frame < from || frame > to + 10) return null;
  const inS = spring({ frame: frame - from, fps, config: { damping: 14, stiffness: 160 } });
  const out = interpolate(frame, [to, to + 10], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // A gentle breath of 1 px (not a scale: on a page-wide box a scale would push the ring past the page's edge), and
  // never further out than maxOut (screen px): near the screenshot's edge the ring moves in rather than being cut off.
  const p = Math.min(padding / zoom + 4 + Math.sin((frame - from) / 7) / zoom, maxOut);
  return (
    <div
      style={{
        position: "absolute",
        left: rect.x - p,
        top: rect.y - p,
        width: rect.w + 2 * p,
        height: rect.h + 2 * p,
        borderRadius: radius,
        border: `${3.5 / zoom}px solid ${C.orange}`,
        boxShadow: `0 0 0 ${6 / zoom}px rgba(200,122,42,0.18)`,
        transform: `scale(${Math.min(1, 0.92 + 0.08 * inS)})`, // the spring's overshoot never grows the ring
        opacity: inS * out,
        zIndex: 30,
      }}
    />
  );
}

/**
 * A soft white vignette around one area (at most 18 %): the screen stays bright and true to the product; the eye
 * goes to the clear area. (Batch 8: no grey veil.) `screen` is the stage's screen size in CSS px.
 */
export function Spotlight({ rect, from, to, strength = 0.18, screen = { w: 1440, h: 900 } }: { rect: Rect; from: number; to: number; strength?: number; screen?: { w: number; h: number }; radius?: number; padding?: number }) {
  const frame = useCurrentFrame();
  if (frame < from || frame > to + 12) return null;
  const o = interpolate(frame, [from, from + 12, to, to + 12], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  // Clear ellipse a little larger than the area, fading to the white veil.
  const rx = rect.w / 2 + 60;
  const ry = rect.h / 2 + 60;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: screen.w,
        height: screen.h,
        background: `radial-gradient(${rx}px ${ry}px at ${cx}px ${cy}px, rgba(255,255,255,0) 70%, rgba(255,255,255,${strength * o}) 100%)`,
        zIndex: 20,
        pointerEvents: "none",
      }}
    />
  );
}

/**
 * Text typed into a field on the captured screen: a patch the colour of the field covers the old value, then the
 * characters appear one by one with a caret. `inset` keeps the field's own border visible.
 */
export function TypedText({ rect, text, from, cps = 14, fontSize = 17, color = C.text, bg = "#fff", paddingLeft = 14, inset = 2, caretUntil }: { rect: Rect; text: string; from: number; cps?: number; fontSize?: number; color?: string; bg?: string; paddingLeft?: number; inset?: number; caretUntil?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < from) return null;
  const n = Math.min(text.length, Math.floor(((frame - from) / fps) * cps));
  const caretOn = (caretUntil === undefined || frame < caretUntil) && Math.floor(frame / 8) % 2 === 0;
  return (
    <div
      style={{
        position: "absolute",
        left: rect.x + inset,
        top: rect.y + inset,
        width: rect.w - 2 * inset,
        height: rect.h - 2 * inset,
        background: bg,
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        paddingLeft: paddingLeft - inset,
        fontFamily: F.sans,
        fontSize,
        color,
        zIndex: 25,
        whiteSpace: "pre",
      }}
    >
      {text.slice(0, n)}
      <span style={{ display: "inline-block", width: 1.6, height: fontSize * 1.2, marginLeft: 1, background: caretOn ? color : "transparent" }} />
    </div>
  );
}

/** A money figure on the screen that counts from one value to another (the result "animating"). */
export function CountUp({ rect, from, to, start, dur = 24, fontSize, color = C.orange, bg = "#f8f8f8", format }: { rect: Rect; from: number; to: number; start: number; dur?: number; fontSize: number; color?: string; bg?: string; format: (n: number) => string }) {
  const frame = useCurrentFrame();
  // Only while counting: afterwards the captured screen shows the real figure (and its label) again.
  if (frame < start || frame > start + dur) return null;
  const v = interpolate(frame, [start, start + dur], [from, to], { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w + 6, height: rect.h, lineHeight: `${rect.h}px`, background: bg, fontFamily: F.serif, fontWeight: 700, fontSize, color, zIndex: 25, whiteSpace: "nowrap" }}>
      {format(v)}
    </div>
  );
}

/** A numbered step badge that pops next to a control. */
export function StepBadge({ n, x, y, from }: { n: number; x: number; y: number; from: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoom = useStageZoom();
  if (frame < from) return null;
  const s = spring({ frame: frame - from, fps, config: { damping: 11, stiffness: 180 } });
  const size = 44 / zoom;
  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        background: C.orange,
        color: "#fff",
        fontFamily: F.sans,
        fontWeight: 700,
        fontSize: 22 / zoom,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${s})`,
        boxShadow: `0 ${4 / zoom}px ${10 / zoom}px rgba(154,84,16,0.35)`,
        zIndex: 35,
      }}
    >
      {n}
    </div>
  );
}

/**
 * A value on the screen changing, with the real pixels: the area from the "before" capture rolls up and out while the
 * same area from the "after" capture rolls in (no re-typesetting, so it always matches the product exactly).
 */
export function RollUpdate({ rect, fromSrc, toSrc, start, dur = 16, screen }: { rect: Rect; fromSrc: string; toSrc: string; start: number; dur?: number; screen: { w: number; h: number } }) {
  const frame = useCurrentFrame();
  if (frame < start || frame > start + dur) return null;
  const t = interpolate(frame, [start, start + dur], [0, 1], { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const crop = (src: string, dy: number, opacity: number) => (
    <div style={{ position: "absolute", inset: 0, transform: `translateY(${dy}px)`, opacity }}>
      <Img src={staticFile(src)} style={{ position: "absolute", left: -rect.x, top: -rect.y, width: screen.w, height: screen.h, maxWidth: "none" }} />
    </div>
  );
  return (
    <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, overflow: "hidden", zIndex: 15 }}>
      <div style={{ position: "absolute", inset: 0, background: "#f8f8f8" }} />
      {crop(fromSrc, -t * rect.h * 0.7, 1 - t)}
      {crop(toSrc, (1 - t) * rect.h * 0.7, t)}
    </div>
  );
}
