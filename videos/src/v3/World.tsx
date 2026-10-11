import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { assertLine } from "./lines";
import { Box, Cam, cameraAt, DEPTH, Key, OUT_H, OUT_W, project, shutterSamples, speedAt, World } from "./camera";
import tiles from "../../public/footage/v3/tiles.json";
import { PlateState, states } from "./plates";

/**
 * Renders one WORLD (a real full-page capture) through the continuous camera (Gate F V3.1).
 *
 * Owner notes V3.1 §1: tap reactions must be invisible as technique. So the UI is never patched, lifted, scaled or
 * ringed: the page on screen is always ONE real capture, and a tap switches the whole plate to the real "after"
 * capture on the tap frame (exactly what the app does). Pixels the app did not change are identical in both captures,
 * so only the changed pixels change. Options per state: a short cross-dissolve (`fade`, frames) for a page that
 * reflows. Typing is the only partial state: the field shows the real typed capture and the not-yet-typed part of the
 * text is covered with the field's own flat background (`wipes`); the plate switches to that capture when it ends.
 *
 * Layers: L0 the page (no parallax on UI: nothing can drift off its place), L1 kinetic type bound to page boxes
 * (depth 0.07, it floats over margins and travels with the camera), L2 the pointer (depth 0, so it sits exactly on
 * its target; a press is the pointer's own small dip, no halo). Camera-only motion blur (180° shutter).
 */
export type { PlateState };
/** Typing in a field: `field` = the field's inner box, `box` = the typed text's extent, `bg` = the field's background. */
export type Wipe = { box: string; field: string; bg: string; f: number; dur: number; to: string; hold?: boolean }; // hold: keep the typed field until the plate itself switches to `to`
export type CursorKey = { f: number; x: number; y: number; press?: boolean };
export type BoundType = { text: string; box: string; dx: number; dy: number; from: number; to: number; size?: number; weight?: number; color?: string; align?: "left" | "center"; italic?: boolean };
export type WorldShot = {
  world: World;
  plate: string | PlateState[];
  keys: Key[];
  wipes?: Wipe[];
  cursor?: CursorKey[];
  type?: BoundType[];
};

/** Captures are split into 600-CSS-px tiles (capture/tile.py): Chrome cannot decode a 40-megapixel PNG in one piece. */
const TILE = 600;
const tileMeta = tiles as Record<string, { wPx: number; hPx: number; n: number }>;
/** All tiles of a capture that intersect page rows [y0, y1), drawn at page scale s with the page origin at (ox, oy). */
export function Tiles({ file, y0, y1, s, ox, oy }: { file: string; y0: number; y1: number; s: number; ox: number; oy: number }) {
  const name = file.replace(/^v3\//, "");
  const m = tileMeta[name];
  if (!m) throw new Error(`no tiles for ${name}`);
  const out: React.ReactNode[] = [];
  for (let i = Math.max(0, Math.floor(y0 / TILE)); i < Math.min(m.n, Math.ceil(y1 / TILE)); i++) {
    const hCss = Math.min(TILE, m.hPx / 3 - i * TILE);
    out.push(<Img key={i} src={staticFile(`footage/v3/tiles/${name}-${i}.png`)} style={{ position: "absolute", left: ox, top: oy + i * TILE * s, width: (m.wPx / 3) * s, height: hCss * s + 0.5, maxWidth: "none" }} />);
  }
  return <>{out}</>;
}

/** The plate on screen at frame f, and the previous one with its dissolve weight when a fade is running. */
function plateAt(plate: string | PlateState[], f: number) {
  const st = states(plate);
  let i = 0;
  for (let k = 0; k < st.length; k++) if (f >= st[k][0]) i = k;
  const cur = st[i];
  const fade = cur[2] ?? 0;
  if (i > 0 && fade > 0 && f < cur[0] + fade) return { file: cur[1], prev: st[i - 1][1], k: (f - cur[0]) / fade };
  return { file: cur[1], prev: null as string | null, k: 1 };
}

function Pointer({ x, y, pressed }: { x: number; y: number; pressed: number }) {
  const sc = 1.25 * (1 - 0.14 * pressed);
  return (
    <svg width={40} height={48} viewBox="0 0 20 24" style={{ position: "absolute", left: x - 3, top: y - 2, transform: `scale(${sc})`, transformOrigin: "3px 2px", filter: "drop-shadow(0 3px 4px rgba(0,0,0,.35))" }}>
      <path d="M2 1 L2 19 L6.5 15 L9.5 22 L12.6 20.6 L9.6 13.8 L15.5 13.8 Z" fill="#111" stroke="#fff" strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  );
}

const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function cursorAt(keys: CursorKey[], f: number) {
  if (f <= keys[0].f) return { ...keys[0] };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (f >= a.f && f <= b.f) {
      const t = easeIO((f - a.f) / Math.max(1e-6, b.f - a.f));
      const arc = Math.sin(t * Math.PI) * Math.min(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.08); // hands never move in straight lines
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - arc };
    }
  }
  return { ...keys[keys.length - 1] };
}

