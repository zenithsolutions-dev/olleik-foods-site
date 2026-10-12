import React from "react";
import { C, F } from "../theme";

/** Minimal browser window: a light bar with three quiet dots and the address, soft shadow, 16 px corners. */
export function BrowserFrame({ url, width, height, children }: { url: string; width: number; height: number; children: React.ReactNode }) {
  const bar = 46;
  return (
    <div
      style={{
        width,
        height: height + bar,
        borderRadius: 16,
        overflow: "hidden",
        background: C.white,
        boxShadow: "0 1px 2px rgba(28,77,58,0.06), 0 12px 32px rgba(28,77,58,0.10), 0 40px 90px rgba(28,77,58,0.12)",
        border: "1px solid rgba(28,77,58,0.08)",
      }}
    >
      <div style={{ height: bar, background: C.chrome, display: "flex", alignItems: "center", gap: 18, padding: "0 18px", borderBottom: "1px solid rgba(28,77,58,0.08)" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 12, height: 12, borderRadius: 6, background: "#d9d1bd" }} />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            maxWidth: 560,
            margin: "0 auto",
            height: 28,
            borderRadius: 14,
            background: C.white,
            border: "1px solid rgba(28,77,58,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontFamily: F.sans,
            fontSize: 15,
            color: C.soft,
          }}
        >
          <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true">
            <rect x="1" y="6" width="10" height="7.5" rx="1.6" fill={C.soft} />
            <path d="M3.3 6V4.3a2.7 2.7 0 0 1 5.4 0V6" stroke={C.soft} strokeWidth="1.5" fill="none" />
          </svg>
          {url}
        </div>
        <div style={{ width: 52 }} />
      </div>
      <div style={{ width, height }}>{children}</div>
    </div>
  );
}

/** A phone: dark rounded body, thin bezel, the camera pill; the screen at 390 × 844 CSS px. */
export function PhoneFrame({ height, children }: { height: number; children: React.ReactNode }) {
  const bezel = 13;
  const screenH = height - 2 * bezel;
  const screenW = (screenH * 390) / 844;
  return (
    <div
      style={{
        width: screenW + 2 * bezel,
        height,
        borderRadius: 64,
        background: "#16191a",
        padding: bezel,
        boxShadow: "0 2px 4px rgba(0,0,0,0.12), 0 30px 70px rgba(28,77,58,0.22), inset 0 0 0 2px #2b3031",
        position: "relative",
      }}
    >
      <div style={{ width: screenW, height: screenH, borderRadius: 52, overflow: "hidden", position: "relative", background: "#fff" }}>
        {children}
        <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", width: 118, height: 34, borderRadius: 17, background: "#0c0e0f" }} />
      </div>
    </div>
  );
}

export { phoneScreenSize } from "../layout";
