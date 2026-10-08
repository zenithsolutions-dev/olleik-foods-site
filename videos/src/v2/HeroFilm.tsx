import React from "react";
import { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { F } from "../theme";
import { Mark, Wordmark } from "../components/Chrome";
import { BoxShape, DriverHands, Marco, Salma } from "./characters";
import { BACK, ez, EXPO, INOUT, K, wob } from "./look";
import { Bubble, Chip, FilmFX, Monitor, MorningKitchen, NightKitchen, Phone, RubberStamp, Ticket, Warehouse } from "./props";
import { HERO } from "./hero.mjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HeroScene = any;

/**
 * "The night before" (CREATIVE_BRIEF_V2 §4): Marco's late-night ordering chaos → one tap → his real catalog and prices on
 * the phone → the order slip travels to the Olleik warehouse → Salma confirms it on the real admin screen, stamps it,
 * boxes build → the driver's hands → morning at Marco's door → SENT stamp → end card. Timing in hero.mjs (shared with the
 * sound plan). Real product footage only inside the story (the phone, the monitor).
 */
const ORDER_LINES = ["COPPERLEAF KITCHEN", "Order #15d6e77c", "3 items · Delivery", "Note: Back door,", "before 9 please."];

/** Kinetic type: words that move with the action (slide + skew + settle), never a static title card. */
function KType({ text, at, f, size = 120, color = "#fff", accent, dir = 1, x, y, italic = false, out }: { text: string; at: number; f: number; size?: number; color?: string; accent?: string; dir?: number; x: number; y: number; italic?: boolean; out?: number }) {
  if (f < at) return null;
  const p = ez(f, at, at + 9);
  const o = out != null ? 1 - ez(f, out, out + 6) : 1;
  const drift = (f - at) * 0.6 * dir;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translateX(${(1 - p) * 240 * dir + drift}px) skewX(${(1 - p) * -14 * dir}deg)`, opacity: Math.min(1, p * 1.4) * o, fontFamily: italic ? F.serif : F.sans, fontStyle: italic ? "italic" : "normal", fontWeight: italic ? 600 : 900, fontSize: size, lineHeight: 1, letterSpacing: italic ? "-0.02em" : "-0.045em", color: accent ?? color, whiteSpace: "nowrap", textShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
      {text}
    </div>
  );
}

function Clock({ text, f, at = 0, dark = true }: { text: string; f: number; at?: number; dark?: boolean }) {
  const p = ez(f, at, at + 8);
  return (
    <div style={{ position: "absolute", left: 90, top: 70, opacity: p, transform: `translateY(${(1 - p) * -20}px)`, fontFamily: F.sans, fontWeight: 800, fontSize: 54, letterSpacing: "0.04em", color: dark ? K.lamp : K.deep, display: "flex", alignItems: "center", gap: 16 }}>
      <span style={{ width: 16, height: 16, borderRadius: 8, background: dark ? K.stamp : K.amber, opacity: Math.floor(f / 15) % 2 ? 1 : 0.35 }} />
      {text}
    </div>
  );
}

// ——— Scenes ————————————————————————————————————————————————————————————————————————————————————————————————
const CHAOS = [
  { kind: "file" as const, text: "price list v3 (final) (2)", sub: "PDF · 4 pages", x: 1020, y: 180, z: 0 },
  { kind: "in" as const, text: "Can you do 4 cases by Fri??", x: 1180, y: 360, z: 6 },
  { kind: "missed" as const, text: "Missed call (3)", x: 980, y: 520, z: 12 },
  { kind: "voice" as const, text: "0:47", x: 1240, y: 650, z: 18 },
  { kind: "in" as const, text: "price changed again?", sub: "$?? → $??", x: 960, y: 760, z: 24 },
  { kind: "out" as const, text: "send me the new list pls", x: 1300, y: 260, z: 30 },
];

/** S01–S02: 11:04 PM, the chaos. Bubbles fly from the phone at the camera; fast rhythm cuts between wide and close. */
function Chaos({ f, len }: { f: number; len: number }) {
  const close = f > 75 && Math.floor((f - 75) / 12) % 2 === 1; // rhythm cut wide/close every 12 frames in the second half
  const zoom = close ? 2.1 : 1 + 0.06 * (f / len);
  const blink = f % 70 > 66 ? 1 : 0;
  return (
    <AbsoluteFill>
      <NightKitchen f={f} />
      {/* close: Marco's face centred (head at 670, 468 in the wide frame) */}
      <AbsoluteFill style={{ transformOrigin: "0 0", transform: close ? `translate(${720 - 670 * zoom}px, ${470 - 468 * zoom}px) scale(${zoom})` : `scale(${zoom})` }}>
        <div style={{ position: "absolute", left: 470, top: 300, width: 400, height: 600 }}>
          <Marco expr={f > 90 ? "surprised" : "tired"} tilt={-6 + wob(1, f, 2)} blink={blink} turn={0.2} armR={{ sh: 62, el: 72 }} armL={{ sh: 8, el: 12 }} hold={{ right: <g transform="rotate(-20) translate(-20 -60)"><rect width={52} height={96} rx={10} fill="#101714" /><rect x={5} y={6} width={42} height={84} rx={6} fill={K.lamp} opacity={0.9} /></g> }} />
        </div>
      </AbsoluteFill>
      {CHAOS.map((c, i) => {
        const t = f - c.z;
        if (t < 0) return null;
        const p = ez(t, 0, 16, 0, 1, EXPO);
        const fly = interpolate(t, [0, 80], [0.4, 1.25], { extrapolateRight: "clamp" });
        const sx = 760 + (c.x - 760) * p;
        const sy = 520 + (c.y - 520) * p;
        return (
          <div key={i} style={{ position: "absolute", left: sx, top: sy, transform: `translate(-50%, -50%) scale(${fly}) rotate(${wob(i, f, 4, 0.3)}deg)`, opacity: Math.min(1, p * 2), filter: fly > 1.15 ? `blur(${(fly - 1.15) * 20}px)` : undefined }}>
            <Bubble text={c.text} kind={c.kind} sub={c.sub} w={c.kind === "voice" ? 460 : 400} />
          </div>
        );
      })}
      <Clock text="11:04 PM" f={f} />
      <KType text="One more text." at={48} f={f} x={110} y={850} size={110} color="#fff" dir={-1} />
      <FilmFX f={f} dark />
    </AbsoluteFill>
  );
}

/** S03: the tap. Time freezes (speed ramp), one finger, one amber ripple, then the bubbles snap into a clean grid. */
function Tap({ f, len }: { f: number; len: number }) {
  const ripple = ez(f, 12, 34);
  const snap = ez(f, 30, 48, 0, 1, BACK);
  const grid = (i: number) => ({ x: 640 + (i % 3) * 230, y: 300 + Math.floor(i / 3) * 230 });
  return (
    <AbsoluteFill>
      <NightKitchen f={f} warm={ez(f, 20, len)} />
      <AbsoluteFill style={{ background: `rgba(11,31,23,${0.55 - 0.3 * snap})` }} />
      {CHAOS.map((c, i) => {
        const g = grid(i);
        const x = c.x + (g.x - c.x) * snap;
        const y = c.y + (g.y - c.y) * snap;
        const tile = snap > 0.6;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${1 - 0.45 * snap})`, transition: "none" }}>
            {tile ? <div style={{ width: 360, height: 360, borderRadius: 40, background: i % 2 ? K.amberSoft : K.white, boxShadow: "0 20px 40px rgba(0,0,0,0.3)", display: "grid", placeItems: "center", fontFamily: F.serif, fontSize: 110, color: K.green, opacity: (snap - 0.6) / 0.4 }}>{"ABCDEF"[i]}</div> : <Bubble text={c.text} kind={c.kind} sub={c.sub} w={400} />}
          </div>
        );
      })}
      {/* the finger + ripple */}
      <div style={{ position: "absolute", left: 960, top: 560, transform: "translate(-50%, -50%)" }}>
        {f >= 12 && <div style={{ position: "absolute", left: -260 * ripple, top: -260 * ripple, width: 520 * ripple, height: 520 * ripple, borderRadius: "50%", border: `${8 * (1 - ripple) + 2}px solid ${K.amber}`, opacity: 1 - ripple }} />}
        <div style={{ position: "absolute", left: -34, top: -34 - 60 * (1 - ez(f, 0, 12)), width: 68, height: 68, borderRadius: 34, background: "#c98b62", boxShadow: "0 10px 20px rgba(0,0,0,0.35)", opacity: 1 - ez(f, 24, 32) }} />
      </div>
      <FilmFX f={f} dark />
    </AbsoluteFill>
  );
}

