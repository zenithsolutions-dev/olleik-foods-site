import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame } from "remotion";
import { Mark, Wordmark } from "../components/Chrome";
import { BRAND, C, F } from "../theme";
import { Key, validateCamera } from "./camera";
import { HookA } from "./Hooks";
import { assertLine } from "./lines";
import { CATALOG } from "./shots";
import quadsPhone from "../../public/v3/clips/f2/phone.quads.json";
import quadsMon from "../../public/v3/clips/f2/monitor.quads.json";
import ink from "../../public/v3/clips/f2/stamp-ink.json";
import manifest from "../../public/footage/manifest.json";
import { CursorKey, WorldShot, WorldView } from "./World";
import { P, PROMO_FRAMES } from "./promoTiming";

/**
 * 20 s promo proof, Gate F V3.1 (owner notes CREATIVE_BRIEF_V3 §9). 19 shots on the 108 BPM grid:
 * D "Two hands" (three chops, no UI for 1.5 s) → each chop is a tap: match cuts knife ↔ the real catalog, the real
 * button turns into "1 in cart" on the beat → A "11:04 PM text" → Marco's phone (real portal composited at 2x, header
 * fully visible), his thumb taps on the beat → push through the screen, match cut on "1 in cart" into the desktop
 * catalog: one continuous camera, two taps, the cart lands on 3 → whip into the warehouse: Salma's monitor (real admin
 * order at monitor size), punch-in, Confirm on the beat → stamp insert (the CONFIRMED ink printed inside the real ink
 * border, in its perspective) → tape → the van door slams → SENT → end card. No morning shot. Every UI frame is one
 * real capture; nothing is patched over it.
 */
