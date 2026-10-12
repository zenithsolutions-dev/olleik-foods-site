/**
 * FULL SYSTEM film (feat/videos-full): one narrated film of the whole Olleik system as linked cause and effect.
 *
 * Layout: a split screen. Left pane = the visitor / customer on a PHONE (390 CSS px captures), right pane = the ADMIN on
 * a DESKTOP (1440 CSS px captures). Each pane is its own V3 "world" with its own continuous camera (camera.ts with
 * viewW/viewH = the pane), real full-page captures only, a tap switches the plate to the real after-tap capture on the
 * tap frame, typing reveals the real typed capture. When an action on one side changes the other side, a THREAD (a line
 * of light) travels from the tap to the place that changes, and the other pane switches to its real after-capture on the
 * arrival frame.
 *
 * Timeline: one narration line = one STEP. A step lasts for its spoken line plus one beat (longer when its actions need
 * it); the line starts 1 frame into the step. Both panes keep a slow push or drift during a step, so nothing freezes.
 * Chapters are separated by chapter cards; the film opens on a title card and closes on an end card.
 * Validation at import (throws): camera rules per pane (zoom cap, native density, anchors, forbidden boxes, eye targets),
 * the admin sidebar whole or out, every tap point and typed field visible, no stretch longer than a beat with no motion,
 * narration within 5 frames of its step and no overlap.
 */
import manifest from "../../public/footage/manifest.json";
import tiles from "../../public/footage/v3/tiles.json";
import typedBoxes from "../../public/footage/v3/typed-full.json";
import index from "../../narration/audio/index.json";
import FULLJ from "../../narration/FULL.json";
import { Box, cameraAt, insideFraction, Key, scaleAt, validateCamera, visibleFraction, World } from "./camera";
import { assertLine } from "./lines";
import type { PlateState } from "./plates";
import type { CursorKey, Wipe, WorldShot } from "./World";

// ——— layout (output px) ——————————————————————————————————————————————————————————————————————————————————————
export const BAND = 132;
export const PANE_TOP = 100;
export const PANE_H = 824;
export const PANES = { C: { x: 60, w: 540 }, A: { x: 660, w: 1200 } } as const;
export type Side = "C" | "A";

const BEAT = 1800 / 108;
const B = Math.round(BEAT); // 17
const HOLD = 72; // after each line: two seconds to watch the consequence before the next line
const ARR = 22; // camera glide to a step's target
const LEAD = 1; // the line starts 1 frame into its step
const RATE = 0.00062; // slow push-in during a hold (log-zoom per frame)
export const TH = 20; // thread travel, frames
export const CHAPTER = 72;
const SIDEBAR = 256;
const ZMAIN = 1.226; // admin view right of the sidebar needs zoom ≥ 1440 / 1184

// ——— captures ——————————————————————————————————————————————————————————————————————————————————————————————————
type MBox = { x: number; y: number; w: number; h: number };
const SHOTS = (manifest as unknown as { shots: Record<string, { boxes: Record<string, MBox | null>; url: string }> }).shots;
const TILES = tiles as Record<string, { wPx: number; hPx: number }>;
const TYPED = typedBoxes as Record<string, { typed: Box; field: Box; bg: string } | null>;
const cap = (k: string) => {
  const s = SHOTS[`v3/f-${k}`];
  if (!s) throw new Error(`no capture f-${k}`);
  return s;
};
/** Extra camera targets per capture (measured on the capture images, CSS px), set by the story before the build. */
export const EXTRA: Record<string, Record<string, Box>> = {};
/** A box of a capture (manifest or EXTRA). */
export const boxOf = (k: string, n: string): Box => {
  const b = EXTRA[k]?.[n] ?? cap(k).boxes[n];
  if (!b) throw new Error(`no box ${k}.${n}`);
  return { x: b.x, y: b.y, w: b.w, h: b.h };
};
/** The bounding box of several boxes of one capture, grown by `pad` CSS px. */
export const union = (k: string, names: string[], pad = 0): Box => {
  const bs = names.map((n) => boxOf(k, n));
  const x0 = Math.min(...bs.map((b) => b.x)) - pad, y0 = Math.min(...bs.map((b) => b.y)) - pad;
  const x1 = Math.max(...bs.map((b) => b.x + b.w)) + pad, y1 = Math.max(...bs.map((b) => b.y + b.h)) + pad;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};
export const urlOf = (plate: string) => SHOTS[`v3/${plate.replace(/^v3\//, "")}`]?.url ?? "";

