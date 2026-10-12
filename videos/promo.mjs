// Promo tooling (adapted from the reference toolkit). Run through ./run.sh so Remotion's temp files go to D:.
//   ./run.sh promo.mjs audio <cut> [opening] [cand]    events.json → mix3 (music + real-recording SFX) → verify
//   ./run.sh promo.mjs render <cut> [opening]          muted picture (h264) per opening (+ 1:1 for cuts marked square)
//   ./run.sh promo.mjs mux <cut> [opening] [cand]      AAC mux with an encode → measure → adjust loop (−14 LUFS, TP ≤ −1 dBTP)
//   ./run.sh promo.mjs qa <cut> [opening] [cand]       frames from the actual MP4 at full and phone size + contact sheet
//   ./run.sh promo.mjs music                           music review pack: each candidate alone (master, short, bumper edits + stems)
// Outputs: out/promo/{audio,video,mp4,silent,qa,music}/…
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { CUTS, promoEvents, promoTimeline } from "./src/promo/timeline.mjs";

const OUT = "out/promo";
const LEN = (cut) => `${CUTS[cut].beats / 2}s`;
const FMT = (cut, square) => (square ? "1x1" : CUTS[cut].w > CUTS[cut].h ? "16x9" : "9x16");
export const fileBase = (cut, op, square = false) => `${cut}-${LEN(cut)}-${FMT(cut, square)}${op ? `-${op}` : ""}`;
const tag = (cut, op, cand = "A") => `${cut}-${op ?? "loop"}-${cand}`;
const openingsOf = (cut, only) => (only && only !== "-" ? [only] : CUTS[cut].openings);

let serveUrl;
const getBundle = async () => (serveUrl ??= await bundle({ entryPoint: resolve("src/index.ts") }));
process.on("exit", () => {
  if (serveUrl) rmSync(serveUrl, { recursive: true, force: true });
});

function audio(cut, only, cand = "A") {
  const dirs = [];
  for (const op of openingsOf(cut, only)) {
    const d = `${OUT}/audio/${tag(cut, op, cand)}`;
    mkdirSync(d, { recursive: true });
    const e = { ...promoEvents(cut, op), cand };
    writeFileSync(`${d}/events.json`, JSON.stringify(e, null, 1));
    console.log(`${d}/events.json  ${e.events.length} events, ${e.frames} frames`);
    dirs.push(d);
  }
  execFileSync("python", ["audio/mix3.py", ...dirs], { stdio: "inherit" });
  execFileSync("python", ["audio/verify.py", ...dirs], { stdio: "inherit" });
}

