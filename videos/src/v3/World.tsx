import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { Box, Cam, cameraAt, DEPTH, Key, OUT_H, OUT_W, project, shutterSamples, speedAt, World } from "./camera";
import tiles from "../../public/footage/v3/tiles.json";

/**
 * Renders one WORLD (a real full-page capture) through the continuous camera, with parallax layers, in-shot tap
 * reactions and camera-only motion blur. Layering method (documented in MOTION_NOTES.md §3):
 *   L0 plate   page captured with the cards hidden (visibility:hidden keeps the layout), depth 0
 *   L1 cards   each card cut from the CURRENT state capture by its measured box, depth 0.035
 *   L2 chips   changed regions (button → "1 in cart", cart badge) cut from the AFTER state, depth 0.07, spring in
 *   L3 cursor  pointer travelling to each target, depth 0.12
 * Every layer's home is the world's rest framing (first camera key): there, all layers land exactly on the plate.
 */
export type CardLayer = { box: string; states: [number, string][] }; // [fromFrame, capture file] — the state shown from that frame on
/** A changed region. press: tap on a button (squash, swap, spring, ring). bump: a badge/chip that pops. swap: a soft
 * crossfade (lists, tables). wipe: left-to-right reveal (typed text). `until`: drop the patch once the plate has
 * switched to the new state (plate states), so the patch only lives for the reaction itself. */
export type Patch = { box: string; f: number; from: string; to: string; kind: "press" | "bump" | "swap" | "wipe"; depth?: number; radius?: number; dur?: number; until?: number; noRing?: boolean };
export type CursorKey = { f: number; x: number; y: number; press?: boolean };
export type BoundType = { text: string; box: string; dx: number; dy: number; from: number; to: number; size?: number; weight?: number; color?: string; align?: "left" | "center" };
export type WorldShot = {
  world: World;
  plate: string | [number, string][]; // capture file for L0, or states [fromFrame, file] that switch in shot
  keys: Key[];
  cards: CardLayer[];
  patches: Patch[];
  cursor?: CursorKey[];
  type?: BoundType[];
  radius?: number; // card corner radius, CSS px
};


/** Captures are split into 600-CSS-px tiles (capture/tile.py): Chrome cannot decode a 40-megapixel PNG in one piece. */
const TILE = 600;
const tileMeta = tiles as Record<string, { wPx: number; hPx: number; n: number }>;
/** All tiles of a capture that intersect page rows [y0, y1), drawn at page scale s with the page origin at (ox, oy). */
export function Tiles({ file, y0, y1, s, ox, oy }: { file: string; y0: number; y1: number; s: number; ox: number; oy: number }) {
  const name = file.replace(/^v3\//, "");
  const m = tileMeta[name];
  const out: React.ReactNode[] = [];
  for (let i = Math.max(0, Math.floor(y0 / TILE)); i < Math.min(m.n, Math.ceil(y1 / TILE)); i++) {
    const hCss = Math.min(TILE, m.hPx / 3 - i * TILE);
    out.push(<Img key={i} src={staticFile(`footage/v3/tiles/${name}-${i}.png`)} style={{ position: "absolute", left: ox, top: oy + i * TILE * s, width: (m.wPx / 3) * s, height: hCss * s + 0.5, maxWidth: "none" }} />);
  }
  return <>{out}</>;
}
const stateAt = (states: [number, string][], f: number) => states.reduce((cur, [from, file]) => (f >= from ? file : cur), states[0][1]);

/** A rectangle of a capture, cut by its page box, drawn at its projected screen position. */
function Crop({ file, b, cam, world, p, home, scale = 1, opacity = 1, radius = 0, shadow = 0 }: { file: string; b: Box; cam: Cam; world: World; p: number; home: { x: number; y: number }; scale?: number; opacity?: number; radius?: number; shadow?: number }) {
  const tl = project(cam, b.x, b.y, p, home.x, home.y);
  const s = cam.s;
  return (
    <div
      style={{
        position: "absolute",
        left: tl.x,
        top: tl.y,
        width: b.w * s,
        height: b.h * s,
        overflow: "hidden",
        borderRadius: radius * s,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "50% 50%",
        boxShadow: shadow > 0.2 ? `0 ${shadow * 0.6}px ${shadow * 2}px rgba(20,32,26,${Math.min(0.22, 0.04 + shadow * 0.012)})` : undefined,
      }}
    >
      <Tiles file={file} y0={b.y} y1={b.y + b.h} s={s} ox={-b.x * s} oy={-b.y * s} />
    </div>
  );
}

function Pointer({ x, y, pressed }: { x: number; y: number; pressed: number }) {
  const sc = 1.25 * (1 - 0.12 * pressed);
  return (
    <svg width={40} height={48} viewBox="0 0 20 24" style={{ position: "absolute", left: x - 3, top: y - 2, transform: `scale(${sc})`, transformOrigin: "3px 2px", filter: "drop-shadow(0 3px 4px rgba(0,0,0,.35))" }}>
      <path d="M2 1 L2 19 L6.5 15 L9.5 22 L12.6 20.6 L9.6 13.8 L15.5 13.8 Z" fill="#111" stroke="#fff" strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  );
}

const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function cursorAt(keys: CursorKey[], f: number) {
  if (f <= keys[0].f) return { ...keys[0], pressed: 0 };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (f >= a.f && f <= b.f) {
      const t = easeIO((f - a.f) / (b.f - a.f));
      // A slight arc on the way (hand-moved cursors never travel in straight lines).
      const arc = Math.sin(t * Math.PI) * Math.min(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.08);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - arc, pressed: 0 };
    }
  }
  return { ...keys[keys.length - 1], pressed: 0 };
}

