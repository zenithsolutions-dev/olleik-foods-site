import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { evolvePath } from "@remotion/paths";
import { F } from "../theme";
import { ez, K, wob } from "./look";

type Rect = { x: number; y: number; w: number; h: number };

/**
 * A vector phone whose screen shows a REAL capture (public/footage/…, 390 × 844 CSS px at 3×). `cam` crops the screen
 * (zoom onto a rect of the capture); `prev` cross-fades from an earlier capture.
 */
export function Phone({ w, src, prev, mix = 1, cam, glow = 0, tilt = 0, children }: { w: number; src: string; prev?: string; mix?: number; cam?: { rect: Rect; z: number } | null; glow?: number; tilt?: number; children?: React.ReactNode }) {
  const h = w * 2.05;
  const bez = w * 0.045;
  const sw = w - 2 * bez;
  const sh = h - 2 * bez;
  const k = sw / 390;
  const z = cam?.z ?? 1;
  const cx = cam ? cam.rect.x + cam.rect.w / 2 : 195;
  const cy = cam ? cam.rect.y + cam.rect.h / 2 : sh / k / 2;
  const s = k * z;
  // keep the crop on the capture
  const hx = sw / 2 / s;
  const hy = sh / 2 / s;
  const fx = Math.min(390 - hx, Math.max(hx, cx));
  const fy = Math.min(844 - hy, Math.max(hy, cy));
  const img = (file: string, o: number) => <Img src={staticFile(`footage/${file}.png`)} style={{ position: "absolute", left: 0, top: 0, width: 390, height: 844, opacity: o }} />;
  return (
    <div style={{ width: w, height: h, borderRadius: w * 0.16, background: "#101714", padding: bez, position: "relative", transform: `rotate(${tilt}deg)`, boxShadow: `0 ${w * 0.12}px ${w * 0.3}px rgba(0,0,0,0.35), 0 0 ${w * 0.5 * glow}px rgba(255,217,160,${0.55 * glow})` }}>
      <div style={{ width: sw, height: sh, borderRadius: w * 0.12, overflow: "hidden", position: "relative", background: "#fff" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 390, height: 844, transformOrigin: "0 0", transform: `translate(${sw / 2}px, ${sh / 2}px) scale(${s}) translate(${-fx}px, ${-fy}px)` }}>
          {prev && mix < 1 && img(prev, 1)}
          {img(src, prev ? mix : 1)}
          {children}
        </div>
        <div style={{ position: "absolute", top: w * 0.03, left: "50%", transform: "translateX(-50%)", width: w * 0.3, height: w * 0.075, borderRadius: w, background: "#0b100e" }} />
      </div>
    </div>
  );
}

/** A chat bubble / notification card for the chaos hook (illustrative texts, no product claim). */
export function Bubble({ text, kind = "in", sub, w = 420 }: { text: string; kind?: "in" | "out" | "missed" | "voice" | "file"; sub?: string; w?: number }) {
  const out = kind === "out";
  const bg = out ? K.amber : kind === "missed" ? "#fff2ef" : K.white;
  const fg = out ? "#fff" : K.ink;
  return (
    <div style={{ width: w, background: bg, color: fg, borderRadius: 26, borderBottomLeftRadius: out ? 26 : 6, borderBottomRightRadius: out ? 6 : 26, padding: "16px 22px", fontFamily: F.sans, fontSize: 28, fontWeight: 600, boxShadow: "0 18px 40px rgba(0,0,0,0.35)", display: "flex", alignItems: "center", gap: 14 }}>
      {kind === "missed" && <span style={{ width: 40, height: 40, borderRadius: 20, background: K.stamp, display: "grid", placeItems: "center", color: "#fff", fontSize: 22, flex: "none" }}>✆</span>}
      {kind === "file" && <span style={{ width: 40, height: 48, borderRadius: 6, background: K.stamp, color: "#fff", fontSize: 13, fontWeight: 800, display: "grid", placeItems: "center", flex: "none" }}>PDF</span>}
      {kind === "voice" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
          <span style={{ width: 36, height: 36, borderRadius: 18, background: K.green, color: "#fff", display: "grid", placeItems: "center", fontSize: 16, marginRight: 8 }}>▶</span>
          {Array.from({ length: 26 }, (_, i) => (
            <span key={i} style={{ width: 5, height: 8 + Math.abs(Math.sin(i * 1.7)) * 26, background: K.green, borderRadius: 3, opacity: 0.8 }} />
          ))}
          <span style={{ marginLeft: 10, fontSize: 22, color: "#586056" }}>{text}</span>
        </div>
      ) : (
        <div>
          <div style={{ color: kind === "missed" ? K.stamp : fg }}>{text}</div>
          {sub && <div style={{ fontSize: 20, fontWeight: 500, opacity: 0.6, marginTop: 4 }}>{sub}</div>}
        </div>
      )}
    </div>
  );
}

