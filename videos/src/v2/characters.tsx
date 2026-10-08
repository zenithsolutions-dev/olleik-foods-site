import React from "react";
import { K } from "./look";

/**
 * Flat 2D vector characters (built here, licence-free, no real faces). Each is a simple rig drawn in a 400 × 600 box:
 * head turn, blink, brows and mouth per expression, two arms (shoulder and elbow angles), a lean, and hand props.
 * Everything is a plain prop so scenes animate them frame by frame.
 */
export type Expr = "neutral" | "tired" | "smile" | "surprised" | "focus" | "wink";
export type Arm = { sh: number; el: number }; // degrees: shoulder (0 = hanging down, + = forward/up), elbow bend
export type Rig = {
  turn?: number; // -1 … 1 head turn (features shift)
  tilt?: number; // head tilt, degrees
  blink?: number; // 0 open … 1 closed
  expr?: Expr;
  armL?: Arm; // the character's right side on screen-left
  armR?: Arm;
  lean?: number; // degrees, whole body
  hold?: { left?: React.ReactNode; right?: React.ReactNode }; // props drawn at the hands
};

const Arm = ({ x, y, a, side, sleeve, cuff, skin, hold, len = 92 }: { x: number; y: number; a: Arm; side: 1 | -1; sleeve: string; cuff?: string; skin: string; hold?: React.ReactNode; len?: number }) => {
  // upper arm hangs from the shoulder; `sh` swings it out/up, `el` bends the forearm
  const r1 = (a.sh * Math.PI) / 180;
  const ex = x + side * Math.sin(r1) * len;
  const ey = y + Math.cos(r1) * len;
  const r2 = ((a.sh + a.el) * Math.PI) / 180;
  const hx = ex + side * Math.sin(r2) * (len - 8);
  const hy = ey + Math.cos(r2) * (len - 8);
  return (
    <g>
      <path d={`M ${x} ${y} L ${ex} ${ey}`} stroke={sleeve} strokeWidth={46} strokeLinecap="round" />
      <path d={`M ${ex} ${ey} L ${hx} ${hy}`} stroke={sleeve} strokeWidth={40} strokeLinecap="round" />
      {cuff && <circle cx={hx - side * Math.sin(r2) * 14} cy={hy - Math.cos(r2) * 14} r={21} fill={cuff} />}
      <circle cx={hx} cy={hy} r={20} fill={skin} />
      {hold && <g transform={`translate(${hx} ${hy})`}>{hold}</g>}
    </g>
  );
};

