import React from "react";
import { AbsoluteFill, Audio, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame } from "remotion";
import { Mark, Wordmark } from "../components/Chrome";
import { BRAND, C, F } from "../theme";
import { Ticket } from "../v2/props";
import { Key, validateCamera } from "./camera";
import { HookA, HookD } from "./Hooks";
import { CATALOG } from "./shots";
import quadsOts from "../../public/v3/clips/ots-composite.quads.json";
import { WorldShot, WorldView } from "./World";
import { P, PROMO_FRAMES } from "./promoTiming";

/**
 * 20 s promo proof (Gate F): D "Two hands" → A "11:04 PM text" → Marco's phone (real portal composited into the
 * green screen) → push through the screen, match cut on the cheddar photo into the desktop catalog (one continuous
 * camera, two taps react in shot, badge lands) → the order slip shoots out of the cart badge → it lands on Salma's
 * bench: her stamp hits the slip on the same frame her monitor (real admin screen) flips to Confirmed → the driver pats
 * the box, SENT → morning, Marco's relieved smile → end card. Grid: 108 BPM, origin frame 6 (the first chop).
 */
export { PROMO_FRAMES } from "./promoTiming";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease3 = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

// ——— the catalog world, continuing from the phone (card 0 already in the cart from Marco's thumb tap) ———
const L = (f: number) => f - P.catFrom;
const catKeys: Key[] = [
  { f: 0, cx: 450, cy: 470, z: 1.6, eye: "img0" },
  { f: 26, cx: 700, cy: 440, z: 1.2, ease: "arrive" },
  { f: L(P.tap1) - 6, cx: 760, cy: 470, z: 1.3, ease: "glide", eye: "card1" },
  { f: L(P.tap2) - 4, cx: 886, cy: 470, z: 1.3, ease: "glide", eye: "card2" },
  { f: L(P.badge) + 2, cx: 850, cy: 360, z: 1.18, ease: "glide", eye: "cartWide" },
  { f: 136, cx: 850, cy: 330, z: 1.22, ease: "linear" },
];
validateCamera(CATALOG, catKeys, 136);
const btnC = (i: number) => ({ x: CATALOG.boxes[`btn${i}`].x + CATALOG.boxes[`btn${i}`].w / 2 + 6, y: CATALOG.boxes[`btn${i}`].y + 26 });
const catShot: WorldShot = {
  world: CATALOG, plate: "v3/catalog-bg", keys: catKeys, radius: 16,
  cards: [
    { box: "card0", states: [[0, "v3/catalog-1"]] },
    { box: "card1", states: [[0, "v3/catalog-1"], [L(P.tap1), "v3/catalog-2"]] },
    { box: "card2", states: [[0, "v3/catalog-1"], [L(P.tap2), "v3/catalog-3"]] },
    ...[3, 4, 5, 6, 7, 8].map((i) => ({ box: `card${i}`, states: [[0, "v3/catalog-0"]] as [number, string][] })),
  ],
  patches: [
    { box: "cartWide", f: -10, from: "v3/catalog-1", to: "v3/catalog-1", kind: "swap", dur: 1 },
    { box: "btn1", f: L(P.tap1), from: "v3/catalog-1", to: "v3/catalog-2", kind: "press", radius: 22 },
    { box: "cartWide", f: L(P.tap1) + 6, from: "v3/catalog-1", to: "v3/catalog-2", kind: "bump" },
    { box: "btn2", f: L(P.tap2), from: "v3/catalog-2", to: "v3/catalog-3", kind: "press", radius: 22 },
    { box: "cartWide", f: L(P.badge), from: "v3/catalog-2", to: "v3/catalog-3", kind: "bump" },
  ],
  cursor: [
    { f: 0, x: 600, y: 900 }, { f: L(P.tap1) - 8, ...btnC(1) }, { f: L(P.tap1), ...btnC(1), press: true },
    { f: L(P.tap2) - 8, ...btnC(2) }, { f: L(P.tap2), ...btnC(2), press: true }, { f: L(P.badge), x: 1236, y: 132 }, { f: 136, x: 1240, y: 138 },
  ],
  type: [
    { text: "Your catalog. Your prices.", box: "tagline", dx: 0, dy: 0, from: 8, to: 46, size: 26 },
    { text: "Three taps.", box: "cartWide", dx: -330, dy: -2, from: L(P.badge) + 2, to: 140, size: 40 },
  ],
};

