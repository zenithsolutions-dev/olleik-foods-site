import React from "react";
import { AbsoluteFill, Audio, Composition, staticFile } from "remotion";
import { HOOK_FRAMES, HOOKS } from "./Hooks";

export function HookRoot() {
  return (
    <>
      {(Object.keys(HOOKS) as (keyof typeof HOOKS)[]).map((k) => {
        const C = HOOKS[k];
        const Comp = ({ audioSrc }: { audioSrc?: string }) => (
          <AbsoluteFill>
            <C />
            {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
          </AbsoluteFill>
        );
        return <Composition key={k} id={`V3-Hook-${k}`} component={Comp} durationInFrames={HOOK_FRAMES} fps={30} width={1920} height={1080} defaultProps={{} as { audioSrc?: string }} />;
      })}
    </>
  );
}
