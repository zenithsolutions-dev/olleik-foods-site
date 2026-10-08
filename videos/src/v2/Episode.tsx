import React from "react";
import { AbsoluteFill, Img, Sequence, spring, staticFile, useCurrentFrame } from "remotion";
import manifest from "../../public/footage/manifest.json";
import { Mark, Wordmark } from "../components/Chrome";
import { F } from "../theme";
import { Marco, Salma, type Arm } from "./characters";
import { episodeOf } from "./episodes.mjs";
import { ez, INOUT, K, wob } from "./look";
import { FilmFX, Phone, RoughArrow, RoughCircle } from "./props";

type Rect = { x: number; y: number; w: number; h: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Beat = any;
const SHOTS = (manifest as { shots: Record<string, { device: string; boxes: Record<string, Rect> }> }).shots;

/** The guide in a round window, bottom-left: blinks, nods on the caption, and gestures (point, thumbs up, wave). */
function GuideBubble({ who, f, gesture, expr = "smile" }: { who: "marco" | "salma"; f: number; gesture?: string; expr?: "smile" | "focus" | "tired" | "neutral" | "surprised" | "wink" }) {
  const P = who === "marco" ? Marco : Salma;
  const g = ez(f, 10, 22, 0, 1, INOUT);
  const arm: Arm = gesture === "point" ? { sh: 30 + 85 * g, el: -20 * g } : gesture === "thumbs" ? { sh: 10 + 60 * g, el: 10 + 70 * g } : gesture === "wave" ? { sh: 150, el: 20 + 25 * Math.sin(f / 4) } : { sh: 10, el: 10 };
  const thumb = gesture === "thumbs" && g > 0.8 ? <path d="M -6 -10 L -6 -34 Q 2 -40 8 -30 L 8 -10 Z" fill={who === "marco" ? "#c98b62" : "#8d5a3b"} /> : null;
  const nod = Math.sin(Math.min(f, 24) / 4) * 3 * (f < 24 ? 1 : 0);
  const pop = spring({ frame: f, fps: 30, config: { damping: 13, stiffness: 160 } });
  return (
    <div style={{ position: "absolute", left: 50, bottom: 40, width: 290, height: 290, borderRadius: 145, background: who === "marco" ? K.amberSoft : "#dfe9e2", overflow: "hidden", border: `6px solid ${K.white}`, boxShadow: "0 20px 50px rgba(20,32,26,0.25)", transform: `scale(${0.6 + 0.4 * pop})`, zIndex: 50 }}>
      <div style={{ position: "absolute", left: -10, top: 20, width: 310, height: 465 }}>
        <P expr={expr} blink={f % 75 > 71 ? 1 : 0} turn={0.35} tilt={nod} armR={arm} hold={{ right: thumb }} />
      </div>
    </div>
  );
}

/** A step number that prints as a little order ticket (top right). */
function StepTicket({ n, f }: { n: number; f: number }) {
  const p = ez(f, 4, 18, 0, 1, INOUT);
  return (
    <div style={{ position: "absolute", right: 90, top: 0, width: 150, height: 190 * p, overflow: "hidden", zIndex: 40 }}>
      <div style={{ position: "absolute", bottom: 0, width: 150, height: 190, background: "#fffdf6", boxShadow: "0 12px 26px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Courier New', monospace", color: K.ink }}>
        <div style={{ fontSize: 22, letterSpacing: "0.2em" }}>STEP</div>
        <div style={{ fontFamily: F.sans, fontWeight: 900, fontSize: 96, lineHeight: 1, color: K.amber }}>{n}</div>
        <div style={{ width: 110, borderTop: `2px dashed ${K.steelDark}`, marginTop: 8 }} />
      </div>
    </div>
  );
}

/** The burned-in caption (English, sentence case). */
function Caption({ text, f, len }: { text: string; f: number; len: number }) {
  const p = ez(f, 6, 14);
  const o = 1 - ez(f, len - 6, len);
  return (
    <div style={{ position: "absolute", left: 380, right: 120, bottom: 54, display: "flex", justifyContent: "center", zIndex: 45, opacity: p * o, transform: `translateY(${(1 - p) * 16}px)` }}>
      <div style={{ background: "rgba(14,44,32,0.92)", color: "#fff", fontFamily: F.sans, fontWeight: 600, fontSize: 44, lineHeight: 1.2, padding: "16px 34px", borderRadius: 18, textAlign: "center", boxShadow: "0 16px 40px rgba(0,0,0,0.25)" }}>{text}</div>
    </div>
  );
}

/** A real desktop capture in a browser frame, with the camera easing onto the box and a marker circle drawing on it. */
function DesktopShot({ b, f, len }: { b: Beat; f: number; len: number }) {
  const shot = SHOTS[b.shot];
  const r: Rect = shot.boxes[b.box];
  const W = 1240;
  const H = (W * 900) / 1440;
  const k = W / 1440;
  // b.zoom forces a tighter crop (e.g. to keep the site's placeholder stats out of frame)
  const zT = b.zoom ?? Math.min(2.2, Math.max(1.15, Math.min((1440 * 0.62) / Math.max(r.w, 1), (900 * 0.55) / Math.max(r.h, 1))));
  const z = 1 + (zT - 1) * ez(f, 4, 34, 0, 1, INOUT) + 0.04 * (f / len);
  const s = k * z;
  const hx = W / 2 / s;
  const hy = H / 2 / s;
  const cx = Math.min(1440 - hx, Math.max(hx, r.x + r.w / 2));
  const cy = Math.min(900 - hy, Math.max(hy, r.y + r.h / 2));
  const swap = b.then && f > len * 0.55 ? ez(f, len * 0.55, len * 0.55 + 8) : 0;
  const rise = spring({ frame: f, fps: 30, config: { damping: 18, stiffness: 120 } });
  return (
    <div style={{ position: "absolute", left: 500, top: 56, width: W, transform: `translateY(${(1 - rise) * 80}px) rotate(${wob(4, f, 0.25, 0.04)}deg)`, opacity: rise }}>
      <div style={{ borderRadius: 18, overflow: "hidden", boxShadow: "0 30px 80px rgba(20,32,26,0.28)", background: "#fff" }}>
        <div style={{ height: 40, background: "#f6f2e8", display: "flex", alignItems: "center", gap: 8, padding: "0 16px" }}>
          {["#e9a28c", "#efcf8a", "#9cc9a6"].map((c) => <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />)}
          <div style={{ margin: "0 auto", fontFamily: F.sans, fontSize: 15, color: "#586056", background: "#fff", borderRadius: 12, padding: "4px 18px" }}>olleik-foods-site.vercel.app</div>
        </div>
        <div style={{ width: W, height: H, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 1440, height: 900, transformOrigin: "0 0", transform: `translate(${W / 2}px, ${H / 2}px) scale(${s}) translate(${-cx}px, ${-cy}px)` }}>
            <Img src={staticFile(`footage/${b.shot}.png`)} style={{ position: "absolute", width: 1440, height: 900 }} />
            {b.then && <Img src={staticFile(`footage/${b.then}.png`)} style={{ position: "absolute", width: 1440, height: 900, opacity: swap }} />}
            <svg width={1440} height={900} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
              <RoughCircle r={r} p={ez(f, 26, 44)} width={5 / z} seed={b.box.length} />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A real phone capture, the phone held up in the frame; marker circle and arrow on the box. */
function PhoneShot({ b, f, len }: { b: Beat; f: number; len: number }) {
  const r: Rect = SHOTS[b.shot].boxes[b.box];
  const z = 1.15 + 0.05 * (f / len);
  const swap = b.then ? (f > len * 0.55 ? ez(f, len * 0.55, len * 0.55 + 8) : 0) : 0;
  const rise = spring({ frame: f, fps: 30, config: { damping: 18, stiffness: 110 } });
  return (
    <>
      <div style={{ position: "absolute", left: 1000, top: 540, transform: `translate(-50%, -50%) translateY(${(1 - rise) * 200}px) rotate(${-3 + wob(5, f, 0.8, 0.05)}deg)` }}>
        <Phone w={430} src={b.then ?? b.shot} prev={b.then ? b.shot : undefined} mix={b.then ? swap : 1} cam={{ rect: { x: 0, y: Math.max(0, r.y - 330), w: 390, h: 660 }, z }}>
          <svg width={390} height={844} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            <RoughCircle r={r} p={ez(f, 24, 42)} width={4} seed={b.box.length} />
          </svg>
        </Phone>
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible", zIndex: 30 }}>
        <RoughArrow from={{ x: 560, y: 300 }} to={{ x: 760, y: 460 }} p={ez(f, 36, 52)} />
      </svg>
    </>
  );
}

function ScreenBeat({ b, f, len, guide }: { b: Beat; f: number; len: number; guide: "marco" | "salma" }) {
  const phone = SHOTS[b.shot].device === "phone";
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 100% at 60% 0%, #fffdf6 0%, ${K.paper} 55%, ${K.paper2} 100%)` }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.06 }}>
        {Array.from({ length: 40 }, (_, i) => <line key={i} x1={i * 48} y1={0} x2={i * 48} y2={1080} stroke={K.green} />)}
      </svg>
      {phone ? <PhoneShot b={b} f={f} len={len} /> : <DesktopShot b={b} f={f} len={len} />}
      {b.step && <StepTicket n={b.step} f={f} />}
      <GuideBubble who={guide} f={f} gesture={b.gesture} expr={b.gesture ? "smile" : "focus"} />
      <Caption text={b.caption} f={f} len={len} />
      <FilmFX f={f} />
    </AbsoluteFill>
  );
}

function ProblemBeat({ b, f, guide }: { b: Beat; f: number; guide: "marco" | "salma" }) {
  const P = guide === "marco" ? Marco : Salma;
  const words = String(b.line).split(" ");
  return (
    <AbsoluteFill style={{ background: `radial-gradient(100% 90% at 30% 20%, ${K.night2} 0%, ${K.deep} 70%)` }}>
      <div style={{ position: "absolute", left: 140, top: 300, width: 1100, display: "flex", flexWrap: "wrap", columnGap: 28, rowGap: 8 }}>
        {words.map((w, i) => {
          const p = ez(f, 4 + i * 3, 14 + i * 3);
          return <span key={i} style={{ fontFamily: i === words.length - 1 ? F.serif : F.sans, fontStyle: i === words.length - 1 ? "italic" : "normal", fontWeight: i === words.length - 1 ? 600 : 900, fontSize: 104, color: i === words.length - 1 ? K.amber : "#fff", letterSpacing: "-0.04em", transform: `translateY(${(1 - p) * 40}px) rotate(${(1 - p) * -4}deg)`, opacity: p, display: "inline-block" }}>{w}</span>;
        })}
      </div>
      <div style={{ position: "absolute", left: 1320, top: 330, width: 460, height: 690 }}>
        <P expr="surprised" turn={-0.4} blink={f % 60 > 56 ? 1 : 0} armL={{ sh: 40, el: 50 }} armR={{ sh: 40, el: 50 }} tilt={wob(2, f, 2, 0.2)} />
      </div>
      <FilmFX f={f} dark />
    </AbsoluteFill>
  );
}

function NextBeat({ b, f, guide }: { b: Beat; f: number; guide: "marco" | "salma" }) {
  const P = guide === "marco" ? Marco : Salma;
  return (
    <AbsoluteFill style={{ background: K.paper }}>
      <div style={{ position: "absolute", left: 160, top: 380, fontFamily: F.sans, fontWeight: 800, fontSize: 40, letterSpacing: "0.2em", color: K.amber, opacity: ez(f, 0, 8) }}>COMING UP</div>
      <div style={{ position: "absolute", left: 160, top: 440, fontFamily: F.serif, fontWeight: 600, fontSize: 110, color: K.deep, transform: `translateX(${(1 - ez(f, 4, 16)) * -120}px)`, opacity: ez(f, 4, 14) }}>{b.line}</div>
      <div style={{ position: "absolute", left: 1350, top: 330, width: 460, height: 690 }}>
        <P expr="smile" turn={0.3} armR={{ sh: 150, el: 20 + 25 * Math.sin(f / 4) }} blink={f % 50 > 46 ? 1 : 0} />
      </div>
      <FilmFX f={f} />
    </AbsoluteFill>
  );
}

function TitleBeat({ b, f, guide }: { b: Beat; f: number; guide: "marco" | "salma" }) {
  const P = guide === "marco" ? Marco : Salma;
  const printed = ez(f, 6, 40, 0, 1, INOUT);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(100% 90% at 50% 0%, #fffdf6 0%, ${K.paper} 60%)` }}>
      <div style={{ position: "absolute", left: 240, top: 120, width: 640, height: 34, borderRadius: 10, background: "#101714" }} />
      <div style={{ position: "absolute", left: 280, top: 150, width: 560, height: 700 * printed, overflow: "hidden" }}>
        <div style={{ position: "absolute", bottom: 0, width: 560, height: 700, background: "#fffdf6", boxShadow: "0 18px 40px rgba(0,0,0,0.18)", padding: 50, boxSizing: "border-box" }}>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 26, letterSpacing: "0.2em", color: K.ink }}>OLLEIK FOODS · HOW-TO</div>
          <div style={{ borderTop: `3px dashed ${K.steelDark}`, margin: "24px 0" }} />
          <div style={{ fontFamily: F.serif, fontWeight: 600, fontSize: 84, lineHeight: 1.02, color: K.deep }}>{b.title}</div>
          <div style={{ fontFamily: F.sans, fontSize: 36, color: "#586056", marginTop: 24 }}>{b.line}</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 1150, top: 300, width: 480, height: 720 }}>
        <P expr="wink" turn={-0.3} armR={{ sh: 70, el: 80 }} blink={0} />
      </div>
      <FilmFX f={f} />
    </AbsoluteFill>
  );
}

