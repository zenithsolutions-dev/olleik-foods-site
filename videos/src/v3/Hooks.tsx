import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { Box } from "./camera";
import { Tiles } from "./World";

/**
 * Five 3-second hook motion tests (CREATIVE_BRIEF_V3 §3). Rules: the first 1.5 s (45 frames) has no logo and no UI,
 * only one picture and one sound that make you ask "what is this?"; at 1.5 s the hook "snaps" (the 108 BPM grid starts
 * there) and turns into the product. Every UI on screen is a crop of a real capture; every photo is a real catalog photo.
 */
export const HOOK_FRAMES = 90;
export const SNAP = 45;
const BEAT = 1800 / 108; // 16.667 frames

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** A region of a real capture drawn at (x, y) with scale s (output px per CSS px). */
function Capture({ file, b, x, y, s, radius = 0, style }: { file: string; b: Box; x: number; y: number; s: number; radius?: number; style?: React.CSSProperties }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: b.w * s, height: b.h * s, overflow: "hidden", borderRadius: radius * s, ...style }}>
      <Tiles file={file} y0={b.y} y1={b.y + b.h} s={s} ox={-b.x * s} oy={-b.y * s} />
    </div>
  );
}
const CARD = { basil: { x: 168, y: 1255, w: 357, h: 439 }, lemons: { x: 541, y: 1710, w: 357, h: 439 }, tomatoes: { x: 541, y: 2620, w: 357, h: 439 } };
const CART = { x: 1158, y: 64, w: 118, h: 52 };

