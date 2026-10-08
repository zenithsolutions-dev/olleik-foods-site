import React from "react";
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { evolvePath } from "@remotion/paths";
import { C, F } from "../theme";
import { Mark as BrandMark, Wordmark } from "../components/Chrome";
import { b, COPY, promoTimeline } from "./timeline.mjs";

/**
 * Olleik Foods promo cuts in the product-launch look (16:9, 9:16 and 1:1 from one set of scenes). Every timed element
 * reads timeline.mjs, the same numbers the sound events are placed from.
 */
export type FinalProps = { cut: string; opening?: string | null; audio?: boolean; audioSrc?: string };
type Rect = { x: number; y: number; w: number; h: number };
type Pt = { x: number; y: number };

const INK = "#0b2118";
const PAPER = "#faf6ec";
const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const INOUT = Easing.bezier(0.65, 0, 0.35, 1);
const BACK = Easing.bezier(0.34, 1.4, 0.64, 1);
const ez = (f: number, a: number, z: number, from = 0, to = 1, e = EXPO) => interpolate(f, [a, z], [from, to], { easing: e, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
const HEAVY = F.sans;
const SERIF = F.serif;

// ——— Layout ————————————————————————————————————————————————————————————————————————————————————————————
type Lay = { W: number; H: number; wide: boolean; tall: boolean; sq: boolean; pick: <T>(w: T, t: T, s?: T) => T; side: number; band: { top: number; bottom: number } };
function useL(): Lay {
  const { width: W, height: H } = useVideoConfig();
  const wide = W > H;
  const tall = H > W;
  const sq = W === H;
  const pick = <T,>(w: T, t: T, s?: T) => (wide ? w : tall ? t : s ?? t);
  // band = where the product sits: under the kicker, over the caption (9:16 keeps the social UI zones clear).
  const band = wide ? { top: 140, bottom: 905 } : tall ? { top: 320, bottom: 1330 } : { top: 150, bottom: 850 };
  return { W, H, wide, tall, sq, pick, side: wide ? 150 : 90, band };
}
/** Optical centre of the safe area (9:16: social UI covers the top 230 and bottom 420 px). */
const safeBox = (L: Lay) => (L.wide ? { top: 0, bottom: 0 } : L.tall ? { top: 230, bottom: 420 } : { top: 60, bottom: 110 });

// ——— Texture, HUD, licence, captions ————————————————————————————————————————————————————————————————————
function Grain({ opacity = 0.06, period = 3 }: { opacity?: number; period?: number }) {
  const frame = useCurrentFrame();
  const k = frame % period;
  return (
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity, mixBlendMode: "overlay", pointerEvents: "none", zIndex: 90 }}>
      <filter id={`fg${k}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={k} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#fg${k})`} />
    </svg>
  );
}

function Hud({ dark, label, hideBottom }: { dark: boolean; label?: string; hideBottom?: boolean }) {
  const L = useL();
  if (!L.wide) return null;
  const col = dark ? "rgba(255,255,255,0.5)" : "rgba(28,77,58,0.45)";
  const br = (style: React.CSSProperties) => <div style={{ position: "absolute", width: 22, height: 22, ...style }} />;
  const line = `2px solid ${col}`;
  const txt: React.CSSProperties = { position: "absolute", fontFamily: HEAVY, fontWeight: 600, fontSize: 16, letterSpacing: "0.08em", color: col };
  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 80 }}>
      {br({ left: 36, top: 36, borderLeft: line, borderTop: line })}
      {br({ right: 36, top: 36, borderRight: line, borderTop: line })}
      {!hideBottom && br({ left: 36, bottom: 36, borderLeft: line, borderBottom: line })}
      {!hideBottom && br({ right: 36, bottom: 36, borderRight: line, borderBottom: line })}
      <div style={{ ...txt, left: 72, top: 39 }}>{COPY.brand}</div>
      <div style={{ ...txt, right: 72, top: 39 }}>{label ?? COPY.kicker}</div>
    </AbsoluteFill>
  );
}

/** No licence or disclaimer line applies to this business (see PROJECT_BRIEF.md); kept as a no-op slot. */
function Licence(_: { dark: boolean; at?: number }) {
  return null;
}

function Caption({ text, at, len, licence }: { text: string; at: number; len: number; licence?: boolean }) {
  const L = useL();
  const frame = useCurrentFrame();
  const s = ez(frame, at, at + 9);
  const out = interpolate(frame, [len + 2, len + 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bottom = L.pick(licence ? 104 : 84, 500, 176);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom, display: "flex", justifyContent: "center", opacity: s * out, transform: `translateY(${(1 - s) * 18}px)`, zIndex: 60, padding: `0 ${L.pick(120, 60, 60)}px` }}>
      <div style={{ background: "rgba(11,33,24,0.84)", backdropFilter: "blur(16px)", color: "#fff", fontFamily: HEAVY, fontWeight: 600, fontSize: L.pick(40, 46, 42), lineHeight: 1.22, padding: L.pick("14px 32px", "18px 34px", "16px 30px"), borderRadius: 20, border: "1px solid rgba(255,255,255,0.12)", textAlign: "center", letterSpacing: "-0.01em", boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}>{text}</div>
    </div>
  );
}

/** Text revealed from behind its own line mask, with an expo ease. */
function MaskIn({ at, children, from = 1.1, dur = 7, style, exitAt, exitDur = 6 }: { at: number; children: React.ReactNode; from?: number; dur?: number; style?: React.CSSProperties; exitAt?: number; exitDur?: number }) {
  const frame = useCurrentFrame();
  const y = ez(frame, at, at + dur, from, 0) - (exitAt != null ? ez(frame, exitAt, exitAt + exitDur, 0, 1.1, INOUT) : 0);
  return (
    <div style={{ overflow: "hidden", display: "inline-block", verticalAlign: "bottom", paddingBottom: "0.1em", marginBottom: "-0.1em", ...style }}>
      <div style={{ transform: `translateY(${y * 100}%)`, opacity: frame < at ? 0 : 1 }}>{children}</div>
    </div>
  );
}

const TONES: Record<string, { bg: string; fg: string; accent: string; dark: boolean }> = {
  ink: { bg: `radial-gradient(90% 80% at 75% 15%, #1d4a37 0%, ${INK} 62%)`, fg: "#fff", accent: C.orange, dark: true },
  teal: { bg: `radial-gradient(100% 90% at 80% 10%, #2a6149 0%, ${C.teal} 48%, #0b2519 100%)`, fg: "#fff", accent: C.orange, dark: true },
  orange: { bg: `radial-gradient(100% 90% at 20% 10%, #dc9446 0%, ${C.orange} 50%, #a9621c 100%)`, fg: "#fff", accent: INK, dark: true },
  paper: { bg: `radial-gradient(110% 90% at 50% 0%, #ffffff 0%, ${PAPER} 62%, #efe7d4 100%)`, fg: C.teal, accent: C.orange, dark: false },
};
/** A colour field with a slow light drift and a fine 12-column grid. */
function Field({ tone, children, len }: { tone: keyof typeof TONES; children?: React.ReactNode; len: number }) {
  const frame = useCurrentFrame();
  const L = useL();
  const T = TONES[tone];
  const sweep = ez(frame, 0, len, -0.25, 1.15, INOUT);
  const cols = 12;
  const gw = (L.W - 2 * L.side) / cols;
  return (
    <AbsoluteFill style={{ background: T.bg, overflow: "hidden" }}>
      <svg width={L.W} height={L.H} style={{ position: "absolute", inset: 0, opacity: T.dark ? 0.06 : 0.05 }}>
        {Array.from({ length: cols + 1 }, (_, i) => (
          <line key={i} x1={L.side + i * gw} x2={L.side + i * gw} y1={0} y2={L.H} stroke={T.dark ? "#fff" : C.teal} strokeWidth={1} />
        ))}
      </svg>
      <AbsoluteFill style={{ background: `linear-gradient(105deg, transparent ${sweep * 100 - 14}%, rgba(255,255,255,${T.dark ? 0.08 : 0.35}) ${sweep * 100}%, transparent ${sweep * 100 + 14}%)`, mixBlendMode: T.dark ? "screen" : "normal" }} />
      {children}
      <Grain opacity={T.dark ? 0.07 : 0.05} />
    </AbsoluteFill>
  );
}
/** Slow push-in on the whole scene content (premium "camera breath"). */
function Push({ len, amount = 0.045, children, origin = "50% 50%" }: { len: number; amount?: number; children: React.ReactNode; origin?: string }) {
  const frame = useCurrentFrame();
  const s = 1 + amount * ez(frame, 0, len + 12, 0, 1, Easing.bezier(0.33, 0, 0.67, 1));
  return <AbsoluteFill style={{ transform: `scale(${s})`, transformOrigin: origin }}>{children}</AbsoluteFill>;
}
const shakeAt = (frame: number, hits: number[], amp = 9) => {
  for (const h of hits) {
    const t = frame - h;
    if (t >= 0 && t < 6) {
      const k = (1 - t / 6) * amp;
      return `translate(${(random(`x${h}${t}`) - 0.5) * 2 * k}px, ${(random(`y${h}${t}`) - 0.5) * 2 * k}px)`;
    }
  }
  return "";
};

