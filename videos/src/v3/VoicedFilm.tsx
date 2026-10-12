import React from "react";
import { AbsoluteFill, Audio, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame } from "remotion";
import { Mark, Wordmark } from "../components/Chrome";
import { C, F } from "../theme";
import { BAND, Whip } from "./Episode3";
import { assertLine } from "./lines";
import { EndCard } from "./Promo20";
import type { VManual, VSeg } from "./voiced";
import { WorldView } from "./World";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** The live-action opener: the clip with a slow push (the narrator starts over it). */
function Live({ seg }: { seg: Extract<VSeg, { kind: "live" }> }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${1.04 + f * 0.0016})`, transformOrigin: "60% 45%" }}>
        <OffthreadVideo src={staticFile(seg.src)} startFrom={Math.round(seg.start * 30)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Title card: the logo, the guide's name and what it covers; type keeps drifting (no frozen hold). */
function Title({ seg }: { seg: Extract<VSeg, { kind: "title" }> }) {
  const f = useCurrentFrame();
  const s = spring({ frame: f, fps: 30, config: { damping: 14, stiffness: 150 } });
  const k = (d: number) => easeOut((f - d) / 12);
  return (
    <AbsoluteFill style={{ background: C.paper, overflow: "hidden" }}>
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30, paddingBottom: BAND, transform: `scale(${1 + f * 0.0007})` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22, opacity: Math.min(1, s * 1.5), transform: `translateY(${(1 - s) * 30}px)` }}>
          <Mark size={84} draw={Math.min(1, s * 1.3)} fill={s} />
          <Wordmark size={72} reveal={Math.min(1, s * 1.2)} />
        </div>
        <div style={{ fontFamily: F.serif, fontWeight: 700, fontSize: 112, letterSpacing: "-0.03em", color: C.tealDark, opacity: k(8), transform: `translateY(${(1 - k(8)) * 30}px)` }}>{assertLine(seg.title)}</div>
        <div style={{ fontFamily: F.sans, fontSize: 38, color: C.soft, opacity: k(16), transform: `translateY(${(1 - k(16)) * 20}px)` }}>{assertLine(seg.sub)}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Chapter card: the number and the chapter's name, sliding with momentum. */
function Chapter({ seg }: { seg: Extract<VSeg, { kind: "chapter" }> }) {
  const f = useCurrentFrame();
  const k = easeOut((f - 2) / 12);
  const out = interpolate(f, [seg.dur - 8, seg.dur], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: C.tealDark, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 180, top: 360, transform: `translateX(${(1 - k) * 160 + f * 0.9 - out * 60}px)`, opacity: k * (1 - out) }}>
        <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 32, letterSpacing: "0.2em", color: C.orange, textTransform: "uppercase" }}>Chapter {seg.n}</div>
        <div style={{ fontFamily: F.serif, fontWeight: 700, fontSize: 120, letterSpacing: "-0.03em", color: C.paper, marginTop: 10 }}>{assertLine(seg.title)}</div>
      </div>
    </AbsoluteFill>
  );
}

/** Lower band: the chapter on the left, the step number and the caption in the middle. Never over the UI. */
function Band({ m }: { m: VManual }) {
  const f = useCurrentFrame();
  const seg = m.segs.find((s) => f >= s.from && f < s.from + s.dur);
  if (!seg || (seg.kind !== "world" && seg.kind !== "title")) return null;
  const c = m.captions.find((x) => f >= x.from && f < x.to);
  const k = c ? interpolate(f, [c.from, c.from + 5, c.to - 5, c.to], [0, 1, 1, 0], clamp) : 0;
  const step = m.steps.find((s) => f >= s.from && f < s.to);
  const ch = [...m.chapters].reverse().find((x) => f >= x.from);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: BAND, background: C.paper, borderTop: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {ch && seg.kind === "world" && (
        <div style={{ position: "absolute", left: 56, top: 0, bottom: 0, display: "flex", alignItems: "center", fontFamily: F.sans, fontWeight: 700, fontSize: 22, letterSpacing: "0.16em", textTransform: "uppercase", color: C.orange }}>
          {ch.n} · {assertLine(ch.title)}
        </div>
      )}
      {c && (
        <div style={{ display: "flex", alignItems: "center", gap: 22, opacity: k, transform: `translateY(${(1 - k) * 12}px)` }}>
          {step && seg.kind === "world" && (
            <div style={{ width: 54, height: 54, borderRadius: 27, background: C.tealDark, color: C.paper, fontFamily: F.sans, fontWeight: 700, fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{step.n}</div>
          )}
          <div style={{ color: C.tealDark, fontFamily: F.sans, fontWeight: 600, fontSize: 42, letterSpacing: "-0.01em", maxWidth: 1300, whiteSpace: "nowrap" }}>{assertLine(c.text)}</div>
        </div>
      )}
    </div>
  );
}

function Tag({ m }: { m: VManual }) {
  const f = useCurrentFrame();
  const k = interpolate(f, [6, 14, 80, 90], [0, 1, 1, 0], clamp);
  if (k <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 56, top: 44, opacity: k, background: "rgba(250,246,236,.94)", border: `1px solid ${C.line}`, borderRadius: 999, padding: "10px 20px", fontFamily: F.sans, fontWeight: 600, fontSize: 24, color: C.tealDark }}>
      {m.tag}
    </div>
  );
}

export function VoicedFilm({ m, audioSrc }: { m: VManual; audioSrc?: string }) {
  return (
    <AbsoluteFill style={{ background: "#faf6ec" }}>
      {m.segs.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.dur}>
          {s.kind === "live" ? <Live seg={s} />
            : s.kind === "title" ? <Title seg={s} />
            : s.kind === "chapter" ? <Chapter seg={s} />
            : s.kind === "end" ? <EndCard line={s.line} cta={s.cta} url={s.url} />
            : <Whip dur={s.dur} whipIn={s.whipIn} whipOut={s.whipOut}><WorldView shot={s.shot} /></Whip>}
        </Sequence>
      ))}
      <Tag m={m} />
      <Band m={m} />
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
    </AbsoluteFill>
  );
}