/** The paper order slip that prints out of the phone and travels to the warehouse (a story object, not a product feature). */
export function Ticket({ w = 300, printed = 1, lines, stamp, stampAt = 0, f = 0, torn = false }: { w?: number; printed?: number; lines: string[]; stamp?: string; stampAt?: number; f?: number; torn?: boolean }) {
  const h = w * 1.35;
  const vis = h * printed;
  const sp = stamp ? ez(f, stampAt, stampAt + 5, 0, 1) : 0;
  return (
    <div style={{ width: w, height: vis, overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", left: 0, bottom: 0, width: w, height: h, background: "#fffdf6", boxShadow: "0 12px 30px rgba(0,0,0,0.25)", clipPath: torn ? `polygon(0 0, 100% 0, 100% 97%, ${[...Array(12)].map((_, i) => `${100 - (i + 0.5) * 8.33}% ${i % 2 ? 100 : 97}%`).join(", ")}, 0 97%)` : undefined, fontFamily: "'Courier New', monospace", color: K.ink, padding: w * 0.08, boxSizing: "border-box" }}>
        <div style={{ fontFamily: F.serif, fontWeight: 700, fontSize: w * 0.085, color: K.deep, textAlign: "center" }}>
          Olleik <span style={{ color: K.amber }}>Foods</span>
        </div>
        <div style={{ borderTop: `2px dashed ${K.steelDark}`, margin: `${w * 0.04}px 0` }} />
        {lines.map((l, i) => (
          <div key={i} style={{ fontSize: w * 0.058, fontWeight: i === 0 ? 700 : 400, lineHeight: 1.45 }}>{l}</div>
        ))}
        <div style={{ borderTop: `2px dashed ${K.steelDark}`, margin: `${w * 0.05}px 0` }} />
        <div style={{ display: "flex", gap: 3, height: w * 0.1 }}>
          {Array.from({ length: 34 }, (_, i) => (
            <span key={i} style={{ width: i % 3 ? 3 : 6, background: K.ink, opacity: 0.85 }} />
          ))}
        </div>
        {stamp && f >= stampAt && (
          <div style={{ position: "absolute", left: "50%", top: "52%", transform: `translate(-50%, -50%) rotate(-12deg) scale(${1.6 - 0.6 * sp})`, opacity: sp, border: `${w * 0.018}px solid ${K.stamp}`, color: K.stamp, borderRadius: w * 0.03, padding: `${w * 0.01}px ${w * 0.05}px`, fontFamily: F.sans, fontWeight: 900, fontSize: w * 0.12, letterSpacing: "0.06em", mixBlendMode: "multiply" }}>{stamp}</div>
        )}
      </div>
    </div>
  );
}

/** A rubber stamp (handle + base) that comes down; `down` 0 = up, 1 = pressed. */
export function RubberStamp({ size = 160, down = 0 }: { size?: number; down?: number }) {
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 100 130" style={{ overflow: "visible", transform: `translateY(${-(1 - down) * size * 0.5}px)` }}>
      <ellipse cx={50} cy={22} rx={22} ry={18} fill={K.amberDeep} />
      <rect x={42} y={30} width={16} height={50} rx={6} fill={K.amber} />
      <rect x={14} y={78} width={72} height={22} rx={6} fill={K.deep} />
      <rect x={18} y={100} width={64} height={10} rx={2} fill={K.stamp} />
    </svg>
  );
}

/** A desk monitor whose screen shows a REAL admin capture (1440 × 900), optionally cropped by `cam`. */
export function Monitor({ w, src, prev, mix = 1, cam, children }: { w: number; src: string; prev?: string; mix?: number; cam?: { rect: Rect; z: number } | null; children?: React.ReactNode }) {
  const sw = w - 28;
  const sh = (sw * 900) / 1440;
  const k = sw / 1440;
  const z = cam?.z ?? 1;
  const s = k * z;
  const cx = cam ? cam.rect.x + cam.rect.w / 2 : 720;
  const cy = cam ? cam.rect.y + cam.rect.h / 2 : 450;
  const hx = sw / 2 / s;
  const hy = sh / 2 / s;
  const fx = Math.min(1440 - hx, Math.max(hx, cx));
  const fy = Math.min(900 - hy, Math.max(hy, cy));
  const img = (file: string, o: number) => <Img src={staticFile(`footage/${file}.png`)} style={{ position: "absolute", left: 0, top: 0, width: 1440, height: 900, opacity: o }} />;
  return (
    <div style={{ width: w, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: w, padding: 14, boxSizing: "border-box", background: "#1b2420", borderRadius: 18, boxShadow: "0 30px 60px rgba(20,32,26,0.35)" }}>
        <div style={{ width: sw, height: sh, overflow: "hidden", position: "relative", borderRadius: 6, background: "#fff" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 1440, height: 900, transformOrigin: "0 0", transform: `translate(${sw / 2}px, ${sh / 2}px) scale(${s}) translate(${-fx}px, ${-fy}px)` }}>
            {prev && mix < 1 && img(prev, 1)}
            {img(src, prev ? mix : 1)}
            {children}
          </div>
        </div>
      </div>
      <div style={{ width: w * 0.12, height: w * 0.08, background: "#26302b" }} />
      <div style={{ width: w * 0.36, height: 16, borderRadius: 8, background: "#26302b" }} />
    </div>
  );
}

/** One of the portal's real status chips (labels and colours from src/app/portal/orders/status-chip.tsx). */
export const CHIP: Record<string, { bg: string; fg: string }> = {
  Received: { bg: "#e0f2fe", fg: "#0369a1" },
  Confirmed: { bg: "rgba(28,77,58,0.16)", fg: "#0e2c20" },
  Ready: { bg: "#fef3c7", fg: "#b45309" },
  Completed: { bg: "#d1fae5", fg: "#047857" },
};
export function Chip({ label, size = 40, flip = 1 }: { label: keyof typeof CHIP; size?: number; flip?: number }) {
  const c = CHIP[label];
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: size * 0.3, background: c.bg, color: c.fg, borderRadius: 999, padding: `${size * 0.28}px ${size * 0.62}px`, fontFamily: F.sans, fontWeight: 800, fontSize: size, letterSpacing: "0.05em", textTransform: "uppercase", transform: `rotateX(${(1 - flip) * 90}deg)`, boxShadow: "0 14px 30px rgba(20,32,26,0.18)" }}>
      ✓ {label}
    </div>
  );
}