// ——— narration ——————————————————————————————————————————————————————————————————————————————————————————————————
type Line = { id: string; chapter: number; text: string; speak?: string; caption: string };
export const LINES: Record<string, Line> = Object.fromEntries((FULLJ as { lines: Line[] }).lines.map((l) => [l.id, l]));
const IDX = index as Record<string, { speech_start: number; speech_end: number }>;
export const speechFrames = (id: string) => Math.ceil((IDX[id].speech_end - IDX[id].speech_start) * 30);

// ——— authoring types ——————————————————————————————————————————————————————————————————————————————————————————
/** A box reference: "cap.box" (a box measured on capture f-cap) or "box" (on the plate on screen at that moment). */
type Ref = string;
export type Tap = { box: Ref; at: number | "early" | "late"; to?: string; dx?: number; dy?: number; press?: false; thread?: { box: Ref; to?: string; bell?: boolean } };
/** Typing into `field` of capture `to` (the after capture, measured by capture/typed.py); `at` = frames into the step. */
export type Typing = { cap: string; field: string; dur: number; at?: number };
export type Move = { eye: Ref; z?: number; sy?: number; dx?: number; air?: number; side?: boolean };
export type SideStep = Move & { plate: string; page?: string; taps?: Tap[]; typing?: Typing[]; then?: (Move & { at: number }) | (Move & { at: number })[]; hover?: Ref; inherit?: boolean };
/** A side of a step: one page, or several pages in turn (each later one with `start`, frames into the step). */
export type SideSpec = SideStep | (SideStep & { start?: number })[];
export type FStep = { id: string; C?: SideSpec; A?: SideSpec; min?: number; cRole?: "Visitor" | "Customer" };
export type Block = { chapter: number; title: string; steps: FStep[] };

// ——— helpers ———————————————————————————————————————————————————————————————————————————————————————————————————
const center = (b: Box, dx = 0, dy = 0) => ({ x: b.x + b.w / 2 + dx, y: b.y + b.h / 2 + dy });
const viewOf = (side: Side) => ({ W: PANES[side].w, H: PANE_H });

/** The world of one pane segment: every capture it shows, boxes namespaced "cap.box". */
function segWorld(side: Side, id: string, caps: string[]): World {
  const boxes: Record<string, Box> = {};
  let h = 0;
  let w = 0;
  for (const k of caps) {
    for (const [n, b] of Object.entries({ ...cap(k).boxes, ...(EXTRA[k] ?? {}) })) if (b && b.w > 0 && b.h > 0) boxes[`${k}.${n}`] = { x: b.x, y: b.y, w: b.w, h: b.h };
    const t = TILES[`f-${k}`];
    if (!t) throw new Error(`no tiles for f-${k} (run capture/tile.py f-)`);
    h = Math.max(h, t.hPx / 3);
    w = t.wPx / 3;
  }
  if (side === "A" && Object.keys(boxes).some((n) => n.endsWith(".sidebar"))) boxes.sidebar = { x: 0, y: 0, w: SIDEBAR, h };
  return { id: `${side}:${id}`, w, h, boxes, anchors: [], viewW: viewOf(side).W, viewH: viewOf(side).H };
}
const plateCap = (plate: string) => plate.replace(/^v3\/f-/, "").replace(/^f-/, "");
const P = (k: string) => `v3/f-${k}`;
/** Resolves a box reference against the capture on screen. */
function ref(w: World, r: Ref, onScreen: string): string {
  const name = r.includes(".") ? r : `${plateCap(onScreen)}.${r}`;
  if (!w.boxes[name]) throw new Error(`${w.id}: no box ${name}`);
  return name;
}

/** The largest zoom at which the target (shifted by dx) keeps `air` CSS px around it inside the pane. */
function fitZoom(w: World, b: Box, m: Move) {
  const vw = w.viewW!, vh = w.viewH!;
  const base = vw / w.w; // scale at z = 1
  const zw = (vw / base) / (b.w + 2 * Math.abs(m.dx ?? 0) + (m.air ?? 60));
  const zh = (vh / base) / (b.h + 40);
  return Math.min(zw, zh);
}
function aimKey(w: World, eye: string, m: Move, f: number, z: number, ease: Key["ease"] = "inout"): Key {
  const bx = w.boxes[eye];
  const c = center(bx);
  const s = scaleAt(w, z);
  const vw = w.viewW! / s, vh = w.viewH! / s;
  let cx = c.x + (m.dx ?? 0);
  if (w.boxes.sidebar) cx = m.side ? 0 : Math.max(cx, SIDEBAR + vw / 2 + 1);
  const sy = m.sy ?? w.viewH! * 0.48;
  return { f, cx, cy: c.y + (w.viewH! / 2 - sy) / s, z, ease, eye };
}
/** Arrival + end keys of a target held from f0 to f1. Admin pages with a wide target: a slow drift down the page at
 * a fixed zoom (the sidebar stays out). Otherwise a slow push-in; on the phone pane the push also drifts a little down
 * (a push alone moves its narrow frame too little to read as motion). */
