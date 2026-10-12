// V3.2 voiced manuals: sound, SRT and chapter list from src/v3/voiced.ts. Picture and mux go through v3.mjs.
//   ./run.sh voiced.mjs audio    <compId> <name>      events.json (sfx + voice placements) → audio/mix_voice.py → verify.py
//   ./run.sh voiced.mjs docs     <compId> <name> <dir> <name>.en.srt and <name>.chapters.txt into <dir>
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const OUT = "out/v3";
async function load() {
  const tmp = resolve(`${OUT}/tmp-voiced-${process.pid}.mjs`);
  mkdirSync(OUT, { recursive: true });
  await build({ entryPoints: [resolve("src/v3/voiced.ts")], bundle: true, format: "esm", platform: "node", outfile: tmp, external: ["remotion"], loader: { ".json": "json" }, logLevel: "error", banner: { js: "import { createRequire } from \"module\"; const require = createRequire(import.meta.url);" } });
  const mod = await import(pathToFileURL(tmp).href);
  rmSync(tmp, { force: true });
  return mod;
}
const ts = (f, sep = ",") => {
  const ms = Math.round((f / 30) * 1000);
  const h = Math.floor(ms / 3600000), mi = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(s).padStart(2, "0")}${sep}${String(ms % 1000).padStart(3, "0")}`;
};

const [cmd, id, name, dir] = process.argv.slice(2);
const mod = await load();
const m = mod.VOICED[id];
if (!m) throw new Error(`no voiced manual ${id}`);
if (cmd === "audio") {
  const d = `${OUT}/audio/${name}`;
  mkdirSync(d, { recursive: true });
  const events = mod.voicedEvents(m);
  const voice = m.voice.map((v) => ({ ...v, file: `narration/audio/${v.id}.wav` }));
  writeFileSync(`${d}/events.json`, JSON.stringify({ cut: name, engine: "v2", frames: m.frames, target_lufs: -16, room: false, music: false, bed_file: "out/v3/music/bed-C-60s.wav", wav_tp: -3, events, voice }, null, 1));
  console.log(`${d}/events.json  ${events.length} events, ${voice.length} lines`);
  execFileSync("python", ["audio/mix_voice.py", d], { stdio: "inherit" });
  execFileSync("python", ["audio/verify.py", d], { stdio: "inherit" });
} else if (cmd === "docs") {
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${name}.en.srt`, m.captions.map((c, i) => `${i + 1}\n${ts(c.from)} --> ${ts(c.to)}\n${c.text}\n`).join("\n"));
  const yt = (f) => { const s = Math.floor(f / 30); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  const lines = [`${m.tag.replace(/^Olleik Foods · /, "Olleik Foods: ")} (${yt(m.frames)}, Pending Review)`, "", "0:00 Introduction", ...m.chapters.map((c) => `${yt(c.from)} ${c.n} · ${c.title}`), "", "Steps:", ...m.steps.map((s) => `${yt(s.from)}  ${s.n}. ${s.caption}`)];
  writeFileSync(`${dir}/${name}.chapters.txt`, lines.join("\n") + "\n");
  console.log(`${dir}/${name}.en.srt, ${name}.chapters.txt`);
} else console.log("usage: voiced.mjs audio|docs <compId> <name> [dir]");