/** Hand-drawn marker callouts (for the manuals): a rough ellipse, an arrow and an underline that draw on. */
export function RoughCircle({ r, p, color = K.amber, seed = 1, width = 6 }: { r: Rect; p: number; color?: string; seed?: number; width?: number }) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const rx = r.w / 2 + 16;
  const ry = r.h / 2 + 12;
  const pts: string[] = [];
  for (let i = 0; i <= 44; i++) {
    const a = -0.6 + (i / 40) * Math.PI * 2;
    const j = 1 + wob(seed + i, i, 0.04, 1);
    pts.push(`${(cx + Math.cos(a) * rx * j).toFixed(1)} ${(cy + Math.sin(a) * ry * j).toFixed(1)}`);
  }
  const d = `M ${pts.join(" L ")}`;
  const ev = evolvePath(Math.min(1, Math.max(0, p)), d);
  return <path d={d} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />;
}
export function RoughArrow({ from, to, p, color = K.amber, width = 6 }: { from: { x: number; y: number }; to: { x: number; y: number }; p: number; color?: string; width?: number }) {
  const mx = (from.x + to.x) / 2 + (to.y - from.y) * 0.18;
  const my = (from.y + to.y) / 2 - (to.x - from.x) * 0.18;
  const d = `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`;
  const ev = evolvePath(Math.min(1, Math.max(0, p)), d);
  const ang = Math.atan2(to.y - my, to.x - mx);
  const head = (s: number) => `M ${to.x} ${to.y} L ${to.x - Math.cos(ang + s * 0.5) * 22} ${to.y - Math.sin(ang + s * 0.5) * 22}`;
  return (
    <g>
      <path d={d} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
      {p > 0.95 && [1, -1].map((s) => <path key={s} d={head(s)} stroke={color} strokeWidth={width} strokeLinecap="round" />)}
    </g>
  );
}
export function RoughUnderline({ x, y, w, p, color = K.amber, width = 6 }: { x: number; y: number; w: number; p: number; color?: string; width?: number }) {
  const d = `M ${x} ${y + 2} Q ${x + w * 0.5} ${y - 6} ${x + w} ${y + 1}`;
  const ev = evolvePath(Math.min(1, Math.max(0, p)), d);
  return <path d={d} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />;
}