function holdKeys(w: World, eye: string, m: Move, f0: number, f1: number, zWant: number): Key[] {
  const span = Math.max(1, f1 - f0);
  const E = Math.exp(RATE * span);
  const b = w.boxes[eye];
  const fit = fitZoom(w, b, m);
  const sideCut = w.boxes.sidebar && !m.side;
  const clampCy = (z: number, cy: number) => {
    const vh = w.viewH! / scaleAt(w, z);
    return Math.min(Math.max(cy, vh / 2), Math.max(vh / 2, w.h - vh / 2));
  };
  if (sideCut && fit < ZMAIN * E) {
    const z = Math.max(ZMAIN, Math.min(zWant, 1.6, fit));
    const a = aimKey(w, eye, m, f0, z);
    const vh = w.viewH! / scaleAt(w, z);
    const minCy = vh / 2, maxCy = Math.max(vh / 2, w.h - vh / 2);
    const cy0 = clampCy(z, a.cy);
    // drift within what keeps the target in frame
    const slack = Math.max(0, (vh - b.h) / 2 - 10);
    const d = Math.min(0.32 * span, Math.max(slack, 0.12 * span));
    const down = cy0 + d <= maxCy;
    const cyEnd = down ? cy0 + d : Math.max(minCy, cy0 - d);
    return [{ ...a, cy: cy0 }, { f: f1, cx: a.cx, cy: cyEnd, z, ease: "linear" }];
  }
  const zMin = w.boxes.sidebar ? (m.side ? 1.0 : ZMAIN) : 1.0;
  const z1 = Math.max(zMin, Math.min(zWant, 1.6 / E, fit / E));
  const z2 = Math.min(1.6, z1 * E);
  const a = aimKey(w, eye, m, f0, z1);
  const e = aimKey(w, eye, m, f1, z2);
  if (w.boxes.sidebar) return [a, { f: f1, cx: e.cx, cy: e.cy, z: z2, ease: "linear" }];
  const vh2 = w.viewH! / scaleAt(w, z2);
  const dy = Math.min(0.22 * span, Math.max(0, (vh2 - b.h) / 2 - 12));
  return [{ ...a, cy: clampCy(z1, a.cy - dy / 2) }, { f: f1, cx: e.cx, cy: clampCy(z2, e.cy + dy / 2), z: z2, ease: "linear" }];
}

// ——— build ——————————————————————————————————————————————————————————————————————————————————————————————————————
export type Thread = { from: Side; to: Side; f: number; segFrom: number; segTo: number; p0: { x: number; y: number }; p1Box: string; bell?: boolean };
export type PaneSeg = { side: Side; from: number; dur: number; shot: WorldShot; whipIn: boolean; whipOut: boolean };
export type FSeg = { kind: "title" | "chapter" | "end"; from: number; dur: number; n?: number; title?: string; sub?: string; line?: string };
export type FStepT = { id: string; from: number; to: number; n: number; caption: string; focus: Side | "both" };
export type Voice = { f: number; id: string; s0: number; s1: number };
export type FullFilm = { id: string; frames: number; cards: FSeg[]; panes: PaneSeg[]; threads: Thread[]; steps: FStepT[]; voice: Voice[]; captions: { from: number; to: number; text: string }[]; chapters: { from: number; n: number; title: string }[]; roles: { from: number; to: number; C: string }[] };

/** One side's part of a step: a page shown from `t0` (block frames) for `dur` frames, with its actions' frames. */
type Piece = { ss: SideStep; t0: number; dur: number; taps: number[]; typing: number[]; step: number };
const piecesOf = (x: SideSpec | undefined): (SideStep & { start?: number })[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);

