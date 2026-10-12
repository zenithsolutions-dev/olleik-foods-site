import React from "react";
import { AbsoluteFill, Audio, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame } from "remotion";
import { Mark, Wordmark } from "../components/Chrome";
import { C, F } from "../theme";
import { CSeg, Cut, LOOP_XF, V_PHONE_TAP, VERT, VSNAP } from "./cuts";
import { Whip } from "./Episode3";
import { assertLine } from "./lines";
import { EndCard, Promo20, shake } from "./Promo20";
import { Tiles, WorldView } from "./World";
import quadsMon from "../../public/v3/clips/f2/monitor.quads.json";
import manifest from "../../public/footage/manifest.json";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const BEAT = 1800 / 108;

/** A range of the approved 20 s promo, from its frame `a`. */
function PromoRange({ a }: { a: number }) {
  return (
    <Sequence from={-a}>
      <Promo20 />
    </Sequence>
  );
}

/** Live action with a line that lands on beat 1 (16:9 or 9:16). */
function Live({ seg }: { seg: Extract<CSeg, { kind: "live" }> }) {
  const f = useCurrentFrame();
  const at = Math.round(BEAT);
  const k = easeOut((f - at) / 9);
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${1.04 + f * 0.0022})`, transformOrigin: "55% 45%" }}>
        <OffthreadVideo src={staticFile(seg.src)} startFrom={Math.round(seg.start * 30)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      {seg.line && (
        <>
          <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(5,10,8,.6) 0%, rgba(5,10,8,.12) 62%, transparent 100%)", opacity: k }} />
          <div style={{ position: "absolute", left: 120, top: 410, width: 1100, fontFamily: F.serif, fontWeight: 700, fontSize: 88, lineHeight: 1.04, letterSpacing: "-0.03em", color: "#fbf8f2", opacity: k, transform: `translateY(${(1 - k) * 40}px) skewX(${(1 - k) * -8}deg)`, textShadow: "0 4px 30px rgba(0,0,0,.5)" }}>
            {assertLine(seg.line)}
          </div>
        </>
      )}
    </AbsoluteFill>
  );
}

/** A kinetic line on the brand colour. */
function Card({ seg }: { seg: Extract<CSeg, { kind: "card" }> }) {
  const f = useCurrentFrame();
  const k = easeOut((f - 3) / 10);
  const k2 = easeOut((f - 12) / 10);
  return (
    <AbsoluteFill style={{ background: C.tealDark, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 180, top: 390, transform: `translateX(${(1 - k) * 200 + f * 1.4}px) skewX(${(1 - k) * -10}deg)`, opacity: k }}>
        <div style={{ fontFamily: F.serif, fontWeight: 700, fontSize: 120, letterSpacing: "-0.03em", color: C.paper }}>{assertLine(seg.line)}</div>
        {seg.sub && <div style={{ fontFamily: F.sans, fontSize: 40, color: C.orange, marginTop: 14, opacity: k2, transform: `translateY(${(1 - k2) * 16}px)` }}>{assertLine(seg.sub)}</div>}
      </div>
    </AbsoluteFill>
  );
}

function Seg16({ s }: { s: CSeg }) {
  if (s.kind === "promo") return <PromoRange a={s.a} />;
  if (s.kind === "beat") return <Whip dur={s.dur} whipIn={s.whipIn} whipOut={s.whipOut}><WorldView shot={s.shot} /></Whip>;
  if (s.kind === "live") return <Live seg={s} />;
  if (s.kind === "card") return <Card seg={s} />;
  return <EndCard line={s.line} />;
}

/** 16:9 cuts (60 s, 30 s, 6 s) and the 10 s loop (its last LOOP_XF frames dissolve into its first: a seamless loop). */
export function CutFilm({ cut, audioSrc }: { cut: Cut; audioSrc?: string }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {cut.segs.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.dur}>
          {cut.loop && i === cut.segs.length - 1 ? (
            // SENT ends on paper; the paper dissolves into the loop's first frames (the catalog), so frame 0 follows on
            <>
              <AbsoluteFill style={{ background: C.paper }} />
              <AbsoluteFill style={{ opacity: interpolate(f - s.from, [0, LOOP_XF - 1], [1 / LOOP_XF, 1], clamp) }}>
                <PromoRange a={(s as Extract<CSeg, { kind: "promo" }>).a} />
              </AbsoluteFill>
            </>
          ) : (
            <Seg16 s={s} />
          )}
        </Sequence>
      ))}
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
    </AbsoluteFill>
  );
}

/** 1:1: the 16:9 promo letterboxed into the square between two brand bands; the end card full frame. */
export function SquareFilm({ cut, audioSrc }: { cut: Cut; audioSrc?: string }) {
  const f = useCurrentFrame();
  const end = cut.segs.find((s) => s.kind === "end")!;
  const k = spring({ frame: f, fps: 30, config: { damping: 14, stiffness: 140 } });
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Sequence durationInFrames={end.from}>
        <AbsoluteFill>
          <div style={{ position: "absolute", left: 0, top: 236, width: 1920, height: 1080, transform: "scale(0.5625)", transformOrigin: "0 0", overflow: "hidden" }}>
            <PromoRange a={0} />
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 236, display: "flex", alignItems: "center", justifyContent: "center", gap: 18, transform: `translateY(${(1 - k) * -30 + Math.sin(f / 20) * 3}px)` }}>
            <Mark size={58} draw={Math.min(1, k * 1.3)} fill={k} />
            <Wordmark size={50} reveal={Math.min(1, k * 1.2)} />
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 844, height: 236, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.serif, fontSize: 44, color: C.tealDark, transform: `translateY(${Math.cos(f / 20) * 3}px)`, opacity: easeOut((f - 10) / 12) }}>
            {assertLine("The supplier behind great kitchens")}
          </div>
        </AbsoluteFill>
      </Sequence>
      <Sequence from={end.from} durationInFrames={end.dur}>
        <EndCard line={(end as Extract<CSeg, { kind: "end" }>).line} />
      </Sequence>
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
    </AbsoluteFill>
  );
}

// ——— the vertical's own shots ———
const TEXTS = ["price list v3 (final) (2)", "Can you do 4 cases by Fri??", "Missed call (3)", "send me the new list pls", "price changed again?", "voice note 0:47", "??", "you up?"];
/** Hook A in 9:16: Marco at night (the 9:16 take), the texts stack up, the snap on frame 45, the line. */
function VHook({ seg }: { seg: Extract<CSeg, { kind: "live" }> }) {
  const f = useCurrentFrame();
  const snap = f >= VSNAP;
  const unread = Math.min(37, Math.floor(interpolate(f, [0, 36], [9, 37], clamp)));
  const punched = f >= VSNAP + Math.round(BEAT);
  return (
    <AbsoluteFill style={{ background: "#05070a", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${(punched ? 1.22 : 1.04) + f * 0.0016})`, transformOrigin: "50% 42%" }}>
        <OffthreadVideo src={staticFile(seg.src)} startFrom={Math.round(seg.start * 30)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: snap ? interpolate(f, [VSNAP, VSNAP + 10], [1, 0], clamp) : 1 }}>
        {TEXTS.map((t, i) => {
          const at = 3 + i * 4;
          const k = spring({ frame: f - at, fps: 30, config: { damping: 14, stiffness: 160 } });
          if (f < at) return null;
          return (
            <div key={i} style={{ position: "absolute", left: 90 + (i % 2) * 60, top: 300 + i * 84 - (f - at) * 0.7, transform: `translateY(${(1 - k) * -30}px) scale(${0.9 + 0.1 * k})`, opacity: k * (1 - i * 0.06), background: "rgba(245,245,247,0.93)", borderRadius: 26, padding: "18px 30px", fontFamily: F.sans, fontSize: 36, color: "#111", boxShadow: "0 10px 30px rgba(0,0,0,.45)", whiteSpace: "nowrap" }}>
              {t}
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 90, top: 190, display: "flex", alignItems: "center", gap: 14, background: "rgba(20,20,22,.8)", borderRadius: 999, padding: "12px 26px 12px 14px", fontFamily: F.sans, fontWeight: 600, fontSize: 36, color: "#fff", transform: `scale(${1 + 0.12 * Math.max(0, Math.sin(f * 1.3)) * (f < VSNAP ? 1 : 0)})`, transformOrigin: "0% 50%" }}>
          <span style={{ minWidth: 60, height: 60, borderRadius: 30, background: "#e5484d", display: "grid", placeItems: "center", fontWeight: 700 }}>{unread}</span>
          unread
        </div>
      </AbsoluteFill>
      {snap && <AbsoluteFill style={{ background: "#fbf8f2", opacity: interpolate(f, [VSNAP, VSNAP + 3, VSNAP + 14], [0, 0.85, 0], clamp) }} />}
      {snap && (
        <div style={{ position: "absolute", left: 90, top: 1240, fontFamily: F.serif, fontWeight: 700, fontSize: 124, letterSpacing: "-0.03em", color: "#fbf8f2", opacity: interpolate(f, [VSNAP + 4, VSNAP + 12], [0, 1], clamp), transform: `translateY(${(1 - easeOut((f - VSNAP - 4) / 12)) * 30}px)`, textShadow: "0 4px 30px rgba(0,0,0,.6)" }}>
          {assertLine(seg.line ?? "")}
          <div style={{ fontFamily: F.sans, fontWeight: 500, fontSize: 46, letterSpacing: 0, opacity: 0.85, marginTop: 8 }}>11:04 PM</div>
        </div>
      )}
    </AbsoluteFill>
  );
}

