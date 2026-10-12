// Prints the distinct failures of the last Playwright run (e2e/.results/report.json), grouped by message.
import { readFileSync } from "node:fs";
const r = JSON.parse(readFileSync(new URL("./.results/report.json", import.meta.url), "utf8"));
const seen = new Map();
const strip = (s) => s.replace(/\u001b\[[0-9;]*m/g, "");
function walk(s, project) {
  for (const sp of s.specs ?? [])
    for (const t of sp.tests)
      for (const res of t.results)
        for (const e of res.errors ?? []) {
          const lines = strip(e.message ?? "").split("\n").filter((l) => /^[+-] /.test(l) || /^Error/.test(l) || /^\s+at |^Expected|^Received/.test(l) === false && /^\s*[+-]/.test(l));
          const key = lines.join("\n").slice(0, Number(process.env.W ?? 900));
          (seen.get(key) ?? seen.set(key, []).get(key)).push(`${t.projectName}: ${sp.title}`);
        }
  (s.suites ?? []).forEach((c) => walk(c));
}
r.suites.forEach((s) => walk(s));
for (const [k, v] of seen) console.log(`### ${v.length}x  ${[...new Set(v)].slice(0, 4).join(" | ")}\n${k}\n`);
console.log(`stats: ${JSON.stringify(r.stats)}`);