// ——— Icons (line art, drawn on) ————————————————————————————————————————————————————————————————————————
const ICONS: Record<string, string[]> = {
  home: ["M14 48 L50 16 L86 48", "M24 40 L24 86 L76 86 L76 40", "M42 86 L42 62 L58 62 L58 86"],
  chart: ["M14 86 L86 86", "M24 74 L24 60", "M42 74 L42 46", "M60 74 L60 52", "M78 74 L78 30", "M20 50 L40 34 L56 42 L80 18", "M68 18 L80 18 L80 30"],
  scale: ["M50 12 L50 88", "M30 88 L70 88", "M18 26 L82 26", "M18 26 L8 56 L28 56 Z", "M82 26 L72 56 L92 56 Z"],
  compass: ["M50 8 A42 42 0 1 1 49.9 8", "M64 36 L56 56 L36 64 L44 44 Z"],
  box: ["M14 32 L50 14 L86 32 L50 50 Z", "M14 32 L14 72 L50 90 L86 72 L86 32", "M50 50 L50 90", "M32 23 L68 41"],
  tag: ["M12 50 L50 12 L88 12 L88 50 L50 88 Z", "M68 26 A6 6 0 1 1 67.9 26"],
  truck: ["M8 26 L58 26 L58 70 L8 70 Z", "M58 40 L78 40 L92 56 L92 70 L58 70", "M26 78 A8 8 0 1 1 25.9 78", "M74 78 A8 8 0 1 1 73.9 78"],
  list: ["M22 22 L86 22", "M22 50 L86 50", "M22 78 L86 78", "M10 22 L12 22", "M10 50 L12 50", "M10 78 L12 78"],
  chat: ["M12 18 L88 18 L88 66 L46 66 L26 84 L28 66 L12 66 Z", "M28 36 L72 36", "M28 50 L60 50"],
  phone: ["M30 8 L70 8 L70 92 L30 92 Z", "M44 80 L56 80"],
};
function Icon({ name, size, at = 0, color = C.orange, width = 5 }: { name: string; size: number; at?: number; color?: string; width?: number }) {
  const frame = useCurrentFrame();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ overflow: "visible" }}>
      {(ICONS[name] ?? ICONS.home).map((d, i) => {
        const ev = evolvePath(ez(frame, at + i * 3, at + i * 3 + 14), d);
        return <path key={i} d={d} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />;
      })}
    </svg>
  );
}
/** The brand mark (rebuilt from the site's header tile), revealed by a rising mask and a soft scale settle. */
function Mark({ size, at = 0, dur = 14, tile }: { size: number; at?: number; dur?: number; tile?: string }) {
  const frame = useCurrentFrame();
  const p = ez(frame, at, at + dur);
  return (
    <div style={{ width: size, height: size, clipPath: `inset(${(1 - p) * 100}% 0 0 0)`, transform: `scale(${1.08 - 0.08 * p})` }}>
      <BrandMark size={size} tile={tile} />
    </div>
  );
}

// ——— Hooks ———————————————————————————————————————————————————————————————————————————————————————————————
/** H1 "Your catalog. Your prices.": two slams, the second in the serif italic accent. */
function Slam2Hook({ t, len, L }: { t: any; len: number; L: Lay }) {
  const frame = useCurrentFrame();
  const sb = safeBox(L);
  const size = L.pick(176, 150, 130);
  return (
    <Field tone="ink" len={len}>
      <Push len={len} amount={0.06} origin="30% 50%">
        <AbsoluteFill style={{ justifyContent: "center", paddingLeft: L.pick(170, 90, 90), paddingTop: sb.top, paddingBottom: sb.bottom, transform: shakeAt(frame, [t.a, t.b], 8) }}>
          <div style={{ lineHeight: 1.0 }}>
            <MaskIn at={t.a - 3} dur={6} from={0.9}>
              <span style={{ fontFamily: HEAVY, fontWeight: 900, fontSize: size, color: "#fff", letterSpacing: "-0.05em" }}>Your catalog.</span>
            </MaskIn>
          </div>
          <div style={{ lineHeight: 1.05, marginTop: L.pick(4, 10, 6) }}>
            <MaskIn at={t.b - 2} dur={7}>
              <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 600, fontSize: size * 1.08, color: C.orange, letterSpacing: "-0.02em" }}>Your prices.</span>
            </MaskIn>
          </div>
          <div style={{ marginTop: L.pick(36, 46, 32), height: 7, width: ez(frame, t.rule, t.rule + 10, 0, L.pick(640, 560, 520)), background: C.orange, borderRadius: 4 }} />
          <div style={{ marginTop: L.pick(28, 34, 24) }}>
            <MaskIn at={t.sub} dur={8}>
              <span style={{ fontFamily: HEAVY, fontWeight: 600, fontSize: L.pick(40, 38, 34), color: "rgba(255,255,255,0.8)", letterSpacing: "-0.005em" }}>{COPY.kicker} · {COPY.brand}</span>
            </MaskIn>
          </div>
        </AbsoluteFill>
      </Push>
      <Hud dark />
    </Field>
  );
}

/** H2 "Still ordering supplies by text?": three message bubbles pop in, then the question slams. */
function QuestionHook({ t, len, L, p }: { t: any; len: number; L: Lay; p: any }) {
  const frame = useCurrentFrame();
  const bubbles: string[] = p.bubbles ?? [];
  const pos: Pt[] = L.wide ? [{ x: 360, y: 220 }, { x: 980, y: 140 }, { x: 1540, y: 280 }] : L.tall ? [{ x: 360, y: 400 }, { x: 700, y: 560 }, { x: 380, y: 720 }] : [{ x: 300, y: 170 }, { x: 740, y: 260 }, { x: 360, y: 370 }];
  const fs = L.pick(40, 42, 36);
  const headY = L.pick(500, 880, 520);
  const words = String(p.text).split(" ");
  const lastTwo = words.slice(-2).join(" ");
  const first = words.slice(0, -2).join(" ");
  return (
    <Field tone="ink" len={len}>
      <Push len={len} amount={0.04}>
        {bubbles.map((it, i) => {
          const s = spring({ frame: frame - t.bubbles[i], fps: 30, config: { damping: 14, stiffness: 220, mass: 0.7 } });
          const mine = i === 1;
          return (
            <div key={it} style={{ position: "absolute", left: pos[i].x, top: pos[i].y, transform: `translate(-50%, -50%) scale(${frame < t.bubbles[i] ? 0 : 0.6 + 0.4 * s})`, opacity: frame < t.bubbles[i] ? 0 : frame > t.head ? 0.4 : 1 }}>
              <div style={{ background: mine ? C.orange : "rgba(255,255,255,0.1)", border: mine ? "none" : "1px solid rgba(255,255,255,0.22)", backdropFilter: "blur(10px)", borderRadius: 30, borderBottomLeftRadius: mine ? 30 : 8, borderBottomRightRadius: mine ? 8 : 30, padding: `${fs * 0.42}px ${fs * 0.7}px`, fontFamily: HEAVY, fontWeight: 600, fontSize: fs, color: "#fff", whiteSpace: "nowrap", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>{it}</div>
            </div>
          );
        })}
        <div style={{ position: "absolute", left: L.side - (L.wide ? 20 : 0), right: L.side, top: headY, lineHeight: 0.98, transform: shakeAt(frame, [t.head], 7) }}>
          <MaskIn at={t.head} dur={6}>
            <span style={{ fontFamily: HEAVY, fontWeight: 900, fontSize: L.pick(150, 128, 112), color: "#fff", letterSpacing: "-0.05em", marginRight: "0.22em", display: "inline-block" }}>{first}</span>
          </MaskIn>
          {!L.wide && <br />}
          <MaskIn at={t.head + 3} dur={7}>
            <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 600, fontSize: L.pick(160, 136, 120), color: C.orange, letterSpacing: "-0.02em" }}>{lastTwo}</span>
          </MaskIn>
        </div>
      </Push>
      <Hud dark />
    </Field>
  );
}

/** The portal's own four status chips (same labels and colours as src/app/portal/orders/status-chip.tsx). */
const STATUS = [
  { label: "Received", bg: "#e0f2fe", fg: "#0369a1" },
  { label: "Confirmed", bg: "rgba(28,77,58,0.16)", fg: "#0e2c20" },
  { label: "Ready", bg: "#fef3c7", fg: "#b45309" },
  { label: "Completed", bg: "#d1fae5", fg: "#047857" },
];
/** H7: the four status chips, one per beat, then "Every order, followed to the end." */
function StatusHook({ t, len, L }: { t: any; len: number; L: Lay }) {
  const frame = useCurrentFrame();
  const sb = safeBox(L);
  const fs = L.pick(52, 60, 50);
  return (
    <Field tone="paper" len={len}>
      <Push len={len} amount={0.05}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: L.wide ? "center" : "flex-start", paddingLeft: L.pick(0, 90, 90), paddingTop: sb.top, paddingBottom: sb.bottom, gap: L.pick(64, 70, 44) }}>
          <div style={{ display: "flex", flexDirection: L.wide ? "row" : "column", gap: L.pick(18, 26, 16), alignItems: L.wide ? "center" : "flex-start" }}>
            {STATUS.map((c, i) => {
              const s = spring({ frame: frame - t.chips[i], fps: 30, config: { damping: 12, stiffness: 240, mass: 0.6 } });
              const on = frame >= t.chips[i];
              const latest = i === STATUS.filter((_, k) => frame >= t.chips[k]).length - 1;
              return (
                <React.Fragment key={c.label}>
                  {i > 0 && L.wide && <div style={{ width: 40 * ez(frame, t.chips[i] - 6, t.chips[i]), height: 5, background: C.orange, borderRadius: 3 }} />}
                  <div style={{ display: "flex", alignItems: "center", gap: 14, background: c.bg, color: c.fg, borderRadius: 999, padding: `${fs * 0.28}px ${fs * 0.6}px`, fontFamily: HEAVY, fontWeight: 800, fontSize: fs, letterSpacing: "0.04em", textTransform: "uppercase", transform: `scale(${on ? 0.7 + 0.3 * s : 0})`, opacity: on ? (latest ? 1 : 0.75) : 0, boxShadow: latest ? `0 18px 40px rgba(28,77,58,0.22), 0 0 0 4px ${C.orange}` : "0 10px 24px rgba(28,77,58,0.12)" }}>
                    <svg width={fs * 0.6} height={fs * 0.6} viewBox="0 0 24 24"><path d="M4 12.5 L10 18 L20 6" stroke={c.fg} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {c.label}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
          <div style={{ textAlign: L.wide ? "center" : "left", lineHeight: 1.05, maxWidth: L.pick(1600, 900, 900) }}>
            <MaskIn at={t.line} dur={7}>
              <span style={{ fontFamily: HEAVY, fontWeight: 900, fontSize: L.pick(110, 100, 86), color: C.teal, letterSpacing: "-0.045em" }}>
                Every order, <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 600, color: C.orange }}>followed to the end.</span>
              </span>
            </MaskIn>
          </div>
        </AbsoluteFill>
      </Push>
      <Hud dark={false} />
    </Field>
  );
}

