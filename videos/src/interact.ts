import type { Beat, Shot } from "./data/types";

/**
 * Pointer and typing for one manual beat. Pure (no React), so the render, the storyboard and the sound events all use
 * the same frames: each typed character and each click is an event the audio pipeline can place exactly.
 */
export type Typed = { rect: { x: number; y: number; w: number; h: number }; text: string; from: number; cps: number; secret: boolean; chars: number[] };
export type Interaction = {
  typed: Typed[];
  typingEnd: number | null;
  cursor: { path: { at: number; x: number; y: number; dur?: number }[]; clicks: number[]; hideAfter: number } | null;
  events: { f: number; sfx: "key" | "click" | "tap"; ch?: string }[];
};

const FPS = 30;
const TYPE_START = 20; // after the frame has risen in and the camera has started to move

export function planInteraction(beat: Beat, shots: Shot[], duration: number): Interaction {
  const first = shots[0];
  const phone = first?.device === "phone";
  const typed: Typed[] = [];
  const events: Interaction["events"] = [];
  let f = TYPE_START;
  const total = (beat.typing ?? []).reduce((a, t) => a + t.text.length, 0);
  // Fit the typing into the first 45 % of the beat; never slower than 12 or faster than 30 characters a second.
  const room = Math.max(30, duration * 0.45 - TYPE_START - 6 * (beat.typing?.length ?? 0));
  const cps = total ? Math.min(30, Math.max(12, total / (room / FPS))) : 14;
  for (const t of beat.typing ?? []) {
    const rect = first.boxes?.[t.box];
    if (!rect) throw new Error(`${beat.id}: typing box "${t.box}" is not measured on ${first.file}`);
    const chars: number[] = [];
    for (let i = 0; i < t.text.length; i++) {
      const at = f + Math.floor((i * FPS) / cps);
      chars.push(at);
      events.push({ f: at, sfx: "key", ch: t.text[i] });
    }
    typed.push({ rect, text: t.text, from: f, cps, secret: !!t.secret, chars });
    f = chars[chars.length - 1] + 6;
  }
  const typingEnd = typed.length ? f : null;

  let cursor: Interaction["cursor"] = null;
  if (beat.click) {
    const r = first.boxes?.[beat.click];
    if (!r) throw new Error(`${beat.id}: click box "${beat.click}" is not measured on ${first.file}`);
    const at = beat.clickAt !== undefined ? Math.round(beat.clickAt * FPS) : typingEnd !== null ? typingEnd + 14 : Math.round(duration * 0.45);
    const x = r.x + r.w / 2;
    const y = r.y + r.h / 2;
    const vw = first.viewport.w;
    const vh = first.viewport.h;
    const start = { at: Math.max(4, at - 34), x: Math.min(vw - 30, x + vw * 0.18), y: Math.min(vh - 30, y + vh * 0.16) };
    cursor = { path: [start, { at: at - 2, x, y, dur: 26 }], clicks: [at], hideAfter: Math.min(duration - 10, at + 40) };
    events.push({ f: at, sfx: phone ? "tap" : "click" });
  }
  return { typed, typingEnd, cursor, events };
}