export { PROMO_FRAMES } from "./promoTiming";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease3 = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
/** Piecewise-linear time map: [[shotFrame, clipFrame], …] → clip frame (speed ramps between the keys). */
export const remap = (f: number, keys: number[][]) => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) if (f <= keys[i + 1][0]) return interpolate(f, [keys[i][0], keys[i + 1][0]], [keys[i][1], keys[i + 1][1]]);
  return keys[keys.length - 1][1];
};
/** A frame sequence (JPGs extracted from a clip, `base` = number of the first file) at a remapped clip frame. */
export function Frames({ dir, n, at, base = 0 }: { dir: string; n: number; at: number; base?: number }) {
  const i = Math.max(0, Math.min(n - 1, Math.round(at))) + base;
  return <Img src={staticFile(`${dir}/${String(i).padStart(3, "0")}.jpg`)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />;
}
/** Camera shake on an impact: a few frames of decaying offset. */
export const shake = (f: number, hits: number[], amp = 9) => {
  const h = hits.filter((x) => f >= x && f < x + 8).pop();
  if (h === undefined) return { x: 0, y: 0 };
  const d = f - h;
  const k = amp * Math.exp(-d / 2.2);
  return { x: Math.sin(d * 2.7) * k, y: Math.cos(d * 3.3) * k * 0.7 };
};
/** Whip: the outgoing shot accelerates out to the left, the incoming one decelerates in from the right, smeared. */
export function Whip({ len, out = 0, inn = 0, children }: { len: number; out?: number; inn?: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  let x = 0;
  if (out && f > len - out) x = -Math.pow((f - (len - out)) / out, 3) * 1700;
  if (inn && f < inn) x = Math.pow(1 - f / inn, 3) * 1700;
  const v = Math.abs(x) / 1700;
  if (v < 0.01) return <AbsoluteFill>{children}</AbsoluteFill>;
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      {Array.from({ length: 6 }, (_, i) => (
        <AbsoluteFill key={i} style={{ transform: `translateX(${x + (i - 2.5) * v * 70}px)`, opacity: 1 / (i + 1) }}>
          {children}
        </AbsoluteFill>
      ))}
    </AbsoluteFill>
  );
}

// ——— D: the chops (clip impacts re-timed onto the beats; hd-chop2 is a 1-based JPG sequence) ———
const chopKeys1 = [[0, 6.2], [P.chops[0], 11], [P.chops[1], 38], [P.chops[2], 61], [P.ui1From, 70]];
const chopKeys2 = [[0, 72], [P.chop4 - P.chop2From, 80], [P.ui2From - P.chop2From, 88]];
function Chop({ keys, hits, push }: { keys: number[][]; hits: number[]; push: [number, number] }) {
  const f = useCurrentFrame();
  const s = shake(f, hits, 7);
  const sc = interpolate(f, [0, keys[keys.length - 1][0]], push);
  return (
    <AbsoluteFill style={{ background: "#0f1210", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${s.x}px, ${s.y}px) scale(${sc})` }}>
        <Frames dir="v3/clips/hd-chop2" n={121} base={1} at={remap(f, keys)} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ——— the catalog world (real captures, the plate switches on the beat) ———
const B = CATALOG.boxes;
const mid = (k: string, dx = 0, dy = 0) => ({ x: B[k].x + B[k].w / 2 + dx, y: B[k].y + B[k].h / 2 + dy });
const press = (k: string, f: number, arrive: number): CursorKey[] => [{ f: arrive, ...mid(k, 10, 6) }, { f, ...mid(k, 10, 6), press: true }, { f: f + 8, ...mid(k, 16, 12) }];

// teaser inserts in D: the chop IS the tap (cheddar, then salmon)
const teaserA: WorldShot = {
  world: CATALOG, plate: [[0, "v3/catalog-0"], [P.tapA - P.ui1From, "v3/catalog-1"]],
  keys: [{ f: 0, cx: 480, cy: 430, z: 1.5 }, { f: 8, cx: 480, cy: 500, z: 1.5, ease: "snap", eye: "btn0" }, { f: 17, cx: 492, cy: 506, z: 1.52, ease: "linear" }],
  cursor: [{ f: 0, x: 420, y: 860 }, ...press("btn0", P.tapA - P.ui1From, 7)],
};
const teaserB: WorldShot = {
  world: CATALOG, plate: [[0, "v3/catalog-1"], [P.tapB - P.ui2From, "v3/catalog-2"]],
  keys: [{ f: 0, cx: 690, cy: 440, z: 1.5 }, { f: 7, cx: 720, cy: 510, z: 1.5, ease: "snap", eye: "btn1" }, { f: 13, cx: 730, cy: 514, z: 1.51, ease: "linear" }],
  cursor: [{ f: 0, x: 760, y: 880 }, ...press("btn1", P.tapB - P.ui2From, 6)],
};
validateCamera(CATALOG, teaserA.keys, 17);
validateCamera(CATALOG, teaserB.keys, 13);

// the story's catalog: Marco's phone already added the cheddar; two taps on the desktop, the cart lands on 3
const L = (f: number) => f - P.catFrom;
const catKeys: Key[] = [
  { f: 0, cx: 480, cy: 520, z: 1.5, eye: "btn0" },
  { f: 12, cx: 600, cy: 470, z: 1.24, ease: "arrive" },
  { f: L(P.tap1) - 6, cx: 720, cy: 482, z: 1.3, ease: "snap", eye: "btn1" },
  { f: L(P.tap1) + 10, cx: 736, cy: 478, z: 1.29, ease: "linear" },
  { f: L(P.tap2) - 6, cx: 960, cy: 482, z: 1.25, ease: "snap", eye: "btn2" },
  { f: L(P.tap2) + 4, cx: 966, cy: 478, z: 1.26, ease: "linear" },
  { f: L(P.cart3), cx: 980, cy: 330, z: 1.3, ease: "snap", eye: "cartWide" },
  { f: 100, cx: 986, cy: 316, z: 1.36, ease: "linear" },
];
validateCamera(CATALOG, catKeys, 100);
const catShot: WorldShot = {
  world: CATALOG, keys: catKeys,
  plate: [[0, "v3/catalog-1"], [L(P.tap1), "v3/catalog-2"], [L(P.tap2), "v3/catalog-3"]],
  cursor: [{ f: 0, x: 640, y: 980 }, ...press("btn1", L(P.tap1), L(P.tap1) - 6), ...press("btn2", L(P.tap2), L(P.tap2) - 6), { f: L(P.cart3) + 4, x: 1236, y: 132 }, { f: 100, x: 1240, y: 138 }],
  // kinetic type on the page's own empty background (right of the title), never on top of a control
  type: [{ text: "Three taps", box: "headline", dx: 560, dy: -16, from: L(P.cart3) - 2, to: 104, size: 40 }],
};

// ——— composited live-action screens (capture/composite2.py) ———
type Quads = { size: number[]; quads: number[][][]; aspect: number };
/** A point of the screen (u, v in 0..1 of the UI) in output pixels, at clip frame cf (bilinear in the fitted quad). */
const onScreen = (qj: Quads, cf: number, u: number, v: number) => {
  const q = qj.quads[Math.max(0, Math.min(qj.quads.length - 1, Math.round(cf)))];
  const top = [q[0][0] + (q[1][0] - q[0][0]) * u, q[0][1] + (q[1][1] - q[0][1]) * u];
  const bot = [q[3][0] + (q[2][0] - q[3][0]) * u, q[3][1] + (q[2][1] - q[3][1]) * u];
  const x = top[0] + (bot[0] - top[0]) * v, y = top[1] + (bot[1] - top[1]) * v;
  const s = Math.max(1920 / qj.size[0], 1080 / qj.size[1]);
  return { x: (x - qj.size[0] / 2) * s + 960, y: (y - qj.size[1] / 2) * s + 540 };
};
function Clip({ src, startFrom }: { src: string; startFrom: number }) {
  return <OffthreadVideo src={staticFile(src)} startFrom={startFrom} muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />;
}

// phone: the thumb's contact is clip frame 53 (24 fps); startFrom puts it on the tap beat
const PHONE_START = Math.round((53 / 24) * 30) - (P.phoneTap - P.phoneFrom) + 1;
const PH_INSET = 0.035;
const btnV = PH_INSET + (786 / (390 / (quadsPhone as Quads).aspect)) * (1 - PH_INSET); // the "1 in cart" row on the screen
function PhoneShot() {
  const f = useCurrentFrame();
  const cf = ((f + PHONE_START) / 30) * 24;
  const target = onScreen(quadsPhone as Quads, cf, 0.5, btnV);
  const mid = onScreen(quadsPhone as Quads, cf, 0.5, 0.5);
  // punch-in about the screen's centre: the whole screen, header included, stays in frame (owner notes V3.1 §4)
  const punch = f >= P.phonePunch - P.phoneFrom ? 1.22 : 1.0;
  const tPush = Math.max(0, (f - (P.pushFrom - P.phoneFrom)) / (P.catFrom - P.pushFrom));
  const k = Math.pow(tPush, 2.4);
  const sc = punch * interpolate(f, [0, 67], [1, 1.03]);
  const blur = k * 9;
  const len = P.catFrom - P.phoneFrom;
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${1 + k * 4.2})`, transformOrigin: `${target.x}px ${target.y}px`, filter: blur > 0.4 ? `blur(${blur}px)` : undefined }}>
        <AbsoluteFill style={{ transform: `scale(${sc})`, transformOrigin: `${mid.x}px ${mid.y}px` }}>
          <Clip src="v3/clips/f2/phone-2x.mp4" startFrom={PHONE_START} />
        </AbsoluteFill>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#fbf8f2", opacity: interpolate(f, [len - 4, len], [0, 0.9], clamp) }} />
    </AbsoluteFill>
  );
}

