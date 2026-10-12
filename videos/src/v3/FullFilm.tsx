import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame } from "remotion";
import { Mark, Wordmark } from "../components/Chrome";
import { C, F } from "../theme";
import { cameraAt, project } from "./camera";
import { BAND, FullFilm as Film, FSeg, PANE_H, PANE_TOP, PANES, PaneSeg, Side, TH, Thread, urlOf } from "./full";
import { assertLine } from "./lines";
import { EndCard } from "./Promo20";
import { WorldView } from "./World";
import { states } from "./plates";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const easeIn = (t: number) => Math.pow(Math.min(1, Math.max(0, t)), 3);
const WHIP = 7;

/** A page change inside one pane: the old page leaves to the left, the new one arrives from the right (pane-wide). */
function PaneWhip({ dur, whipIn, whipOut, w, children }: { dur: number; whipIn: boolean; whipOut: boolean; w: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  let x = 0;
  if (whipOut && f > dur - WHIP) x = -easeIn((f - (dur - WHIP)) / WHIP) * w;
  if (whipIn && f < WHIP) x = (1 - easeOut(f / WHIP)) * w;
  const v = Math.abs(x) / w;
  if (v < 0.01) return <AbsoluteFill>{children}</AbsoluteFill>;
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      {[0, 1, 2, 3].map((i) => (
        <AbsoluteFill key={i} style={{ transform: `translateX(${x + (i - 1.5) * v * 28}px)`, opacity: 1 / (i + 1) }}>{children}</AbsoluteFill>
      ))}
    </AbsoluteFill>
  );
}

function Pane({ side, segs }: { side: Side; segs: PaneSeg[] }) {
  const g = PANES[side];
  return (
    <div style={{ position: "absolute", left: g.x, top: PANE_TOP, width: g.w, height: PANE_H, borderRadius: side === "C" ? 30 : 16, overflow: "hidden", background: "#fbf8f2", boxShadow: "0 18px 40px rgba(14,44,32,.16), 0 0 0 1px rgba(14,44,32,.10)" }}>
      {segs.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.dur} layout="none">
          <PaneWhip dur={s.dur} whipIn={s.whipIn} whipOut={s.whipOut} w={g.w}>
            <WorldView shot={s.shot} />
          </PaneWhip>
        </Sequence>
      ))}
    </div>
  );
}

/** Screen position (output px) of a page point of a pane segment at a global frame. */
function screenOf(seg: PaneSeg, x: number, y: number, f: number) {
  const c = cameraAt(seg.shot.world, seg.shot.keys, f - seg.from);
  const p = project(c, x, y);
  return { x: PANES[seg.side].x + p.x, y: PANE_TOP + p.y };
}

