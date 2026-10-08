import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import manifest from "../public/footage/manifest.json";
import { Background, Caption, ChapterCard, LogoIntro, LogoOutro } from "./components/Chrome";
import { BrowserFrame, PhoneFrame } from "./components/Frames";
import { Cursor, HighlightRing, Spotlight, TypedText } from "./components/Overlays";
import { planInteraction } from "./interact";
import { Stage } from "./components/Stage";
import { planBeat, screenFroms } from "./highlight";
import { DESK, PHONE_H, PHONE_LEFT, VDESK, VPHONE_H, VPHONE_LEFT, viewFor } from "./layout";
import type { Beat, Shot } from "./data/types";
import { BRAND, C, F, H } from "./theme";

const SHOTS = (manifest as { shots: Record<string, Shot> }).shots;

export const shotOf = (key: string): Shot => {
  const s = SHOTS[key];
  if (!s) throw new Error(`No shot ${key} in footage/manifest.json`);
  return s;
};


/** A beat as it plays: frame rises in, the camera pushes onto the focus, vignette and ring, the caption. */
export function BeatScene({ beat, duration }: { beat: Beat; duration: number }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const vertical = height > width;
  if (beat.kind === "intro") return <LogoIntro duration={duration} />;
  if (beat.kind === "outro") return <LogoOutro urls={beat.urls ?? [BRAND.url]} cta={beat.cta} />;
  if (beat.kind === "chapter" && beat.chapter) return <ChapterCard n={beat.chapter.n} title={beat.chapter.title} duration={duration} />;
  const capTo = duration - 8;
  if (beat.kind === "card" && beat.card) {
    const s = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
    return (
      <AbsoluteFill>
        <Background />
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 120 }}>
          <div style={{ background: "#fff", borderRadius: 28, padding: "64px 88px", boxShadow: "0 1px 2px rgba(28,77,58,0.06), 0 24px 60px rgba(28,77,58,0.14)", minWidth: vertical ? 940 : 1180, maxWidth: vertical ? 1000 : undefined, opacity: s, transform: `translateY(${(1 - s) * 30}px)` }}>
            <div style={{ fontFamily: F.serif, fontWeight: 500, fontSize: vertical ? 64 : 76, color: C.teal, marginBottom: 34, letterSpacing: "-0.015em" }}>{beat.card.title}</div>
            {beat.card.lines.map((l, i) => {
              const li = interpolate(frame, [10 + i * 8, 24 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <div key={l} style={{ fontFamily: F.sans, fontSize: vertical ? 38 : 42, color: C.text, padding: "12px 0", display: "flex", gap: 22, alignItems: "center", opacity: li, transform: `translateX(${(1 - li) * 20}px)` }}>
                  <span style={{ flex: "none", width: 14, height: 14, borderRadius: 7, background: C.orange }} />
                  {l}
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
        {beat.caption && <Caption text={beat.caption} step={beat.step} from={8} to={capTo} />}
      </AbsoluteFill>
    );
  }

  const keys = beat.shots ?? [];
  const shots = keys.map(shotOf);
  const first = shots[0];
  const phone = first.device === "phone";
  const desk = vertical ? VDESK : DESK;
  const view = viewFor(first.device, vertical);
  // Rings per screenshot, the camera on the ring itself (src/highlight.ts); a ring outside its screenshot throws here.
  const act = planInteraction(beat, shots, duration);
  // With typing, the real filled screen replaces the typed overlay as soon as the typing is done.
  const froms = act.typingEnd !== null && shots.length > 1 ? screenFroms(shots.length, duration).map((f, i) => (i === 1 ? Math.min(duration - 30, act.typingEnd! + 4) : f)) : undefined;
  const plan = planBeat(beat, shots, keys, vertical ? "vertical" : "horizontal", view, duration, froms);
  const swapAt = froms?.[1] ?? Infinity;
  const rise = spring({ frame, fps, config: { damping: 20, stiffness: 120 } });
  const stage = (
    <Stage metric={plan.metric} screens={plan.screens} camera={plan.camera}>
      {act.typed.map((t, i) => (frame < swapAt + 8 ? <TypedText key={`t${i}`} rect={t.rect} text={t.secret ? "•".repeat(t.text.length) : t.text} from={t.from} cps={t.cps} fontSize={phone ? 16 : 15} paddingLeft={12} caretUntil={(act.typed[i + 1]?.from ?? swapAt) - 1} /> : null))}
      {act.cursor && <Cursor path={act.cursor.path} clicks={act.cursor.clicks} hideAfter={act.cursor.hideAfter} />}
      {plan.rings.map((r, i) => (
        <React.Fragment key={i}>
          <Spotlight rect={r.rect} from={r.from - 4} to={r.to + 6} screen={plan.metric.screen} />
          <HighlightRing rect={r.rect} from={r.from} to={r.to} maxOut={r.out} />
        </React.Fragment>
      ))}
    </Stage>
  );
  return (
    <AbsoluteFill>
      <Background />
      {phone && vertical ? (
        <>
          {beat.sideTitle && (
            <div style={{ position: "absolute", left: 60, top: 380, width: VPHONE_LEFT - 100, opacity: rise, transform: `translateY(${(1 - rise) * 20}px)` }}>
              <div style={{ width: 70, height: 5, borderRadius: 3, background: C.orange, marginBottom: 28 }} />
              <div style={{ fontFamily: F.serif, fontWeight: 500, fontSize: 68, lineHeight: 1.04, color: C.teal, letterSpacing: "-0.02em" }}>{beat.sideTitle}</div>
            </div>
          )}
          <div style={{ position: "absolute", left: VPHONE_LEFT, top: 170, opacity: rise, transform: `translateY(${(1 - rise) * 30}px)` }}>
            <PhoneFrame height={VPHONE_H}>{stage}</PhoneFrame>
          </div>
        </>
      ) : phone ? (
        <>
          {beat.sideTitle && (
            <div style={{ position: "absolute", left: 150, top: 300, width: PHONE_LEFT - 260, opacity: rise, transform: `translateY(${(1 - rise) * 20}px)` }}>
              <div style={{ width: 90, height: 5, borderRadius: 3, background: C.orange, marginBottom: 34 }} />
              <div style={{ fontFamily: F.serif, fontWeight: 500, fontSize: 104, lineHeight: 1.02, color: C.teal, letterSpacing: "-0.02em" }}>{beat.sideTitle}</div>
            </div>
          )}
          <div style={{ position: "absolute", left: PHONE_LEFT, top: (H - PHONE_H) / 2, opacity: rise, transform: `translateY(${(1 - rise) * 30}px)` }}>
            <PhoneFrame height={PHONE_H}>{stage}</PhoneFrame>
          </div>
        </>
      ) : (
        <div style={{ position: "absolute", left: desk.left, top: desk.top, opacity: rise, transform: `translateY(${(1 - rise) * 24}px) scale(${0.985 + 0.015 * rise})`, transformOrigin: "50% 40%" }}>
          <BrowserFrame url={beat.url ?? first.url ?? BRAND.url} width={desk.w} height={desk.h - 46}>
            {stage}
          </BrowserFrame>
        </div>
      )}
      {beat.caption && <Caption text={beat.caption} step={beat.step} from={8} to={capTo} />}
    </AbsoluteFill>
  );
}
