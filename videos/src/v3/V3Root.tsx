import React from "react";
import { AbsoluteFill, Audio, Composition, staticFile } from "remotion";
import { CAMERA_TEST, CAMERA_TEST_FRAMES } from "./shots";
import { WorldView } from "./World";
import { HookRoot } from "./hooksRoot";

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
      <Composition id="V3-CameraTest" component={CameraTest} durationInFrames={CAMERA_TEST_FRAMES} fps={30} width={1920} height={1080} defaultProps={{} as { audioSrc?: string }} />
    </>
  );
}