/** The line of light between the two panes: a comet that draws from the tap to the place that changes, then retracts. */
function Threads({ m }: { m: Film }) {
  const f = useCurrentFrame();
  const live = m.threads.filter((t) => f >= t.f && f < t.f + TH + 14);
  if (!live.length) return null;
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      {live.map((t: Thread, i) => {
        const src = m.panes[t.segFrom], dst = m.panes[t.segTo];
        const p0 = screenOf(src, t.p0.x, t.p0.y, Math.min(t.f, src.from + src.dur - 1));
        const b = dst.shot.world.boxes[t.p1Box];
        const p1 = screenOf(dst, b.x + b.w / 2, b.y + b.h / 2, f);
        const k = (f - t.f) / TH;
        const head = easeOut(Math.min(1, k) * 1.05);
        const tail = k <= 1 ? Math.max(0, head - 0.45) : Math.min(1, 0.55 + (k - 1) * 3);
        const fade = interpolate(f, [t.f + TH + 4, t.f + TH + 14], [1, 0], clamp);
        const lift = Math.min(220, 80 + Math.abs(p1.x - p0.x) * 0.18);
        const d = `M ${p0.x} ${p0.y} C ${p0.x + (p1.x - p0.x) * 0.3} ${Math.min(p0.y, p1.y) - lift}, ${p0.x + (p1.x - p0.x) * 0.7} ${Math.min(p0.y, p1.y) - lift}, ${p1.x} ${p1.y}`;
        const dash = { strokeDasharray: `${Math.max(0.0001, head - tail)} 2`, strokeDashoffset: -tail };
        // the head: the curve's point at the head parameter (cubic Bézier)
        const c1 = { x: p0.x + (p1.x - p0.x) * 0.3, y: Math.min(p0.y, p1.y) - lift }, c2 = { x: p0.x + (p1.x - p0.x) * 0.7, y: Math.min(p0.y, p1.y) - lift };
        const u = Math.min(1, head), v = 1 - u;
        const hx = v * v * v * p0.x + 3 * v * v * u * c1.x + 3 * v * u * u * c2.x + u * u * u * p1.x;
        const hy = v * v * v * p0.y + 3 * v * v * u * c1.y + 3 * v * u * u * c2.y + u * u * u * p1.y;
        const headOn = k <= 1 ? 1 : interpolate(f, [t.f + TH, t.f + TH + 6], [1, 0], clamp);
        return (
          <g key={i} opacity={fade}>
            <path d={d} pathLength={1} fill="none" stroke={C.orange} strokeWidth={18} strokeLinecap="round" opacity={0.5} filter="url(#glow)" style={dash} />
            <path d={d} pathLength={1} fill="none" stroke="#fff1dc" strokeWidth={5} strokeLinecap="round" style={dash} />
            <circle cx={hx} cy={hy} r={16} fill={C.orange} opacity={0.55 * headOn} filter="url(#glow)" />
            <circle cx={hx} cy={hy} r={6} fill="#fff6e8" opacity={headOn} />
          </g>
        );
      })}
    </svg>
  );
}

/** Role labels over the panes: who is on each side, the page's address, and which side is acting in this step. */
function Labels({ m }: { m: Film }) {
  const f = useCurrentFrame();
  const st = m.steps.find((s) => f >= s.from && f < s.to);
  const role = m.roles.find((r) => f >= r.from && f < r.to)?.C ?? "Visitor";
  const urlFor = (side: Side) => {
    const seg = m.panes.find((p) => p.side === side && f >= p.from && f < p.from + p.dur);
    if (!seg) return "";
    const lf = f - seg.from;
    let cur = states(seg.shot.plate)[0][1];
    for (const s of states(seg.shot.plate)) if (lf >= s[0]) cur = s[1];
    const path = urlOf(cur).replace(/^olleik-foods-site\.vercel\.app/, "").replace(/([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "$1…");
    return path;
  };
  const label = (side: Side, text: string) => {
    const on = st && (st.focus === side || st.focus === "both");
    const g = PANES[side];
    return (
      <div style={{ position: "absolute", left: g.x + 4, top: 34, width: g.w, display: "flex", alignItems: "center", gap: 14, whiteSpace: "nowrap", overflow: "hidden" }}>
        <div style={{ width: 14, height: 14, borderRadius: 7, background: on ? C.orange : "transparent", border: `2px solid ${on ? C.orange : C.soft}`, flex: "none" }} />
        <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 24, letterSpacing: "0.14em", textTransform: "uppercase", color: on ? C.tealDark : C.soft }}>{text}</div>
        <div style={{ fontFamily: F.sans, fontSize: 21, color: C.soft, overflow: "hidden", textOverflow: "ellipsis" }}>{urlFor(side)}</div>
      </div>
    );
  };
  return (
    <>
      {label("C", `${role} · Phone`)}
      {label("A", "Admin · Desktop")}
    </>
  );
}

