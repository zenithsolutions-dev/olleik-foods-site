import React, { createContext, useContext } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { camAt, type CamKey, type Metric } from "../camera";

/**
 * A captured screen inside a view (the browser frame's content area or the phone's screen), with a camera
 * (src/camera.ts). Everything placed inside <Stage> uses the SCREEN's CSS pixels (the Playwright boxes in the
 * manifest), so overlays (cursor, ring, spotlight) move with the camera.
 */
const StageCtx = createContext<{ zoom: number }>({ zoom: 1 });
/** The view px per screen px in effect, for overlays that keep a constant on-screen size (cursor, ring width). */
export const useStageZoom = () => useContext(StageCtx).zoom;

/** Screens shown in turn: [{ from, src }]; each crossfades in over `fade` frames. */
export type ScreenSrc = { from: number; src: string };

export function Stage({ metric, screens, camera = [], fade = 8, children }: { metric: Metric; screens: ScreenSrc[]; camera?: CamKey[]; fade?: number; children?: React.ReactNode }) {
  const frame = useCurrentFrame();
  const { view, screen } = metric;
  const cam = camAt(frame, camera, metric);
  const s = metric.base * cam.z;
  const transform = `translate(${view.w / 2}px, ${view.h / 2}px) scale(${s}) translate(${-cam.cx}px, ${-cam.cy}px)`;
  return (
    <div style={{ position: "relative", width: view.w, height: view.h, overflow: "hidden", background: "#fff" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: screen.w, height: screen.h, transformOrigin: "0 0", transform }}>
        {screens.map((sc, i) => {
          const next = screens[i + 1];
          const opacity = i === 0 ? 1 : interpolate(frame, [sc.from, sc.from + fade], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const gone = next && frame >= next.from + fade;
          if (gone || (i > 0 && frame < sc.from)) return null;
          return <Img key={sc.src + i} src={staticFile(sc.src)} style={{ position: "absolute", inset: 0, width: screen.w, height: screen.h, opacity }} />;
        })}
        <StageCtx.Provider value={{ zoom: s }}>
          <AbsoluteFill style={{ width: screen.w, height: screen.h }}>{children}</AbsoluteFill>
        </StageCtx.Provider>
      </div>
    </div>
  );
}

/** The earlier rect-based camera keys (StyleReel, Board): { at, rect (null = whole screen), dur, maxZoom }. */
type RectKey = { at: number; rect: { x: number; y: number; w: number; h: number } | null; dur?: number; maxZoom?: number };
export function LegacyStage({ view, screen, screens, camera = [], children }: { view: { w: number; h: number }; screen: { w: number; h: number }; screens: ScreenSrc[]; camera?: RectKey[]; children?: React.ReactNode }) {
  const metric: Metric = { base: view.w / screen.w, view, screen };
  const keys: CamKey[] = camera.map((k) => {
    if (!k.rect) return { at: k.at, dur: k.dur ?? 16, cam: { z: 1, cx: screen.w / 2, cy: screen.h / 2 } };
    const z = Math.max(1, Math.min(k.maxZoom ?? 2.2, screen.w / k.rect.w, screen.h / k.rect.h));
    return { at: k.at, dur: k.dur ?? 16, cam: { z, cx: k.rect.x + k.rect.w / 2, cy: k.rect.y + k.rect.h / 2 } };
  });
  return (
    <Stage metric={metric} screens={screens} camera={keys}>
      {children}
    </Stage>
  );
}
