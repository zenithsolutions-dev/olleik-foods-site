import React from "react";
import { AbsoluteFill, Audio, Composition, staticFile } from "remotion";
import { CAMERA_TEST, CAMERA_TEST_FRAMES } from "./shots";
import { WorldView } from "./World";
import { HookRoot } from "./hooksRoot";
import { ManualFilm } from "./Episode3";
import { MANUALS } from "./manuals";
import { FULL_MANUALS } from "./manualsFull";
import { Promo20, PROMO_FRAMES } from "./Promo20";
import { VOICED } from "./voiced";
import { VoicedFilm } from "./VoicedFilm";
import { CUTS } from "./cuts";
import { CutFilm, SquareFilm, VerticalFilm } from "./CutFilms";
import { FULL_FILM } from "./fullStory";
import { FullFilm } from "./FullFilm";

function CameraTest({ audioSrc }: { audioSrc?: string }) {
  return (
    <AbsoluteFill>
      <WorldView shot={CAMERA_TEST} />
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
    </AbsoluteFill>
  );
}

/** V3 compositions (creative brief V3, Gate E). */
export function V3Root() {
  return (
    <>
      <HookRoot />
      <Composition id="V3-Promo20" component={Promo20} durationInFrames={PROMO_FRAMES} fps={30} width={1920} height={1080} defaultProps={{} as { audioSrc?: string }} />
      {[...Object.values(MANUALS), ...Object.values(FULL_MANUALS)].map((m) => (
        <Composition key={m.id} id={m.id} component={({ audioSrc }: { audioSrc?: string }) => <ManualFilm m={m} audioSrc={audioSrc} />} durationInFrames={m.frames} fps={30} width={1920} height={1080} defaultProps={{} as { audioSrc?: string }} />
      ))}
      {Object.values(VOICED).map((m) => (
        <Composition key={m.id} id={m.id} component={({ audioSrc }: { audioSrc?: string }) => <VoicedFilm m={m} audioSrc={audioSrc} />} durationInFrames={m.frames} fps={30} width={1920} height={1080} defaultProps={{} as { audioSrc?: string }} />
      ))}
      {Object.values(CUTS).map((c) => {
        const Film = c.w === c.h ? SquareFilm : c.h > c.w ? VerticalFilm : CutFilm;
        return <Composition key={c.id} id={c.id} component={({ audioSrc }: { audioSrc?: string }) => <Film cut={c} audioSrc={audioSrc} />} durationInFrames={c.frames} fps={30} width={c.w} height={c.h} defaultProps={{} as { audioSrc?: string }} />;
      })}
      <Composition id="FULL-SYSTEM" component={({ audioSrc }: { audioSrc?: string }) => <FullFilm m={FULL_FILM} audioSrc={audioSrc} />} durationInFrames={FULL_FILM.frames} fps={30} width={1920} height={1080} defaultProps={{} as { audioSrc?: string }} />
      <Composition id="V3-CameraTest" component={CameraTest} durationInFrames={CAMERA_TEST_FRAMES} fps={30} width={1920} height={1080} defaultProps={{} as { audioSrc?: string }} />
    </>
  );
}