function OutroBeat({ b, f, guide }: { b: Beat; f: number; guide: "marco" | "salma" }) {
  const P = guide === "marco" ? Marco : Salma;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(100% 90% at 50% 20%, #245a43 0%, ${K.green} 45%, ${K.deep} 100%)` }}>
      <div style={{ position: "absolute", left: 200, top: 300, display: "flex", flexDirection: "column", gap: 26, opacity: ez(f, 0, 10) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <Mark size={120} tile={K.amber} />
          <Wordmark size={100} dark />
        </div>
        <div style={{ fontFamily: F.serif, fontStyle: "italic", fontSize: 46, color: "rgba(255,255,255,0.86)" }}>{b.line}</div>
        <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 44, color: "#fff" }}>{b.url}</div>
      </div>
      <div style={{ position: "absolute", left: 1300, top: 330, width: 460, height: 690 }}>
        <P expr="smile" turn={-0.2} armR={{ sh: 70, el: 80 }} hold={{ right: <path d="M -6 -10 L -6 -34 Q 2 -40 8 -30 L 8 -10 Z" fill={guide === "marco" ? "#c98b62" : "#8d5a3b"} /> }} blink={f % 60 > 56 ? 1 : 0} />
      </div>
      <FilmFX f={f} />
    </AbsoluteFill>
  );
}

function BeatBody({ b, guide }: { b: Beat; guide: "marco" | "salma" }) {
  const f = useCurrentFrame();
  const len = b.to - b.from;
  if (b.kind === "screen") return <ScreenBeat b={b} f={f} len={len} guide={guide} />;
  if (b.kind === "problem") return <ProblemBeat b={b} f={f} guide={guide} />;
  if (b.kind === "next") return <NextBeat b={b} f={f} guide={guide} />;
  if (b.kind === "title") return <TitleBeat b={b} f={f} guide={guide} />;
  return <OutroBeat b={b} f={f} guide={guide} />;
}

/** One manual episode (V2): the visitor manual or an admin episode, from episodes.mjs. */
export function Episode({ ep }: { ep: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const E: any = episodeOf(ep);
  return (
    <AbsoluteFill style={{ background: K.paper }}>
      {E.beats.map((b: Beat, i: number) => (
        <Sequence key={i} from={b.from} durationInFrames={b.to - b.from}>
          <BeatBody b={b} guide={E.guide} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