function Band({ m }: { m: Film }) {
  const f = useCurrentFrame();
  const card = m.cards.find((c) => f >= c.from && f < c.from + c.dur);
  if (card && card.kind === "chapter") return null;
  const c = m.captions.find((x) => f >= x.from && f < x.to);
  const k = c ? interpolate(f, [c.from, c.from + 5, c.to - 5, c.to], [0, 1, 1, 0], clamp) : 0;
  const step = m.steps.find((s) => f >= s.from && f < s.to);
  const ch = [...m.chapters].reverse().find((x) => f >= x.from);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: BAND, background: C.paper, borderTop: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {ch && step && (
        <div style={{ position: "absolute", left: 56, top: 0, bottom: 0, display: "flex", alignItems: "center", fontFamily: F.sans, fontWeight: 700, fontSize: 18, letterSpacing: "0.12em", textTransform: "uppercase", color: C.orange, maxWidth: 400, whiteSpace: "nowrap" }}>
          {ch.n} · {assertLine(ch.title)}
        </div>
      )}
      {c && (
        <div style={{ display: "flex", alignItems: "center", gap: 22, opacity: k, transform: `translateY(${(1 - k) * 12}px)`, marginLeft: step ? 200 : 0 }}>
          {step && (
            <div style={{ width: 54, height: 54, borderRadius: 27, background: C.tealDark, color: C.paper, fontFamily: F.sans, fontWeight: 700, fontSize: 26, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{step.n}</div>
          )}
          <div style={{ color: C.tealDark, fontFamily: F.sans, fontWeight: 600, fontSize: 40, letterSpacing: "-0.01em", maxWidth: 1380, whiteSpace: "nowrap" }}>{assertLine(c.text)}</div>
        </div>
      )}
    </div>
  );
}

function Title({ seg }: { seg: FSeg }) {
  // the film's first frame already shows the logo and the title (the build-in runs ahead of frame 0)
  const f = useCurrentFrame() + 24;
  const s = spring({ frame: f, fps: 30, config: { damping: 14, stiffness: 150 } });
  const k = (d: number) => easeOut((f - d) / 12);
  return (
    <AbsoluteFill style={{ background: C.paper, overflow: "hidden" }}>
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30, paddingBottom: BAND, transform: `scale(${1 + f * 0.0006})` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22, opacity: Math.min(1, s * 1.5), transform: `translateY(${(1 - s) * 30}px)` }}>
          <Mark size={84} draw={Math.min(1, s * 1.3)} fill={s} />
          <Wordmark size={72} reveal={Math.min(1, s * 1.2)} />
        </div>
        <div style={{ fontFamily: F.serif, fontWeight: 700, fontSize: 104, letterSpacing: "-0.03em", color: C.tealDark, opacity: k(8), transform: `translateY(${(1 - k(8)) * 30}px)` }}>{assertLine(seg.title!)}</div>
        <div style={{ fontFamily: F.sans, fontSize: 38, color: C.soft, opacity: k(16), transform: `translateY(${(1 - k(16)) * 20}px)` }}>{assertLine(seg.sub!)}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function Chapter({ seg }: { seg: FSeg }) {
  const f = useCurrentFrame();
  const k = easeOut((f - 2) / 12);
  const out = interpolate(f, [seg.dur - 8, seg.dur], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: C.tealDark, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 180, top: 360, transform: `translateX(${(1 - k) * 160 + f * 0.9 - out * 60}px)`, opacity: k * (1 - out) }}>
        <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 32, letterSpacing: "0.2em", color: C.orange, textTransform: "uppercase" }}>Chapter {seg.n}</div>
        <div style={{ fontFamily: F.serif, fontWeight: 700, fontSize: 120, letterSpacing: "-0.03em", color: C.paper, marginTop: 10 }}>{assertLine(seg.title!)}</div>
      </div>
    </AbsoluteFill>
  );
}

export function FullFilm({ m, audioSrc }: { m: Film; audioSrc?: string }) {
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Labels m={m} />
      <Pane side="C" segs={m.panes.filter((p) => p.side === "C")} />
      <Pane side="A" segs={m.panes.filter((p) => p.side === "A")} />
      <Threads m={m} />
      {m.cards.map((c, i) => (
        <Sequence key={i} from={c.from} durationInFrames={c.dur}>
          {c.kind === "title" ? <Title seg={c} /> : c.kind === "chapter" ? <Chapter seg={c} /> : <EndCard line={c.line} cta="" url="olleik-foods-site.vercel.app" />}
        </Sequence>
      ))}
      <Band m={m} />
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
    </AbsoluteFill>
  );
}
