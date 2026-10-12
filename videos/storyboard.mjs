// Storyboards: one still per beat, rendered from the real scene code (BeatScene) at a settled frame, then a PNG
// contact sheet per video with the beat id, planned start and caption.
//   cd videos && node storyboard.mjs [VISITOR|ADMIN|VISITOR-vertical]
// Remotion temp bundles go to out/tmp on D: (the C: drive is nearly full).
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { resolve } from "node:path";
import { mkdirSync, readFileSync, rmSync } from "node:fs";

const reading = (c) => (c ? Math.max(2.5, c.split(/\s+/).length / 3 + 1) : 0);
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const which = process.argv[2] ? [process.argv[2]] : ["VISITOR", "ADMIN", "VISITOR-vertical"];
let serveUrl = await bundle({ entryPoint: resolve("src/index.ts") });
const bundles = [serveUrl];
const still = async (id, output, inputProps, frame = 0, scale = 1) => {
  const composition = await selectComposition({ serveUrl, id, inputProps, port: 3997 });
  await renderStill({ serveUrl, composition, output: resolve(output), inputProps, frame, scale, port: 3997 });
};
mkdirSync("public/board", { recursive: true });
mkdirSync("out/storyboards", { recursive: true });
const errors = [];
for (const w of which) {
  const vertical = w.endsWith("vertical");
  const v = w.replace("-vertical", "");
  const data = JSON.parse(readFileSync(`src/data/${v}.json`, "utf8"));
  const items = [];
  let t = 0;
  for (const b of data.beats) {
    const file = `board/${w}-${b.id}.png`;
    const frame = b.kind === "intro" ? 70 : b.kind === "chapter" ? 40 : b.kind === "outro" ? 60 : b.click ? Math.round((b.clickAt ?? 2.2) * 30) + 3 : 124;
    try {
      await still(vertical ? "BeatStillVertical" : "BeatStill", `public/${file}`, { video: v, id: b.id }, frame, 0.5);
    } catch (e) {
      errors.push(String(e?.message ?? e).split(String.fromCharCode(10))[0]);
    }
    const title = b.kind === "chapter" ? `Chapter ${b.chapter.n}: ${b.chapter.title}` : b.kind === "intro" ? "Logo intro" : b.kind === "outro" ? `Outro · ${(b.urls ?? []).join(" · ")}${b.cta ? ` · ${b.cta}` : ""}` : b.caption;
    items.push({ src: file, label: b.id, time: fmt(t), caption: title });
    t += Math.max(b.targetSeconds, reading(b.caption), b.kind === "chapter" ? 2 : 0);
    process.stdout.write(`${b.id} `);
  }
  // The bundle copies public/ when it is made: re-bundle so the sheet sees the stills just rendered.
  serveUrl = await bundle({ entryPoint: resolve("src/index.ts") });
  bundles.push(serveUrl);
  await still("Sheet", `out/storyboards/${w}-storyboard.png`, { title: `${w} · ${data.title}`, subtitle: `${data.beats.length} beats · planned ${fmt(t)} · real screens from the local demo copy, fictional data · captions Pending Review`, items, columns: vertical ? 6 : 4, aspect: vertical ? 9 / 16 : 16 / 9 });
  console.log(`\n${w}: out/storyboards/${w}-storyboard.png  (planned ${fmt(t)})`);
}
if (errors.length) console.log(`ERRORS (${errors.length}):\n${errors.join("\n")}`);
for (const b of bundles) rmSync(b, { recursive: true, force: true }); // temp bundles (in TMP; run.sh puts TMP on D:)