async function render(cut, only) {
  const s = await getBundle();
  mkdirSync(`${OUT}/video`, { recursive: true });
  for (const op of openingsOf(cut, only)) {
    for (const square of CUTS[cut].square ? [false, true] : [false]) {
      const id = square ? `Promo-${cut}-square` : `Promo-${cut}`;
      const props = { cut, opening: op, audio: false };
      const comp = await selectComposition({ serveUrl: s, id, inputProps: props, port: 3997 });
      const out = resolve(`${OUT}/video/${fileBase(cut, op, square)}-picture.mp4`);
      const t0 = Date.now();
      await renderMedia({ serveUrl: s, composition: comp, inputProps: props, codec: "h264", crf: 16, muted: true, outputLocation: out, concurrency: Number(process.env.CONC ?? 4), x264Preset: "slow", pixelFormat: "yuv420p", colorSpace: "bt709", port: 3997 });
      console.log(`${out}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
  }
}

/** Integrated loudness and true peak of an encoded file (ffmpeg ebur128, measured after encoding). */
const ffLoud = (path) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" });
  const sum = r.stderr.slice(r.stderr.lastIndexOf("Summary:"));
  return { I: Number(/I:\s+(-?[\d.]+) LUFS/.exec(sum)?.[1]), TP: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(sum)?.[1]) };
};

function mux(cut, only, cand = "A") {
  const res = {};
  mkdirSync(`${OUT}/mp4`, { recursive: true });
  mkdirSync(`${OUT}/silent`, { recursive: true });
  for (const op of openingsOf(cut, only)) {
    for (const square of CUTS[cut].square ? [false, true] : [false]) {
      const base = fileBase(cut, op, square);
      const pic = `${OUT}/video/${base}-picture.mp4`;
      if (!existsSync(pic)) throw new Error(`missing ${pic}`);
      copyFileSync(pic, `${OUT}/silent/${base}-silent.mp4`);
      if (CUTS[cut].silent) continue;
      const ad = `${OUT}/audio/${tag(cut, op, cand)}`;
      if (!existsSync(`${ad}/mix-aac.wav`)) execFileSync("python", ["audio/tp_fix.py", ad], { stdio: "inherit" });
      const wav = `${ad}/mix-aac.wav`;
      const out = `${OUT}/mp4/${base}-music-${cand}.mp4`;
      let gain = 0;
      let m;
      for (let i = 0; i < 6; i++) {
        execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", pic, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-af", `volume=${gain.toFixed(2)}dB`, "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-shortest", "-movflags", "+faststart", out]);
        m = ffLoud(out);
        console.log(`${base}: gain ${gain.toFixed(2)} → I ${m.I} LUFS, TP ${m.TP} dBTP`);
        if (m.TP <= -1.0 && Math.abs(m.I + 14) <= 0.5) break;
        const step = Math.min(-14 - m.I, -1.1 - m.TP);
        gain += Math.max(-0.5, Math.min(0.5, Math.abs(step) < 0.05 ? -0.1 : step));
      }
      res[base] = { ...m, gain_dB: +gain.toFixed(2), MB: +(statSync(out).size / 1e6).toFixed(1) };
    }
  }
  const p = `${OUT}/loudness.json`;
  const all = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
  writeFileSync(p, JSON.stringify({ ...all, ...res }, null, 1));
  console.log(res);
}

function qa(cut, only, cand = "A") {
  for (const op of openingsOf(cut, only)) {
    for (const square of CUTS[cut].square ? [false, true] : [false]) {
      const base = fileBase(cut, op, square);
      const mp4 = CUTS[cut].silent ? `${OUT}/silent/${base}-silent.mp4` : `${OUT}/mp4/${base}-music-${cand}.mp4`;
      const T = promoTimeline(cut, op);
      const d = `${OUT}/qa/${base}`;
      rmSync(d, { recursive: true, force: true });
      mkdirSync(`${d}/full`, { recursive: true });
      mkdirSync(`${d}/phone`, { recursive: true });
      const picks = [{ f: 0, id: "first-frame" }];
      for (const s of T.scenes) for (const q of [0.12, 0.45, 0.8, 0.97]) picks.push({ f: s.from + Math.round(q * s.len), id: s.id });
      for (const p of picks) {
        const name = `${String(p.f).padStart(4, "0")}-${p.id}.png`;
        execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", ((p.f + 0.5) / 30).toFixed(3), "-i", mp4, "-frames:v", "1", `${d}/full/${name}`]);
        const w = T.w > T.h ? 640 : 360;
        execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", `${d}/full/${name}`, "-vf", `scale=${w}:-2:flags=lanczos`, `${d}/phone/${name}`]);
      }
      execFileSync("python", ["audio/sheet.py", `${d}/phone`, `${d}/sheet-phone.png`, String(T.w > T.h ? 4 : 8)]);
      console.log(`${d}: ${picks.length} frames`);
    }
  }
}

/** Music review pack: every candidate alone, following the scene map of the master, the short cut and the bumper. */
function music() {
  const d = `${OUT}/music`;
  mkdirSync(d, { recursive: true });
  const jobs = [];
  for (const cut of ["master", "short45", "bumper"]) {
    const e = promoEvents(cut, CUTS[cut].openings[0]);
    writeFileSync(`${d}/${cut}-map.json`, JSON.stringify({ music: e.music, frames: e.frames }));
    jobs.push(cut);
  }
  execFileSync("python", ["audio/music_pack.py", d, ...jobs], { stdio: "inherit" });
}

const [cmd, cut, a3, a4] = process.argv.slice(2);
if (cmd === "audio") audio(cut, a3, a4 ?? "A");
else if (cmd === "render") await render(cut, a3);
else if (cmd === "mux") mux(cut, a3, a4 ?? "A");
else if (cmd === "qa") qa(cut, a3, a4 ?? "A");
else if (cmd === "music") music();
else console.log("usage: ./run.sh promo.mjs audio|render|mux|qa <cut> [opening] [cand] | music");