/** Words in rows; the last word in the serif italic accent. */
const rowsOf = (n: number, per: number) => {
  const rows: number[][] = [];
  for (let i = 0; i < n; i += per) rows.push(Array.from({ length: Math.min(per, n - i) }, (_, k) => i + k));
  return rows;
};
const packRows = (words: string[], max: number) => {
  const rows: number[][] = [[]];
  let len = 0;
  words.forEach((w, i) => {
    const cur = rows[rows.length - 1];
    if (cur.length && len + 1 + w.length > max) {
      rows.push([i]);
      len = w.length;
    } else {
      cur.push(i);
      len += (cur.length > 1 ? 1 : 0) + w.length;
    }
  });
  return rows;
};
function CtaWords({ t, len, L, text }: { t: any; len: number; L: Lay; text: string }) {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  const sb = safeBox(L);
  // 16:9: 2–3 words a row; 9:16 and 1:1: words packed into rows of at most 11 characters.
  const rows = L.wide ? rowsOf(words.length, words.length > 4 ? 3 : 2) : packRows(words, 11);
  // Largest size at which the longest row still fits the frame (heavy sans ≈ 0.56 em per character).
  const longest = Math.max(...rows.map((r) => r.map((i) => words[i]).join(" ").length));
  const size = Math.min(L.pick(210, 150, 130), (L.W - 2 * L.pick(170, 90, 90)) / (longest * 0.56));
  return (
    <Field tone="orange" len={len}>
      <Push len={len} amount={0.08} origin="25% 50%">
        <AbsoluteFill style={{ justifyContent: "center", paddingLeft: L.pick(170, 90, 90), paddingTop: sb.top, paddingBottom: sb.bottom, transform: shakeAt(frame, t.words, 5) }}>
          {rows.map((row, r) => (
            <div key={r} style={{ display: "flex", gap: size * 0.24, lineHeight: 1.0 }}>
              {row.map((i) => {
                const last = i === words.length - 1;
                return (
                  <MaskIn key={i} at={t.words[i]} dur={6}>
                    <span style={{ fontFamily: last ? SERIF : HEAVY, fontStyle: last ? "italic" : "normal", fontWeight: last ? 600 : 900, fontSize: last ? size * 1.08 : size, color: last ? INK : "#fff", letterSpacing: last ? "-0.02em" : "-0.045em" }}>{words[i]}</span>
                  </MaskIn>
                );
              })}
            </div>
          ))}
          <div style={{ marginTop: L.pick(34, 44, 30), height: 7, width: ez(frame, t.rule, t.rule + 10, 0, L.pick(420, 360, 320)), background: INK, borderRadius: 4 }} />
        </AbsoluteFill>
      </Push>
      <Hud dark label={COPY.cta} />
    </Field>
  );
}

/** The trust line on the deep-green field, word by word, then a quiet hold (the half-second before the payoff). */
function Trust({ t, len, L, text }: { t: any; len: number; L: Lay; text: string }) {
  const frame = useCurrentFrame();
  const sb = safeBox(L);
  const words = text.split(" ");
  const accentFrom = Math.max(0, words.length - 2);
  const size = L.pick(120, 108, 92);
  return (
    <Field tone="ink" len={len}>
      <Push len={len} amount={0.035}>
        <AbsoluteFill style={{ justifyContent: "center", paddingLeft: L.pick(170, 90, 90), paddingRight: L.pick(170, 90, 90), paddingTop: sb.top, paddingBottom: sb.bottom }}>
          <div style={{ display: "flex", flexWrap: "wrap", columnGap: size * 0.26, lineHeight: 1.05, maxWidth: L.pick(1500, 900, 900) }}>
            {words.map((w, i) => (
              <MaskIn key={i} at={t.words[i]} dur={6}>
                <span style={{ fontFamily: i >= accentFrom ? SERIF : HEAVY, fontStyle: i >= accentFrom ? "italic" : "normal", fontWeight: i >= accentFrom ? 600 : 900, fontSize: i >= accentFrom ? size * 1.06 : size, color: i >= accentFrom ? C.orange : "#fff", letterSpacing: i >= accentFrom ? "-0.02em" : "-0.045em" }}>{w}</span>
              </MaskIn>
            ))}
          </div>
          <div style={{ marginTop: L.pick(34, 40, 28), height: 6, width: ez(frame, t.rule, t.rule + 12, 0, L.pick(300, 260, 240)), background: C.orange, borderRadius: 3 }} />
        </AbsoluteFill>
      </Push>
      <Hud dark />
    </Field>
  );
}

// ——— Story scenes ————————————————————————————————————————————————————————————————————————————————————————
function Words({ t, len, L, lines, licence }: { t: any; len: number; L: Lay; lines: string[]; licence?: boolean }) {
  const frame = useCurrentFrame();
  const sb = safeBox(L);
  const longest = Math.max(...lines.map((l) => l.length));
  // 16:9: one line each, sized to fit; 9:16 and 1:1: full size, lines wrap.
  const size = L.wide ? Math.min(176, (L.W - 290) / (longest * 0.56)) : L.pick(176, 112, 100);
  return (
    <Field tone="paper" len={len}>
      <Push len={len} amount={0.04} origin="20% 50%">
        <AbsoluteFill style={{ justifyContent: "center", paddingLeft: L.pick(170, 96, 90), paddingTop: sb.top, paddingBottom: sb.bottom + (licence ? 60 : 0) }}>
          <div style={{ height: 6, width: ez(frame, 0, 10, 0, 120), background: C.orange, borderRadius: 3, marginBottom: L.pick(30, 40, 28) }} />
          {lines.map((ln, i) => {
            const last = i === lines.length - 1;
            const dim = frame >= t.lines[i] + b(1) && !last ? 0.32 : 1;
            return (
              <div key={i} style={{ lineHeight: 1.08, opacity: interpolate(dim, [0, 1], [0, 1]), transition: "none" }}>
                <MaskIn at={t.lines[i]} dur={6}>
                  <span style={{ fontFamily: last ? SERIF : HEAVY, fontStyle: last ? "italic" : "normal", fontWeight: last ? 500 : 900, fontSize: last ? size * 1.1 : size, color: last ? C.orange : C.teal, display: "inline-block", marginTop: last ? size * 0.08 : 0, letterSpacing: last ? "-0.02em" : "-0.045em", opacity: ez(frame, t.lines[i] + b(1), t.lines[i] + b(1) + 8, 1, last ? 1 : 0.42) }}>{ln}</span>
                </MaskIn>
              </div>
            );
          })}
        </AbsoluteFill>
      </Push>
      <Hud dark={false} />
      {licence && <Licence dark={false} />}
    </Field>
  );
}