/** Frames into its piece of each tap / typing (same rules as the voiced manuals). `speech` for fractional taps. */
function timing(ss: SideStep, speech: number, start: number) {
  const taps: number[] = [], typing: number[] = [];
  let tt = ARR + 4;
  for (const ty of ss.typing ?? []) {
    const at = ty.at ?? tt;
    typing.push(at);
    tt = at + ty.dur + 5;
  }
  let early = Math.max(ARR + 6, tt + 2);
  let need = (ss.typing?.length ? tt + 12 : 0);
  for (const tp of ss.taps ?? []) {
    let at: number;
    if (tp.at === "early") { at = early; early += 24; }
    else if (tp.at === "late") at = -1; // resolved when the step length is known
    else at = tp.at < 1 ? Math.max(ARR, Math.round(LEAD + speech * tp.at) - start) : tp.at;
    taps.push(at);
    if (at >= 0) need = Math.max(need, at + (tp.thread ? TH + 30 : 18));
  }
  return { taps, typing, need };
}

export function buildFull(id: string, intro: { line: string; title: string; sub: string }, blocks: Block[], end: { line: string; text: string }): FullFilm {
  const cards: FSeg[] = [], panes: PaneSeg[] = [], threads: Thread[] = [], steps: FStepT[] = [], voice: Voice[] = [], captions: FullFilm["captions"] = [], chapters: FullFilm["chapters"] = [], roles: FullFilm["roles"] = [];
  const say = (lineId: string, at: number) => voice.push({ f: at, id: lineId, s0: IDX[lineId].speech_start, s1: IDX[lineId].speech_end });
  let t = 0, n = 0;
  const tDur = Math.max(120, 6 + speechFrames(intro.line) + B);
  cards.push({ kind: "title", from: 0, dur: tDur, title: intro.title, sub: intro.sub });
  say(intro.line, 6);
  captions.push({ from: 6, to: tDur - 2, text: LINES[intro.line].caption });
  t = tDur;
  let role = "Visitor";
  const carry: Record<Side, SideStep | undefined> = { C: undefined, A: undefined }; // a side not given at a chapter start keeps its page
  for (const blk of blocks) {
    cards.push({ kind: "chapter", from: t, dur: CHAPTER, n: blk.chapter, title: blk.title });
    chapters.push({ from: t, n: blk.chapter, title: blk.title });
    t += CHAPTER;
    // 1) step lengths and every side's pieces
    const pieces: Record<Side, Piece[]> = { C: [], A: [] };
    const stepT: { t0: number; dur: number }[] = [];
    let bt = 0;
    blk.steps.forEach((s, si) => {
      const speech = speechFrames(s.id);
      const parts: Record<Side, { ss: SideStep; start: number; tm: ReturnType<typeof timing> }[]> = { C: [], A: [] };
      let dur = Math.max(s.min ?? 0, LEAD + speech + HOLD);
      for (const side of ["C", "A"] as const) {
        for (const ps of piecesOf(s[side])) {
          const start = ps.start ?? 0;
          const tm = timing(ps, speech, start);
          parts[side].push({ ss: ps, start, tm });
          dur = Math.max(dur, start + tm.need);
          if ((ps.taps ?? []).some((tp) => tp.at === "late")) dur = Math.max(dur, LEAD + speech + 14);
        }
      }
      for (const side of ["C", "A"] as const) {
        const ps = parts[side];
        if (!ps.length) {
          const last = pieces[side][pieces[side].length - 1]?.ss ?? carry[side];
          if (!last) throw new Error(`${blk.title}: step ${s.id} has no ${side} page`);
          // a step without this side keeps its page; at a chapter start the page restarts on the target it ended on
          const base = { ...last, taps: [], typing: [], then: undefined, hover: undefined };
          const lt = last.then === undefined ? undefined : Array.isArray(last.then) ? last.then[last.then.length - 1] : last.then;
          const fromThen = lt ? { ...base, eye: lt.eye, z: lt.z ?? base.z, sy: lt.sy, dx: lt.dx } : base;
          pieces[side].push({ ss: { ...fromThen, inherit: pieces[side].length > 0 }, t0: bt, dur, taps: [], typing: [], step: si });
          continue;
        }
        ps.forEach((p, k) => {
          const end = k + 1 < ps.length ? ps[k + 1].start : dur;
          const taps = p.tm.taps.map((at, i) => (p.ss.taps![i].at === "late" ? end - p.start - 14 : at));
          pieces[side].push({ ss: p.ss, t0: bt + p.start, dur: end - p.start, taps, typing: p.tm.typing, step: si });
        });
      }
      stepT.push({ t0: bt, dur });
      bt += dur;
    });
    for (const side of ["C", "A"] as const) carry[side] = pieces[side][pieces[side].length - 1]?.ss;
    // 2) each pane: runs of pieces on the same page = one continuous camera
    const segOfPiece: Record<Side, number[]> = { C: [], A: [] };
    for (const side of ["C", "A"] as const) {
      const ps = pieces[side];
      const key = (p: Piece) => p.ss.page ?? p.ss.plate;
      let i = 0;
      while (i < ps.length) {
        let j = i + 1;
        while (j < ps.length && (ps[j].ss.inherit || key(ps[j]) === key(ps[i]))) j++;
        const segIdx = panes.length;
        panes.push(buildPane(side, `${blk.chapter}-${i}`, ps.slice(i, j), t, blk.steps));
        for (let k = i; k < j; k++) segOfPiece[side][k] = segIdx;
        i = j;
      }
      const segs = [...new Set(segOfPiece[side])];
      segs.forEach((si, k) => { panes[si].whipIn = k > 0; panes[si].whipOut = k < segs.length - 1; });
    }
    // 3) threads: the target pane at the arrival frame, and its plate switch
    for (const side of ["C", "A"] as const) {
      const other: Side = side === "C" ? "A" : "C";
      pieces[side].forEach((p, pi) => {
        (p.ss.taps ?? []).forEach((tp, ti) => {
          if (!tp.thread || p.ss.inherit) return;
          const fTap = t + p.t0 + p.taps[ti];
          const src = panes[segOfPiece[side][pi]];
          const arrive = fTap + 3 + TH;
          const dIdx = pieces[other].findIndex((q) => t + q.t0 <= arrive && arrive < t + q.t0 + q.dur);
          if (dIdx < 0) throw new Error(`${p.ss.plate}: thread arrives outside the other pane`);
          const dst = panes[segOfPiece[other][dIdx]];
          const onSrc = plateAtFrame(src.shot.plate, fTap - src.from);
          const sb = src.shot.world.boxes[ref(src.shot.world, tp.box, onSrc)];
          let dstPlate = plateAtFrame(dst.shot.plate, arrive - dst.from);
          if (tp.thread.to) {
            dstPlate = P(tp.thread.to);
            const st = dst.shot.plate as PlateState[];
            st.push([arrive - dst.from, dstPlate, 0]);
            st.sort((x, y) => x[0] - y[0]);
          }
          const tb = ref(dst.shot.world, tp.thread.box, dstPlate);
          threads.push({ from: side, to: other, f: fTap + 3, segFrom: segOfPiece[side][pi], segTo: segOfPiece[other][dIdx], p0: center(sb, tp.dx ?? 0, tp.dy ?? 0), p1Box: tb, bell: tp.thread.bell });
        });
      });
    }
    // 4) steps, voice, captions, roles
    blk.steps.forEach((s, si) => {
      n += 1;
      const act = (side: Side) => piecesOf(s[side]).some((p) => (p.taps ?? []).some((tp) => tp.press !== false) || p.typing?.length);
      const focus: Side | "both" = act("C") && act("A") ? "both" : act("C") ? "C" : act("A") ? "A" : "both";
      const { t0, dur } = stepT[si];
      steps.push({ id: s.id, from: t + t0, to: t + t0 + dur, n, caption: LINES[s.id].caption, focus });
      say(s.id, t + t0 + LEAD);
      captions.push({ from: t + t0 + LEAD, to: t + t0 + dur - 2, text: LINES[s.id].caption });
      if (s.cRole) role = s.cRole;
      roles.push({ from: t + t0, to: t + t0 + dur, C: role });
    });
    t += bt;
  }
  const eDur = Math.max(120, 6 + speechFrames(end.line) + 40);
  cards.push({ kind: "end", from: t, dur: eDur, line: end.text });
  say(end.line, t + 6);
  captions.push({ from: t + 6, to: t + eDur - 2, text: LINES[end.line].caption });
  t += eDur;
  return { id, frames: t, cards, panes, threads, steps, voice, captions, chapters, roles };
}