/** S04–S06: the phone. The grid becomes the real catalog; push-ins and whip pans follow the taps. */
function OnThePhone({ f, len, sc }: { f: number; len: number; sc: HeroScene }) {
  const shots: { at: number; src: string; cam: { rect: { x: number; y: number; w: number; h: number }; z: number } | null }[] = sc.shots;
  const cur = [...shots].reverse().find((s) => f >= s.at) ?? shots[0];
  const idx = shots.indexOf(cur);
  const prev = idx > 0 ? shots[idx - 1] : null;
  const mix = prev ? ez(f, cur.at, cur.at + 6) : 1;
  // camera: whip pan on each new shot (horizontal blur + offset), slow push otherwise
  const whip = prev ? 1 - ez(f, cur.at, cur.at + 8, 0, 1, INOUT) : 0;
  const push = 1 + 0.08 * ((f - cur.at) / Math.max(30, len));
  const taps: number[] = sc.taps ?? [];
  const lastTap = taps.filter((t) => t <= f).pop();
  const tt = lastTap != null ? f - lastTap : 99;
  const rise = spring({ frame: f, fps: 30, config: { damping: 18, stiffness: 110 } });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(90% 80% at 60% 40%, ${K.night2} 0%, ${K.night} 70%)` }}>
      <AbsoluteFill style={{ transform: `translateX(${whip * -260}px)`, filter: whip > 0.05 ? `blur(${whip * 18}px)` : undefined }}>
        <div style={{ position: "absolute", left: 1290, top: 540, transform: `translate(-50%, -50%) translateY(${(1 - rise) * 300}px) scale(${push}) rotate(${-4 + wob(2, f, 1.2, 0.05)}deg)` }}>
          <Phone w={430} src={cur.src} prev={prev?.src} mix={mix} cam={cur.cam} glow={0.5}>
            {lastTap != null && tt < 18 && (() => {
              const at = sc.tapsAt?.[taps.indexOf(lastTap)] ?? sc.tapAt;
              return <div style={{ position: "absolute", left: at.x - 40 * (0.4 + tt / 18), top: at.y - 40 * (0.4 + tt / 18), width: 80 * (0.4 + tt / 18), height: 80 * (0.4 + tt / 18), borderRadius: "50%", border: `3px solid ${K.amber}`, opacity: 1 - tt / 18 }} />;
            })()}
          </Phone>
          {/* Marco's hand holding the phone */}
          <div style={{ position: "absolute", left: -40, bottom: -50, width: 120, height: 120, borderRadius: 60, background: "#c98b62" }} />
          <div style={{ position: "absolute", left: -220, bottom: -120, width: 260, height: 90, borderRadius: 45, background: K.white, transform: "rotate(-24deg)" }} />
        </div>
      </AbsoluteFill>
      {(sc.words ?? []).map((w: any, i: number) => (
        <KType key={i} text={w.t} at={w.at} f={f} x={w.x} y={w.y} size={w.size ?? 120} italic={w.italic} accent={w.italic ? K.amber : undefined} dir={w.dir ?? 1} out={w.out} />
      ))}
      {sc.counter && f >= taps[0] && (
        <div style={{ position: "absolute", left: 140, top: 700, display: "flex", gap: 22 }}>
          {taps.map((t, i) => {
            const s = spring({ frame: f - t, fps: 30, config: { damping: 11, stiffness: 240 } });
            return <div key={i} style={{ width: 96, height: 96, borderRadius: 48, background: f >= t ? K.amber : "rgba(255,255,255,0.1)", color: "#fff", fontFamily: F.sans, fontWeight: 900, fontSize: 54, display: "grid", placeItems: "center", transform: `scale(${f >= t ? 0.7 + 0.3 * s : 0.7})` }}>{i + 1}</div>;
          })}
        </div>
      )}
      <FilmFX f={f} dark />
    </AbsoluteFill>
  );
}

/** S07: the slip prints out of the phone; Marco finally exhales. Ends on a whip to the right (match cut). */
function Print({ f, len }: { f: number; len: number }) {
  const printed = ez(f, 6, 46, 0, 1, INOUT);
  const fly = ez(f, len - 16, len, 0, 1, INOUT);
  return (
    <AbsoluteFill>
      <NightKitchen f={f} warm={0.6} />
      <div style={{ position: "absolute", left: 300, top: 300, width: 400, height: 600 }}>
        <Marco expr={f > 30 ? "smile" : "neutral"} blink={f > 52 && f < 56 ? 1 : 0} turn={0.4} armR={{ sh: 70, el: 60 }} />
      </div>
      <div style={{ position: "absolute", left: 980, top: 200, transform: `translateX(${fly * 1200}px) rotate(${fly * 8}deg)` }}>
        <div style={{ width: 360, height: 40, borderRadius: 12, background: "#101714" }} />
        <div style={{ marginLeft: 30 }}>
          <Ticket w={300} printed={printed} lines={ORDER_LINES} />
        </div>
      </div>
      <KType text="Done." at={34} f={f} x={140} y={150} size={120} italic accent={K.amber} dir={-1} />
      <FilmFX f={f} dark />
    </AbsoluteFill>
  );
}

/** S08–S10: Olleik's warehouse. The slip slides in, Salma confirms the order on the real admin screen, stamps the slip,
 *  the boxes build themselves and the status chips flip. */
function WarehouseScene({ f, len, sc }: { f: number; len: number; sc: HeroScene }) {
  const slide = ez(f, 0, 14, 0, 1, EXPO);
  const t = sc.t;
  const monitorSrc = f >= t.confirm ? "admin/order-confirmed" : "admin/order-new";
  const mix = f >= t.confirm ? ez(f, t.confirm, t.confirm + 6) : 1;
  const stampDown = f >= t.stamp - 6 ? 1 - Math.abs(ez(f, t.stamp - 6, t.stamp + 6, -1, 1, INOUT)) : 0;
  const chip = f >= t.ready ? "Ready" : f >= t.confirm ? "Confirmed" : "Received";
  const chipAt = f >= t.ready ? t.ready : f >= t.confirm ? t.confirm : 0;
  const flip = ez(f, chipAt, chipAt + 8, 0, 1, BACK);
  const shake = f >= t.stamp && f < t.stamp + 6 ? wob(9, f, 6, 2) : 0;
  return (
    <AbsoluteFill style={{ transform: `translate(${shake}px, ${shake * 0.6}px)` }}>
      <Warehouse f={f} />
      <div style={{ position: "absolute", left: 90, top: 70, fontFamily: F.sans, fontWeight: 800, fontSize: 30, letterSpacing: "0.22em", color: K.green }}>OLLEIK FOODS · WAREHOUSE</div>
      <div style={{ position: "absolute", left: 980, top: 230 }}>
        <Monitor w={820} src={monitorSrc} prev={f >= t.confirm ? "admin/order-new" : undefined} mix={mix} cam={{ rect: { x: 400, y: 60, w: 900, h: 420 }, z: 1.45 }} />
      </div>
      <div style={{ position: "absolute", left: 470, top: 300, width: 400, height: 600 }}>
        <Salma expr={f >= t.stamp ? "smile" : "focus"} turn={f < t.stamp - 20 ? 0.6 : -0.3} blink={f % 90 > 86 ? 1 : 0} armR={f >= t.stamp - 20 ? { sh: 150 - 70 * stampDown, el: 10 } : { sh: 80, el: 40 }} armL={{ sh: 30, el: 60 }} />
      </div>
      {/* the slip on the bench */}
      <div style={{ position: "absolute", left: 120 - (1 - slide) * 900, top: 520, transform: `rotate(${-6 + (1 - slide) * -20}deg)` }}>
        <Ticket w={280} printed={1} lines={ORDER_LINES} torn stamp="CONFIRMED" stampAt={t.stamp} f={f} />
      </div>
      {f >= t.stamp - 20 && f < t.stamp + 30 && (
        <div style={{ position: "absolute", left: 180, top: 480 - 260 * (1 - stampDown) }}>
          <RubberStamp size={150} down={stampDown} />
        </div>
      )}
      {/* boxes build themselves */}
      {[0, 1, 2].map((i) => {
        const at = t.boxes + i * 6;
        const s = spring({ frame: f - at, fps: 30, config: { damping: 12, stiffness: 200 } });
        if (f < at) return null;
        return (
          <svg key={i} width={240} height={200} style={{ position: "absolute", left: 1060 + i * 210 - (i === 2 ? 105 : 0), top: i === 2 ? 600 - 170 : 730 - 170 * 0, transform: `translateY(${(1 - s) * -400}px) scale(${0.6 + 0.4 * s})`, overflow: "visible" }}>
            <BoxShape w={220} h={170} label={i === 2 ? "COPPERLEAF" : undefined} />
          </svg>
        );
      })}
      <div style={{ position: "absolute", left: 1200, top: 150, perspective: 600 }}>
        <Chip label={chip as any} size={44} flip={flip} />
      </div>
      <FilmFX f={f} />
    </AbsoluteFill>
  );
}

/** S11: the handoff — the driver's hands carry the box across a whip pan (motion streaks). */
function Handoff({ f, len }: { f: number; len: number }) {
  const x = interpolate(f, [0, len], [-700, 2000], { easing: INOUT });
  return (
    <AbsoluteFill style={{ background: `linear-gradient(90deg, ${K.paper2}, ${K.amberSoft} 50%, #fff4dc)` }}>
      {Array.from({ length: 14 }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: ((i * 173 + f * 60) % 2400) - 300, top: 120 + i * 62, width: 420, height: 6, borderRadius: 3, background: K.amber, opacity: 0.25 }} />
      ))}
      <div style={{ position: "absolute", left: x, top: 330, width: 900, height: 450, filter: "blur(1.5px)" }}>
        <DriverHands />
      </div>
      <FilmFX f={f} />
    </AbsoluteFill>
  );
}

