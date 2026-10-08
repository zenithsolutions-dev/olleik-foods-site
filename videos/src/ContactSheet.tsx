import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { Mark } from "./components/Chrome";
import { C, F } from "./theme";

export type SheetItem = { src: string; label: string; caption?: string; time?: string };
export type SheetProps = { title: string; subtitle?: string; items: SheetItem[]; columns?: number; aspect?: number };

/** A storyboard contact sheet: one still per scene with its number, time and caption. Rendered with `remotion still`. */
export function ContactSheet({ title, subtitle, items, columns = 4, aspect = 16 / 9 }: SheetProps) {
  const cellW = (2400 - 120 - (columns - 1) * 36) / columns;
  const cellH = cellW / aspect;
  return (
    <AbsoluteFill style={{ background: C.paper, padding: 60, fontFamily: F.sans }}>
      <div style={{ display: "flex", alignItems: "center", gap: 28, marginBottom: 40 }}>
        <Mark size={120} />
        <div style={{ borderLeft: `3px solid ${C.orange}`, paddingLeft: 24 }}>
          <div style={{ fontFamily: F.serif, fontWeight: 500, fontSize: 52, color: C.teal, lineHeight: 1.05 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 22, color: C.soft, marginTop: 8 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 36 }}>
        {items.map((it, i) => (
          <div key={i} style={{ width: cellW }}>
            <div style={{ width: cellW, height: cellH, borderRadius: 10, overflow: "hidden", background: "#fff", boxShadow: "0 1px 2px rgba(28,77,58,0.08), 0 8px 24px rgba(28,77,58,0.10)" }}>
              <Img src={staticFile(it.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "baseline", marginTop: 12 }}>
              <span style={{ flex: "none", fontWeight: 700, fontSize: 20, color: C.orangeDeep }}>{it.label}</span>
              {it.time && <span style={{ fontSize: 17, color: C.soft }}>{it.time}</span>}
            </div>
            {it.caption && <div style={{ fontSize: 19, lineHeight: 1.35, color: C.text, marginTop: 4 }}>{it.caption}</div>}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

/** Height that fits `n` items in `columns` columns (for the composition size). */
export const sheetHeight = (n: number, columns = 4, aspect = 16 / 9) => {
  const cellW = (2400 - 120 - (columns - 1) * 36) / columns;
  const rows = Math.ceil(n / columns);
  return Math.ceil(60 + 160 + rows * (cellW / aspect + 150) + 40);
};