// screen centre of the phone in the composite (for the push-through), from capture/composite.py's tracked corners
const q = (quadsOts as { quads: number[][][]; size: number[] }).quads;
const screenAt = (cf: number) => { const s = q[Math.max(0, Math.min(q.length - 1, Math.round(cf)))]; const cx = s.reduce((a, p) => a + p[0], 0) / 4, cy = s.reduce((a, p) => a + p[1], 0) / 4; const h = Math.hypot(s[3][0] - s[0][0], s[3][1] - s[0][1]); return { cx: (cx / 1928) * 1920, cy: (cy / 1076) * 1080, h: (h / 1076) * 1080 }; };

function PhoneShot() {
  const f = useCurrentFrame(); // local
  const t = Math.max(0, (f - (P.pushFrom - P.otsFrom)) / (P.catFrom - P.pushFrom)); // 0..1 push-through
  const cf = (f / 30) * 24;
  const sc = screenAt(cf);
  const k = Math.pow(t, 2.2);
  const scale = 1 + k * (1080 / sc.h) * 1.9;
  const blur = t > 0 ? k * 10 : 0;
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: `${sc.cx}px ${sc.cy}px`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined }}>
        <OffthreadVideo src={staticFile("v3/clips/ots-composite.mp4")} muted style={{ width: "100%", height: "100%" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#faf6ec", opacity: interpolate(t, [0.7, 1], [0, 1], clamp) }} />
    </AbsoluteFill>
  );
}

function CatalogShot() {
  const f = useCurrentFrame();
  const slipT = (f - L(P.slip)) / 12; // the slip prints out of the cart badge and shoots up out of frame
  const rise = interpolate(f, [L(P.slip), L(P.slip) + 8, 136], [0, 1, 1], clamp);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: interpolate(f, [0, 6], [0, 1], clamp) }}>
        <WorldView shot={catShot} />
      </AbsoluteFill>
      {f >= L(P.slip) && (
        <div style={{ position: "absolute", left: 1290, top: 230 - Math.max(0, slipT - 0.6) * 900, transform: `rotate(${-4 + slipT * 6}deg) scale(${0.6 + 0.4 * rise})`, transformOrigin: "50% 0%", filter: slipT > 0.8 ? `blur(${(slipT - 0.8) * 8}px)` : undefined }}>
          <Ticket w={300} printed={Math.min(1, rise)} lines={["COPPERLEAF KITCHEN", "Order #ca6e00ac", "3 items · Delivery", "Back door, before 9 please."]} f={f} />
        </div>
      )}
    </AbsoluteFill>
  );
}

function StampMark({ text, x, y, at, size = 60, rot = -8 }: { text: string; x: number; y: number; at: number; size?: number; rot?: number }) {
  const f = useCurrentFrame();
  if (f < at) return null;
  const s = spring({ frame: f - at, fps: 30, config: { damping: 11, stiffness: 260 } });
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${1.6 - 0.6 * s})`, opacity: Math.min(1, (f - at + 1) / 2) * 0.92, border: `${size * 0.09}px solid #b5452b`, color: "#b5452b", borderRadius: size * 0.12, padding: `${size * 0.08}px ${size * 0.28}px`, fontFamily: F.sans, fontWeight: 800, fontSize: size, letterSpacing: "0.08em", mixBlendMode: "multiply", whiteSpace: "nowrap" }}>
      {text}
    </div>
  );
}

function SalmaShot() {
  const f = useCurrentFrame();
  const drop = ease3(f / 10); // the slip from Marco's catalog drops onto her bench and becomes the real paper slip
  const at = P.stamp - P.salmaFrom;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <OffthreadVideo src={staticFile("v3/clips/salma-composite.mp4")} startFrom={36} muted style={{ width: "100%", height: "100%" }} />
      {f < 14 && (
        <div style={{ position: "absolute", left: 590, top: interpolate(drop, [0, 1], [-420, 640]), transform: `rotate(${(1 - drop) * 25 - 12}deg) scale(${0.9 - 0.45 * drop})`, opacity: interpolate(f, [10, 14], [1, 0], clamp) }}>
          <Ticket w={300} lines={["COPPERLEAF KITCHEN", "Order #ca6e00ac", "3 items · Delivery", "Back door, before 9 please."]} />
        </div>
      )}
      <StampMark text="CONFIRMED" x={928} y={1004} at={at + 8} size={28} rot={-5} />
    </AbsoluteFill>
  );
}