function plateAtFrame(plate: string | PlateState[], f: number) {
  const st = typeof plate === "string" ? [[0, plate] as PlateState] : plate;
  let cur = st[0][1];
  for (const s of st) if (f >= s[0]) cur = s[1];
  return cur;
}

/** One pane segment: pieces laid end to end on one continuous camera (`blockT` = the block's first frame). */
function buildPane(side: Side, id: string, ps: Piece[], blockT: number, blockSteps: FStep[]): PaneSeg {
  const t0 = ps[0].t0;
  const dur = ps[ps.length - 1].t0 + ps[ps.length - 1].dur - t0;
  // every capture this segment can show: plates, tap / typing after-captures, thread arrivals from the other side
  const caps = new Set<string>();
  for (const p of ps) {
    caps.add(plateCap(p.ss.plate));
    for (const tp of p.ss.taps ?? []) if (tp.to) caps.add(tp.to);
    for (const ty of p.ss.typing ?? []) caps.add(ty.cap);
  }
  const other: Side = side === "C" ? "A" : "C";
  const steps = new Set(ps.map((p) => p.step));
  for (const si of steps) for (const q of piecesOf(blockSteps[si][other])) for (const tp of q.taps ?? []) if (tp.thread?.to) caps.add(tp.thread.to);
  const w = segWorld(side, id, [...caps]);
  const keys: Key[] = [];
  const cursor: CursorKey[] = [];
  const plate: PlateState[] = [[0, P(plateCap(ps[0].ss.plate))]];
  const wipes: Wipe[] = [];
  let onScreen = plate[0][1];
  ps.forEach((p, i) => {
    const s = p.ss;
    const st = p.t0 - t0;
    const dur = p.dur;
    if (i > 0 && !s.inherit && P(plateCap(s.plate)) !== onScreen) { plate.push([st, P(plateCap(s.plate)), 0]); onScreen = P(plateCap(s.plate)); }
    (s.typing ?? []).forEach((ty, k) => {
      const tb = TYPED[`${ty.cap}.${ty.field}`];
      if (!tb) throw new Error(`no typed box ${ty.cap}.${ty.field} (run capture/typed_full.py)`);
      const fk = `${ty.cap}.${ty.field}`;
      w.boxes[`${fk}#typed`] = tb.typed;
      w.boxes[`${fk}#field`] = tb.field;
      const f = st + p.typing[k];
      wipes.push({ box: `${fk}#typed`, field: `${fk}#field`, bg: tb.bg, f, dur: ty.dur, to: P(ty.cap), hold: true });
      if (side === "A") cursor.push({ f: f - 3, x: tb.field.x + Math.min(tb.field.w - 20, 60), y: tb.field.y + tb.field.h / 2 + 4 });
    });
    for (const to of new Set((s.typing ?? []).map((ty) => P(ty.cap)))) {
      const endF = Math.max(...wipes.filter((x) => x.to === to).map((x) => x.f + x.dur));
      plate.push([endF, to, 0]);
      plate.sort((a, b) => a[0] - b[0]);
      onScreen = to;
    }
    (s.taps ?? []).forEach((tp, k) => {
      const f = st + p.taps[k];
      if (tp.press !== false) {
        const name = ref(w, tp.box, plateAtFrame(plate, f));
        const c = center(w.boxes[name], tp.dx ?? 0, tp.dy ?? 0);
        cursor.push({ f: f - 10, ...c }, { f, ...c, press: true }, { f: f + 7, x: c.x + 6, y: c.y + 6 });
      }
      if (tp.to) { plate.push([f, P(tp.to), 0]); plate.sort((a, b) => a[0] - b[0]); onScreen = P(tp.to); }
    });
    if (s.hover) {
      const c = center(w.boxes[ref(w, s.hover, onScreen)], 0, 6);
      cursor.push({ f: st + ARR + 10, ...c }, { f: st + dur - 6, x: c.x + 14, y: c.y + 8 });
    }
    const eyeAt = (m: Move, f: number) => ref(w, m.eye, plateAtFrame(plate, f));
    // targets in turn: the step's own, then each `then` from its fraction of the piece (a whole frame count when ≥ 1)
    const thens = s.then === undefined ? [] : Array.isArray(s.then) ? s.then : [s.then];
    const at = (x: number) => (x >= 1 ? Math.round(x) : Math.round(dur * x));
    const legs: { m: Move; from: number; to: number }[] = [{ m: s, from: 0, to: thens.length ? at(thens[0].at) : dur }];
    thens.forEach((tn, k) => legs.push({ m: tn, from: at(tn.at), to: k + 1 < thens.length ? at(thens[k + 1].at) : dur }));
    legs.forEach((leg, k) => {
      const e = eyeAt(leg.m, st + leg.from + 1);
      const kk = holdKeys(w, e, leg.m, st + leg.from + ARR, st + leg.to, leg.m.z ?? 1.3);
      if (i === 0 && k === 0) {
        const z0 = Math.max(w.boxes.sidebar && !leg.m.side ? ZMAIN : 1.0, kk[0].z * 0.92);
        keys.push({ ...aimKey(w, e, leg.m, 0, z0), ease: undefined, eye: undefined });
      }
      keys.push(...kk);
      w.anchors.push(e);
    });
  });
  plate.sort((a, b) => a[0] - b[0]);
  cursor.sort((a, b) => a.f - b.f);
  for (let k = 1; k < cursor.length; k++) if (cursor[k].f <= cursor[k - 1].f) cursor[k] = { ...cursor[k], f: cursor[k - 1].f + 1 };
  if (cursor.length && side === "A") cursor.unshift({ f: 0, x: cursor[0].x + 200, y: cursor[0].y + 160 });
  for (const n of Object.keys(w.boxes)) if (/\.(headline|nav|sidebar|tabs)$/.test(n)) w.anchors.push(n);
  w.anchors = [...new Set(w.anchors)];
  return { side, from: blockT + t0, dur, shot: { world: w, plate, keys, wipes, cursor: cursor.length ? cursor : undefined, touch: side === "C" }, whipIn: false, whipOut: false };
}