/** Sets (flat backgrounds). */
export function NightKitchen({ f = 0, warm = 0 }: { f?: number; warm?: number }) {
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${K.night} 0%, ${K.night2} 70%, #0f2a20 100%)` }}>
      {/* window with the moon */}
      <div style={{ position: "absolute", right: 180, top: 120, width: 360, height: 300, borderRadius: 12, background: "#16362a", border: "14px solid #1f4436", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: 60, top: 50, width: 70, height: 70, borderRadius: 35, background: "#f4e7c4", boxShadow: "0 0 50px rgba(244,231,196,0.5)" }} />
        <div style={{ position: "absolute", left: 166, top: 0, width: 14, height: "100%", background: "#1f4436" }} />
      </div>
      {/* shelf with pots */}
      <div style={{ position: "absolute", left: 120, top: 220, width: 520, height: 14, background: "#24493a" }} />
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ position: "absolute", left: 150 + i * 160, top: 150 + (i % 2) * 14, width: 110 - (i % 2) * 20, height: 70 - (i % 2) * 14, borderRadius: "10px 10px 30px 30px", background: "#2c5646" }} />
      ))}
      {/* pendant lamp + light cone */}
      <div style={{ position: "absolute", left: 760, top: 0, width: 4, height: 150, background: "#2c5646" }} />
      <div style={{ position: "absolute", left: 700, top: 146, width: 124, height: 50, borderRadius: "62px 62px 8px 8px", background: K.amberDeep }} />
      <div style={{ position: "absolute", left: 470, top: 190, width: 584, height: 780, clipPath: "polygon(42% 0, 58% 0, 100% 100%, 0 100%)", background: `linear-gradient(180deg, rgba(255,217,160,${0.28 + 0.04 * Math.sin(f / 9) + 0.2 * warm}) 0%, rgba(255,217,160,0) 90%)` }} />
      {/* counter */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 820, height: 260, background: "#1a3a2d" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 800, height: 34, background: K.steelDark }} />
    </AbsoluteFill>
  );
}
export function MorningKitchen({ f = 0, sun = 1 }: { f?: number; sun?: number }) {
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #fff4dc 0%, ${K.paper} 60%, #efe5cc 100%)` }}>
      <div style={{ position: "absolute", right: 180, top: 120, width: 360, height: 300, borderRadius: 12, background: "#ffe2a8", border: "14px solid #e7d6b0", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: 70, top: 120 - 40 * sun, width: 110, height: 110, borderRadius: 55, background: "#ffc35a", boxShadow: "0 0 90px rgba(255,195,90,0.8)" }} />
        <div style={{ position: "absolute", left: 166, top: 0, width: 14, height: "100%", background: "#e7d6b0" }} />
      </div>
      <div style={{ position: "absolute", right: 0, top: 120, width: 1100, height: 900, clipPath: "polygon(68% 0, 100% 0, 60% 100%, 10% 100%)", background: `linear-gradient(200deg, rgba(255,205,120,${0.45 * sun}), rgba(255,205,120,0) 80%)`, transform: `translateX(${wob(3, f, 6, 0.05)}px)` }} />
      <div style={{ position: "absolute", left: 120, top: 220, width: 520, height: 14, background: "#d9c9a3" }} />
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ position: "absolute", left: 150 + i * 160, top: 150 + (i % 2) * 14, width: 110 - (i % 2) * 20, height: 70 - (i % 2) * 14, borderRadius: "10px 10px 30px 30px", background: i === 1 ? K.amber : K.green }} />
      ))}
      <div style={{ position: "absolute", left: 0, right: 0, top: 820, height: 260, background: "#e6dbc0" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 800, height: 34, background: K.steel }} />
    </AbsoluteFill>
  );
}
export function Warehouse({ f = 0 }: { f?: number }) {
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${K.paper} 0%, ${K.paper2} 100%)` }}>
      {[0, 1, 2].map((row) => (
        <div key={row} style={{ position: "absolute", left: 60, right: 60, top: 150 + row * 210, height: 12, background: K.green, opacity: 0.85 }} />
      ))}
      {[0, 1, 2, 3, 4].map((c) => (
        <div key={c} style={{ position: "absolute", left: 60 + c * 450, top: 120, width: 14, height: 700, background: K.deep, opacity: 0.7 }} />
      ))}
      {Array.from({ length: 18 }, (_, i) => {
        const row = i % 3;
        const col = Math.floor(i / 3);
        return <div key={i} style={{ position: "absolute", left: 100 + col * 300 + (row * 40) % 120, top: 70 + row * 210, width: 140 + (i % 4) * 20, height: 80, background: i % 5 === 0 ? K.amberSoft : K.kraft, borderTop: `14px solid ${K.kraftDark}`, opacity: 0.85 }} />;
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: 820, height: 260, background: "#e9dfc6" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 800, height: 30, background: K.deep }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "100%", background: `linear-gradient(90deg, rgba(250,246,236,${0.15 + wob(1, f, 0.02)}), rgba(250,246,236,0) 40%)` }} />
    </AbsoluteFill>
  );
}

/** Film grain + vignette over every V2 frame. */
export function FilmFX({ f, dark = false }: { f: number; dark?: boolean }) {
  const k = f % 3;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,${dark ? 0.45 : 0.16}) 100%)` }} />
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: dark ? 0.08 : 0.06, mixBlendMode: "overlay" }}>
        <filter id={`g${k}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={k} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#g${k})`} />
      </svg>
    </AbsoluteFill>
  );
}