function Pointer({ x, y, pressed }: { x: number; y: number; pressed: boolean }) {
  return (
    <svg width={60} height={72} viewBox="0 0 20 24" style={{ position: "absolute", left: x - 4, top: y - 3, transform: `scale(${pressed ? 0.88 : 1})`, transformOrigin: "4px 3px", filter: "drop-shadow(0 4px 6px rgba(0,0,0,.35))" }}>
      <path d="M2 1 L2 19 L6.5 15 L9.5 22 L12.6 20.6 L9.6 13.8 L15.5 13.8 Z" fill="#111" stroke="#fff" strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  );
}
const PH = (manifest as unknown as { shots: Record<string, { boxes: Record<string, { x: number; y: number; w: number; h: number }> }> }).shots["v3/p-catalog"].boxes;
const PS = 1080 / 390; // the phone capture at full width: 2.77 output px per CSS px (native density 3)
/** The real phone catalog, full width: a fast scroll through the photos (A), then the first card and the real tap (B). */
function VPhone({ part, dur }: { part: "scroll" | "tap"; dur: number }) {
  const f = useCurrentFrame();
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let y: number;
  if (part === "scroll") y = interpolate(ease(Math.min(1, f / (dur - 4))), [0, 1], [120, 2300]) + f * 0.6;
  else y = interpolate(ease(Math.min(1, f / 14)), [0, 1], [900, 330]) + f * 0.4;
  const file = part === "tap" && f >= V_PHONE_TAP ? "v3/p-catalog-1" : "v3/p-catalog";
  const vh = 1920 / PS;
  const btn = PH.add0;
  const bx = (btn.x + btn.w * 0.55) * PS, by = (btn.y + btn.h / 2 - y) * PS;
  const cur = part === "tap" ? { x: interpolate(f, [0, V_PHONE_TAP - 6], [bx + 260, bx], clamp), y: interpolate(f, [0, V_PHONE_TAP - 6], [by + 420, by], clamp) + (f > V_PHONE_TAP + 4 ? (f - V_PHONE_TAP - 4) * 2 : 0) } : null;
  return (
    <AbsoluteFill style={{ background: "#fbf8f2", overflow: "hidden" }}>
      <Tiles file={file} y0={y - 40} y1={y + vh + 40} s={PS} ox={0} oy={-y * PS} />
      {cur && <Pointer x={cur.x} y={cur.y} pressed={Math.abs(f - V_PHONE_TAP) <= 2} />}
    </AbsoluteFill>
  );
}