function Face({ cx, cy, turn = 0, blink = 0, expr = "neutral", skin, ink = "#2a1d16", brow = "#2a1d16", r = 72 }: { cx: number; cy: number; turn?: number; blink?: number; expr?: Expr; skin: string; ink?: string; brow?: string; r?: number }) {
  const fx = cx + turn * 16;
  const eyeY = cy + 2;
  const lid = expr === "tired" ? 0.45 : expr === "focus" ? 0.25 : 0;
  const open = Math.max(0.08, 1 - Math.max(blink, lid));
  // + = inner ends up (worried, tired, surprised), − = inner ends down (concentration)
  const browTilt = { neutral: 0, tired: 14, smile: 3, surprised: 8, focus: -7, wink: 3 }[expr];
  const browY = expr === "surprised" ? eyeY - 34 : eyeY - 26;
  const mouth = {
    neutral: `M ${fx - 16} ${cy + 38} Q ${fx} ${cy + 42} ${fx + 16} ${cy + 38}`,
    tired: `M ${fx - 16} ${cy + 42} Q ${fx} ${cy + 36} ${fx + 16} ${cy + 42}`,
    smile: `M ${fx - 22} ${cy + 32} Q ${fx} ${cy + 54} ${fx + 22} ${cy + 32}`,
    surprised: `M ${fx - 9} ${cy + 40} a 9 11 0 1 0 18 0 a 9 11 0 1 0 -18 0`,
    focus: `M ${fx - 12} ${cy + 40} L ${fx + 12} ${cy + 40}`,
    wink: `M ${fx - 22} ${cy + 32} Q ${fx} ${cy + 52} ${fx + 22} ${cy + 32}`,
  }[expr];
  return (
    <g>
      {[-1, 1].map((s) => {
        const ex = fx + s * 26;
        const closed = expr === "wink" && s === 1;
        return (
          <g key={s}>
            {closed ? (
              <path d={`M ${ex - 9} ${eyeY} Q ${ex} ${eyeY - 7} ${ex + 9} ${eyeY}`} stroke={ink} strokeWidth={4} fill="none" strokeLinecap="round" />
            ) : (
              <ellipse cx={ex} cy={eyeY} rx={8} ry={10 * open} fill={ink} />
            )}
            <path d={`M ${ex - 13} ${browY} L ${ex + 13} ${browY}`} stroke={brow} strokeWidth={6} strokeLinecap="round" transform={`rotate(${-s * browTilt} ${ex} ${browY})`} />
            {expr === "tired" && <path d={`M ${ex - 10} ${eyeY + 15} Q ${ex} ${eyeY + 20} ${ex + 10} ${eyeY + 15}`} stroke="rgba(60,30,20,0.35)" strokeWidth={3} fill="none" strokeLinecap="round" />}
          </g>
        );
      })}
      <path d={`M ${fx + 2} ${cy + 6} Q ${fx + 10} ${cy + 22} ${fx} ${cy + 24}`} stroke="rgba(60,30,20,0.4)" strokeWidth={4} fill="none" strokeLinecap="round" />
      <path d={mouth} stroke={ink} strokeWidth={5} fill={expr === "surprised" ? ink : expr === "smile" || expr === "wink" ? "#7a2e22" : "none"} strokeLinecap="round" strokeLinejoin="round" />
      {(expr === "smile" || expr === "wink") && <ellipse cx={fx} cy={cy + 44} rx={10} ry={3} fill="#e9907a" />}
      {[-1, 1].map((s) => (
        <circle key={`c${s}`} cx={fx + s * 40} cy={cy + 26} r={10} fill="#e07b5f" opacity={expr === "smile" || expr === "wink" ? 0.35 : 0.15} />
      ))}
      <circle cx={cx - r + 4 + Math.max(0, turn) * 6} cy={cy + 6} r={13} fill={skin} />
      <circle cx={cx + r - 4 + Math.min(0, turn) * 6} cy={cy + 6} r={13} fill={skin} />
    </g>
  );
}