const OFFICE_ICON = ["list", "chat", "truck"];
function OfficeCard({ label, icon, at, x, y, s = 1, glow = 0, L }: { label: string; icon: string; at: number; x: number; y: number; s?: number; glow?: number; L: Lay }) {
  const frame = useCurrentFrame();
  const sp = spring({ frame: frame - at, fps: 30, config: { damping: 15, stiffness: 200, mass: 0.7 } });
  const fs = L.pick(40, 44, 38);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${(frame < at ? 0 : 0.7 + 0.3 * sp) * s}) translateY(${(1 - sp) * 40}px)`, opacity: frame < at ? 0 : Math.min(1, sp * 1.5) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, background: "rgba(255,255,255,0.07)", border: `1px solid rgba(255,255,255,${0.2 + glow * 0.5})`, backdropFilter: "blur(12px)", borderRadius: 26, padding: `${fs * 0.5}px ${fs * 0.75}px`, boxShadow: `0 30px 60px rgba(0,0,0,0.3), 0 0 ${40 * glow}px rgba(200,122,42,${0.5 * glow})` }}>
        <div style={{ width: fs * 1.6, height: fs * 1.6, borderRadius: 16, background: "rgba(200,122,42,0.14)", display: "grid", placeItems: "center" }}>
          <Icon name={icon} size={fs * 1.05} at={at + 2} width={7} />
        </div>
        <span style={{ fontFamily: HEAVY, fontWeight: 700, fontSize: fs, color: "#fff", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{label}</span>
      </div>
    </div>
  );
}

/** "Or one place for all of it." → ["Or one place", "for all of it."] (the accent is the second half). */
const accentSplit = (text: string): [string, string] => {
  const words = text.split(" ");
  const k = Math.max(1, Math.ceil(words.length / 2) - 1);
  return [words.slice(0, k).join(" "), words.slice(k).join(" ")];
};

function Merge({ t, len, L, p }: { t: any; len: number; L: Lay; p: { items: string[]; headline: string; pill: string } }) {
  const frame = useCurrentFrame();
  const from: Pt[] = L.wide ? [{ x: 360, y: 300 }, { x: 960, y: 440 }, { x: 1560, y: 300 }] : L.tall ? [{ x: 330, y: 420 }, { x: 720, y: 640 }, { x: 360, y: 860 }] : [{ x: 280, y: 190 }, { x: 760, y: 330 }, { x: 330, y: 470 }];
  const c: Pt = L.wide ? { x: 960, y: 380 } : L.tall ? { x: 540, y: 640 } : { x: 540, y: 330 };
  const k = ez(frame, t.converge[0], t.converge[1], 0, 1, Easing.bezier(0.7, 0, 0.3, 1));
  const snap = spring({ frame: frame - t.snap, fps: 30, config: { damping: 12, stiffness: 240 } });
  const fs = L.pick(88, 80, 66);
  const burst = frame >= t.snap ? ez(frame, t.snap, t.snap + 16) : 0;
  return (
    <Field tone="ink" len={len}>
      <Push len={len} amount={0.07}>
        {burst > 0 && burst < 1 && <div style={{ position: "absolute", left: c.x - 300 * burst - 100, top: c.y - 300 * burst - 100, width: 600 * burst + 200, height: 600 * burst + 200, borderRadius: "50%", border: `${4 * (1 - burst) + 1}px solid rgba(200,122,42,0.9)`, opacity: 1 - burst }} />}
        {frame < t.snap &&
          p.items.map((it, i) => (
            <OfficeCard key={it} label={it} icon={OFFICE_ICON[i]} at={t.cards[i]} x={from[i].x + (c.x - from[i].x) * k} y={from[i].y + (c.y - from[i].y) * k} s={1 - 0.35 * k} glow={k} L={L} />
          ))}
        {frame >= t.snap && (
          <div style={{ position: "absolute", left: c.x, top: c.y, transform: `translate(-50%, -50%) scale(${0.6 + 0.4 * snap})` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 22, background: C.orange, borderRadius: 999, padding: `${fs * 0.36}px ${fs * 0.8}px`, boxShadow: `0 30px 80px rgba(200,122,42,${0.45 * snap}), 0 0 0 ${18 * (1 - snap)}px rgba(200,122,42,0.25)` }}>
              <Icon name="phone" size={fs * 0.8} color="#fff" width={8} at={-30} />
              <span style={{ fontFamily: HEAVY, fontWeight: 900, fontSize: fs, color: "#fff", letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>{p.pill}</span>
            </div>
          </div>
        )}
        <div style={{ position: "absolute", left: L.side, right: L.side, top: L.pick(620, 1010, 600), textAlign: L.wide ? "center" : "left" }}>
          <MaskIn at={t.head} dur={7}>
            <span style={{ fontFamily: HEAVY, fontWeight: 800, fontSize: L.pick(88, 90, 76), lineHeight: 1.06, color: "#fff", letterSpacing: "-0.035em", display: "block", maxWidth: L.pick(1700, 900, 900), margin: L.wide ? "0 auto" : undefined }}>
              {accentSplit(p.headline)[0]} <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 600, color: C.orange }}>{accentSplit(p.headline)[1]}</span>
            </span>
          </MaskIn>
        </div>
      </Push>
      <Hud dark />
    </Field>
  );
}

function Brand({ t, len, L }: { t: any; len: number; L: Lay }) {
  const frame = useCurrentFrame();
  const sb = safeBox(L);
  return (
    <Field tone="paper" len={len}>
      <Push len={len} amount={0.045}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingTop: sb.top, paddingBottom: sb.bottom, gap: L.pick(30, 38, 26) }}>
          <MaskIn at={0} dur={7}>
            <span style={{ fontFamily: HEAVY, fontWeight: 700, fontSize: L.pick(34, 36, 32), letterSpacing: "0.24em", color: C.orange }}>MEET</span>
          </MaskIn>
          <Mark size={L.pick(190, 220, 170)} at={t.mark[0] + 3} dur={t.mark[1]} />
          <MaskIn at={t.name} dur={7}>
            <Wordmark size={L.pick(150, 132, 112)} />
          </MaskIn>
          <div style={{ height: 5, width: ez(frame, t.rule, t.rule + 10, 0, 160), background: C.orange, borderRadius: 3 }} />
          <MaskIn at={t.place} dur={7}>
            <span style={{ fontFamily: HEAVY, fontWeight: 600, fontSize: L.pick(46, 44, 38), color: C.teal, letterSpacing: "-0.01em" }}>
              {COPY.kicker}, <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 600, color: C.orange, fontSize: "1.1em" }}>{COPY.region}</span>
            </span>
          </MaskIn>
        </AbsoluteFill>
      </Push>
      <Hud dark={false} />
    </Field>
  );
}

function Service({ t, len, L, p, licence }: { t: any; len: number; L: Lay; p: any; licence?: boolean }) {
  const frame = useCurrentFrame();
  const tone = (p.tone ?? "teal") as keyof typeof TONES;
  const T = TONES[tone];
  const sb = safeBox(L);
  const numSize = L.pick(900, 900, 700);
  const drift = interpolate(frame, [0, len + 12], [40, -120]);
  const titleSize = L.pick(p.title.length > 20 ? 120 : 156, p.title.length > 20 ? 96 : 118, p.title.length > 20 ? 84 : 104);
  return (
    <Field tone={tone} len={len}>
      {/* the giant numeral, cut by the frame edge */}
      <div style={{ position: "absolute", right: L.pick(-40, -120, -80), bottom: L.pick(-260, 280, -200), transform: `translateX(${drift}px)` }}>
        <MaskIn at={t.num} dur={8} from={0.6}>
          <span style={{ fontFamily: HEAVY, fontWeight: 900, fontSize: numSize, lineHeight: 0.8, color: T.dark ? "rgba(255,255,255,0.1)" : "rgba(28,77,58,0.08)", letterSpacing: "-0.07em" }}>{p.n}</span>
        </MaskIn>
      </div>
      <Push len={len} amount={0.07} origin="20% 50%">
        <AbsoluteFill style={{ justifyContent: "center", paddingLeft: L.pick(170, 96, 90), paddingRight: L.pick(420, 90, 90), paddingTop: sb.top, paddingBottom: sb.bottom + (licence ? 70 : 0) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22, marginBottom: L.pick(34, 40, 30) }}>
            <div style={{ width: L.pick(118, 128, 104), height: L.pick(118, 128, 104), borderRadius: 30, background: T.dark ? "rgba(255,255,255,0.1)" : "rgba(200,122,42,0.1)", border: `1px solid ${T.dark ? "rgba(255,255,255,0.2)" : "rgba(200,122,42,0.25)"}`, display: "grid", placeItems: "center", transform: `scale(${ez(frame, 0, 10, 0.6, 1, BACK)})`, opacity: ez(frame, 0, 6) }}>
              <Icon name={p.icon} size={L.pick(70, 76, 62)} at={t.icon} color={tone === "orange" ? "#fff" : C.orange} width={6} />
            </div>
            <MaskIn at={2} dur={7}>
              <span style={{ fontFamily: HEAVY, fontWeight: 700, fontSize: L.pick(30, 34, 30), letterSpacing: "0.16em", color: tone === "orange" ? INK : C.orange }}>{`0${p.n}`}</span>
            </MaskIn>
          </div>
          <div style={{ lineHeight: 1.0, maxWidth: L.pick(1300, 900, 900) }}>
            <MaskIn at={t.title} dur={7}>
              <span style={{ fontFamily: HEAVY, fontWeight: 900, fontSize: titleSize, color: T.fg, letterSpacing: "-0.045em" }}>{p.title}</span>
            </MaskIn>
          </div>
          <div style={{ marginTop: L.pick(26, 34, 24), maxWidth: L.pick(1150, 880, 880) }}>
            <MaskIn at={t.sub} dur={8}>
              <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 500, fontSize: L.pick(66, 62, 54), lineHeight: 1.15, color: tone === "orange" ? INK : tone === "paper" ? C.orange : "rgba(255,255,255,0.92)", letterSpacing: "-0.01em", display: "block" }}>{p.sub}</span>
            </MaskIn>
          </div>
        </AbsoluteFill>
      </Push>
      <Hud dark={T.dark} hideBottom={licence} />
      {licence && <Licence dark={T.dark} at={t.sub} />}
    </Field>
  );
}

function Trio({ t, len, L, p, licence }: { t: any; len: number; L: Lay; p: any; licence?: boolean }) {
  const frame = useCurrentFrame();
  const sb = safeBox(L);
  const chips = p.chips ?? ["Catalog", "Prices", "Orders"];
  const icons = ["box", "tag", "truck"];
  const fs = L.pick(64, 56, 48);
  const headline: string = p.headline;
  return (
    <Field tone="paper" len={len}>
      <Push len={len} amount={0.07}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: L.wide ? "center" : "flex-start", paddingLeft: L.pick(0, 96, 90), paddingRight: L.pick(0, 90, 90), paddingTop: sb.top, paddingBottom: sb.bottom + (licence ? 70 : 0), gap: L.pick(56, 60, 44) }}>
          <div style={{ display: "flex", flexDirection: L.wide ? "row" : "column", gap: L.pick(28, 22, 18), alignItems: "flex-start" }}>
            {chips.map((c: string, i: number) => {
              const s = spring({ frame: frame - t.chips[i], fps: 30, config: { damping: 13, stiffness: 240, mass: 0.6 } });
              return (
                <div key={c} style={{ display: "flex", alignItems: "center", gap: 16, background: i === 2 ? C.orange : C.teal, color: "#fff", borderRadius: 999, padding: `${fs * 0.3}px ${fs * 0.7}px ${fs * 0.3}px ${fs * 0.42}px`, fontFamily: HEAVY, fontWeight: 800, fontSize: fs, letterSpacing: "-0.02em", transform: `scale(${frame < t.chips[i] ? 0 : 0.7 + 0.3 * s})`, opacity: frame < t.chips[i] ? 0 : 1, boxShadow: "0 18px 40px rgba(28,77,58,0.18)" }}>
                  <div style={{ width: fs * 1.1, height: fs * 1.1, borderRadius: fs, background: "rgba(255,255,255,0.16)", display: "grid", placeItems: "center" }}>
                    <Icon name={icons[i]} size={fs * 0.72} color="#fff" width={8} at={t.chips[i]} />
                  </div>
                  {c}
                </div>
              );
            })}
          </div>
          <div style={{ height: 6, width: ez(frame, t.bracket[0], t.bracket[1], 0, L.pick(900, 600, 560), INOUT), background: C.orange, borderRadius: 3 }} />
          <div style={{ maxWidth: L.pick(1600, 900, 900), textAlign: L.wide ? "center" : "left", lineHeight: 1.04 }}>
            <MaskIn at={t.head} dur={8}>
              <span style={{ fontFamily: HEAVY, fontWeight: 900, fontSize: L.pick(headline.length > 40 ? 84 : 124, headline.length > 40 ? 78 : 104, headline.length > 40 ? 66 : 90), color: C.teal, letterSpacing: "-0.045em", display: "block" }}>
                {(() => {
                  const parts = headline.match(/[^.]+\./g) ?? [headline];
                  const last = parts.pop()!.trim();
                  return (
                    <>
                      {parts.join("").trim()} <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 600, color: C.orange, whiteSpace: "nowrap" }}>{last}</span>
                    </>
                  );
                })()}

              </span>
            </MaskIn>
          </div>
        </AbsoluteFill>
      </Push>
      <Hud dark={false} hideBottom={licence} />
      {licence && <Licence dark={false} at={t.head} />}
    </Field>
  );
}

function Steps({ t, len, L, p }: { t: any; len: number; L: Lay; p: { items: string[] } }) {
  const frame = useCurrentFrame();
  const sb = safeBox(L);
  const drift = interpolate(frame, [0, len], [0, -24]);
  const numSize = L.pick(380, 240, 190);
  return (
    <Field tone="orange" len={len}>
      <Push len={len} amount={0.035} origin="20% 30%">
        <div style={{ position: "absolute", left: L.pick(170, 96, 90), top: L.pick(150, sb.top + 30, 90) }}>
          <MaskIn at={t.heading} dur={7}>
            <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 500, fontSize: L.pick(124, 120, 104), color: "#fff", letterSpacing: "-0.02em" }}>How it works</span>
          </MaskIn>
          <div style={{ marginTop: 16, height: 6, width: ez(frame, t.rule, t.rule + 10, 0, 260), background: INK, borderRadius: 3 }} />
        </div>
        <div style={{ position: "absolute", left: L.pick(160, 96, 90), right: L.pick(120, 60, 60), top: L.pick(370, sb.top + 300, 330), display: "flex", flexDirection: L.wide ? "row" : "column", gap: L.pick(70, 26, 14), transform: `translateX(${drift}px)` }}>
          {p.items.map((it, i) => {
            const on = frame >= t.nums[i];
            const active = i === p.items.filter((_, k) => frame >= t.nums[k]).length - 1;
            return (
              <div key={it} style={{ display: "flex", flexDirection: L.wide ? "column" : "row", alignItems: L.wide ? "flex-start" : "center", gap: L.pick(8, 30, 24), flex: L.wide ? 1 : undefined }}>
                <MaskIn at={t.nums[i]} dur={6} from={0.8}>
                  <span style={{ fontFamily: HEAVY, fontWeight: 900, fontSize: numSize, lineHeight: 0.86, color: active ? INK : "rgba(255,255,255,0.9)", letterSpacing: "-0.06em", display: "block", minWidth: L.wide ? undefined : numSize * 0.62 }}>{i + 1}</span>
                </MaskIn>
                <MaskIn at={t.nums[i] + 3} dur={7}>
                  <span style={{ fontFamily: HEAVY, fontWeight: 800, fontSize: L.pick(60, 58, 50), color: on && active ? INK : "#fff", letterSpacing: "-0.025em", whiteSpace: "nowrap" }}>{it}</span>
                </MaskIn>
              </div>
            );
          })}
        </div>
      </Push>
      <Hud dark label={COPY.cta} />
    </Field>
  );
}

function End({ t, len, L, cta }: { t: any; len: number; L: Lay; cta: string }) {
  const frame = useCurrentFrame();
  const sb = safeBox(L);
  const n = t.url.filter((c: any) => c.f <= frame).length;
  const url = COPY.url.slice(0, n);
  const pop = spring({ frame: frame - t.button, fps: 30, config: { damping: 11, stiffness: 220 } });
  const pulse = t.pulses.reduce((a: number, f: number) => a + (frame >= f ? Math.max(0, 1 - (frame - f) / 8) : 0), 0);
  const btn = L.pick(60, 56, 48);
  return (
    <Field tone="teal" len={len}>
      <Push len={len} amount={0.03}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingTop: sb.top, paddingBottom: sb.bottom + L.pick(10, 40, 30), gap: L.pick(26, 32, 20) }}>
          <Mark size={L.pick(170, 200, 150)} at={t.mark[0]} dur={t.mark[1]} tile={C.orange} />
          <MaskIn at={t.name} dur={7}>
            <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: L.pick(128, 112, 96), lineHeight: 1, letterSpacing: "-0.02em", color: "#fff" }}>
              Olleik <span style={{ color: C.accentSoft }}>Foods</span>
            </div>
          </MaskIn>
          <MaskIn at={t.tagline} dur={7}>
            <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 500, fontSize: L.pick(48, 44, 38), color: "rgba(255,255,255,0.86)", whiteSpace: "nowrap" }}>{COPY.tagline}</span>
          </MaskIn>
          <div style={{ height: L.pick(14, 22, 10) }} />
          <div style={{ transform: `scale(${frame < t.button ? 0 : pop * (1 + 0.04 * pulse)})`, background: C.orange, color: "#fff", fontFamily: HEAVY, fontWeight: 700, fontSize: btn, padding: `${btn * 0.42}px ${btn * 0.95}px`, borderRadius: 999, boxShadow: `0 18px 50px rgba(200,122,42,0.4), 0 0 0 ${10 * pulse}px rgba(200,122,42,${0.25 * pulse})`, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{cta} →</div>
          <div style={{ fontFamily: HEAVY, fontWeight: 600, fontSize: L.pick(50, 44, 38), color: "#fff", minHeight: 64, letterSpacing: "-0.01em" }}>
            {url}
            {n > 0 && n < COPY.url.length && frame % 16 < 9 && <span style={{ color: C.orange }}>|</span>}
          </div>
        </AbsoluteFill>
      </Push>
      <Hud dark hideBottom />
    </Field>
  );
}

// ——— Product scenes ——————————————————————————————————————————————————————————————————————————————————————
type CamKey = { f: number; rect: Rect | null; z?: number };
const lerpCam = (f: number, keys: CamKey[], target: (k: CamKey | null) => { z: number; cx: number; cy: number }) => {
  let cur = target(null);
  for (const k of keys) {
    if (f < k.f) break;
    const tg = target(k);
    const p = ez(f, k.f, k.f + 16, 0, 1, INOUT);
    cur = { z: cur.z + (tg.z - cur.z) * p, cx: cur.cx + (tg.cx - cur.cx) * p, cy: cur.cy + (tg.cy - cur.cy) * p };
  }
  return cur;
};

function Ring({ r, at, until, frame, radius = 12, sw = 3 }: { r: Rect; at: number; until?: number; frame: number; radius?: number; sw?: number }) {
  if (frame < at) return null;
  const s = ez(frame, at, at + 10);
  const out = until != null ? 1 - ez(frame, until - 4, until + 4) : 1;
  if (out <= 0) return null;
  const pulse = 0.5 + 0.5 * Math.sin(((frame - at) / 30) * Math.PI * 2);
  const pad = 6 * (sw / 3);
  return <div style={{ position: "absolute", left: r.x - pad, top: r.y - pad, width: r.w + 2 * pad, height: r.h + 2 * pad, borderRadius: radius, border: `${sw}px solid ${C.orange}`, transform: `scale(${1.2 - 0.2 * s})`, opacity: s * out, boxShadow: `0 0 0 ${(4 + 3 * pulse) * (sw / 3)}px rgba(200,122,42,${0.16 * s})`, zIndex: 20 }} />;
}

function TypedField({ box, chars, frame, k, multiline }: { box: Rect; chars: { f: number; ch: string }[]; frame: number; k: number; multiline?: boolean }) {
  // A textarea is covered from the start (the capture already holds the final text); an input only once typing begins.
  if (!chars.length || (!multiline && frame < chars[0].f - 3)) return null;
  const n = chars.filter((c) => c.f <= frame).length;
  const text = chars.slice(0, n).map((c) => c.ch).join("");
  const shift = Math.max(0, text.length * 8.9 - (box.w - 30));
  const active = frame - chars[chars.length - 1].f < 12;
  return (
    <div style={{ position: "absolute", left: box.x + 1.5, top: box.y + 1.5, width: box.w - 3, height: box.h - 3, background: "#fff", borderRadius: 7, overflow: "hidden", boxShadow: active ? `0 0 0 ${2}px ${C.orange}, 0 0 0 ${5}px rgba(200,122,42,0.16)` : undefined }}>
      <div style={{ position: "absolute", left: 14 - shift, top: multiline ? 9 : 0, height: multiline ? 24 : box.h - 3, display: "flex", alignItems: "center", fontFamily: F.sans, fontSize: 16, color: C.text, whiteSpace: "pre" }}>
        {text}
        {active && frame % 16 < 10 && <span style={{ width: 1.5, height: 19, background: C.text, marginLeft: 1 }} />}
      </div>
    </div>
  );
}

function Pointer({ x, y, scale, clicks, frame, touch }: { x: number; y: number; scale: number; clicks: number[]; frame: number; touch?: boolean }) {
  const last = clicks.filter((c) => c <= frame).pop();
  const next = clicks.find((c) => c > frame);
  const t = last != null ? frame - last : 99;
  if (touch) {
    // A touch: the dot appears 10 frames before a tap, presses, ripples and fades after.
    const before = next != null ? next - frame : 99;
    const vis = Math.max(before <= 10 ? 1 - before / 10 : 0, t < 14 ? 1 - t / 14 : 0);
    if (vis <= 0) return null;
    const press = t < 6 ? 1 - 0.25 * Math.sin((t / 6) * Math.PI) : 1;
    return (
      <div style={{ position: "absolute", left: x, top: y, transform: `scale(${scale})`, zIndex: 30 }}>
        {t < 16 && <div style={{ position: "absolute", left: -46 * (0.4 + t / 16), top: -46 * (0.4 + t / 16), width: 92 * (0.4 + t / 16), height: 92 * (0.4 + t / 16), borderRadius: "50%", border: `3px solid ${C.orange}`, opacity: 1 - t / 16 }} />}
        <div style={{ position: "absolute", left: -22, top: -22, width: 44, height: 44, borderRadius: 22, background: "rgba(11,33,24,0.28)", border: "2px solid rgba(255,255,255,0.9)", boxShadow: "0 6px 16px rgba(0,0,0,0.25)", transform: `scale(${press})`, opacity: vis }} />
      </div>
    );
  }
  const press = t < 6 ? 1 - 0.15 * Math.sin((t / 6) * Math.PI) : 1;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `scale(${scale * press})`, transformOrigin: "0 0", zIndex: 30 }}>
      {t < 18 && <div style={{ position: "absolute", left: -40 * (0.3 + t / 18), top: -40 * (0.3 + t / 18), width: 80 * (0.3 + t / 18), height: 80 * (0.3 + t / 18), borderRadius: "50%", border: `3px solid ${C.orange}`, opacity: 1 - t / 18 }} />}
      <svg width="30" height="38" viewBox="0 0 30 38" style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.35))" }}>
        <path d="M2 2 L2 30 L9 23 L14 35 L19 33 L14 21 L24 21 Z" fill="#fff" stroke="#0b2118" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** A callout: dot on the anchor, an elbow line, a label kept inside the safe area. */
function Callout({ p, text, at, until, frame, L, dark, place, gutter }: { p: Pt; text: string; at: number; until?: number; frame: number; L: Lay; dark?: boolean; place?: { dx: number; dy: number }; gutter?: { l: number; r: number } }) {
  if (frame < at) return null;
  const out = until != null ? 1 - ez(frame, until - 6, until + 2) : 1;
  if (out <= 0) return null;
  const fs = L.pick(30, 36, 32);
  const w = text.length * fs * 0.54 + 48;
  const h = fs + 30;
  const right = place ? place.dx > 0 : p.x < L.W * 0.55;
  const sb = safeBox(L);
  const minY = L.pick(150, sb.top + 90, 140);
  let lx = right ? p.x + L.pick(150, 90, 80) : p.x - L.pick(150, 90, 80) - w;
  lx = Math.max(L.pick(80, 50, 50), Math.min(L.W - L.pick(80, 50, 50) - w, lx));
  let ly = p.y - L.pick(150, 170, 140);
  if (ly - h / 2 < minY) ly = p.y + L.pick(150, 170, 140);
  if (place) {
    lx = right ? p.x + place.dx : p.x + place.dx - w;
    lx = Math.max(40, Math.min(L.W - 40 - w, lx));
    ly = p.y + place.dy;
  } else if (gutter) {
    // label in the side gutter next to the browser frame, level with the anchor (never over the product UI)
    const left = p.x - gutter.l < gutter.r - p.x;
    lx = left ? Math.max(40, gutter.l - 40 - w) : Math.min(L.W - 40 - w, gutter.r + 40);
    ly = Math.max(minY, Math.min(L.band.bottom - h, p.y));
  }
  const rightSide = lx > p.x;
  const ex = rightSide ? lx : lx + w;
  const d = `M ${p.x} ${p.y} L ${ex - (rightSide ? 30 : -30)} ${ly} L ${ex} ${ly}`;
  const ev = evolvePath(ez(frame, at, at + 10), d);
  const lab = ez(frame, at + 6, at + 14);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: out, zIndex: 40 }}>
      <svg style={{ position: "absolute", inset: 0, overflow: "visible" }} width={L.W} height={L.H}>
        <circle cx={p.x} cy={p.y} r={8 * ez(frame, at, at + 6)} fill={C.orange} />
        <circle cx={p.x} cy={p.y} r={16 * ez(frame, at, at + 10)} fill="none" stroke={C.orange} strokeWidth={2} opacity={0.5} />
        <path d={d} stroke={C.orange} strokeWidth={3} fill="none" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
      </svg>
      <div style={{ position: "absolute", left: lx, top: ly - h / 2, height: h, display: "flex", alignItems: "center", transform: `translateX(${(1 - lab) * (rightSide ? -16 : 16)}px)`, opacity: lab, background: dark ? "rgba(255,255,255,0.14)" : "rgba(11,33,24,0.9)", backdropFilter: "blur(12px)", border: `1px solid ${dark ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.1)"}`, color: "#fff", fontFamily: HEAVY, fontWeight: 650, fontSize: fs, padding: "0 24px", borderRadius: 16, whiteSpace: "nowrap", boxShadow: "0 16px 40px rgba(0,0,0,0.25)", letterSpacing: "-0.01em" }}>
        {text}
      </div>
    </div>
  );
}

