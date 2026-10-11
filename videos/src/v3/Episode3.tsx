import React from "react";
import { AbsoluteFill, Audio, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { assertLine } from "./lines";
import type { Manual, Seg } from "./manuals";
import { WorldView } from "./World";
import { EndCard } from "./Promo20";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeIn = (t: number) => t * t * t;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const WHIP = 7; // frames of whip at each side of a page change

/** Whip pan between pages: the outgoing page accelerates out to the left, the next one decelerates in from the right,
 * with a horizontal smear (same direction and speed on both sides, so the join hides in the blur). */
function Whip({ dur, whipIn, whipOut, children }: { dur: number; whipIn?: boolean; whipOut?: boolean; children: React.ReactNode }) {
  const f = useCurrentFrame();
  let x = 0;
  if (whipOut && f > dur - WHIP) x = -easeIn((f - (dur - WHIP)) / WHIP) * 1500;
  if (whipIn && f < WHIP) x = (1 - easeOut(f / WHIP)) * 1500;
  const v = Math.abs(x) / 1500;
  if (v < 0.01) return <AbsoluteFill>{children}</AbsoluteFill>;
  // directional blur: a few copies spread along x
  const n = 5;
  return (
    <AbsoluteFill style={{ background: "#faf6ec" }}>
      {Array.from({ length: n }, (_, i) => (
        <AbsoluteFill key={i} style={{ transform: `translateX(${x + (i - (n - 1) / 2) * v * 60}px)`, opacity: 1 / (i + 1) }}>
          {children}
        </AbsoluteFill>
      ))}
    </AbsoluteFill>
  );
}

function Live({ seg }: { seg: Extract<Seg, { kind: "live" }> }) {
  const f = useCurrentFrame();
  const k = easeOut(interpolate(f, [(seg.lineAt ?? 0), (seg.lineAt ?? 0) + 9], [0, 1], clamp));
  if (seg.line) assertLine(seg.line);
  const punched = seg.punchAt !== undefined && f >= seg.punchAt;
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${(punched ? 1.28 : 1.0) + f * 0.0015})`, transformOrigin: "62% 42%" }}>
        <OffthreadVideo src={staticFile(seg.src)} startFrom={Math.round(seg.start * 30)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      {seg.line && (
        <>
          <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(5,10,8,.62) 0%, rgba(5,10,8,.15) 60%, transparent 100%)", opacity: k }} />
          <div style={{ position: "absolute", left: 120, top: 400, width: 980, fontFamily: F.serif, fontWeight: 700, fontSize: 84, lineHeight: 1.05, letterSpacing: "-0.03em", color: "#fbf8f2", opacity: k, transform: `translateY(${(1 - k) * 40}px) skewX(${(1 - k) * -8}deg)`, textShadow: "0 4px 30px rgba(0,0,0,.5)" }}>
            {seg.line}
          </div>
        </>
      )}
    </AbsoluteFill>
  );
}

/** The closing line ("Next: …"): kinetic type on paper, always moving (no frozen hold). */
function Next({ seg }: { seg: Extract<Seg, { kind: "next" }> }) {
  const f = useCurrentFrame();
  const k = easeOut(interpolate(f, [2, 12], [0, 1], clamp));
  const [head, ...restParts] = assertLine(seg.line).split(": ");
  const rest = restParts.join(": ");
  return (
    <AbsoluteFill style={{ background: C.paper, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 160, top: 420, transform: `translateX(${(1 - k) * 220 + f * 1.2}px) skewX(${(1 - k) * -12}deg)`, opacity: k }}>
        <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 34, letterSpacing: "0.18em", color: C.orange, textTransform: "uppercase" }}>{head}</div>
        <div style={{ fontFamily: F.serif, fontWeight: 700, fontSize: 104, letterSpacing: "-0.03em", color: C.tealDark, marginTop: 8 }}>{rest.charAt(0).toUpperCase() + rest.slice(1)}</div>
      </div>
    </AbsoluteFill>
  );
}

/** Burned-in captions in their own lower band (owner notes V3.1 §6: no caption ever sits on top of UI text). The band is
 * part of the manual's frame on every page segment; the camera frames every control above it (manuals.ts `aim`). */
export const BAND = 132;
function Captions({ m }: { m: Manual }) {
  const f = useCurrentFrame();
  const onPage = m.segs.some((s) => s.kind === "world" && f >= s.from && f < s.from + s.dur);
  const c = m.captions.find((x) => f >= x.from && f < x.to);
  const k = c ? interpolate(f, [c.from, c.from + 4, c.to - 4, c.to], [0, 1, 1, 0], clamp) : 0;
  if (c) assertLine(c.text);
  if (!onPage) return null;
  const chapter = [...(m.chapters ?? [])].reverse().find((c) => f >= c.from);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: BAND, background: C.paper, borderTop: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {chapter && (
        <div style={{ position: "absolute", left: 56, top: 0, bottom: 0, display: "flex", alignItems: "center", fontFamily: F.sans, fontWeight: 700, fontSize: 22, letterSpacing: "0.16em", textTransform: "uppercase", color: C.orange }}>
          {assertLine(chapter.label)}
        </div>
      )}
      {c && (
        <div style={{ opacity: k, transform: `translateY(${(1 - k) * 12}px)`, color: C.tealDark, fontFamily: F.sans, fontWeight: 600, fontSize: 44, letterSpacing: "-0.01em", maxWidth: 1600, textAlign: "center" }}>
          {c.text}
        </div>
      )}
    </div>
  );
}

function Tag({ m }: { m: Manual }) {
  const f = useCurrentFrame();
  const k = interpolate(f, [4, 12, 44, 52], [0, 1, 1, 0], clamp); // on the live hook only: gone before the first page arrives
  if (k <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 56, top: 44, opacity: k, background: "rgba(250,246,236,.94)", border: `1px solid ${C.line}`, borderRadius: 999, padding: "10px 20px", fontFamily: F.sans, fontWeight: 600, fontSize: 24, color: C.tealDark }}>
      {m.tag}
    </div>
  );
}

export function ManualFilm({ m, audioSrc }: { m: Manual; audioSrc?: string }) {
  return (
    <AbsoluteFill style={{ background: "#faf6ec" }}>
      {m.segs.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.dur}>
          {s.kind === "live" ? (
            <Live seg={s} />
          ) : s.kind === "end" ? (
            <EndCard line={s.line} cta={s.cta} url={s.url} />
          ) : s.kind === "next" ? (
            <Whip dur={s.dur} whipIn>
              <Next seg={s} />
            </Whip>
          ) : (
            <Whip dur={s.dur} whipIn={s.whipIn} whipOut={s.whipOut}>
              <WorldView shot={s.shot} />
            </Whip>
          )}
        </Sequence>
      ))}
      <Tag m={m} />
      <Captions m={m} />
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
    </AbsoluteFill>
  );
}