/** Chef Marco: small-restaurant owner. White chef jacket, green apron, amber neckerchief, short toque, moustache. */
export function Marco({ turn = 0, tilt = 0, blink = 0, expr = "neutral", armL = { sh: 8, el: 10 }, armR = { sh: 8, el: 10 }, lean = 0, hold = {} }: Rig) {
  const skin = "#c98b62";
  const jacket = K.white;
  return (
    <svg viewBox="0 0 400 600" width="100%" height="100%" style={{ overflow: "visible" }}>
      <ellipse cx={200} cy={590} rx={130} ry={14} fill="rgba(20,32,26,0.18)" />
      <g transform={`rotate(${lean} 200 560)`}>
        {/* body */}
        <path d="M 92 330 Q 100 270 200 262 Q 300 270 308 330 L 318 590 L 82 590 Z" fill={jacket} />
        <path d="M 200 262 L 200 590" stroke="#e8e2d4" strokeWidth={3} />
        {[300, 340, 380].map((y) => (
          <circle key={y} cx={214} cy={y} r={6} fill={K.green} />
        ))}
        {/* apron */}
        <path d="M 112 420 L 288 420 L 300 590 L 100 590 Z" fill={K.green} />
        <path d="M 112 420 Q 200 404 288 420" stroke={K.deep} strokeWidth={8} fill="none" />
        <rect x={166} y={470} width={68} height={44} rx={8} fill={K.deep} opacity={0.6} />
        {/* neckerchief */}
        <path d="M 160 268 L 240 268 L 200 318 Z" fill={K.amber} />
        <Arm x={110} y={312} a={armL} side={-1} sleeve={jacket} cuff="#ece6d8" skin={skin} hold={hold.left} />
        <Arm x={290} y={312} a={armR} side={1} sleeve={jacket} cuff="#ece6d8" skin={skin} hold={hold.right} />
        {/* neck + head */}
        <rect x={180} y={226} width={40} height={44} rx={12} fill={skin} />
        <g transform={`rotate(${tilt} 200 220)`}>
          <circle cx={200} cy={168} r={72} fill={skin} />
          <path d="M 132 150 Q 138 92 200 92 Q 262 92 268 150 Q 250 120 200 118 Q 150 120 132 150 Z" fill="#3b2a20" />
          {/* toque */}
          <path d="M 140 104 Q 120 40 170 36 Q 200 4 232 36 Q 282 40 260 104 Z" fill={K.white} stroke="#ebe5d6" strokeWidth={3} />
          <rect x={140} y={96} width={120} height={22} rx={6} fill={K.white} stroke="#ebe5d6" strokeWidth={3} />
          <Face cx={200} cy={168} turn={turn} blink={blink} expr={expr} skin={skin} />
          {/* moustache */}
          <path d={`M ${178 + turn * 16} ${200} Q ${200 + turn * 16} ${188} ${222 + turn * 16} ${200} Q ${200 + turn * 16} ${206} ${178 + turn * 16} ${200} Z`} fill="#3b2a20" />
        </g>
      </g>
    </svg>
  );
}

/** Salma: warehouse lead. Green work shirt, amber safety vest, headset, hair in a bun. Calm and precise. */
export function Salma({ turn = 0, tilt = 0, blink = 0, expr = "neutral", armL = { sh: 8, el: 10 }, armR = { sh: 8, el: 10 }, lean = 0, hold = {} }: Rig) {
  const skin = "#8d5a3b";
  const shirt = K.green;
  return (
    <svg viewBox="0 0 400 600" width="100%" height="100%" style={{ overflow: "visible" }}>
      <ellipse cx={200} cy={590} rx={120} ry={14} fill="rgba(20,32,26,0.18)" />
      <g transform={`rotate(${lean} 200 560)`}>
        <path d="M 100 330 Q 108 272 200 264 Q 292 272 300 330 L 308 590 L 92 590 Z" fill={shirt} />
        {/* vest */}
        <path d="M 112 300 L 178 272 L 186 590 L 104 590 Z" fill={K.amber} />
        <path d="M 288 300 L 222 272 L 214 590 L 296 590 Z" fill={K.amber} />
        {[430, 470].map((y) => (
          <g key={y}>
            <rect x={106} y={y} width={78} height={12} fill={K.amberSoft} />
            <rect x={216} y={y} width={78} height={12} fill={K.amberSoft} />
          </g>
        ))}
        <rect x={226} y={330} width={40} height={52} rx={6} fill={K.white} />
        <rect x={234} y={340} width={24} height={6} rx={3} fill={K.green} />
        <Arm x={116} y={314} a={armL} side={-1} sleeve={shirt} skin={skin} hold={hold.left} len={88} />
        <Arm x={284} y={314} a={armR} side={1} sleeve={shirt} skin={skin} hold={hold.right} len={88} />
        <rect x={182} y={228} width={36} height={44} rx={12} fill={skin} />
        <g transform={`rotate(${tilt} 200 220)`}>
          {/* bun behind */}
          <circle cx={200 - turn * 10} cy={86} r={36} fill="#1f1512" />
          <circle cx={200} cy={168} r={70} fill={skin} />
          <path d="M 130 160 Q 128 96 200 94 Q 272 96 270 160 Q 262 124 226 118 Q 190 136 140 132 Q 132 144 130 160 Z" fill="#1f1512" />
          <Face cx={200} cy={168} turn={turn} blink={blink} expr={expr} skin={skin} ink="#1b120e" brow="#1f1512" />
          {/* headset */}
          <path d="M 128 168 Q 128 84 200 84 Q 272 84 272 168" stroke={K.ink} strokeWidth={9} fill="none" />
          <rect x={258} y={150} width={22} height={40} rx={10} fill={K.ink} />
          <path d={`M 268 188 Q 262 222 ${224 + turn * 10} 222`} stroke={K.ink} strokeWidth={5} fill="none" strokeLinecap="round" />
          <circle cx={222 + turn * 10} cy={222} r={7} fill={K.ink} />
        </g>
      </g>
    </svg>
  );
}