/** Kinetic type in page space: it slides in with momentum, travels and parallaxes with the camera. */
function KineticType({ ty, cam, home, frame, world }: { ty: BoundType; cam: Cam; home: { x: number; y: number }; frame: number; world: World }) {
  assertLine(ty.text);
  const b = world.boxes[ty.box];
  const inK = interpolate(frame, [ty.from, ty.from + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const outK = interpolate(frame, [ty.to - 6, ty.to], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (inK <= 0 || outK <= 0) return null;
  const e = 1 - Math.pow(1 - inK, 4);
  const pt = project(cam, b.x + ty.dx, b.y + ty.dy, DEPTH.chip, home.x, home.y);
  return (
    <div style={{ position: "absolute", left: pt.x, top: pt.y, transform: `translate(${ty.align === "center" ? "-50%" : "0"}, ${(1 - e) * 46 - (1 - outK) * 20}px) skewX(${(1 - e) * -10}deg)`, opacity: Math.min(e * 1.6, outK), fontFamily: F.serif, fontStyle: ty.italic ? "italic" : "normal", fontWeight: ty.weight ?? 700, fontSize: (ty.size ?? 30) * cam.s, letterSpacing: "-0.025em", color: ty.color ?? C.tealDark, whiteSpace: "nowrap" }}>
      {ty.text}
    </div>
  );
}

/** Everything in the shot at one (possibly fractional) time t for the camera; plate states use the integer frame. */
function Scene({ shot, t, frame }: { shot: WorldShot; t: number; frame: number }) {
  const { world, keys } = shot;
  const cam = cameraAt(world, keys, t);
  const home = { x: keys[0].cx, y: keys[0].cy };
  const tl = project(cam, 0, 0);
  const y0 = cam.cy - cam.vh / 2 - 40, y1 = cam.cy + cam.vh / 2 + 40;
  const pl = plateAt(shot.plate, frame);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {pl.prev && <Tiles file={pl.prev} y0={y0} y1={y1} s={cam.s} ox={tl.x} oy={tl.y} />}
      <AbsoluteFill style={{ opacity: pl.prev ? pl.k : 1 }}>
        <Tiles file={pl.file} y0={y0} y1={y1} s={cam.s} ox={tl.x} oy={tl.y} />
      </AbsoluteFill>
      {(shot.wipes ?? []).map((w, i) => {
        // typing: the field shows the real typed capture (its placeholder is gone, as in a browser) and the not-yet-typed
        // part of the text is covered with the field's own flat background colour (pixel-exact, sampled from the capture)
        const d = frame - w.f;
        // a held field shows until the plate itself switches to the typed capture (and never after)
        const until = w.hold ? (states(shot.plate).find((st) => st[1] === w.to)?.[0] ?? Infinity) : w.f + w.dur;
        if (d < 0 || frame >= until) return null;
        const fb = world.boxes[w.field], tb = world.boxes[w.box];
        const pf = project(cam, fb.x, fb.y), pt = project(cam, tb.x, tb.y);
        const k = Math.min(1, (d + 1) / w.dur);
        return (
          <React.Fragment key={i}>
            <div style={{ position: "absolute", left: pf.x, top: pf.y, width: fb.w * cam.s, height: fb.h * cam.s, overflow: "hidden" }}>
              <Tiles file={w.to} y0={fb.y} y1={fb.y + fb.h} s={cam.s} ox={-fb.x * cam.s} oy={-fb.y * cam.s} />
            </div>
            <div style={{ position: "absolute", left: pt.x + k * tb.w * cam.s, top: pt.y, width: (1 - k) * tb.w * cam.s + 1, height: tb.h * cam.s, background: w.bg }} />
          </React.Fragment>
        );
      })}
      {(shot.type ?? []).map((ty, i) => <KineticType key={i} ty={ty} cam={cam} home={home} frame={frame} world={world} />)}
      {shot.cursor && (() => {
        const c = cursorAt(shot.cursor, t);
        const pressed = shot.cursor.some((k) => k.press && frame >= k.f - 2 && frame <= k.f + 2) ? 1 : 0;
        const pt = project(cam, c.x, c.y);
        return <Pointer x={pt.x} y={pt.y} pressed={pressed} />;
      })()}
    </AbsoluteFill>
  );
}

/** Camera-only motion blur: the scene re-drawn at sub-frame camera times across a 180° shutter, equal weights. */
export function WorldView({ shot, frameOffset = 0 }: { shot: WorldShot; frameOffset?: number }) {
  const frame = useCurrentFrame() + frameOffset;
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

export type { Box };