// ——— validation ————————————————————————————————————————————————————————————————————————————————————————————————
export function checkFull(m: FullFilm, forbid: Record<string, string[]> = {}) {
  const problems: string[] = [];
  for (const s of m.panes) {
    const { world, keys } = s.shot;
    // forbidden boxes of every capture this pane shows
    world.forbid = Object.keys(world.boxes).filter((n) => (forbid[n.split(".")[0]] ?? []).includes(n.split(".")[1]) || n.endsWith(".forbid"));
    const fast = (f: number) => {
      const a0 = cameraAt(world, keys, f - 1), a1 = cameraAt(world, keys, f + 1);
      return Math.hypot((a1.cx - a0.cx) * a1.s, (a1.cy - a0.cy) * a1.s) / 2 > 18;
    };
    try { validateCamera(world, keys, s.dur, 0, fast); } catch (e) { problems.push(`${s.side}@${s.from} ${world.id}: ${(e as Error).message.slice(0, 600)}`); }
    for (let f = 0; f < s.dur; f++) {
      const c = cameraAt(world, keys, f), c1 = cameraAt(world, keys, f + 1);
      const speed = Math.hypot((c1.cx - c.cx) * c.s, (c1.cy - c.cy) * c.s);
      if (world.boxes.sidebar && speed < 3) {
        const l = c.cx - c.vw / 2;
        if (l > 0.5 && l < SIDEBAR - 0.5) { problems.push(`${s.side}@${s.from + f} ${world.id}: sidebar cut (left ${l.toFixed(0)})`); break; }
      }
    }
    for (const w of s.shot.wipes ?? []) for (const f of [w.f, w.f + w.dur]) if (visibleFraction(cameraAt(world, keys, f), world.boxes[w.field], 0) < 0.9) problems.push(`${s.side}@${s.from + f} ${world.id}: typed field ${w.field} not visible`);
    for (const k of s.shot.cursor ?? []) if (k.press && visibleFraction(cameraAt(world, keys, k.f), { x: k.x - 2, y: k.y - 2, w: 4, h: 4 }, 0) < 1) problems.push(`${s.side}@${s.from + k.f} ${world.id}: tap at (${k.x.toFixed(0)}, ${k.y.toFixed(0)}) not visible`);
    for (const k of keys) if (k.eye && insideFraction(cameraAt(world, keys, k.f), world.boxes[k.eye]) < 0.95) problems.push(`${s.side}@${s.from + k.f} ${world.id}: eye ${k.eye} not in frame`);
  }
  for (const th of m.threads) {
    const d = m.panes[th.segTo];
    const c = cameraAt(d.shot.world, d.shot.keys, th.f + TH - d.from);
    if (insideFraction(c, d.shot.world.boxes[th.p1Box]) < 0.5) problems.push(`thread @${th.f} → ${th.p1Box} not in frame on arrival`);
  }
  // stillness: at every frame of a step at least one pane (or a thread) moves
  for (const st of m.steps) {
    let still = 0;
    for (let f = st.from + 8; f < st.to - 8; f++) {
      const moving = m.panes.some((p) => {
        if (f < p.from || f >= p.from + p.dur) return false;
        const lf = f - p.from;
        const a = cameraAt(p.shot.world, p.shot.keys, lf), b = cameraAt(p.shot.world, p.shot.keys, lf + 1);
        const mv = Math.hypot((b.cx - a.cx) * a.s, (b.cy - a.cy) * a.s) + (Math.abs(b.s - a.s) / a.s) * p.shot.world.viewW! * 0.5;
        const cur = p.shot.cursor ?? [];
        const cm = cur.some((k, i) => i > 0 && lf >= cur[i - 1].f && lf < k.f && Math.hypot(k.x - cur[i - 1].x, k.y - cur[i - 1].y) > 2);
        return mv >= 0.3 || cm;
      }) || m.threads.some((th) => f >= th.f && f < th.f + TH + 12);
      still = moving ? 0 : still + 1;
      if (still > B) { problems.push(`${st.id} @${f}: no movement for more than a beat`); break; }
    }
  }
  for (const c of m.captions) assertLine(c.text);
  for (const c of m.chapters) assertLine(c.title);
  const v = [...m.voice].sort((a, b) => a.f - b.f);
  for (let i = 0; i + 1 < v.length; i++) if (v[i].f + Math.ceil((v[i].s1 - v[i].s0) * 30) >= v[i + 1].f) problems.push(`line ${v[i].id} overlaps ${v[i + 1].id}`);
  for (const st of m.steps) {
    const vo = m.voice.find((x) => x.id === st.id)!;
    if (vo.f - st.from > 5 || vo.f < st.from) problems.push(`${st.id} starts ${vo.f - st.from} frames into its step`);
  }
  return problems;
}