/** The delivery driver, hands only: two green sleeves holding a box out (enters from the frame edge). */
export function DriverHands({ box = true }: { box?: boolean }) {
  return (
    <svg viewBox="0 0 600 300" width="100%" height="100%" style={{ overflow: "visible" }}>
      <path d="M -40 120 L 170 150" stroke={K.deep} strokeWidth={52} strokeLinecap="round" />
      <path d="M -40 250 L 170 230" stroke={K.deep} strokeWidth={52} strokeLinecap="round" />
      <circle cx={186} cy={150} r={24} fill="#b07a55" />
      <circle cx={186} cy={230} r={24} fill="#b07a55" />
      {box && <g transform="translate(200 80)"><BoxShape w={260} h={210} /></g>}
    </svg>
  );
}

/** A head-and-shoulders guide for the manuals' corner (Marco or Salma), with a pose: point, nod, thumbs up. */
export function Guide({ who, expr = "smile", blink = 0, turn = 0.3, gesture = "none" }: { who: "marco" | "salma"; expr?: Expr; blink?: number; turn?: number; gesture?: "none" | "point" | "thumbs" | "wave" }) {
  const arm: Arm = gesture === "point" ? { sh: 115, el: -20 } : gesture === "thumbs" ? { sh: 70, el: 80 } : gesture === "wave" ? { sh: 150, el: 20 } : { sh: 10, el: 10 };
  const thumb = gesture === "thumbs" ? <path d="M -6 -10 L -6 -34 Q 2 -40 8 -30 L 8 -10 Z" fill={who === "marco" ? "#c98b62" : "#8d5a3b"} /> : null;
  const P = who === "marco" ? Marco : Salma;
  return <P expr={expr} blink={blink} turn={turn} armR={arm} hold={{ right: thumb }} />;
}

/** A cardboard box (front + top + tape), used by Salma's scene, the driver and the morning door. */
export function BoxShape({ w, h, label }: { w: number; h: number; label?: string }) {
  const top = h * 0.22;
  return (
    <g>
      <path d={`M 0 ${top} L ${w * 0.18} 0 L ${w} 0 L ${w * 0.82} ${top} Z`} fill={K.kraftDark} />
      <rect x={0} y={top} width={w * 0.82} height={h - top} fill={K.kraft} />
      <path d={`M ${w * 0.82} ${top} L ${w} 0 L ${w} ${h - top} L ${w * 0.82} ${h} Z`} fill={K.kraftDark} />
      <rect x={w * 0.33} y={top} width={w * 0.16} height={h - top} fill={K.amberSoft} opacity={0.7} />
      {label && (
        <g transform={`translate(${w * 0.08} ${h * 0.58})`}>
          <rect width={w * 0.66} height={h * 0.22} rx={6} fill={K.white} />
          <text x={w * 0.33} y={h * 0.15} textAnchor="middle" fontFamily="Geist, sans-serif" fontWeight={800} fontSize={h * 0.11} fill={K.deep}>{label}</text>
        </g>
      )}
    </g>
  );
}