function Kicker({ text, dark }: { text: string; dark: boolean }) {
  const L = useL();
  const frame = useCurrentFrame();
  const top = L.pick(88, 250, 72);
  return (
    <div style={{ position: "absolute", left: L.wide ? 120 : 0, right: L.wide ? undefined : 0, top, zIndex: 50, display: "flex", justifyContent: L.wide ? "flex-start" : "center", opacity: ez(frame, 3, 12), transform: `translateY(${ez(frame, 3, 12, 14, 0)}px)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: L.wide ? 0 : "10px 22px", borderRadius: 999, background: L.wide ? undefined : dark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.85)", boxShadow: L.wide ? undefined : "0 8px 24px rgba(28,77,58,0.12)" }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: C.orange }} />
        <span style={{ fontFamily: HEAVY, fontWeight: 700, fontSize: L.pick(30, 36, 32), color: dark ? "#fff" : C.teal, letterSpacing: "-0.01em" }}>{text}</span>
      </div>
    </div>
  );
}

function ScreenScene({ s, L }: { s: any; L: Lay }) {
  const frame = useCurrentFrame();
  const r = s.scr;
  const len = s.len;
  const past = (r.shots ?? []).filter((x: any) => x.f <= frame);
  const src = past.map((x: any) => x.src).pop() ?? r.shot0;
  const lastShot = past[past.length - 1];
  const prevSrc = past.length > 1 ? past[past.length - 2].src : r.shot0;
  const fadeIn = lastShot?.fade ? ez(frame, lastShot.f, lastShot.f + 6, 0, 1, INOUT) : 1;
  const view: Rect = r.view;
  const dark = !!r.dark;
  const bg = dark ? INK : PAPER;
  const rise = spring({ frame: frame + (s.in === "cut" ? 6 : 2), fps: 30, config: { damping: 19, stiffness: 110 } });
  const clicks = (r.clicks ?? []).map((c: any) => c.f);
  const wordSide = L.wide && r.device !== "browser";
  // ——— geometry: browser = fixed frame + inner camera; phone/card = the device moves (glides, zooms) in the band.
  let screenToCanvas: (p: Pt) => Pt;
  let gutter: { l: number; r: number } | undefined;
  let deviceEl: React.ReactNode;
  let k = 1;
  const content = (kk: number) => (
    <>
      {fadeIn < 1 && <Img src={staticFile(`footage/${prevSrc}.png`)} style={{ position: "absolute", left: 0, top: 0, width: r.device === "browser" ? 1440 : 390, height: r.device === "browser" ? 900 : 844 }} />}
      <Img src={staticFile(`footage/${src}.png`)} style={{ position: "absolute", left: 0, top: 0, width: r.device === "browser" ? 1440 : 390, height: r.device === "browser" ? 900 : 844, opacity: fadeIn }} />
      {(r.typed ?? []).map((fl: any, i: number) => (frame < (r.typedUntil ?? 1e9) ? <TypedField key={i} box={fl.box} chars={fl.chars} frame={frame} k={kk} multiline={fl.multiline} /> : null))}
      {(r.rings ?? []).map((g: any, i: number) => (
        <Ring key={i} r={g.rect} at={g.f} until={g.until} frame={frame} radius={g.radius} sw={Math.max(1.2, 3.5 / kk)} />
      ))}
      {(r.pulses ?? []).map((p: any, i: number) =>
        frame >= p.f && frame < p.f + 14 ? <div key={`p${i}`} style={{ position: "absolute", left: p.rect.x - 10, top: p.rect.y - 10, width: p.rect.w + 20, height: p.rect.h + 20, borderRadius: 40, border: `${2 / Math.max(0.5, kk / 2)}px solid ${C.orange}`, opacity: 1 - (frame - p.f) / 14, transform: `scale(${1 + (frame - p.f) / 14})` }} /> : null,
      )}
      {(r.pops ?? []).map((p: any, i: number) => {
        if (frame < p.f) return null;
        const t = frame - p.f;
        const lift = t < 16 ? Math.sin((t / 16) * Math.PI) : 0;
        return (
          <div key={`pop${i}`} style={{ position: "absolute", left: p.rect.x, top: p.rect.y, width: p.rect.w, height: p.rect.h, borderRadius: 14, overflow: "hidden", transform: `scale(${1 + 0.05 * lift})`, boxShadow: `0 ${10 * lift}px ${30 * lift}px rgba(11,33,24,${0.35 * lift}), 0 0 0 ${2.5 * ez(frame, p.f, p.f + 6)}px ${C.orange}`, zIndex: 10 }}>
            <Img src={staticFile(`footage/${src}.png`)} style={{ position: "absolute", left: -p.rect.x, top: -p.rect.y, width: 390, height: 844 }} />
          </div>
        );
      })}
    </>
  );
  // cursor (screen coords)
  const cur = r.cursor ?? [];
  let cx = cur[0]?.x ?? 0;
  let cy = cur[0]?.y ?? 0;
  for (let i = 1; i < cur.length; i++) {
    const a = cur[i - 1];
    const z = cur[i];
    if (frame >= a.f) {
      const q = ez(frame, a.f + (r.touch ? 4 : 0), z.f - (r.touch ? 10 : 0), 0, 1, INOUT);
      cx = a.x + (z.x - a.x) * q;
      cy = a.y + (z.y - a.y) * q;
    }
  }
  const showCursor = cur.length > 0 && frame >= cur[0].f - (r.touch ? 10 : 0);

  if (r.device === "browser") {
    const bar = 44;
    const bandH = L.band.bottom - L.band.top;
    const fw = Math.min(r.frameW, ((bandH - bar - 10) * view.w) / view.h);
    const fh = (fw * view.h) / view.w;
    const left = (L.W - fw) / 2;
    const top = L.band.top + (bandH - (fh + bar)) / 2;
    const base = fw / view.w;
    const cam = lerpCam(frame, r.cam ?? [], (kk) => {
      if (!kk || !kk.rect) return { z: 1, cx: view.x + view.w / 2, cy: view.y + view.h / 2 };
      const rr = kk.rect;
      const padR = { w: rr.w * 1.3, h: rr.h * 3.0 };
      const z = kk.z ?? Math.max(1, Math.min(2.4, view.w / padR.w, view.h / padR.h));
      return { z, cx: rr.x + rr.w / 2, cy: rr.y + rr.h / 2 };
    });
    const hw = view.w / 2 / cam.z;
    const hh = view.h / 2 / cam.z;
    cam.cx = Math.min(view.x + view.w - hw, Math.max(view.x + hw, cam.cx));
    cam.cy = Math.min(view.y + view.h - hh, Math.max(view.y + hh, cam.cy));
    k = base * cam.z;
    gutter = { l: left, r: left + fw };
    screenToCanvas = (p) => ({ x: left + fw / 2 + (p.x - cam.cx) * k, y: top + bar + fh / 2 + (p.y - cam.cy) * k });
    const sweep = interpolate(frame, [0, len], [-0.2, 1.2]);
    deviceEl = (
      <div style={{ position: "absolute", left, top, width: fw, perspective: 2200 }}>
        <div style={{ transform: `translateY(${(1 - rise) * 170}px) rotateX(${(1 - rise) * 16}deg) scale(${0.93 + 0.07 * rise})`, transformOrigin: "50% 100%", opacity: Math.min(1, rise * 1.4) }}>
          <div style={{ borderRadius: 20, overflow: "hidden", boxShadow: dark ? "0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.09)" : "0 2px 4px rgba(28,77,58,0.06), 0 34px 100px rgba(28,77,58,0.24), 0 0 0 1px rgba(28,77,58,0.08)" }}>
            <div style={{ height: bar, background: dark ? "rgba(22,40,32,0.95)" : "rgba(250,247,240,0.95)", display: "flex", alignItems: "center", padding: "0 18px", gap: 8, borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(28,77,58,0.07)"}` }}>
              {["#ff5f57", "#febc2e", "#28c840"].map((col) => (
                <span key={col} style={{ width: 12, height: 12, borderRadius: 6, background: dark ? "rgba(255,255,255,0.18)" : col, opacity: dark ? 1 : 0.85 }} />
              ))}
              <div style={{ margin: "0 auto", height: 28, minWidth: 420, padding: "0 16px", borderRadius: 14, background: dark ? "rgba(255,255,255,0.06)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(28,77,58,0.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: F.sans, fontSize: 15, color: dark ? "rgba(255,255,255,0.7)" : C.soft }}>
                <svg width="11" height="13" viewBox="0 0 12 14"><rect x="1" y="6" width="10" height="7.5" rx="1.6" fill="currentColor" /><path d="M3.3 6V4.3a2.7 2.7 0 0 1 5.4 0V6" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
                {r.url}
              </div>
              <div style={{ width: 52 }} />
            </div>
            <div style={{ position: "relative", width: fw, height: fh, overflow: "hidden", background: dark ? INK : "#fff" }}>
              <div style={{ position: "absolute", left: 0, top: 0, width: 1440, height: 900, transformOrigin: "0 0", transform: `translate(${fw / 2}px, ${fh / 2}px) scale(${k}) translate(${-cam.cx}px, ${-cam.cy}px)` }}>
                {content(k)}
                {showCursor && <Pointer x={cx} y={cy} scale={1.25 / k} clicks={clicks} frame={frame} />}
              </div>
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(115deg, transparent ${sweep * 100 - 10}%, rgba(255,255,255,${dark ? 0.05 : 0.12}) ${sweep * 100}%, transparent ${sweep * 100 + 10}%)`, pointerEvents: "none" }} />
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    const isPhone = r.device === "phone";
    const band = L.band;
    const bandH = band.bottom - band.top;
    const areaX = wordSide ? { l: 980, r: 1800 } : { l: 0, r: L.W };
    const areaW = areaX.r - areaX.l;
    // base scale: wide fits the whole device in the band; 9:16 and 1:1 make the phone big (cropped by the frame).
    const k0 = isPhone ? L.pick((bandH * 1.2) / view.h, 820 / view.w, 600 / view.w) : L.pick(bandH / view.h, 900 / view.w, 760 / view.w);
    const cam = lerpCam(frame, r.cam ?? [], (kk) => {
      if (!kk || !kk.rect) return { z: 1, cx: view.x + view.w / 2, cy: view.y + view.h / 2 };
      return { z: kk.z ?? 1, cx: kk.rect.x + kk.rect.w / 2, cy: kk.rect.y + kk.rect.h / 2 };
    });
    k = k0 * cam.z;
    const midX = areaX.l + areaW / 2;
    const midY = band.top + bandH / 2;
    // clamp the focus so the device covers the band when it is bigger than the band, or stays centred when smaller
    const halfW = areaW / 2 / k;
    const halfH = bandH / 2 / k;
    const fx = view.w * k <= areaW ? view.x + view.w / 2 : Math.min(view.x + view.w - halfW, Math.max(view.x + halfW, cam.cx));
    const fy = view.h * k <= bandH ? view.y + view.h / 2 : Math.min(view.y + view.h - halfH, Math.max(view.y + halfH, cam.cy));
    screenToCanvas = (p) => ({ x: midX + (p.x - fx) * k, y: midY + (p.y - fy) * k });
    const o = screenToCanvas({ x: view.x, y: view.y });
    const sw = view.w * k;
    const sh = view.h * k;
    const bez = isPhone ? 14 * Math.min(1.6, k / 1.2) : 0;
    const rad = isPhone ? 54 * Math.min(1.6, k / 1.2) : 30;
    const enter = (1 - rise) * L.pick(240, 420, 300);
    const tilt = (1 - rise) * 10;
    const mask = `linear-gradient(to bottom, transparent ${L.pick(20, 260, 60)}px, black ${L.pick(120, 370, 150)}px, black ${L.pick(960, 1290, 820)}px, transparent ${L.pick(1060, 1400, 900)}px)`;
    deviceEl = (
      <AbsoluteFill style={{ WebkitMaskImage: mask, maskImage: mask }}>
        <div style={{ position: "absolute", left: o.x - bez, top: o.y - bez, width: sw + 2 * bez, height: sh + 2 * bez, transform: `translateY(${enter}px) rotate(${tilt * (wordSide ? 1 : 0.4)}deg)`, opacity: Math.min(1, rise * 1.5) }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: rad + bez, background: isPhone ? "#0d1416" : dark ? INK : "#fff", boxShadow: dark ? "0 50px 140px rgba(0,0,0,0.65), 0 0 0 1.5px rgba(255,255,255,0.1)" : "0 50px 120px rgba(28,77,58,0.32), 0 0 0 1px rgba(28,77,58,0.12)" }} />
          <div style={{ position: "absolute", left: bez, top: bez, width: sw, height: sh, borderRadius: rad, overflow: "hidden", background: dark ? INK : "#fff" }}>
            <div style={{ position: "absolute", left: 0, top: 0, width: 390, height: 844, transformOrigin: "0 0", transform: `scale(${k}) translate(${-view.x}px, ${-view.y}px)` }}>
              {content(k)}
              {showCursor && <Pointer x={cx} y={cy} scale={1 / k * L.pick(1, 1.4, 1.2)} clicks={clicks} frame={frame} touch={r.touch} />}
            </div>
            <div style={{ position: "absolute", inset: 0, borderRadius: rad, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)", background: `linear-gradient(120deg, rgba(255,255,255,0) 40%, rgba(255,255,255,${dark ? 0.04 : 0.1}) 50%, rgba(255,255,255,0) 60%)`, backgroundSize: "300% 100%", backgroundPosition: `${interpolate(frame, [0, len], [100, 0])}% 0`, pointerEvents: "none" }} />
          </div>
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ background: bg }}>
      {/* depth of field: the same screen, huge and blurred, drifting behind */}
      <AbsoluteFill style={{ opacity: (dark ? 0.35 : 0.45) * (r.device === "browser" ? 1 : 0.5), filter: "blur(40px) saturate(1.1)", transform: `scale(${1.5 + 0.05 * (frame / len)}) translateX(${interpolate(frame, [0, len], [30, -30])}px)` }}>
        <Img src={staticFile(`footage/${src}.png`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: dark ? "radial-gradient(70% 60% at 50% 45%, rgba(11,33,24,0.25), rgba(11,33,24,0.88))" : "radial-gradient(70% 60% at 50% 45%, rgba(250,246,236,0.2), rgba(250,246,236,0.92))" }} />
      {wordSide && s.props.word && (
        <div style={{ position: "absolute", left: 170, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center", zIndex: 5 }}>
          <MaskIn at={b(0.5)} dur={7}>
            <span style={{ fontFamily: HEAVY, fontWeight: 900, fontSize: 170, color: dark ? "#fff" : C.teal, letterSpacing: "-0.05em", lineHeight: 1 }}>{s.props.word}</span>
          </MaskIn>
          <div style={{ marginTop: 22, height: 6, width: ez(frame, b(1), b(1) + 10, 0, 140), background: C.orange, borderRadius: 3 }} />
        </div>
      )}
      {deviceEl}
      {(r.callouts ?? []).filter((c: any) => L.wide || !c.wideOnly).map((c: any, i: number) => (
        <Callout key={i} p={screenToCanvas(c.at)} text={c.text} at={c.f} until={c.until} frame={frame} L={L} dark={dark} place={L.wide ? c.placeWide : c.placeTall} gutter={gutter} />
      ))}
      <Kicker text={r.kicker} dark={dark} />
      {s.caption && <Caption text={s.caption} at={6} len={len} licence={s.licence} />}
      <Grain opacity={dark ? 0.06 : 0.045} />
      <Hud dark={dark} hideBottom />
      {s.licence && <Licence dark={dark} at={0} />}
    </AbsoluteFill>
  );
}

// ——— Hero loop (silent, seamless) ————————————————————————————————————————————————————————————————————————
function Loop({ len }: { len: number }) {
  const frame = useCurrentFrame();
  const L = useL();
  const t = (frame % len) / len;
  const TAU = Math.PI * 2;
  const words = ["Your catalog", "Your prices", "Your orders"];
  const hl = (i: number) => {
    const d = Math.min(Math.abs(t - i / 3), 1 - Math.abs(t - i / 3));
    return Math.max(0, 1 - d * 6);
  };
  // three real client-area captures float on slow periodic orbits (period = loop length)
  const cards = [
    { src: "visitor/p-catalog-card", x: 250, y: 600, rot: -9, ph: 0, s: 0.42 },
    { src: "visitor/p-orders", x: 1670, y: 500, rot: 8, ph: 0.33, s: 0.42 },
  ];
  return (
    <AbsoluteFill style={{ background: `radial-gradient(110% 80% at ${50 + 8 * Math.sin(TAU * t)}% 20%, #245a43 0%, ${C.teal} 45%, ${C.tealDark} 100%)`, overflow: "hidden" }}>
      {cards.map((c, i) => {
        const dy = 22 * Math.sin(TAU * (t + c.ph));
        const dr = 1.5 * Math.sin(TAU * (t + c.ph + 0.25));
        return (
          <div key={i} style={{ position: "absolute", left: c.x, top: c.y, transform: `translate(-50%, -50%) translateY(${dy}px) rotate(${c.rot + dr}deg) scale(${c.s})`, filter: "blur(5px)", opacity: 0.32 }}>
            <div style={{ width: 390 * 2, height: 844 * 2, borderRadius: 110, background: "#0d1416", padding: 26, boxShadow: "0 60px 140px rgba(0,0,0,0.5)" }}>
              <div style={{ width: "100%", height: "100%", borderRadius: 86, overflow: "hidden" }}>
                <Img src={staticFile(`footage/${c.src}.png`)} style={{ width: "100%", height: "100%" }} />
              </div>
            </div>
          </div>
        );
      })}
      <AbsoluteFill style={{ background: "radial-gradient(45% 55% at 50% 50%, rgba(14,44,32,0.85), rgba(14,44,32,0) 100%)" }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 46, transform: `translateY(${-6 * Math.sin(TAU * t)}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <BrandMark size={190} tile={C.orange} />
          <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 150, lineHeight: 1, letterSpacing: "-0.02em", color: "#fff" }}>
            Olleik <span style={{ color: C.accentSoft }}>Foods</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 30, alignItems: "center" }}>
          {words.map((w, i) => (
            <React.Fragment key={w}>
              {i > 0 && <span style={{ width: 12, height: 12, borderRadius: 6, background: C.orange }} />}
              <span style={{ fontFamily: HEAVY, fontWeight: 700, fontSize: 48, letterSpacing: "0.1em", color: `rgba(255,255,255,${0.55 + 0.45 * hl(i)})`, textShadow: hl(i) > 0.5 ? "0 0 24px rgba(200,122,42,0.35)" : undefined }}>{w}</span>
            </React.Fragment>
          ))}
        </div>
      </AbsoluteFill>
      <Grain opacity={0.05} period={4} />
    </AbsoluteFill>
  );
}

// ——— Transitions and the cut —————————————————————————————————————————————————————————————————————————————
function Enter({ type, children }: { type?: string; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const L = useL();
  if (!type || type === "cut" || frame >= 13) return <AbsoluteFill>{children}</AbsoluteFill>;
  const e = ez(frame, 0, 11);
  if (type === "circle") return <AbsoluteFill style={{ clipPath: `circle(${e * Math.hypot(L.W, L.H) * 0.55}px at 50% 50%)` }}>{children}</AbsoluteFill>;
  if (type === "slide") return <AbsoluteFill style={{ transform: `translateX(${(1 - e) * L.W}px)`, filter: e < 0.95 ? `blur(${(1 - e) * 18}px)` : undefined }}>{children}</AbsoluteFill>;
  if (type === "push") {
    const q = ez(frame, 0, 9, 0, 1, Easing.bezier(0.5, 0, 0.1, 1));
    return <AbsoluteFill style={{ transform: `translateX(${(1 - q) * L.W * 0.9}px) scale(${1.04 - 0.04 * q})`, filter: q < 0.92 ? `blur(${(1 - q) * 26}px)` : undefined, opacity: Math.min(1, q * 3) }}>{children}</AbsoluteFill>;
  }
  // wipe: an ink band with an orange leading edge sweeps across, revealing the new scene behind it
  const band = L.wide ? 560 : 420;
  const skew = L.wide ? 216 : 340;
  const x = -band + e * (L.W + band * 2 + skew);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `polygon(0 0, ${x}px 0, ${x - skew}px 100%, 0 100%)` }}>{children}</AbsoluteFill>
      <div style={{ position: "absolute", top: -80, bottom: -80, left: x - band, width: band, background: INK, transform: "skewX(-11deg)" }} />
      <div style={{ position: "absolute", top: -80, bottom: -80, left: x - 14, width: 14, background: C.orange, transform: "skewX(-11deg)" }} />
    </AbsoluteFill>
  );
}

/** The outgoing scene's half of a transition (its last OVERLAP frames run under the incoming scene). */
function Exit({ type, len, children }: { type?: string; len: number; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const L = useL();
  const t = frame - len;
  if (!type || type === "cut" || t < 0) return <AbsoluteFill>{children}</AbsoluteFill>;
  if (type === "push") {
    const q = ez(t, 0, 9, 0, 1, Easing.bezier(0.5, 0, 0.1, 1));
    return <AbsoluteFill style={{ transform: `translateX(${-q * L.W * 0.45}px) scale(${1 - 0.04 * q})`, filter: q > 0.05 ? `blur(${q * 20}px)` : undefined }}>{children}</AbsoluteFill>;
  }
  if (type === "slide") {
    const q = ez(t, 0, 11);
    return <AbsoluteFill style={{ transform: `translateX(${-q * L.W * 0.25}px)`, filter: `brightness(${1 - 0.35 * q})` }}>{children}</AbsoluteFill>;
  }
  const q = ez(t, 0, 11);
  return <AbsoluteFill style={{ transform: `scale(${1 - 0.05 * q})`, filter: `brightness(${1 - 0.4 * q})` }}>{children}</AbsoluteFill>;
}

function Body({ s }: { s: any }) {
  const L = useL();
  const len = s.len;
  switch (s.kind) {
    case "slam2":
      return <Slam2Hook t={s.t} len={len} L={L} />;
    case "question":
      return <QuestionHook t={s.t} len={len} L={L} p={s.props} />;
    case "status":
      return <StatusHook t={s.t} len={len} L={L} />;
    case "cta":
      return <CtaWords t={s.t} len={len} L={L} text={s.props.text} />;
    case "trust":
      return <Trust t={s.t} len={len} L={L} text={s.props.text} />;
    case "words":
      return <Words t={s.t} len={len} L={L} lines={s.props.lines} />;
    case "merge":
      return <Merge t={s.t} len={len} L={L} p={s.props} />;
    case "brand":
      return <Brand t={s.t} len={len} L={L} />;
    case "service":
      return <Service t={s.t} len={len} L={L} p={s.props} />;
    case "trio":
      return <Trio t={s.t} len={len} L={L} p={s.props} />;
    case "steps":
      return <Steps t={s.t} len={len} L={L} p={s.props} />;
    case "screen":
      return <ScreenScene s={s} L={L} />;
    case "end":
      return <End t={s.t} len={len} L={L} cta={s.props.cta} />;
    case "loop":
      return <Loop len={len} />;
    default:
      return null;
  }
}

export function PromoCut({ cut, opening, audio = true, audioSrc }: FinalProps) {
  const T = promoTimeline(cut, opening ?? undefined);
  return (
    <AbsoluteFill style={{ background: INK }}>
      {T.scenes.map((s: any, i: number) => (
        <Sequence key={s.id} from={s.from} durationInFrames={s.render} name={`${s.id} ${s.kind}`}>
          <AbsoluteFill style={{ isolation: "isolate" }}>
            <Enter type={i === 0 ? undefined : s.in}>
              <Exit type={T.scenes[i + 1]?.in} len={s.len}>
                <Body s={s} />
              </Exit>
            </Enter>
          </AbsoluteFill>
        </Sequence>
      ))}
      {audio && audioSrc && <Audio src={staticFile(audioSrc)} />}
    </AbsoluteFill>
  );
}
export const promoFramesOf = (cut: string) => promoTimeline(cut).frames;

// ——— Thumbnails (3 variants for the master) ———————————————————————————————————————————————————————————————
export type ThumbProps = { variant: "A" | "B" | "C" };
/** Still thumbnails: big readable type at small sizes, one real product capture, the brand mark. */
export function Thumb({ variant }: ThumbProps) {
  const phone = (src: string, x: number, y: number, sc: number, rot: number) => (
    <div style={{ position: "absolute", left: x, top: y, transform: `rotate(${rot}deg)`, transformOrigin: "50% 50%" }}>
      <div style={{ width: 390 * sc + 28, height: 844 * sc + 28, borderRadius: 64, background: "#0d1416", padding: 14, boxShadow: "0 60px 120px rgba(0,0,0,0.45), 0 0 0 1.5px rgba(255,255,255,0.08)" }}>
        <div style={{ width: 390 * sc, height: 844 * sc, borderRadius: 52, overflow: "hidden" }}>
          <Img src={staticFile(`footage/${src}.png`)} style={{ width: "100%", height: "100%" }} />
        </div>
      </div>
    </div>
  );
  const brand = (x: number, y: number, dark: boolean) => (
    <div style={{ position: "absolute", left: x, top: y, display: "flex", alignItems: "center", gap: 22 }}>
      <BrandMark size={96} tile={dark ? C.orange : C.teal} />
      <Wordmark size={64} dark={dark} />
    </div>
  );
  if (variant === "A")
    return (
      <AbsoluteFill style={{ background: `radial-gradient(90% 80% at 75% 15%, #245a43 0%, ${INK} 62%)` }}>
        <div style={{ position: "absolute", left: 120, top: 300, lineHeight: 1.0 }}>
          <div style={{ fontFamily: HEAVY, fontWeight: 900, fontSize: 190, color: "#fff", letterSpacing: "-0.05em" }}>Your catalog.</div>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 600, fontSize: 206, color: C.orange, letterSpacing: "-0.02em" }}>Your prices.</div>
        </div>
        {phone("visitor/p-catalog-card", 1330, 110, 1.0, 6)}
        {brand(120, 90, true)}
        <Grain opacity={0.06} />
      </AbsoluteFill>
    );
  if (variant === "B")
    return (
      <AbsoluteFill style={{ background: `radial-gradient(110% 90% at 50% 0%, #ffffff 0%, ${PAPER} 62%, #efe7d4 100%)` }}>
        <div style={{ position: "absolute", left: 120, top: 280, width: 1180, lineHeight: 1.0 }}>
          <span style={{ fontFamily: HEAVY, fontWeight: 900, fontSize: 150, color: C.teal, letterSpacing: "-0.045em" }}>Every order,</span>
          <br />
          <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 600, fontSize: 132, color: C.orange, letterSpacing: "-0.02em" }}>followed to the end.</span>
          <div style={{ marginTop: 56, display: "flex", gap: 16 }}>
            {STATUS.map((c) => (
              <span key={c.label} style={{ background: c.bg, color: c.fg, borderRadius: 999, padding: "14px 28px", fontFamily: HEAVY, fontWeight: 800, fontSize: 34, letterSpacing: "0.04em", textTransform: "uppercase" }}>{c.label}</span>
            ))}
          </div>
        </div>
        {phone("visitor/p-orders", 1330, 90, 1.02, -5)}
        {brand(120, 90, false)}
        <Grain opacity={0.05} />
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill style={{ background: `radial-gradient(100% 90% at 20% 10%, #dc9446 0%, ${C.orange} 50%, #a9621c 100%)` }}>
      <div style={{ position: "absolute", left: 120, top: 250, lineHeight: 1.0 }}>
        <span style={{ fontFamily: HEAVY, fontWeight: 900, fontSize: 200, color: "#fff", letterSpacing: "-0.045em" }}>Open a</span>
        <br />
        <span style={{ fontFamily: HEAVY, fontWeight: 900, fontSize: 200, color: "#fff", letterSpacing: "-0.045em" }}>wholesale </span>
        <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 600, fontSize: 216, color: INK }}>account.</span>
        <br />
        <div style={{ marginTop: 50, display: "inline-block", background: INK, color: "#fff", borderRadius: 999, padding: "22px 48px", fontFamily: HEAVY, fontWeight: 800, fontSize: 52 }}>{COPY.cta} →</div>
      </div>
      {brand(120, 90, true)}
      <div style={{ position: "absolute", right: 120, bottom: 100, fontFamily: HEAVY, fontWeight: 700, fontSize: 46, color: "#fff" }}>{COPY.url}</div>
      <Grain opacity={0.07} />
    </AbsoluteFill>
  );
}