/** S12–S13: morning at Marco's door. Door bell, the boxes land, sun through the window, Marco smiles; SENT stamp. */
function Morning({ f, len, sc }: { f: number; len: number; sc: HeroScene }) {
  const t = sc.t;
  const door = ez(f, t.door, t.door + 14, 0, 1, INOUT);
  const stamp = ez(f, t.stampSent, t.stampSent + 5);
  return (
    <AbsoluteFill>
      <MorningKitchen f={f} sun={ez(f, 0, 40)} />
      {/* door */}
      <div style={{ position: "absolute", left: 1320, top: 260, width: 360, height: 560, background: "#fff7e6", boxShadow: "inset 0 0 0 14px #d9c9a3" }}>
        <div style={{ position: "absolute", inset: 14, background: K.green, transformOrigin: "100% 50%", transform: `perspective(900px) rotateY(${door * 70}deg)` }}>
          <div style={{ position: "absolute", left: 30, top: 270, width: 22, height: 22, borderRadius: 11, background: K.amber }} />
        </div>
      </div>
      {[0, 1].map((i) => {
        const at = t.boxes + i * 8;
        const s = spring({ frame: f - at, fps: 30, config: { damping: 11, stiffness: 220 } });
        if (f < at) return null;
        return (
          <svg key={i} width={260} height={210} style={{ position: "absolute", left: 1330 + i * 120, top: 640 - i * 150, transform: `translateY(${(1 - s) * -300}px)`, overflow: "visible" }}>
            <BoxShape w={240} h={180} label={i === 0 ? "COPPERLEAF" : undefined} />
          </svg>
        );
      })}
      <div style={{ position: "absolute", left: 520, top: 300, width: 400, height: 600 }}>
        <Marco expr={f > t.boxes + 10 ? "smile" : "neutral"} turn={0.6} blink={f % 80 > 76 ? 1 : 0} armL={{ sh: 40, el: 100 }} armR={f > t.boxes + 20 ? { sh: 150, el: 20 } : { sh: 10, el: 10 }} hold={{ left: <g transform="translate(-26 -40)"><rect width={52} height={60} rx={8} fill={K.amber} /><path d="M 52 14 q 22 4 0 28" stroke={K.amber} strokeWidth={8} fill="none" /></g> }} />
      </div>
      <Clock text="Morning." f={f} at={4} dark={false} />
      <KType text="Your catalog. Your prices." at={t.line} f={f} x={110} y={300} size={76} color={K.deep} dir={-1} out={t.stampSent - 4} />
      {f >= t.stampSent && (
        <div style={{ position: "absolute", left: 1290, top: 520, transform: `translate(-50%, -50%) rotate(-10deg) scale(${2.4 - 1.4 * stamp})`, opacity: stamp, border: `14px solid ${K.stamp}`, borderRadius: 18, padding: "6px 40px", color: K.stamp, fontFamily: F.sans, fontWeight: 900, fontSize: 210, letterSpacing: "0.08em", mixBlendMode: "multiply" }}>SENT</div>
      )}
      <FilmFX f={f} />
    </AbsoluteFill>
  );
}