type Quads = { size: number[]; quads: number[][][] };
const MB = (manifest as unknown as { shots: Record<string, { boxes: Record<string, { x: number; y: number; w: number; h: number }> }> }).shots["v3/m-order-new"].boxes.confirm;
/** Salma's monitor, 9:16: the 2x composite at native size around the Confirm button; Confirm on its beat. */
function VMon({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const cfm = VERT.confirm - VERT.mon;
  const START = 24;
  const cf = ((f + START) / 30) * 24;
  const q = (quadsMon as Quads).quads[Math.max(0, Math.min(120, Math.round(cf)))];
  const u = (MB.x + MB.w / 2) / 1152, v = (MB.y + MB.h / 2) / 720;
  const top = [q[0][0] + (q[1][0] - q[0][0]) * u, q[0][1] + (q[1][1] - q[0][1]) * u];
  const bot = [q[3][0] + (q[2][0] - q[3][0]) * u, q[3][1] + (q[2][1] - q[3][1]) * u];
  const bxs = (top[0] + (bot[0] - top[0]) * v) * 2, bys = (top[1] + (bot[1] - top[1]) * v) * 2; // in the 2x clip
  const sc = (f >= cfm ? 1.08 : 1.0) * interpolate(f, [0, dur], [1, 1.05]);
  // the button near the centre, the clip always covering the frame (no black band)
  const left = Math.min(0, Math.max(1080 - 3856 * sc, 540 - bxs * sc)), topPx = Math.min(0, Math.max(1920 - 2152 * sc, 960 - bys * sc));
  const s = shake(f, [cfm], 5);
  const style: React.CSSProperties = { position: "absolute", left: left + s.x, top: topPx + s.y, width: 3856 * sc, height: 2152 * sc, maxWidth: "none" };
  return (
    <Whip dur={dur} whipIn>
      <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
        <Sequence durationInFrames={cfm}><OffthreadVideo src={staticFile("v3/clips/f2/monitor-new-2x.mp4")} startFrom={START} muted style={style} /></Sequence>
        <Sequence from={cfm}><OffthreadVideo src={staticFile("v3/clips/f2/monitor-confirmed-2x.mp4")} startFrom={START + cfm} muted style={style} /></Sequence>
      </AbsoluteFill>
    </Whip>
  );
}

/** The van door closes on its beat, the SENT stamp lands (9:16 take). */
function VSent({ seg }: { seg: Extract<CSeg, { kind: "live" }> }) {
  const f = useCurrentFrame();
  const at = VERT.sentAt - VERT.sent;
  const s = shake(f, [at], 10);
  const k = f >= at ? spring({ frame: f - at, fps: 30, config: { damping: 11, stiffness: 260 } }) : 0;
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${s.x}px, ${s.y}px) scale(${interpolate(f, [0, seg.dur], [1.0, 1.06])})` }}>
        <OffthreadVideo src={staticFile(seg.src)} startFrom={Math.round(seg.start * 30)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      {f >= at && (
        <div style={{ position: "absolute", left: 540, top: 700, transform: `translate(-50%,-50%) rotate(-7deg) scale(${1.6 - 0.6 * k})`, opacity: Math.min(1, (f - at + 1) / 2) * 0.92, border: "12px solid #b5452b", color: "#b5452b", borderRadius: 16, padding: "10px 40px", fontFamily: F.sans, fontWeight: 800, fontSize: 140, letterSpacing: "0.08em", mixBlendMode: "multiply", background: "rgba(251,248,242,.5)" }}>
          SENT
        </div>
      )}
      <AbsoluteFill style={{ background: C.paper, opacity: interpolate(f, [seg.dur - 3, seg.dur], [0, 1], clamp) }} />
    </AbsoluteFill>
  );
}

export function VerticalFilm({ cut, audioSrc }: { cut: Cut; audioSrc?: string }) {
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {cut.segs.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.dur}>
          {s.kind === "live" && s.src.includes("marco") ? <VHook seg={s} />
            : s.kind === "card" ? <VPhone part={s.line === "v-phone-scroll" ? "scroll" : "tap"} dur={s.dur} />
            : s.kind === "live" && s.src.includes("monitor") ? <VMon dur={s.dur} />
            : s.kind === "live" ? <VSent seg={s} />
            : <EndCard line={(s as Extract<CSeg, { kind: "end" }>).line} />}
        </Sequence>
      ))}
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
    </AbsoluteFill>
  );
}