function DriverShot() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <OffthreadVideo src={staticFile("v3/clips/driver2-169-t2.mp4")} startFrom={50} muted style={{ width: "100%", height: "100%" }} />
      <StampMark text="SENT" x={830} y={455} at={P.sent - P.driverFrom} size={92} rot={-7} />
      <AbsoluteFill style={{ background: "#fff8e8", opacity: interpolate(f, [34, 40], [0, 0.9], clamp) }} />
    </AbsoluteFill>
  );
}

function MorningShot() {
  const f = useCurrentFrame();
  const at = P.morning - P.morningFrom;
  const k = interpolate(f, [at, at + 10], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <OffthreadVideo src={staticFile("v3/clips/marco-morning.mp4")} startFrom={37} muted style={{ width: "100%", height: "100%" }} />
      <AbsoluteFill style={{ background: "#fff8e8", opacity: interpolate(f, [0, 6], [0.9, 0], clamp) }} />
      <div style={{ position: "absolute", left: 1180, top: 180, fontFamily: F.serif, fontWeight: 700, fontSize: 120, letterSpacing: "-0.03em", color: "#fffaf0", opacity: k, transform: `translateY(${(1 - k) * 24}px)`, textShadow: "0 4px 30px rgba(60,30,0,.45)" }}>
        Morning.
      </div>
    </AbsoluteFill>
  );
}

function EndCard() {
  const f = useCurrentFrame();
  const hit = P.logo - P.endFrom;
  const s = spring({ frame: f - hit, fps: 30, config: { damping: 14, stiffness: 150 } });
  const k = (d: number) => interpolate(f, [hit + d, hit + d + 8], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: C.paper, alignItems: "center", justifyContent: "center", display: "flex", flexDirection: "column", gap: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 26, transform: `scale(${0.9 + 0.1 * s})`, opacity: Math.min(1, s * 1.4) }}>
        <Mark size={110} draw={Math.min(1, s * 1.3)} fill={s} />
        <Wordmark size={96} reveal={Math.min(1, s * 1.2)} />
      </div>
      <div style={{ fontFamily: F.serif, fontSize: 46, color: C.tealDark, opacity: k(4) }}>{BRAND.tagline}</div>
      <div style={{ display: "flex", gap: 22, alignItems: "center", opacity: k(8) }}>
        <div style={{ background: C.orange, color: "#fff", fontFamily: F.sans, fontWeight: 600, fontSize: 32, padding: "16px 34px", borderRadius: 999 }}>Become a customer →</div>
        <div style={{ fontFamily: F.sans, fontSize: 30, color: C.soft }}>{BRAND.url}</div>
      </div>
    </AbsoluteFill>
  );
}

export function Promo20({ audioSrc }: { audioSrc?: string }) {
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Sequence from={0} durationInFrames={P.aFrom}><HookD /></Sequence>
      <Sequence from={P.aFrom} durationInFrames={P.otsFrom - P.aFrom}><HookA /></Sequence>
      <Sequence from={P.otsFrom} durationInFrames={P.catFrom - P.otsFrom}><PhoneShot /></Sequence>
      <Sequence from={P.catFrom} durationInFrames={P.salmaFrom - P.catFrom}><CatalogShot /></Sequence>
      <Sequence from={P.salmaFrom} durationInFrames={P.driverFrom - P.salmaFrom}><SalmaShot /></Sequence>
      <Sequence from={P.driverFrom} durationInFrames={P.morningFrom - P.driverFrom}><DriverShot /></Sequence>
      <Sequence from={P.morningFrom} durationInFrames={P.endFrom - P.morningFrom}><MorningShot /></Sequence>
      <Sequence from={P.endFrom} durationInFrames={PROMO_FRAMES - P.endFrom}><EndCard /></Sequence>
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
    </AbsoluteFill>
  );
}
