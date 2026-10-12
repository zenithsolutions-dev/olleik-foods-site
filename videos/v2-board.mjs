// Storyboard V2 (creative brief V2): stills straight from the V2 scene code, then contact sheets.
//   ./run.sh v2-board.mjs [hero|manuals|all]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { HERO } from "./src/v2/hero.mjs";
import { EPISODES } from "./src/v2/episodes.mjs";

const which = process.argv[2] ?? "all";
const PORT = 3997;
mkdirSync("public/board/v2", { recursive: true });
mkdirSync("out/storyboards/v2", { recursive: true });
const bundles = [];
let serveUrl = await bundle({ entryPoint: resolve("src/index.ts") });
bundles.push(serveUrl);
const still = async (id, output, inputProps, frame, scale) => {
  const composition = await selectComposition({ serveUrl, id, inputProps, port: PORT });
  await renderStill({ serveUrl, composition, output: resolve(output), inputProps, frame, scale, port: PORT });
};
const tc = (f) => `${Math.floor(f / 30 / 60)}:${String(Math.floor((f / 30) % 60)).padStart(2, "0")}.${Math.round(((f / 30) % 1) * 10)}`;
const sheets = [];

if (which === "hero" || which === "all") {
  // two or three stills per scene, at the story moments that matter
  const picks = {
    H01: [0.05, 0.4, 0.85], H02: [0.25, 0.75], H03: [0.25, 0.8], H04: [0.6], H05: [0.2, 0.55, 0.9], H06: [0.6],
    H07: [0.08, 0.3, 0.48, 0.62, 0.85], H08: [0.5], H09: [0.15, 0.3, 0.55, 0.93], H10: [0.8],
  };
  const items = [];
  for (const sc of HERO.scenes) {
    for (const q of picks[sc.id] ?? [0.6]) {
      const f = sc.from + Math.round((sc.to - sc.from) * q);
      const file = `board/v2/hero-${String(f).padStart(4, "0")}.png`;
      await still("V2-Hero", `public/${file}`, {}, f, 0.5);
      items.push({ src: file, label: `${sc.id} · ${tc(f)}`, time: sc.kind, caption: `${sc.beat}. Sound: ${sc.sound}` });
      process.stdout.write(`${sc.id}@${f} `);
    }
  }
  sheets.push({ name: "V2-hero-60s-storyboard", props: { title: "V2 · “The night before” · hero 60 s", subtitle: "Stills rendered from the scene code · 2D vector characters built in code · real product footage only on the phone and the monitor · all copy Pending Review", items, columns: 4, aspect: 16 / 9 } });
  await still("V2-CharSheet", "out/storyboards/v2/V2-characters-model-sheet.png", {}, 0, 1);
}

if (which === "manuals" || which === "all") {
  for (const ep of EPISODES) {
    const items = [];
    for (const [i, b] of ep.beats.entries()) {
      const file = `board/v2/${ep.id}-${String(i + 1).padStart(2, "0")}.png`;
      await still("V2-Episode", `public/${file}`, { ep: ep.id }, b.from + Math.round((b.to - b.from) * 0.75), 0.5);
      items.push({ src: file, label: `${ep.id}-${String(i + 1).padStart(2, "0")} · ${tc(b.from)}`, time: b.kind, caption: b.caption ?? b.line ?? b.title ?? "" });
      process.stdout.write(`${ep.id}-${i + 1} `);
    }
    sheets.push({ name: `V2-${ep.id}-storyboard`, props: { title: `V2 · ${ep.title}`, subtitle: `${ep.length} · guide: ${ep.guide} · real captures from the local demo copy (fictional data) · captions Pending Review`, items, columns: 4, aspect: 16 / 9 } });
  }
}

serveUrl = await bundle({ entryPoint: resolve("src/index.ts") });
bundles.push(serveUrl);
for (const sh of sheets) {
  await still("Sheet", `out/storyboards/v2/${sh.name}.png`, sh.props, 0, 1);
  console.log(`\nout/storyboards/v2/${sh.name}.png`);
}
for (const b of bundles) rmSync(b, { recursive: true, force: true });
