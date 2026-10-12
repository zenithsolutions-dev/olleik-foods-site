// V2 proofs tooling (Gate D). Run through ./run.sh (temp files on D:, bundles deleted).
//   ./run.sh v2.mjs audio  film anim15 [music|nomusic]   events.json → audio/mix_v2.py → audio/verify.py
//   ./run.sh v2.mjs audio  ep   VISITOR-CH4                (manuals: sound design only, −16 LUFS)
//   ./run.sh v2.mjs render film anim15 | ep EP1           muted picture (H.264, CRF 16)
//   ./run.sh v2.mjs mux    <id> <variant>                  AAC mux: encode → measure → adjust until on target, TP ≤ −1 dBTP
//   ./run.sh v2.mjs qa     <id> <variant>                  frames from the encoded MP4 at full and phone size + sheet
// Outputs: out/v2/{audio,video,mp4,qa}/…
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { FILMS, filmEvents } from "./src/v2/hero.mjs";
import { episodeEvents, episodeOf } from "./src/v2/episodes.mjs";

const OUT = "out/v2";
const PORT = 3997;
let serveUrl;
const getBundle = async () => (serveUrl ??= await bundle({ entryPoint: resolve("src/index.ts") }));
process.on("exit", () => serveUrl && rmSync(serveUrl, { recursive: true, force: true }));

const dirOf = (id, variant) => `${OUT}/audio/${id}-${variant}`;

function audio(kind, id, variant = "nomusic") {
  const data = kind === "film" ? filmEvents(id, variant === "music") : episodeEvents(id);
  // Gate F V3.1: the V2 line uses the approved recorded bed C (Higgsfield, conformed to 108 BPM) instead of the
  // synthesized Gate D candidates; it enters on the snap and follows the film's envelope
  if (kind === "film" && variant === "music") {
    Object.assign(data, { music: false, bed_file: "out/v3/music/bed-C-60s.wav", bed_from: data.music_env[1][0], music_under_lu: 6, wav_tp: -3.2 });
    data.music_env = [...data.music_env, [data.frames - 30, 0], [data.frames - 2, -60]];
  }
  if (kind === "film" && variant !== "music") data.wav_tp = -3.2;
  if (kind !== "film") data.wav_tp = -3;
  const d = dirOf(id, kind === "film" ? variant : "sfx");
  mkdirSync(d, { recursive: true });
  writeFileSync(`${d}/events.json`, JSON.stringify(data, null, 1));
  console.log(`${d}/events.json  ${data.events.length} events, ${data.frames} frames, target ${data.target_lufs} LUFS`);
  execFileSync("python", ["audio/mix_v2.py", d], { stdio: "inherit" });
  execFileSync("python", ["audio/verify.py", d], { stdio: "inherit" });
}

async function render(kind, id) {
  const s = await getBundle();
  mkdirSync(`${OUT}/video`, { recursive: true });
  const compId = kind === "film" ? "V2-Film" : "V2-Episode";
  const props = kind === "film" ? { cut: id } : { ep: id };
  const comp = await selectComposition({ serveUrl: s, id: compId, inputProps: props, port: PORT });
  const out = resolve(`${OUT}/video/${id}-picture.mp4`);
  const t0 = Date.now();
  await renderMedia({ serveUrl: s, composition: comp, inputProps: props, codec: "h264", crf: 16, muted: true, outputLocation: out, concurrency: Number(process.env.CONC ?? 4), x264Preset: "slow", pixelFormat: "yuv420p", colorSpace: "bt709", port: PORT });
  console.log(`${out}  ${comp.durationInFrames} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

const ffLoud = (path) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 }); // ebur128 logs every 100 ms: long films exceed the 1 MB default
  const sum = r.stderr.slice(r.stderr.lastIndexOf("Summary:"));
  return { I: Number(/I:\s+(-?[\d.]+) LUFS/.exec(sum)?.[1]), TP: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(sum)?.[1]) };
};

function mux(id, variant) {
  const d = dirOf(id, variant);
  const data = JSON.parse(readFileSync(`${d}/events.json`, "utf8"));
  const target = data.target_lufs;
  const pic = `${OUT}/video/${id}-picture.mp4`;
  mkdirSync(`${OUT}/mp4`, { recursive: true });
  const out = `${OUT}/mp4/${id}-${variant}.mp4`;
  let gain = 0;
  let m;
  for (let i = 0; i < 14; i++) {
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", pic, "-i", `${d}/mix.wav`, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-af", `volume=${gain.toFixed(2)}dB,${process.env.COMP ? "acompressor=threshold=-20dB:ratio=3:attack=4:release=90:knee=4," : ""}alimiter=limit=${(10 ** (Number(process.env.LIMIT ?? -1.6) / 20)).toFixed(4)}:attack=1:release=60:level=disabled`, "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-shortest", "-movflags", "+faststart", out]);
    m = ffLoud(out);
    console.log(`${id}-${variant}: gain ${gain.toFixed(2)} dB → I ${m.I} LUFS, TP ${m.TP} dBTP`);
    if (m.TP <= -1.2 && Math.abs(m.I - target) <= 0.3) break; // 0.2 dB margin under the -1 dBTP ceiling
    const step = Math.min(target - m.I, -1.3 - m.TP);
    gain += Math.max(-4, Math.min(4, Math.abs(step) < 0.05 ? -0.1 : step));
  }
  const silent = `${OUT}/mp4/${id}-silent.mp4`;
  copyFileSync(pic, silent);
  const p = `${OUT}/loudness.json`;
  const all = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
  all[`${id}-${variant}`] = { file: out, target, ...m, gain_dB: +gain.toFixed(2), MB: +(statSync(out).size / 1e6).toFixed(1), seconds: data.frames / 30 };
  writeFileSync(p, JSON.stringify(all, null, 1));
}

function qa(id, variant) {
  const mp4 = `${OUT}/mp4/${id}-${variant}.mp4`;
  const scenes = FILMS[id]?.scenes ?? episodeOf(id)?.beats;
  const d = `${OUT}/qa/${id}-${variant}`;
  rmSync(d, { recursive: true, force: true });
  mkdirSync(`${d}/full`, { recursive: true });
  mkdirSync(`${d}/phone`, { recursive: true });
  const picks = [{ f: 0, id: "first" }];
  scenes.forEach((s, i) => [0.15, 0.5, 0.85].forEach((q) => picks.push({ f: s.from + Math.round(q * (s.to - s.from)), id: s.id ?? `b${i + 1}` })));
  for (const p of picks) {
    const name = `${String(p.f).padStart(4, "0")}-${p.id}.png`;
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", ((p.f + 0.5) / 30).toFixed(3), "-i", mp4, "-frames:v", "1", `${d}/full/${name}`]);
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", `${d}/full/${name}`, "-vf", "scale=640:-2:flags=lanczos", `${d}/phone/${name}`]);
  }
  execFileSync("python", ["audio/sheet.py", `${d}/phone`, `${d}/sheet-phone.png`, "5"]);
  console.log(`${d}: ${picks.length} frames`);
}

const [cmd, a, b, c] = process.argv.slice(2);
if (cmd === "audio") audio(a, b, c);
else if (cmd === "render") await render(a, b);
else if (cmd === "mux") mux(a, b);
else if (cmd === "qa") qa(a, b);
else console.log("usage: ./run.sh v2.mjs audio|render|mux|qa …");
