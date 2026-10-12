// SRT for the V2 manual proofs (same lines as on screen: titles, problem and next lines, captions).
//   node qa/srt_v2.mjs <EPISODE_ID> <out.srt>
import { writeFileSync } from "node:fs";
import { episodeOf } from "../src/v2/episodes.mjs";
const [id, out] = process.argv.slice(2);
const E = episodeOf(id);
const ts = (f) => { const ms = Math.round((f / 30) * 1000); const p = (n, w = 2) => String(n).padStart(w, "0"); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
const lines = E.beats.flatMap((b) => {
  const t = b.kind === "screen" ? b.caption : b.kind === "title" ? `${b.title} · ${b.line}` : b.line;
  return t ? [{ from: b.from + 3, to: b.to - 1, text: t }] : [];
});
writeFileSync(out, lines.map((l, i) => `${i + 1}\n${ts(l.from)} --> ${ts(l.to)}\n${l.text}\n`).join("\n"));
console.log(out, lines.length, "cues");
