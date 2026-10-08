import React from "react";
import { AbsoluteFill } from "remotion";
import { F } from "../theme";
import { DriverHands, Marco, Salma } from "./characters";
import { K } from "./look";

/** Model sheet: Marco and Salma in their key poses and expressions (for the storyboard and for review). */
export function CharSheet() {
  const cell = (label: string, el: React.ReactNode) => (
    <div style={{ width: 300, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: 260, height: 390 }}>{el}</div>
      <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 20, color: K.deep, marginTop: 8 }}>{label}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: K.paper, padding: 50, gap: 30 }}>
      <div style={{ fontFamily: F.serif, fontWeight: 600, fontSize: 46, color: K.deep }}>Characters · model sheet (V2, Pending Review)</div>
      <div style={{ display: "flex", gap: 10 }}>
        {cell("Marco · tired (11:04 PM)", <Marco expr="tired" tilt={-6} armR={{ sh: 60, el: 70 }} />)}
        {cell("Marco · surprised", <Marco expr="surprised" turn={-0.4} armL={{ sh: 40, el: 40 }} armR={{ sh: 40, el: 40 }} />)}
        {cell("Marco · tap (focus)", <Marco expr="focus" turn={0.5} armR={{ sh: 95, el: 30 }} />)}
        {cell("Marco · relieved", <Marco expr="smile" armL={{ sh: 20, el: 90 }} armR={{ sh: 150, el: 30 }} />)}
        {cell("Marco · wink", <Marco expr="wink" turn={0.3} armR={{ sh: 70, el: 80 }} />)}
        {cell("Marco · blink", <Marco blink={1} />)}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        {cell("Salma · calm", <Salma expr="neutral" />)}
        {cell("Salma · focus", <Salma expr="focus" turn={0.6} armR={{ sh: 80, el: 40 }} />)}
        {cell("Salma · stamp", <Salma expr="focus" turn={-0.3} armR={{ sh: 160, el: 10 }} />)}
        {cell("Salma · smile", <Salma expr="smile" armL={{ sh: 20, el: 30 }} />)}
        {cell("Salma · wave", <Salma expr="smile" armR={{ sh: 150, el: 20 }} />)}
        <div style={{ width: 300, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: 280, height: 140 }}>
            <DriverHands />
          </div>
          <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 20, color: K.deep, marginTop: 8 }}>Driver · hands only</div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
