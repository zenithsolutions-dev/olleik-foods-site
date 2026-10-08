import { loadFont } from "@remotion/fonts";
import { Easing, interpolate, staticFile } from "remotion";

/**
 * Brand tokens from the site (src/app/globals.css). The key names are the toolkit's generic roles:
 *   teal = primary brand colour (Olleik deep green), orange = accent (Olleik amber), paper = warm background.
 */
export const C = {
  teal: "#1c4d3a", // --brand
  tealDark: "#0e2c20", // --brand-deep
  tealSoft: "#e8e1cf", // --brand-soft
  orange: "#c87a2a", // --accent
  orangeDeep: "#9a5410", // --accent-deep
  accentSoft: "#f4dcb8", // --accent-soft
  text: "#14201a", // --foreground
  soft: "#586056", // --muted
  line: "#e2dac6", // --border
  paper: "#faf6ec", // --background
  mist: "#f3eedc", // --brand-mist
  white: "#ffffff",
  chrome: "#f6f2e8",
};
/** Brand colour as "r,g,b" for rgba(): primary and accent. */
export const RGB = { brand: "28,77,58", deep: "14,44,32", accent: "200,122,42" };

export const F = {
  serif: "Fraunces, Georgia, 'Times New Roman', serif",
  sans: "Geist, system-ui, -apple-system, 'Segoe UI', sans-serif",
};

// The site's own families (Fraunces + Geist, SIL Open Font License), loaded locally; Remotion waits for them.
loadFont({ family: "Fraunces", url: staticFile("brand/fraunces-latin-full-normal.woff2"), weight: "100 900" });
loadFont({ family: "Fraunces", url: staticFile("brand/fraunces-latin-full-italic.woff2"), weight: "100 900", style: "italic" });
loadFont({ family: "Geist", url: staticFile("brand/geist-latin-wght-normal.woff2"), weight: "100 900" });

/** Brand name and addresses used on screen (one place). */
export const BRAND = {
  name: "Olleik Foods",
  first: "Olleik",
  second: "Foods",
  tagline: "The supplier behind great kitchens.",
  url: "olleik-foods-site.vercel.app",
};

export const FPS = 30;
export const W = 1920;
export const H = 1080;
export const VW = 1080;
export const VH = 1920;

/** ease-out (0.22, 1, 0.36, 1): the one curve for moves. */
export const EASE = Easing.bezier(0.22, 1, 0.36, 1);
export const ease = (frame: number, input: [number, number], output: [number, number]) =>
  interpolate(frame, input, output, { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

export type Rect = { x: number; y: number; w: number; h: number };
export const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
export const union = (...rs: Rect[]): Rect => {
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  const x2 = Math.max(...rs.map((r) => r.x + r.w));
  const y2 = Math.max(...rs.map((r) => r.y + r.h));
  return { x, y, w: x2 - x, h: y2 - y };
};
export const pad = (r: Rect, p: number): Rect => ({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p });