// monitor: the real admin order at monitor size; the confirmed composite takes over on the Confirm beat
const MON_START = 24;
const mb = (manifest as unknown as { shots: Record<string, { boxes: Record<string, { x: number; y: number; w: number; h: number }> }> }).shots["v3/m-order-new"].boxes.confirm;
function MonitorShot() {
  const f = useCurrentFrame();
  const len = P.stampFrom - P.monFrom;
  const cf = ((f + MON_START) / 30) * 24;
  const btn = onScreen(quadsMon as Quads, cf, (mb.x + mb.w / 2) / 1152, (mb.y + mb.h / 2) / 720);
  const pf = P.monPunch - P.monFrom;
  const punched = f >= pf;
  const sc = punched ? 1.75 * interpolate(f, [pf, len], [1, 1.06]) : interpolate(f, [0, pf], [1.0, 1.05]);
  const cfm = P.confirm - P.monFrom;
  return (
    <Whip len={len} inn={7}>
      <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
        <AbsoluteFill style={{ transform: `scale(${sc})`, transformOrigin: `${btn.x}px ${btn.y}px` }}>
          <Sequence durationInFrames={cfm}>
            <Clip src="v3/clips/f2/monitor-new-2x.mp4" startFrom={MON_START} />
          </Sequence>
          <Sequence from={cfm}>
            <Clip src="v3/clips/f2/monitor-confirmed-2x.mp4" startFrom={MON_START + cfm} />
          </Sequence>
        </AbsoluteFill>
      </AbsoluteFill>
    </Whip>
  );
}

