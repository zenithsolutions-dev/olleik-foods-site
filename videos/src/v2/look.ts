import { Easing, interpolate } from "remotion";
import { C } from "../theme";

/**
 * V2 "short film" look (docs/qa/2026-10-08-videos/CREATIVE_BRIEF_V2.md): flat 2D vector world, warm paper palette with
 * the brand's deep green and amber. One extra colour: stamp red, used only for stamps.
 */
export const K = {
  paper: C.paper,
  paper2: "#f1e9d6",
  green: C.teal,
  deep: C.tealDark,
  night: "#0b1f17",
  night2: "#123327",
  amber: C.orange,
  amberDeep: C.orangeDeep,
  amberSoft: C.accentSoft,
  ink: "#14201a",
  white: "#fffdf8",
  steel: "#c9ccc4",
  steelDark: "#8f948b",
  kraft: "#c9a477",
  kraftDark: "#a8835a",
  stamp: "#b5452b",
  lamp: "#ffd9a0",
};

export const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
export const INOUT = Easing.bezier(0.65, 0, 0.35, 1);
export const BACK = Easing.bezier(0.34, 1.56, 0.64, 1);
export const ez = (f: number, a: number, z: number, from = 0, to = 1, e = EXPO) =>
  interpolate(f, [a, z], [from, to], { easing: e, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
/** Deterministic wobble (for hand-drawn lines and idle motion). */
export const wob = (seed: number, f: number, amp = 1, speed = 0.12) => Math.sin(seed * 12.9898 + f * speed) * amp;