/** Everything in the shot at one (possibly fractional) time t, for the camera; reactions use the integer frame. */
function Scene({ shot, t, frame }: { shot: WorldShot; t: number; frame: number }) {
  const { world, keys } = shot;
  const cam = cameraAt(world, keys, t);
  const home = { x: keys[0].cx, y: keys[0].cy };
  const off = (p: number) => Math.hypot(cam.cx - home.x, cam.cy - home.y) * p * cam.s; // layer lift in screen px
  const plateTL = project(cam, 0, 0);
  const r = shot.radius ?? 16;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* L0 plate */}
      <Tiles file={typeof shot.plate === "string" ? shot.plate : stateAt(shot.plate, frame)} y0={cam.cy - cam.vh / 2 - 40} y1={cam.cy + cam.vh / 2 + 40} s={cam.s} ox={plateTL.x} oy={plateTL.y} />
      {/* L1 cards */}
      {shot.cards.map((c) => (
        <Crop key={c.box} file={stateAt(c.states, frame)} b={world.boxes[c.box]} cam={cam} world={world} p={DEPTH.card} home={home} radius={r} shadow={off(DEPTH.card)} />
      ))}
      {/* L2 changed regions: press, swap, spring */}
      {shot.patches.map((pt, i) => {
        const b = world.boxes[pt.box];
        const d = frame - pt.f;
        // with plate states the plate itself carries the new state, so a patch only lives through its reaction
        const until = pt.until ?? (typeof shot.plate === "string" ? undefined : pt.f + 24);
        if (d < -4 || (until !== undefined && frame >= until)) return null;
        const p = pt.depth ?? (pt.kind === "bump" ? DEPTH.chip : pt.kind === "press" ? DEPTH.card : 0);
        if (pt.kind === "swap" || pt.kind === "wipe") {
          if (d < 0) return null;
          const k = Math.min(1, d / (pt.dur ?? 8));
          const tlw = project(cam, b.x, b.y, p, home.x, home.y);
          return (
            <div key={i} style={{ position: "absolute", left: tlw.x, top: tlw.y, width: (pt.kind === "wipe" ? k : 1) * b.w * cam.s, height: b.h * cam.s, overflow: "hidden", opacity: pt.kind === "swap" ? k : 1 }}>
              <Tiles file={pt.to} y0={b.y} y1={b.y + b.h} s={cam.s} ox={-b.x * cam.s} oy={-b.y * cam.s} />
            </div>
          );
        }
        const after = d >= 0;
        let scale = 1;
        if (!after) scale = 1 - 0.04 * interpolate(d, [-4, -1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        else if (pt.kind === "press") scale = 1 + 0.045 * spring({ frame: d, fps: 30, config: { damping: 9, stiffness: 180 }, durationInFrames: 14 }) * Math.exp(-d / 6);
        else scale = 1 + 0.38 * Math.sin(Math.min(1, d / 10) * Math.PI) * Math.exp(-d / 14);
        const ring = after && d < 16 ? d / 16 : -1;
        const tl = project(cam, b.x, b.y, p, home.x, home.y);
        return (
          <React.Fragment key={i}>
            <Crop file={after ? pt.to : pt.from} b={b} cam={cam} world={world} p={p} home={home} scale={scale} radius={pt.radius ?? 0} shadow={after && d < 12 ? 6 * (1 - d / 12) : 0} />
            {ring >= 0 && pt.kind === "press" && !pt.noRing && (
              <div style={{ position: "absolute", left: tl.x + (b.w * cam.s) / 2, top: tl.y + (b.h * cam.s) / 2, width: 0, height: 0 }}>
                <div style={{ position: "absolute", left: -(30 + ring * 60), top: -(30 + ring * 60), width: 2 * (30 + ring * 60), height: 2 * (30 + ring * 60), borderRadius: "50%", border: `${3 * (1 - ring) + 0.5}px solid ${C.orange}`, opacity: 0.85 * (1 - ring) }} />
              </div>
            )}
          </React.Fragment>
        );
      })}
      {/* Kinetic type bound to UI: lives in page space, so it travels and parallaxes with the camera. */}
      {(shot.type ?? []).map((ty, i) => {
        const b = world.boxes[ty.box];
        const k = interpolate(frame, [ty.from, ty.from + 12, ty.to - 8, ty.to], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        if (k <= 0) return null;
        const pt = project(cam, b.x + ty.dx, b.y + ty.dy, DEPTH.chip, home.x, home.y);
        return (
          <div key={i} style={{ position: "absolute", left: pt.x, top: pt.y, transform: `translate(${ty.align === "center" ? "-50%" : "0"}, ${(1 - k) * 24}px)`, opacity: k, fontFamily: F.serif, fontWeight: ty.weight ?? 700, fontSize: (ty.size ?? 30) * cam.s, letterSpacing: "-0.02em", color: ty.color ?? C.tealDark, whiteSpace: "nowrap", textShadow: "0 1px 0 rgba(255,255,255,.6)" }}>
            {ty.text}
          </div>
        );
      })}
      {/* L3 cursor */}
      {shot.cursor && (() => {
        const c = cursorAt(shot.cursor, t);
        const pressedNow = shot.cursor.some((k) => k.press && frame >= k.f - 3 && frame <= k.f + 2) ? 1 : 0;
        const pt = project(cam, c.x, c.y, DEPTH.cursor, home.x, home.y);
        return <Pointer x={pt.x} y={pt.y} pressed={pressedNow} />;
      })()}
    </AbsoluteFill>
  );
}

/** Camera-only motion blur: the scene re-drawn at sub-frame camera times across a 180° shutter, equal weights. */
export function WorldView({ shot }: { shot: WorldShot }) {
  const frame = useCurrentFrame();
  const offsets = shutterSamples(speedAt(shot.world, shot.keys, frame));
  return (
    <AbsoluteFill style={{ background: "#fbf8f2", width: OUT_W, height: OUT_H }}>
      {offsets.map((o, i) => (
        <AbsoluteFill key={i} style={{ opacity: 1 / (i + 1) }}>
          <Scene shot={shot} t={frame + o} frame={frame} />
        </AbsoluteFill>
      ))}
    </AbsoluteFill>
  );
}
