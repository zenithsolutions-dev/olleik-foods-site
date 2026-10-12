import React from "react";
import { Composition } from "remotion";
import { FPS } from "../theme";
import { PromoCut, promoFramesOf, Thumb, type FinalProps, type ThumbProps } from "./Promo";
import { CUTS } from "./timeline.mjs";

/** Promo compositions: Promo-<cut> (and Promo-<cut>-square for the bumper), the three master thumbnails. */
export function PromoRoot() {
  return (
    <>
      {Object.entries(CUTS as Record<string, any>).map(([id, c]) => (
        <React.Fragment key={id}>
          <Composition id={`Promo-${id}`} component={PromoCut} durationInFrames={promoFramesOf(id)} fps={FPS} width={c.w} height={c.h} defaultProps={{ cut: id, opening: c.openings[0], audio: false } as FinalProps} />
          {c.square && <Composition id={`Promo-${id}-square`} component={PromoCut} durationInFrames={promoFramesOf(id)} fps={FPS} width={1080} height={1080} defaultProps={{ cut: id, opening: c.openings[0], audio: false } as FinalProps} />}
        </React.Fragment>
      ))}
      {(["A", "B", "C"] as const).map((v) => (
        <Composition key={v} id={`Thumb-master-${v}`} component={Thumb} durationInFrames={1} fps={FPS} width={1920} height={1080} defaultProps={{ variant: v } as ThumbProps} />
      ))}
    </>
  );
}
