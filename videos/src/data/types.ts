/**
 * One beat of a manual video: one idea, one caption, one narration line (one WAV). The storyboard stills, the
 * timeline and videos/narration/<V>.json all come from the beats in src/data/V1.json, V2.json and V3.json.
 */
export type Beat = {
  id: string; // "V1-02": also the narration WAV name (narration/audio/<id>.wav)
  kind: "intro" | "outro" | "chapter" | "screen" | "card";
  chapter?: { n: number; title: string };
  /** Manifest keys shown in turn (a → b → c), e.g. ["v1/calc-a", "v1/calc-e"]. */
  shots?: string[];
  /** Box names on the FIRST shot the camera pushes onto (their union). */
  focus?: string[];
  focusPad?: number;
  /**
   * What the narration points at: a box name measured on the beat's screenshots, "a+b" for the box around several,
   * or a list of those drawn separately. Drawn on each screenshot that measured it, at its own position (src/highlight.ts).
   */
  ring?: string | string[];
  /** The vertical cut's ring when `ring` is wider than its view: a smaller child element measured on the same screenshots. */
  ringVertical?: string | string[];
  step?: number;
  /** Phone beats: a large serif title on the free left side (e.g. "Your Client Area"). */
  sideTitle?: string;
  url?: string;
  caption?: string;
  /** Spoken text for a narrator (unused: VOICEOVER = no). */
  narration?: string;
  /** The pointer glides to this box (first shot) and clicks it; a phone shows a tap instead. */
  click?: string;
  /** Seconds into the beat for the click (default: 45 % of the beat, or right after the typing). */
  clickAt?: number;
  /** Text typed into fields of the FIRST shot, in order (box name → text). The next shot shows the real filled form. */
  typing?: { box: string; text: string; secret?: boolean }[];
  /** Planned length before the WAV exists (seconds). */
  targetSeconds: number;
  card?: { title: string; lines: string[] };
  urls?: string[];
  cta?: string;
};

export type VideoId = "VISITOR" | "ADMIN";
export type VideoData = { id: VideoId; title: string; beats: Beat[] };

export type Box = { x: number; y: number; w: number; h: number };
export type Shot = { file: string; device: "desktop" | "phone"; viewport: { w: number; h: number }; url?: string; boxes?: Record<string, Box> };

/** Seconds a caption needs on screen: about 3 words a second plus a beat, never under 2.5 s. */
export const readingSeconds = (caption?: string) => (caption ? Math.max(2.5, caption.split(/\s+/).length / 3 + 1) : 0);