// stamp insert: the strike (clip frame 55) on the beat; the press is ramped; the ink border shows from clip frame 106
const stampKeys = [[0, 38], [P.strike - P.stampFrom - 1, 54], [P.strike - P.stampFrom, 55], [P.strike - P.stampFrom + 8, 62], [P.strike - P.stampFrom + 14, 100], [P.tapeFrom - P.stampFrom, 117]];
/** CSS matrix3d mapping the unit square onto a quad [TL, TR, BR, BL] (a homography). */
function quadMatrix(q: number[][]) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den, h = (dx1 * sy - sx * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3;
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${h},0,0,1,0,${x0},${y0},0,1)`;
}
function StampShot() {
  const f = useCurrentFrame();
  const cf = remap(f, stampKeys);
  const s = shake(f, [P.strike - P.stampFrom], 10);
  const sc = interpolate(f, [0, P.tapeFrom - P.stampFrom], [1.0, 1.07]);
  // the ink letters sit inside the generated ink border (quad measured in the clip), multiplied into the paper
  const sz = (ink as { size: number[] }).size;
  const k = Math.max(1920 / sz[0], 1080 / sz[1]);
  const q = (ink as { quad: number[][] }).quad.map(([x, y]) => [(x - sz[0] / 2) * k + 960, (y - sz[1] / 2) * k + 540]);
  // reading order on the slip: left corner = top-left of the text, then top, right, bottom
  const [TL, TR, BR, BL] = [q[2], q[3], q[0], q[1]];
  const lerp = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const at = (u: number, v: number) => lerp(lerp(TL, TR, u), lerp(BL, BR, u), v);
  const inner = [at(0.16, 0.27), at(0.84, 0.27), at(0.84, 0.73), at(0.16, 0.73)];
  const show = cf >= 106 ? Math.min(1, (cf - 106) / 2) : 0;
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${s.x}px, ${s.y}px) scale(${sc})`, transformOrigin: "52% 62%" }}>
        <Frames dir="v3/clips/f2/stamp-b-t1" n={121} at={cf} />
        {show > 0 && (
          <div style={{ position: "absolute", left: 0, top: 0, width: 400, height: 100, transformOrigin: "0 0", transform: `${quadMatrix(inner)} scale(${1 / 400}, ${1 / 100})`, mixBlendMode: "multiply", opacity: 0.95 * show }}>
            <svg width={400} height={100} viewBox="0 0 400 100" style={{ display: "block", overflow: "visible" }}>
              <defs>
                <filter id="inkgrain" x="0" y="0" width="1" height="1">
                  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
                  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.2" result="holes" />
                  <feComposite in="SourceGraphic" in2="holes" operator="in" />
                  <feGaussianBlur stdDeviation="0.6" />
                </filter>
              </defs>
              <text x="200" y="74" textAnchor="middle" fontFamily={F.sans} fontWeight={800} fontSize="68" fill="#d4404c" filter="url(#inkgrain)" textLength="370" lengthAdjust="spacingAndGlyphs">CONFIRMED</text>
            </svg>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// tape: the flat hand pats the sealed box on the beat (clip frame 22)
const tapeKeys = [[0, 4], [P.pat - P.tapeFrom, 22], [P.vanFrom - P.tapeFrom, 34]];
function TapeShot() {
  const f = useCurrentFrame();
  const s = shake(f, [P.pat - P.tapeFrom], 6);
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${s.x}px, ${s.y}px) scale(${interpolate(f, [0, 34], [1.12, 1.02])})` }}>
        <Frames dir="v3/clips/f2/tape-b-t1" n={121} at={remap(f, tapeKeys)} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
// van: the side door slams on the beat (clip frame 34; the generated take re-opens the door after frame 38: unused)
const vanKeys = [[0, 8], [P.slam - P.vanFrom, 34], [P.sentFrom - P.vanFrom, 36.5]];
function VanShot() {
  const f = useCurrentFrame();
  const s = shake(f, [P.slam - P.vanFrom], 12);
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${s.x}px, ${s.y}px) scale(${interpolate(f, [0, 25], [1.0, 1.08])})` }}>
        <Frames dir="v3/clips/f2/van-b-t1" n={121} at={remap(f, vanKeys)} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function StampMark({ text, x, y, at, size = 60, rot = -8 }: { text: string; x: number; y: number; at: number; size?: number; rot?: number }) {
  const f = useCurrentFrame();
  if (f < at) return null;
  assertLine(text);
  const s = spring({ frame: f - at, fps: 30, config: { damping: 11, stiffness: 260 } });
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${1.6 - 0.6 * s})`, opacity: Math.min(1, (f - at + 1) / 2) * 0.9, border: `${size * 0.09}px solid #b5452b`, color: "#b5452b", borderRadius: size * 0.12, padding: `${size * 0.08}px ${size * 0.28}px`, fontFamily: F.sans, fontWeight: 800, fontSize: size, letterSpacing: "0.08em", mixBlendMode: "multiply", whiteSpace: "nowrap" }}>
      {text}
    </div>
  );
}
const SENT_START = Math.round(2.1 * 30) - (P.sent - P.sentFrom);
function SentShot() {
  const f = useCurrentFrame();
  const at = P.sent - P.sentFrom;
  const s = shake(f, [at], 9);
  const len = P.endFrom - P.sentFrom;
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${s.x}px, ${s.y}px) scale(${interpolate(f, [0, len], [1.0, 1.06])})`, transformOrigin: "44% 45%" }}>
        <Clip src="v3/clips/driver2-169-t2.mp4" startFrom={SENT_START} />
        <StampMark text="SENT" x={830} y={455} at={at} size={92} rot={-7} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: C.paper, opacity: interpolate(f, [len - 3, len], [0, 1], clamp) }} />
    </AbsoluteFill>
  );
}

function EndCard() {
  const f = useCurrentFrame();
  const beat = 1800 / 108;
  const s = spring({ frame: f, fps: 30, config: { damping: 13, stiffness: 170 } });
  const k = (b: number) => ease3((f - b * beat) / 8);
  // the button answers the grid twice after it lands (V3.1 §5: nothing holds longer than a beat)
  const bump = (at: number) => { const d = f - at * beat; return d >= 0 ? Math.sin(Math.min(1, d / 8) * Math.PI) * Math.exp(-d / 14) : 0; };
  const pulse = 1 + 0.07 * (bump(2.5) + bump(3.25));
  const line = assertLine(BRAND.tagline);
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26, transform: `scale(${interpolate(f, [0, 61], [1.0, 1.1])}) translateY(${interpolate(f, [0, 61], [10, -10])}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26, transform: `translateY(${(1 - s) * 40}px) scale(${0.86 + 0.14 * s})`, opacity: Math.min(1, s * 1.5) }}>
          <Mark size={110} draw={Math.min(1, s * 1.3)} fill={s} />
          <Wordmark size={96} reveal={Math.min(1, s * 1.2)} />
        </div>
        <div style={{ fontFamily: F.serif, fontSize: 46, color: C.tealDark, opacity: k(0.5), transform: `translateY(${(1 - k(0.5)) * 26}px)` }}>{line}</div>
        <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
          <div style={{ background: C.orange, color: "#fff", fontFamily: F.sans, fontWeight: 600, fontSize: 32, padding: "16px 34px", borderRadius: 999, opacity: k(1.25), transform: `translateY(${(1 - k(1.25)) * 26}px) scale(${pulse})` }}>Become a customer →</div>
          <div style={{ fontFamily: F.sans, fontSize: 30, color: C.soft, opacity: k(1.75), transform: `translateX(${(1 - k(1.75)) * -24}px)` }}>{BRAND.url}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

