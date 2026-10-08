import React from "react";
import { AbsoluteFill, Img, staticFile, useVideoConfig } from "remotion";
import { shotOf } from "./BeatScene";
import { Background, Mark, Wordmark } from "./components/Chrome";
import { BrowserFrame } from "./components/Frames";
import { VIDEOS } from "./ManualVideo";
import { BRAND, C, F } from "./theme";
import type { VideoId } from "./data/types";

const AUDIENCE: Record<string, string> = { VISITOR: "FOR NEW AND APPROVED CUSTOMERS", ADMIN: "FOR ADMINS" };
/** The screen on each cover: the website for clients, the dashboard for staff and owners. */
const COVER: Record<string, string> = { VISITOR: "visitor/home-hero", ADMIN: "admin/dashboard" };

/** The cover still for a video (also its thumbnail): who it is for, the title, the firm, one real screen. */
export function Poster({ video }: { video: VideoId }) {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const data = VIDEOS[video];
  const beat = data.beats.find((b) => b.shots?.[0] === COVER[video]);
  const shot = shotOf(COVER[video]);
  const [lead, rest] = data.title.includes(":") ? data.title.split(/:\s*/) : [data.title, ""];
  const frameW = vertical ? 960 : 1060;
  const frameH = Math.round((frameW * 900) / 1440);
  const text = (
    <div style={{ width: vertical ? 960 : 760 }}>
      <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: vertical ? 30 : 26, letterSpacing: "0.22em", color: C.orangeDeep }}>USER GUIDE · {AUDIENCE[video]}</div>
      <div style={{ height: 4, width: 120, background: C.orange, borderRadius: 2, margin: "26px 0 30px" }} />
      <div style={{ fontFamily: F.serif, fontWeight: 500, fontSize: vertical ? 104 : 88, lineHeight: 1.02, color: C.teal, letterSpacing: "-0.02em", textWrap: "balance" }}>{lead}</div>
      {rest && <div style={{ fontFamily: F.serif, fontStyle: "italic", fontWeight: 400, fontSize: vertical ? 60 : 52, lineHeight: 1.1, color: C.teal, marginTop: 18 }}>{rest}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: vertical ? 60 : 70 }}>
        <Mark size={vertical ? 130 : 110} />
        <div style={{ borderLeft: `3px solid ${C.orange}`, paddingLeft: 22 }}>
          <Wordmark size={vertical ? 56 : 48} />
        </div>
      </div>
    </div>
  );
  const screen = shot && (
    <BrowserFrame url={beat?.url ?? shot.url ?? BRAND.url} width={frameW} height={frameH}>
      <Img src={staticFile(shot.file)} style={{ width: frameW, height: frameH, objectFit: "cover", objectPosition: "top left" }} />
    </BrowserFrame>
  );
  return (
    <AbsoluteFill>
      <Background />
      {vertical ? (
        <AbsoluteFill style={{ padding: "180px 60px", flexDirection: "column", gap: 110 }}>
          {text}
          {screen}
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ alignItems: "center", flexDirection: "row", padding: "0 0 0 110px", gap: 70 }}>
          {text}
          <div style={{ marginRight: -140 }}>{screen}</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
