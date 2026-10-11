import React from "react";
import { AbsoluteFill, Audio, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import type { Manual, Seg } from "./manuals";
import { WorldView } from "./World";

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
  const k = interpolate(f, [(seg.lineAt ?? 0), (seg.lineAt ?? 0) + 10], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <OffthreadVideo src={staticFile(seg.src)} startFrom={Math.round(seg.start * 30)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      {seg.line && (
        <>
          <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(5,10,8,.62) 0%, rgba(5,10,8,.15) 60%, transparent 100%)", opacity: k }} />
          <div style={{ position: "absolute", left: 120, top: 400, width: 980, fontFamily: F.serif, fontWeight: 700, fontSize: 84, lineHeight: 1.05, letterSpacing: "-0.03em", color: "#fbf8f2", opacity: k, transform: `translateY(${(1 - k) * 26}px)`, textShadow: "0 4px 30px rgba(0,0,0,.5)" }}>
            {seg.line}
          </div>
        </>
      )}
    </AbsoluteFill>
  );
}

/** Burned-in captions: functional type, bottom centre, always inside the title-safe area. */
function Captions({ m }: { m: Manual }) {
  const f = useCurrentFrame();
  const c = m.captions.find((x) => f >= x.from && f < x.to);
  if (!c) return null;
  const k = interpolate(f, [c.from, c.from + 6, c.to - 6, c.to], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 64, display: "flex", justifyContent: "center", opacity: k }}>
      <div style={{ background: "rgba(14,44,32,.92)", color: "#fbf8f2", fontFamily: F.sans, fontWeight: 500, fontSize: 40, padding: "14px 30px", borderRadius: 14, maxWidth: 1500, textAlign: "center", boxShadow: "0 8px 30px rgba(0,0,0,.2)" }}>
        {c.text}
      </div>
    </div>
  );
}

function Tag({ m }: { m: Manual }) {
  const f = useCurrentFrame();
  const k = interpolate(f, [4, 12, 54, 64], [0, 1, 1, 0], clamp); // on the live hook only, never over the UI
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
