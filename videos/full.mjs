// FULL SYSTEM film driver: build check, sound, SRT, chapter list and coverage table from src/v3/fullStory.ts.
//   node full.mjs check                       build + validate, print the timeline
//   node full.mjs audio  <name>               events.json (sfx + narration placements) → audio/mix_voice.py → audio/verify.py
//   node full.mjs docs   <name> <dir>         <name>.en.srt, <name>.chapters.txt
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const OUT = "out/v3";
async function load(lenient = false) {
  const tmp = resolve(`${OUT}/tmp-full-${process.pid}.mjs`);
  mkdirSync(OUT, { recursive: true });
  await build({ entryPoints: [resolve("src/v3/fullStory.ts")], bundle: true, format: "esm", platform: "node", outfile: tmp, external: ["remotion"], loader: { ".json": "json" }, logLevel: "error", banner: { js: `import { createRequire } from "module"; const require = createRequire(import.meta.url); globalThis.FULL_LENIENT = ${lenient};` } });
  try { return await import(pathToFileURL(tmp).href); } finally { rmSync(tmp, { force: true }); }
}
const ts = (f, sep = ",") => {
  const ms = Math.round((f / 30) * 1000);
  const h = Math.floor(ms / 3600000), mi = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(s).padStart(2, "0")}${sep}${String(ms % 1000).padStart(3, "0")}`;
};
const yt = (f) => { const s = Math.floor(f / 30); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const [cmd, name, dir] = process.argv.slice(2);
if (cmd === "check") {
  const mod = await load(true);
  const m = mod.FULL_FILM;
  console.log(`${m.id}: ${m.frames} frames (${yt(m.frames)}), ${m.steps.length} steps, ${m.panes.length} pane segments, ${m.threads.length} threads`);
  for (const c of m.chapters) console.log(`  ${yt(c.from)} ${c.n} · ${c.title}`);
  console.log(mod.FULL_PROBLEMS.length ? "PROBLEMS:\n" + mod.FULL_PROBLEMS.join("\n") : "no problems");
  if (name === "mids") console.log("MIDS " + m.steps.map((s) => Math.round((s.from + s.to) / 2)).join(","));
  if (name === "threads") console.log("THREADS " + m.threads.map((t) => t.f + 12).join(","));
} else {
  const mod = await load(false);
  const m = mod.FULL_FILM;
  if (cmd === "audio") {
    const d = `${OUT}/audio/${name}`;
    mkdirSync(d, { recursive: true });
    const events = mod.fullEvents(m);
    const voice = m.voice.map((v) => ({ ...v, file: `narration/audio/${v.id}.wav` }));
    writeFileSync(`${d}/events.json`, JSON.stringify({ cut: name, engine: "v2", frames: m.frames, target_lufs: -16, room: false, music: false, bed_file: "out/v3/music/bed-C-60s.wav", wav_tp: -3, events, voice }, null, 1));
    console.log(`${d}/events.json  ${events.length} events, ${voice.length} lines`);
    execFileSync("python", ["audio/mix_voice.py", d], { stdio: "inherit" });
    execFileSync("python", ["audio/verify.py", d], { stdio: "inherit" });
  } else if (cmd === "docs") {
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${name}.en.srt`, m.captions.map((c, i) => `${i + 1}\n${ts(c.from)} --> ${ts(c.to)}\n${c.text}\n`).join("\n"));
    const lines = [`Olleik Foods: the whole system (${yt(m.frames)}, Pending Review)`, "", "0:00 Introduction", ...m.chapters.map((c) => `${yt(c.from)} ${c.n} · ${c.title}`), `${yt(m.cards[m.cards.length - 1].from)} End`, "", "Steps:", ...m.steps.map((s) => `${yt(s.from)}  ${s.n}. ${s.caption}`)];
    writeFileSync(`${dir}/${name}.chapters.txt`, lines.join("\n") + "\n");
    writeFileSync(`${dir}/${name}.steps.json`, JSON.stringify(m.steps.map((s) => ({ id: s.id, n: s.n, from: s.from, to: s.to, t: yt(s.from) })), null, 1));
    console.log(`${dir}/${name}.en.srt, .chapters.txt, .steps.json`);
  } else console.log("usage: full.mjs check | audio <name> | docs <name> <dir>");
}
