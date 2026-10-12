import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import { BeatScene } from "./BeatScene";
import { SceneFade } from "./components/Chrome";
import { readingSeconds, type Beat, type VideoData, type VideoId } from "./data/types";
import VISITOR from "./data/VISITOR.json";
import ADMIN from "./data/ADMIN.json";
import { FPS } from "./theme";

export const VIDEOS: Record<string, VideoData> = { VISITOR: VISITOR as VideoData, ADMIN: ADMIN as VideoData };

/** Overlap between beats (dissolve), frames. */
export const XFADE = 8;
/**
 * Breath after a narration line before the next beat starts, seconds. The prepared WAVs (prep-audio.mjs) keep
 * 0.06 s before and 0.12 s after the voice and start 4 frames into their beat, so lines are about 0.75 s apart.
 */
const TAIL = 0.45;
/** Where the voice starts inside its beat (frames): after the dissolve's midpoint. */
export const VOICE_AT = Math.round(XFADE / 2);

export type Timed = { beat: Beat; from: number; frames: number; audio: string | null };
export type ManualProps = { video: VideoId; timed?: Timed[]; roomTone?: string | null; muted?: boolean };

const exists = async (path: string) => {
  try {
    const r = await fetch(staticFile(path), { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
};

/**
 * Each beat lasts as long as its narration WAV (public/narration/<id>.wav, made from narration/audio by
 * prep-audio.mjs) plus a short breath, never less than the
 * caption's reading time; until the WAV exists, `targetSeconds` of silence. Runs in calculateMetadata, so the
 * composition's length follows the audio automatically.
 */
export async function timeline(video: ManualProps["video"]): Promise<{ timed: Timed[]; total: number; roomTone: string | null }> {
  const data = VIDEOS[video];
  const timed: Timed[] = [];
  let at = 0;
  for (const beat of data.beats) {
    const wav = `narration/${beat.id}.wav`;
    const has = beat.narration ? await exists(wav) : false;
    const audioSec = has ? await getAudioDurationInSeconds(staticFile(wav)).catch(() => 0) : 0;
    const seconds = Math.max(has && audioSec > 0 ? audioSec + TAIL : beat.targetSeconds, readingSeconds(beat.caption), beat.kind === "chapter" ? 2 : 0);
    const frames = Math.round(seconds * FPS) + XFADE;
    timed.push({ beat, from: at, frames, audio: has ? wav : null });
    at += frames - XFADE;
  }
  const roomTone = (await exists("narration/room-tone.wav")) ? "narration/room-tone.wav" : null;
  return { timed, total: at + XFADE, roomTone };
}

/** A whole manual: beats in order with dissolves; narration per beat; an optional low room tone; captions carry it muted. */
export function ManualVideo({ timed = [], roomTone, muted }: ManualProps) {
  return (
    <AbsoluteFill style={{ background: "#fff" }}>
      {!muted && roomTone && <Audio src={staticFile(roomTone)} loop volume={0.035} />}
      {timed.map((t, i) => (
        <Sequence key={t.beat.id} from={t.from} durationInFrames={t.frames}>
          <SceneFade duration={t.frames} fadeIn={i === 0 ? 0 : XFADE} fadeOut={i === timed.length - 1 ? 0 : XFADE}>
            <BeatScene beat={t.beat} duration={t.frames} />
          </SceneFade>
          {!muted && t.audio && (
            <Sequence from={VOICE_AT} layout="none">
              <Audio src={staticFile(t.audio)} volume={1} />
            </Sequence>
          )}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

/** One beat alone, for storyboard stills (rendered at a late frame, when the camera and ring have settled). */
export function BeatStill({ video, id }: { video: VideoId; id: string }) {
  const beat = VIDEOS[video].beats.find((b) => b.id === id);
  if (!beat) throw new Error(`No beat ${id}`);
  return <BeatScene beat={beat} duration={150} />;
}
