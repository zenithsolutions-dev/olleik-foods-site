import React from "react";
import { Composition } from "remotion";
import { ContactSheet, sheetHeight, type SheetProps } from "./ContactSheet";
import { BeatStill, ManualVideo, timeline, type ManualProps } from "./ManualVideo";
import { Poster } from "./Poster";
import { FPS, H, VH, VW, W } from "./theme";
import type { VideoId } from "./data/types";
import { PromoRoot } from "./promo/PromoRoot";
import { V2Root } from "./v2/V2Root";
import { V3Root } from "./v3/V3Root";

const manual = (id: string, video: VideoId, w: number, h: number) => (
  <Composition
    key={id}
    id={id}
    component={ManualVideo}
    fps={FPS}
    width={w}
    height={h}
    durationInFrames={300}
    defaultProps={{ video } as ManualProps}
    calculateMetadata={async ({ props }) => {
      const t = await timeline(props.video);
      return { durationInFrames: Math.max(30, t.total), props: { ...props, timed: t.timed, roomTone: t.roomTone } };
    }}
  />
);

export function Root() {
  return (
    <>
      {manual("VISITOR", "VISITOR", W, H)}
      {manual("VISITOR-vertical", "VISITOR", VW, VH)}
      {manual("ADMIN", "ADMIN", W, H)}
      <Composition id="Poster" component={Poster} durationInFrames={1} fps={FPS} width={W} height={H} defaultProps={{ video: "VISITOR" as VideoId }} />
      <Composition id="PosterVertical" component={Poster} durationInFrames={1} fps={FPS} width={VW} height={VH} defaultProps={{ video: "VISITOR" as VideoId }} />
      <Composition id="BeatStill" component={BeatStill} durationInFrames={300} fps={FPS} width={W} height={H} defaultProps={{ video: "VISITOR" as VideoId, id: "VI-02" }} />
      <Composition id="BeatStillVertical" component={BeatStill} durationInFrames={300} fps={FPS} width={VW} height={VH} defaultProps={{ video: "VISITOR" as VideoId, id: "VI-02" }} />
      <Composition
        id="Sheet"
        component={ContactSheet}
        durationInFrames={1}
        fps={FPS}
        width={2400}
        height={1200}
        defaultProps={{ title: "Sheet", items: [] } as SheetProps}
        calculateMetadata={({ props }) => ({ height: sheetHeight(props.items.length, props.columns ?? 4, props.aspect ?? 16 / 9) })}
      />
      <PromoRoot />
      <V2Root />
      <V3Root />
    </>
  );
}