/** S14: end card — mark, wordmark, the site's tagline, the button and the address. */
function EndCard({ f }: { f: number }) {
  const s = spring({ frame: f, fps: 30, config: { damping: 14, stiffness: 140 } });
  const b = spring({ frame: f - 30, fps: 30, config: { damping: 11, stiffness: 220 } });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(100% 90% at 50% 20%, #245a43 0%, ${K.green} 45%, ${K.deep} 100%)`, alignItems: "center", justifyContent: "center", gap: 28 }}>
      <div style={{ transform: `scale(${0.7 + 0.3 * s})`, opacity: s }}>
        <Mark size={170} tile={K.amber} />
      </div>
      <div style={{ opacity: ez(f, 8, 20) }}>
        <Wordmark size={130} dark />
      </div>
      <div style={{ fontFamily: F.serif, fontStyle: "italic", fontWeight: 500, fontSize: 50, color: "rgba(255,255,255,0.86)", opacity: ez(f, 18, 30) }}>The supplier behind great kitchens.</div>
      <div style={{ marginTop: 20, transform: `scale(${f < 30 ? 0 : b})`, background: K.amber, color: "#fff", fontFamily: F.sans, fontWeight: 700, fontSize: 56, padding: "22px 52px", borderRadius: 999, boxShadow: "0 18px 50px rgba(200,122,42,0.45)" }}>Become a customer →</div>
      <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 46, color: "#fff", opacity: ez(f, 40, 52) }}>olleik-foods-site.vercel.app</div>
      <FilmFX f={f} />
    </AbsoluteFill>
  );
}

function SceneBody({ sc }: { sc: HeroScene }) {
  const f = useCurrentFrame();
  const len = sc.to - sc.from;
  switch (sc.kind) {
    case "chaos":
      return <Chaos f={f} len={len} />;
    case "tap":
      return <Tap f={f} len={len} />;
    case "phone":
      return <OnThePhone f={f} len={len} sc={sc} />;
    case "print":
      return <Print f={f} len={len} />;
    case "warehouse":
      return <WarehouseScene f={f} len={len} sc={sc} />;
    case "handoff":
      return <Handoff f={f} len={len} />;
    case "morning":
      return <Morning f={f} len={len} sc={sc} />;
    case "end":
      return <EndCard f={f} />;
    default:
      return null;
  }
}

/** The hero cut (60 s 16:9). Scenes overlap by 0 frames: every transition is a cut on action, a whip or a match cut. */
export function HeroFilm() {
  return (
    <AbsoluteFill style={{ background: K.night }}>
      {HERO.scenes.map((sc: HeroScene) => (
        <Sequence key={sc.id} from={sc.from} durationInFrames={sc.to - sc.from} name={`${sc.id} ${sc.kind}`}>
          <SceneBody sc={sc} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
export const heroFrames = HERO.frames;
void useVideoConfig;