/** Sound events (mix_v2 format) under the narration: taps, typing, real page updates, whips, threads, cards. */
export function fullEvents(m: FullFilm) {
  type Ev = { f: number; sfx: string; vel: number; pan?: number; pitch?: number; dur?: number; sweep?: number[]; note: string };
  const ev: Ev[] = [];
  const panOf = (side: Side, x: number, w: number) => (side === "C" ? -0.55 : 0.15) + (x / w - 0.5) * 0.3;
  for (const c of m.cards) {
    if (c.kind === "title") ev.push({ f: c.from + 2, sfx: "pop", vel: 0.35, note: "logo lands" });
    else if (c.kind === "chapter") ev.push({ f: c.from, sfx: "whip", vel: 0.3, note: "to the chapter card" }, { f: c.from + 4, sfx: "pluck", vel: 0.4, note: "chapter" }, { f: c.from + c.dur - 6, sfx: "whoosh", vel: 0.26, dur: 6, sweep: [0.5, -0.5], note: "out of the chapter card" });
    else ev.push({ f: c.from, sfx: "whip", vel: 0.3, note: "to the end card" }, { f: c.from + 2, sfx: "pop", vel: 0.36, note: "logo lands" }, { f: c.from + 3, sfx: "bell", vel: 0.34, note: "end card" });
  }
  for (const p of m.panes) {
    const w = p.shot.world.w;
    if (p.whipIn) ev.push({ f: p.from, sfx: "whip", vel: 0.26, pan: panOf(p.side, w / 2, w), note: `${p.side} page change` });
    for (const c of p.shot.cursor ?? []) if (c.press && c.f < p.dur) ev.push({ f: p.from + c.f, sfx: "tap", vel: 0.55, pan: panOf(p.side, c.x, w), note: `${p.side} tap` });
    const st = typeof p.shot.plate === "string" ? [] : p.shot.plate;
    for (const s of st.slice(1)) if (s[0] < p.dur && !(p.shot.wipes ?? []).some((wp) => wp.to === s[1] && Math.abs(wp.f + wp.dur - s[0]) < 2)) ev.push({ f: p.from + s[0] + 1, sfx: "snaplock", vel: 0.28, pan: panOf(p.side, w / 2, w), note: `${p.side} page updates (real after-capture)` });
    for (const wp of p.shot.wipes ?? []) for (let k = 0; k < wp.dur; k += 3) ev.push({ f: p.from + wp.f + k, sfx: "key", vel: 0.24 + ((k * 7) % 5) / 25, pan: panOf(p.side, p.shot.world.boxes[wp.box].x, w), note: `${p.side} typing` });
  }
  for (const th of m.threads) {
    ev.push({ f: th.f, sfx: "whoosh", vel: 0.22, dur: TH, sweep: th.from === "C" ? [-0.5, 0.4] : [0.4, -0.5], note: `thread ${th.from} → ${th.to}` });
    if (th.bell) ev.push({ f: th.f + TH, sfx: "bell", vel: 0.3, pan: 0.3, note: "the admin's new-order alert" });
  }
  return ev.filter((e) => e.f < m.frames).sort((a, b) => a.f - b.f);
}
