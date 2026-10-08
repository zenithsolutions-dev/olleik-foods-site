// Promo storyboards: one still per scene from the real promo composition (at ~70 % of the scene, once it has settled),
// then a PNG contact sheet per cut, plus a sheet of the alternative openings.   ./run.sh promo-board.mjs [cut ...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { CUTS, FPS, promoTimeline } from "./src/promo/timeline.mjs";

const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CUTS);
const fmt = (f) => `${Math.floor(f / FPS / 60)}:${String(Math.floor((f / FPS) % 60)).padStart(2, "0")}.${String(Math.round(((f / FPS) % 1) * 10)).padStart(1, "0")}`;
mkdirSync("public/board/promo", { recursive: true });
mkdirSync("out/storyboards", { recursive: true });
const bundles = [];
let serveUrl = await bundle({ entryPoint: resolve("src/index.ts") });
bundles.push(serveUrl);
const still = async (id, output, inputProps, frame, scale) => {
  const composition = await selectComposition({ serveUrl, id, inputProps, port: 3997 });
  await renderStill({ serveUrl, composition, output: resolve(output), inputProps, frame, scale, port: 3997 });
};
const label = (s) => s.caption ?? (s.kind === "slam2" || s.kind === "question" || s.kind === "status" ? `Hook ${s.hook}: ${s.props.text}` : s.props?.text ?? s.props?.headline ?? s.props?.lines?.join(" ") ?? (s.kind === "steps" ? `How it works: ${s.props.items.join(" · ")}` : s.kind));
const sheets = [];
for (const cut of want) {
  const c = CUTS[cut];
  const T = promoTimeline(cut);
  const items = [];
  for (const s of T.scenes) {
    const f = s.from + Math.min(s.len - 4, Math.round(s.len * (s.kind === "screen" ? 0.75 : 0.8)));
    const file = `board/promo/${cut}-${s.id}.png`;
    await still(`Promo-${cut}`, `public/${file}`, { cut, opening: T.opening, audio: false }, f, c.w > c.h ? 0.5 : 0.4);
    items.push({ src: file, label: `${s.id} · ${s.part}`, time: `${fmt(s.from)}–${fmt(s.to)}`, caption: label(s) });
    process.stdout.write(`${s.id} `);
  }
  sheets.push({ cut, c, items });
  if (c.openings.length > 1) {
    const hooks = [];
    for (const op of c.openings) {
      const H = promoTimeline(cut, op);
      const s = H.scenes[0];
      for (const k of [0.3, 0.85]) {
        const file = `board/promo/${cut}-open-${op}-${k}.png`;
        await still(`Promo-${cut}`, `public/${file}`, { cut, opening: op, audio: false }, Math.round(s.len * k), c.w > c.h ? 0.5 : 0.4);
        hooks.push({ src: file, label: `Opening ${op}`, time: `${fmt(Math.round(s.len * k))}`, caption: s.props.text });
      }
    }
    sheets.push({ cut: `${cut}-openings`, c, items: hooks });
  }
}
serveUrl = await bundle({ entryPoint: resolve("src/index.ts") });
bundles.push(serveUrl);
for (const sh of sheets) {
  const vertical = sh.c.h > sh.c.w;
  const props = { title: `Promo · ${sh.c.title}${sh.cut.endsWith("openings") ? " · alternative openings" : ""}`, subtitle: `${sh.c.w}×${sh.c.h} · ${sh.c.beats / 2} s at 120 BPM (music candidate A) · real product screens, fictional demo data · all copy Pending Review`, items: sh.items, columns: vertical ? 6 : 4, aspect: sh.c.w / sh.c.h };
  await still("Sheet", `out/storyboards/promo-${sh.cut}-storyboard.png`, props, 0, 1);
  console.log(`\nout/storyboards/promo-${sh.cut}-storyboard.png`);
}
for (const b of bundles) rmSync(b, { recursive: true, force: true });
