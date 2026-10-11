// V3 tooling (Gate E). Run through ./run.sh (temp files on D:, bundles deleted).
//   ./run.sh v3.mjs stills <compId> f1,f2,…        frames to out/v3/stills/<compId>-<f>.png
//   ./run.sh v3.mjs render <compId> <name>          muted picture (H.264 CRF 16) → out/v3/video/<name>-picture.mp4
//   ./run.sh v3.mjs audio  <name> <events fn> [target] [module] [frames export]   events.json → mix_v2.py → verify.py
//   ./run.sh v3.mjs mux    <name> <variant>         AAC mux, loudness loop on the encoded file (as v2.mjs)
//   ./run.sh v3.mjs qa     <name> <variant> f1,f2,… frames pulled from the encoded MP4
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const OUT = "out/v3";
const PORT = 3997;
let serveUrl;
const getBundle = async () => (serveUrl ??= await bundle({ entryPoint: resolve("src/index.ts") }));
process.on("exit", () => serveUrl && rmSync(serveUrl, { recursive: true, force: true }));

async function stills(id, frames, props = {}) {
  const s = await getBundle();
  const comp = await selectComposition({ serveUrl: s, id, inputProps: props, port: PORT });
  mkdirSync(`${OUT}/stills`, { recursive: true });
  for (const f of frames) {
    const output = resolve(`${OUT}/stills/${id}-${String(f).padStart(4, "0")}.png`);
    await renderStill({ serveUrl: s, composition: comp, output, inputProps: props, frame: f, port: PORT });
    console.log(output);
  }
}

