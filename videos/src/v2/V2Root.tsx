import React from "react";
import { Composition } from "remotion";
import { CharSheet } from "./CharSheet";
import { Film, filmFrames, HeroFilm, heroFrames } from "./HeroFilm";
import { Episode } from "./Episode";
import { episodeOf } from "./episodes.mjs";

/** V2 compositions (creative brief V2). */
export function V2Root() {
  return (
    <>
      <Composition id="V2-Hero" component={HeroFilm} durationInFrames={heroFrames} fps={30} width={1920} height={1080} />
      <Composition
        id="V2-Episode"
        component={Episode}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ ep: "EP1" }}
        calculateMetadata={({ props }) => ({ durationInFrames: episodeOf(props.ep)?.frames ?? 300 })}
      />
      <Composition id="V2-Film" component={Film} durationInFrames={450} fps={30} width={1920} height={1080} defaultProps={{ cut: "anim15" } as { cut: string; audioSrc?: string }} calculateMetadata={({ props }) => ({ durationInFrames: filmFrames(String(props.cut)) })} />
      <Composition id="V2-CharSheet" component={CharSheet} durationInFrames={1} fps={30} width={1920} height={1080} />
    </>
  );
}