const seq = (from: number, to: number, el: React.ReactNode, name: string) => (
  <Sequence from={from} durationInFrames={to - from} name={name}>{el}</Sequence>
);
export function Promo20({ audioSrc }: { audioSrc?: string }) {
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {seq(0, P.ui1From, <Chop keys={chopKeys1} hits={P.chops} push={[1.0, 1.08]} />, "D chops")}
      {seq(P.ui1From, P.chop2From, <WorldView shot={teaserA} />, "D tap: cheddar")}
      {seq(P.chop2From, P.ui2From, <Chop keys={chopKeys2} hits={[P.chop4 - P.chop2From]} push={[1.16, 1.22]} />, "D chop 4")}
      {seq(P.ui2From, P.aFrom, <WorldView shot={teaserB} />, "D tap: salmon")}
      {seq(P.aFrom, P.phoneFrom, <HookA punchAt={P.aPunch - P.aFrom} />, "A 11:04 PM")}
      {seq(P.phoneFrom, P.catFrom, <PhoneShot />, "Marco's phone")}
      {seq(P.catFrom, P.monFrom, <Whip len={P.monFrom - P.catFrom} out={7}><WorldView shot={catShot} /></Whip>, "catalog")}
      {seq(P.monFrom, P.stampFrom, <MonitorShot />, "Salma's monitor")}
      {seq(P.stampFrom, P.tapeFrom, <StampShot />, "stamp")}
      {seq(P.tapeFrom, P.vanFrom, <TapeShot />, "tape")}
      {seq(P.vanFrom, P.sentFrom, <VanShot />, "van door")}
      {seq(P.sentFrom, P.endFrom, <SentShot />, "SENT")}
      {seq(P.endFrom, PROMO_FRAMES, <EndCard />, "end card")}
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
    </AbsoluteFill>
  );
}