/** Frame-sequence clip with a time map (hook frame → clip frame, 24 fps source). */
function Seq({ dir, n, at }: { dir: string; n: number; at: number }) {
  const i = Math.max(1, Math.min(n, Math.round(at) + 1));
  return <Img src={staticFile(`v3/clips/${dir}/${String(i).padStart(3, "0")}.jpg`)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />;
}

// ——— H-A "The 11:04 PM text" ———
const TEXTS = ["Can you add 2 cases of tomatoes?", "and lemons", "sorry, 3 cases", "did you get my last msg?", "Need it by morning", "+ basil", "Call me", "??"];
export function HookA() {
  const f = useCurrentFrame();
  const unread = Math.min(37, Math.floor(interpolate(f, [0, 42], [9, 37], clamp)));
  const snap = f >= SNAP;
  return (
    <AbsoluteFill style={{ background: "#05070a" }}>
      <AbsoluteFill style={{ transform: `scale(${1.04 + f * 0.0012})` }}>
        <Seq dir="ha-thumb" n={121} at={interpolate(f, [0, 90], [0, 62])} />
      </AbsoluteFill>
      {/* messages stack above the phone: functional type, phone-notification shapes (no app chrome, no logos) */}
      <AbsoluteFill style={{ opacity: snap ? interpolate(f, [SNAP, SNAP + 10], [1, 0], clamp) : 1 }}>
        {TEXTS.map((t, i) => {
          const at = 4 + i * 5;
          const k = spring({ frame: f - at, fps: 30, config: { damping: 14, stiffness: 160 } });
          if (f < at) return null;
          return (
            <div key={i} style={{ position: "absolute", left: 1180 + (i % 2) * 36, top: 120 + i * 74 - (f - at) * 0.6, transform: `translateY(${(1 - k) * -30}px) scale(${0.9 + 0.1 * k})`, opacity: k * (1 - i * 0.06), background: "rgba(245,245,247,0.92)", borderRadius: 22, padding: "16px 26px", fontFamily: F.sans, fontSize: 30, color: "#111", boxShadow: "0 10px 30px rgba(0,0,0,.45)", whiteSpace: "nowrap" }}>
              {t}
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 1086, top: 112, width: 74, height: 74, borderRadius: 37, background: "#e5484d", color: "white", fontFamily: F.sans, fontWeight: 700, fontSize: 36, display: "grid", placeItems: "center", transform: `scale(${1 + 0.2 * Math.max(0, Math.sin(f * 1.3)) * (f < SNAP ? 1 : 0)})` }}>
          {unread}
        </div>
      </AbsoluteFill>
      {/* the snap: the screen light floods, the line lands (expressive type) */}
      {snap && <AbsoluteFill style={{ background: "#fbf8f2", opacity: interpolate(f, [SNAP, SNAP + 3, SNAP + 14], [0, 0.85, 0], clamp) }} />}
      {snap && (
        <div style={{ position: "absolute", left: 140, top: 430, fontFamily: F.serif, fontWeight: 700, fontSize: 112, letterSpacing: "-0.03em", color: "#fbf8f2", opacity: interpolate(f, [SNAP + 4, SNAP + 12], [0, 1], clamp), transform: `translateY(${(1 - ease((f - SNAP - 4) / 12)) * 30}px)`, textShadow: "0 4px 30px rgba(0,0,0,.6)" }}>
          One more text.
          <div style={{ fontFamily: F.sans, fontWeight: 500, fontSize: 40, letterSpacing: 0, opacity: 0.85, marginTop: 8 }}>11:04 PM</div>
        </div>
      )}
    </AbsoluteFill>
  );
}

// ——— H-B "Price roulette" ———
const PRICES = ["$41.20", "$38.90", "$44.10", "$39.75", "$43.30", "$40.60", "$46.45"];
export function HookB() {
  const f = useCurrentFrame();
  // reel: one long eased spin (fast start, slow landing) that stops on the account's real price exactly on the snap
  const TARGET = 7 * 6 + 6; // six full turns, then "$46.45"
  const reel = TARGET * (1 - Math.pow(1 - Math.min(1, f / SNAP), 3));
  const morph = ease((f - SNAP - 6) / 18);
  return (
    <AbsoluteFill style={{ background: "#efe9dd" }}>
      {/* the same crate of tomatoes: the real catalog photo */}
      <AbsoluteFill style={{ opacity: 1 - morph }}>
        <Img src={staticFile("v3/products/PRD-001.jpg")} style={{ position: "absolute", left: 120, top: 120, width: 1100, height: 822, objectFit: "cover", borderRadius: 24, transform: `scale(${1.02 + Math.sin(f / 9) * 0.004})` }} />
        <div style={{ position: "absolute", left: 1300, top: 380, width: 500, height: 200, overflow: "hidden", borderRadius: 26, background: "#14201a", boxShadow: "inset 0 18px 24px rgba(0,0,0,.6), inset 0 -18px 24px rgba(0,0,0,.6)" }}>
          {Array.from({ length: 5 }, (_, k) => {
            const j = Math.floor(reel) - 2 + k;
            const label = PRICES[((j % 7) + 7) % 7];
            const speed = f < SNAP ? 3 * TARGET * Math.pow(1 - f / SNAP, 2) / SNAP : 0;
            return (
              <div key={j} style={{ position: "absolute", left: 0, width: 500, top: 50 + (j - reel) * 120, textAlign: "center", fontFamily: F.sans, fontWeight: 700, fontSize: 92, lineHeight: "100px", color: f >= SNAP && label === "$46.45" ? C.accentSoft : "#fbf8f2", filter: speed > 0.15 ? `blur(${Math.min(8, speed * 6)}px)` : undefined }}>
                {label}
              </div>
            );
          })}
        </div>
        <div style={{ position: "absolute", left: 1300, top: 610, width: 500, textAlign: "center", fontFamily: F.serif, fontWeight: 700, fontSize: 56, color: C.tealDark, opacity: interpolate(f, [SNAP, SNAP + 8], [0, 1], clamp) }}>your price.</div>
      </AbsoluteFill>
      {/* the lock turns into the real catalog card with that price */}
      {f >= SNAP && (
        <Capture file="v3/catalog-3" b={CARD.tomatoes} s={2.0} radius={16} x={interpolate(morph, [0, 1], [1100, 603])} y={interpolate(morph, [0, 1], [380, 101])} style={{ opacity: morph, transform: `scale(${0.6 + 0.4 * morph})`, transformOrigin: "50% 50%", boxShadow: "0 30px 60px rgba(20,32,26,.18)" }} />
      )}
    </AbsoluteFill>
  );
}

// ——— H-C "Receipt rain" ———
const SLIPS = Array.from({ length: 34 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { x: r(1) * 1920 - 120, delay: r(2) * 10 - 14, speed: 16 + r(3) * 14, rot: (r(4) - 0.5) * 80, spin: (r(5) - 0.5) * 9, w: 150 + r(6) * 80, tilt: (r(7) - 0.5) * 60 };
});
function Slip({ w, lines = 6 }: { w: number; lines?: number }) {
  return (
    <div style={{ width: w, height: w * 1.45, background: "#fffdf8", borderRadius: 4, boxShadow: "0 8px 18px rgba(0,0,0,.25)", padding: w * 0.1, boxSizing: "border-box", clipPath: "polygon(0 0,100% 0,100% 96%,92% 100%,84% 96%,76% 100%,68% 96%,60% 100%,52% 96%,44% 100%,36% 96%,28% 100%,20% 96%,12% 100%,4% 96%,0 100%)" }}>
      {Array.from({ length: lines }, (_, i) => <div key={i} style={{ height: w * 0.045, width: `${55 + ((i * 37) % 40)}%`, background: "#c9c2b2", borderRadius: 4, marginBottom: w * 0.09 }} />)}
    </div>
  );
}
export function HookC() {
  const f = useCurrentFrame();
  const land = ease((f - 20) / (SNAP - 20)); // the hero slip falls and lands flat in the centre on the snap
  const morph = ease((f - SNAP) / 16);
  const ORDER = { x: 350, y: 178, w: 748, h: 318 };
  return (
    <AbsoluteFill style={{ background: "#2a2f2b" }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 40%, #3b423d 0%, #1b1f1c 70%)" }} />
      {SLIPS.map((s, i) => {
        const t = f - s.delay;
        if (t < 0) return null;
        const y = -260 + t * s.speed + (f >= SNAP ? (f - SNAP) * 30 : 0);
        return (
          <div key={i} style={{ position: "absolute", left: s.x, top: y, transform: `perspective(900px) rotate(${s.rot + t * s.spin}deg) rotateX(${s.tilt + Math.sin(t / 5) * 40}deg)`, opacity: f >= SNAP ? 1 - morph * 0.6 : 1, filter: `blur(${i % 3 === 0 ? 2 : 0}px)` }}>
            <Slip w={s.w} />
          </div>
        );
      })}
      {/* hero slip */}
      <div style={{ position: "absolute", left: 960, top: interpolate(land, [0, 1], [-300, 540]), transform: `translate(-50%,-50%) perspective(1000px) rotate(${(1 - land) * 35}deg) rotateX(${(1 - land) * 55}deg) scale(${1 + land * 0.6 + morph * 1.2})`, opacity: 1 - morph }}>
        <Slip w={260} lines={7} />
      </div>
      {f >= SNAP && (
        <AbsoluteFill style={{ opacity: morph }}>
          <AbsoluteFill style={{ background: "#faf6ec", opacity: morph }} />
          <Capture file="v3/order-placed" b={ORDER} s={2.2} radius={0} x={960 - (ORDER.w * 2.2) / 2} y={540 - (ORDER.h * 2.2) / 2} style={{ transform: `scale(${0.8 + 0.2 * morph})`, transformOrigin: "50% 50%", WebkitMaskImage: "linear-gradient(to bottom, #000 82%, transparent 100%)", maskImage: "linear-gradient(to bottom, #000 82%, transparent 100%)" }} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

// ——— H-D "Two hands" ———
// Clip impact frames (24 fps source, measured from motion) are re-timed onto the 108 BPM grid: each chop lands on a beat.
const IMPACTS = [11, 27, 51, 66, 90, 106];
const BEATS = IMPACTS.map((_, k) => 6 + k * BEAT);
const clipAt = (f: number) => {
  if (f <= BEATS[0]) return IMPACTS[0] - (BEATS[0] - f) * 0.8;
  for (let k = 0; k < BEATS.length - 1; k++) if (f <= BEATS[k + 1]) return interpolate(f, [BEATS[k], BEATS[k + 1]], [IMPACTS[k], IMPACTS[k + 1]]);
  return IMPACTS[IMPACTS.length - 1] + (f - BEATS[BEATS.length - 1]) * 0.8;
};
export const HOOK_D_BEATS = BEATS;
export function HookD() {
  const f = useCurrentFrame();
  const split = ease((f - SNAP) / 12);
  const adds = BEATS.filter((b) => b > SNAP && f >= b);
  const cards = [CARD.basil, CARD.lemons, CARD.tomatoes];
  return (
    <AbsoluteFill style={{ background: "#0f1210" }}>
      <AbsoluteFill style={{ width: 1920 - 760 * split, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, width: 1920, left: -200 * split }}>
          <Seq dir="hd-chop" n={121} at={clipAt(f)} />
        </div>
      </AbsoluteFill>
      {f >= SNAP && (
        <AbsoluteFill style={{ left: 1920 - 760 * split, width: 760, background: "#f6f2e8", overflow: "hidden" }}>
          <Capture file={["v3/catalog-0", "v3/catalog-1", "v3/catalog-2", "v3/catalog-3"][adds.length]} b={CART} s={2.6} x={760 - CART.w * 2.6 - 40} y={50} style={{ transform: `scale(${1 + 0.3 * Math.max(0, 1 - (f - (adds[adds.length - 1] ?? -99)) / 10)})`, transformOrigin: "50% 50%" }} />
          {adds.map((b, i) => {
            const k = spring({ frame: f - b, fps: 30, config: { damping: 12, stiffness: 170 } });
            return <Capture key={i} file="v3/catalog-3" b={cards[i]} s={0.95} radius={16} x={40 + i * 225} y={interpolate(k, [0, 1], [-500, 260 + i * 34])} style={{ transform: `rotate(${(i - 1) * 4}deg)`, boxShadow: "0 18px 40px rgba(20,32,26,.2)" }} />;
          })}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

// ——— H-E "The wall of sticky notes" ———
const NOTE_COLORS = ["#f7e27a", "#f5b6c4", "#a9d8f0", "#f7e27a", "#c7e9a3", "#f9c784"];
export function HookE() {
  const f = useCurrentFrame();
  const cols = 9, rows = 5, w = 1920 / cols, h = 1080 / rows;
  return (
    <AbsoluteFill style={{ background: "#faf6ec" }}>
      {/* under the wall: the real catalog grid, photos and all */}
      <AbsoluteFill style={{ transform: `scale(${interpolate(f, [SNAP, 90], [1.12, 1.0], clamp)})` }}>
        <Tiles file="v3/catalog-0" y0={300} y1={1240} s={1.42} ox={-108 * 1.42 + 18} oy={-300 * 1.42 + 70} />
      </AbsoluteFill>
      {Array.from({ length: cols * rows }, (_, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        const rnd = ((Math.sin(i * 91.7) * 1e4) % 1 + 1) % 1;
        const start = SNAP + c * 2.2 + r * 0.8 + rnd * 4; // the wall peels away in a wave from left to right
        const t = Math.max(0, f - start);
        const peel = Math.min(1, t / 14);
        const flutter = f < SNAP ? Math.sin(f / 3 + i) * 2.5 * (rnd > 0.6 ? 1 : 0.3) : 0;
        if (peel >= 1 && t > 22) return null;
        return (
          <div key={i} style={{ position: "absolute", left: c * w - 8 + rnd * 12, top: r * h - 8 + ((i * 7) % 11), width: w + 14, height: h + 14, transformOrigin: "50% 0%", transform: `perspective(800px) rotate(${(rnd - 0.5) * 7 + flutter}deg) rotateX(${-peel * 110}deg) translateY(${t > 10 ? (t - 10) * 40 : 0}px)`, background: NOTE_COLORS[i % NOTE_COLORS.length], boxShadow: `0 ${4 + peel * 20}px ${10 + peel * 30}px rgba(0,0,0,${0.18 + peel * 0.2})`, padding: 22, boxSizing: "border-box" }}>
            {Array.from({ length: 3 + (i % 3) }, (_, j) => <div key={j} style={{ height: 7, width: `${40 + ((i * 13 + j * 29) % 50)}%`, background: "rgba(20,32,26,.55)", borderRadius: 4, marginBottom: 18, transform: `rotate(${((i + j) % 5) - 2}deg)` }} />)}
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

export const HOOKS = { A: HookA, B: HookB, C: HookC, D: HookD, E: HookE } as const;
