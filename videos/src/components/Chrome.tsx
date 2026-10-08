import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND, C, ease, F } from "../theme";

/** Very light paper with a faint grid and a little grain; a soft light from the top. */
export function Background({ grid = true }: { grid?: boolean }) {
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 0%, #ffffff 0%, ${C.paper} 60%, #f1ead8 100%)` }}>
      {grid && (
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <defs>
            <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(28,77,58,0.045)" strokeWidth="1" />
            </pattern>
            <radialGradient id="fade" cx="50%" cy="45%" r="70%">
              <stop offset="0%" stopColor="#fff" stopOpacity="1" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <mask id="gridMask">
              <rect width="100%" height="100%" fill="url(#fade)" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" mask="url(#gridMask)" />
        </svg>
      )}
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.05, mixBlendMode: "multiply" }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
}

/**
 * Lower-third caption: one idea, sentence case. White card, orange edge, optional step number.
 * In at `from`, out at `to` (both in the parent sequence's frames); at least 2.5 s on screen by design.
 */
export function Caption({ text, from, to, step, position = "left" }: { text: string; from: number; to: number; step?: number; position?: "left" | "center" }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const vertical = height > width;
  if (frame < from - 1 || frame > to + 12) return null;
  const inS = spring({ frame: frame - from, fps, config: { damping: 18, stiffness: 140 } });
  const out = interpolate(frame, [to, to + 12], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        // Vertical cut: under the picture, clear of the bottom band phone apps cover.
        ...(vertical ? { top: 1430 } : { bottom: 34 }),
        ...(vertical ? { left: 60, transform: `translateY(${(1 - inS) * 24}px)` } : position === "center" ? { left: "50%", transform: `translate(-50%, ${(1 - inS) * 24}px)` } : { left: 70, transform: `translateY(${(1 - inS) * 24}px)` }),
        opacity: inS * out,
        display: "flex",
        alignItems: "center",
        gap: 18,
        background: "rgba(255,255,255,0.985)",
        borderRadius: 18,
        padding: "18px 34px 18px 24px",
        boxShadow: "0 1px 2px rgba(28,77,58,0.08), 0 16px 40px rgba(28,77,58,0.16)",
        borderLeft: `5px solid ${C.orange}`,
        maxWidth: vertical ? 960 : 1240,
        zIndex: 60,
      }}
    >
      {step !== undefined && (
        <span style={{ flex: "none", width: 50, height: 50, borderRadius: 25, background: C.orangeDeep, color: "#fff", fontFamily: F.sans, fontWeight: 700, fontSize: 25, display: "flex", alignItems: "center", justifyContent: "center" }}>{step}</span>
      )}
      <span style={{ fontFamily: F.sans, fontSize: vertical ? 46 : 40, lineHeight: 1.22, color: C.tealDark, fontWeight: 500, letterSpacing: "-0.01em" }}>{text}</span>
    </div>
  );
}

/** Chapter title card: number, Title Case title in the brand serif, an orange rule that draws in. */
export function ChapterCard({ n, title, kicker, duration }: { n: number; title: string; kicker?: string; duration: number }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const vertical = height > width;
  const inS = spring({ frame, fps, config: { damping: 16, stiffness: 120 } });
  const out = interpolate(frame, [duration - 10, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rule = ease(frame, [6, 26], [0, 120]);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Background />
      <div style={{ position: "absolute", right: vertical ? 40 : 120, top: vertical ? "30%" : "50%", transform: `translateY(-54%) translateX(${(1 - inS) * 40}px)`, fontFamily: F.serif, fontStyle: "italic", fontWeight: 500, fontSize: vertical ? 440 : 620, lineHeight: 1, color: C.orange, opacity: 0.07 * inS, letterSpacing: "-0.04em" }}>{String(n).padStart(2, "0")}</div>
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: vertical ? 90 : 200 }}>
        <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 26, letterSpacing: "0.22em", color: C.orangeDeep, opacity: inS, transform: `translateY(${(1 - inS) * 16}px)` }}>
          {kicker ?? `CHAPTER ${String(n).padStart(2, "0")}`}
        </div>
        <div style={{ height: 4, width: rule, background: C.orange, borderRadius: 2, margin: "26px 0 30px" }} />
        <div style={{ fontFamily: F.serif, fontWeight: 500, fontSize: vertical ? 96 : 104, lineHeight: 1.02, color: C.teal, letterSpacing: "-0.02em", maxWidth: vertical ? 900 : 1400, opacity: inS, transform: `translateY(${(1 - inS) * 28}px)` }}>{title}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// The Olleik Foods mark, rebuilt from the site's header (src/app/(marketing)/layout.tsx): a rounded brand-green tile with