async function render(id, name, props = {}) {
  const s = await getBundle();
  mkdirSync(`${OUT}/video`, { recursive: true });
  const comp = await selectComposition({ serveUrl: s, id, inputProps: props, port: PORT });
  const out = resolve(`${OUT}/video/${name}-picture.mp4`);
  const t0 = Date.now();
  await renderMedia({ serveUrl: s, composition: comp, inputProps: props, codec: "h264", crf: 16, muted: true, outputLocation: out, concurrency: Number(process.env.CONC ?? 3), x264Preset: "slow", pixelFormat: "yuv420p", colorSpace: "bt709", port: PORT, timeoutInMilliseconds: 120000 });
  console.log(`${out}  ${comp.durationInFrames} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

async function audio(name, fnName, target = -14, modPath = "src/v3/shots.ts", framesExport = "CAMERA_TEST_FRAMES", extra = {}) {
  // events come from the TS shot module, compiled on the fly through the Remotion bundle is overkill: a tiny esbuild pass
  const { build } = await import("esbuild");
  const tmp = resolve(`${OUT}/tmp-events.mjs`);
  mkdirSync(OUT, { recursive: true });
  await build({ entryPoints: [resolve(modPath)], bundle: true, format: "esm", platform: "node", outfile: tmp, external: ["remotion"], loader: { ".json": "json" }, logLevel: "error", jsx: "automatic", banner: { js: "import { createRequire } from \"module\"; const require = createRequire(import.meta.url);" } });
  const mod = await import("file://" + tmp.replace(/\\/g, "/"));
  const events = mod[fnName]();
  const frames = mod[framesExport];
  const d = `${OUT}/audio/${name}`;
  mkdirSync(d, { recursive: true });
  writeFileSync(`${d}/events.json`, JSON.stringify({ cut: name, engine: "v2", frames, target_lufs: Number(target), room: true, music: false, events, ...extra }, null, 1));
  rmSync(tmp, { force: true });
  console.log(`${d}/events.json  ${events.length} events`);
  execFileSync("python", ["audio/mix_v2.py", d], { stdio: "inherit" });
  execFileSync("python", ["audio/verify.py", d], { stdio: "inherit" });
}

const ffLoud = (path) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" });
  const sum = r.stderr.slice(r.stderr.lastIndexOf("Summary:"));
  return { I: Number(/I:\s+(-?[\d.]+) LUFS/.exec(sum)?.[1]), TP: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(sum)?.[1]) };
};

function mux(name, variant) {
  const d = existsSync(`${OUT}/audio/${name}-${variant}`) ? `${OUT}/audio/${name}-${variant}` : `${OUT}/audio/${name}`;
  const data = JSON.parse(readFileSync(`${d}/events.json`, "utf8"));
  const target = data.target_lufs;
  const pic = `${OUT}/video/${name}-picture.mp4`;
  mkdirSync(`${OUT}/mp4`, { recursive: true });
  const out = `${OUT}/mp4/${name}-${variant}.mp4`;
  let gain = 0;
  let m;
  for (let i = 0; i < 14; i++) {
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", pic, "-i", `${d}/mix.wav`, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-af", `volume=${gain.toFixed(2)}dB,${process.env.COMP ? "acompressor=threshold=-20dB:ratio=3:attack=4:release=90:knee=4," : ""}alimiter=limit=${(10 ** (Number(process.env.LIMIT ?? -1.6) / 20)).toFixed(4)}:attack=1:release=60:level=disabled`, "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-shortest", "-movflags", "+faststart", out]);
    m = ffLoud(out);
    console.log(`${name}-${variant}: gain ${gain.toFixed(2)} dB → I ${m.I} LUFS, TP ${m.TP} dBTP`);
    if (m.TP <= -1.2 && Math.abs(m.I - target) <= 0.3) break; // 0.2 dB margin under the -1 dBTP ceiling
    const step = Math.min(target - m.I, -1.3 - m.TP);
    gain += Math.max(-4, Math.min(4, Math.abs(step) < 0.05 ? -0.1 : step));
  }
  const silent = `${OUT}/mp4/${name}-silent.mp4`;
  copyFileSync(pic, silent);
  const p = `${OUT}/loudness.json`;
  const all = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
  all[`${name}-${variant}`] = { file: out, target, ...m, gain_dB: +gain.toFixed(2), MB: +(statSync(out).size / 1e6).toFixed(1), seconds: data.frames / 30 };
  writeFileSync(p, JSON.stringify(all, null, 1));
}

function qa(name, variant, frames) {
  const mp4 = `${OUT}/mp4/${name}-${variant}.mp4`;
  const d = `${OUT}/qa/${name}-${variant}`;
  rmSync(d, { recursive: true, force: true });
  mkdirSync(d, { recursive: true });
  for (const f of frames) execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", ((f + 0.5) / 30).toFixed(3), "-i", mp4, "-frames:v", "1", `${d}/${String(f).padStart(4, "0")}.png`]);
  execFileSync("python", ["audio/sheet.py", d, `${d}/sheet.png`, "4"]);
  console.log(`${d}: ${frames.length} frames`);
}

/** SRT files for the V3 manuals (the same lines as on screen). */
async function srt(outDir = `${OUT}/mp4`) {
  const { build } = await import("esbuild");
  const tmp = resolve(`${OUT}/tmp-srt.mjs`);
  await build({ entryPoints: [resolve("src/v3/manuals.ts")], bundle: true, format: "esm", platform: "node", outfile: tmp, external: ["remotion"], loader: { ".json": "json" }, logLevel: "error", banner: { js: "import { createRequire } from \"module\"; const require = createRequire(import.meta.url);" } });
  const mod = await import(pathToFileURL(tmp).href);
  mkdirSync(outDir, { recursive: true });
  for (const [file, m] of [["visitor-ch4", mod.VISITOR_CH4], ["ep1", mod.ADMIN_EP1]]) {
    writeFileSync(`${outDir}/${file}.en.srt`, mod.srtOf(m));
    console.log(`${outDir}/${file}.en.srt`);
  }
  rmSync(tmp, { force: true });
}

const [cmd, a, b, c, e] = process.argv.slice(2);
const list = (x) => String(x).split(",").map(Number);
if (cmd === "stills") await stills(a, list(b));
else if (cmd === "render") await render(a, b);
else if (cmd === "audio") await audio(a, b, c ?? -14, e ?? "src/v3/shots.ts", process.argv[7] ?? "CAMERA_TEST_FRAMES", process.env.EXTRA ? JSON.parse(process.env.EXTRA) : {});
else if (cmd === "mux") mux(a, b);
else if (cmd === "qa") qa(a, b, list(c));
else if (cmd === "srt") await srt(a);
else console.log("usage: ./run.sh v3.mjs stills|render|audio|mux|qa …");