// a Fraunces "O", next to the wordmark "Olleik" (brand-deep) "Foods" (accent). No logo file exists in the project.
export function Mark({ size, draw = 1, fill = 1, tile = C.teal, letter = "#fff" }: { size: number; draw?: number; fill?: number; tile?: string; letter?: string }) {
  const r = size * 0.18;
  const per = 4 * (size - 6) - (8 - 2 * Math.PI) * r;
  const d = Math.min(1, Math.max(0, draw));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Olleik Foods mark">
      <rect x={3} y={3} width={size - 6} height={size - 6} rx={r} fill={tile} fillOpacity={fill} stroke={tile} strokeWidth={5} strokeDasharray={per} strokeDashoffset={per * (1 - d)} />
      <text x="50%" y="53%" dominantBaseline="middle" textAnchor="middle" fontFamily={F.serif} fontWeight={600} fontSize={size * 0.56} fill={letter} opacity={Math.min(1, Math.max(0, (fill - 0.3) / 0.7))}>
        O
      </text>
    </svg>
  );
}

/** "Olleik Foods" as on the site: Fraunces semibold, the second word in the accent colour. */
export function Wordmark({ size, dark = false, reveal = 1 }: { size: number; dark?: boolean; reveal?: number }) {
  return (
    <div style={{ fontFamily: F.serif, fontWeight: 600, fontSize: size, lineHeight: 1, letterSpacing: "-0.02em", whiteSpace: "nowrap", clipPath: `inset(0 ${100 - reveal * 100}% 0 0)` }}>
      <span style={{ color: dark ? "#fff" : C.tealDark }}>Olleik</span> <span style={{ color: C.orange }}>Foods</span>
    </div>
  );
}

/** Opening (about 2.5 s): the tile draws and fills, the wordmark wipes in, then the site's tagline. */
export function LogoIntro({ duration = 80 }: { duration?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const draw = ease(frame, [2, 26], [0, 1]);
  const fill = ease(frame, [20, 36], [0, 1]);
  const slide = spring({ frame: frame - 30, fps, config: { damping: 18, stiffness: 110 } });
  const name = ease(frame, [36, 54], [0, 1]);
  const motto = ease(frame, [48, 64], [0, 1]);
  const out = interpolate(frame, [duration - 10, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Background grid={false} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 44 * slide }}>
          <div style={{ transform: `scale(${1.25 - 0.25 * slide})` }}>
            <Mark size={210} draw={draw} fill={fill} />
          </div>
          <div style={{ width: 760 * slide, overflow: "hidden", borderLeft: `3px solid ${C.orange}`, paddingLeft: 40 * slide, opacity: slide }}>
            <Wordmark size={112} reveal={name} />
            <div style={{ marginTop: 22, fontFamily: F.serif, fontStyle: "italic", fontWeight: 500, fontSize: 40, color: C.teal, whiteSpace: "nowrap", opacity: motto, transform: `translateY(${(1 - motto) * 10}px)` }}>
              {BRAND.tagline}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Closing (3 s): the logo, the site address, an optional call to action. */
export function LogoOutro({ urls, cta }: { urls: string[]; cta?: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 16, stiffness: 120 } });
  const u = ease(frame, [14, 30], [0, 1]);
  return (
    <AbsoluteFill>
      <Background grid={false} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 36, opacity: s, transform: `scale(${0.94 + 0.06 * s})` }}>
          <Mark size={150} />
          <div style={{ borderLeft: `3px solid ${C.orange}`, paddingLeft: 34 }}>
            <Wordmark size={84} />
          </div>
        </div>
        <div style={{ marginTop: 56, display: "flex", gap: 28, opacity: u, transform: `translateY(${(1 - u) * 12}px)` }}>
          {urls.map((url) => (
            <span key={url} style={{ fontFamily: F.sans, fontWeight: 500, fontSize: 34, color: C.teal }}>
              {url}
            </span>
          ))}
        </div>
        {cta && (
          <div style={{ marginTop: 34, opacity: u, fontFamily: F.sans, fontWeight: 600, fontSize: 28, color: "#fff", background: C.orange, borderRadius: 999, padding: "14px 34px" }}>{cta}</div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** A scene that fades in and out as a whole (sequences overlap by the fade length, so cuts become dissolves). */
export function SceneFade({ duration, fadeIn = 10, fadeOut = 10, children }: { duration: number; fadeIn?: number; fadeOut?: number; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const o = Math.min(
    fadeIn ? interpolate(frame, [0, fadeIn], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1,
    fadeOut ? interpolate(frame, [duration - fadeOut, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1,
  );
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
}
