// Writes scripts/<VIDEO>.md (captions, timing, screens, chapters) from src/data/<VIDEO>.json. All copy is Pending Review.
//   node scripts.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const reading = (c) => (c ? Math.max(2.5, c.split(/\s+/).length / 3 + 1) : 0);
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
mkdirSync("scripts", { recursive: true });
for (const v of ["VISITOR", "ADMIN"]) {
  const d = JSON.parse(readFileSync(`src/data/${v}.json`, "utf8"));
  let t = 0;
  const rows = [];
  const chapters = [];
  for (const b of d.beats) {
    const len = Math.max(b.targetSeconds, reading(b.caption), b.kind === "chapter" ? 2 : 0);
    if (b.kind === "chapter") chapters.push(`- ${fmt(t)} Chapter ${b.chapter.n}: ${b.chapter.title}`);
    const what = b.kind === "screen" ? (b.shots ?? []).join(" → ") : b.kind === "card" ? `card: ${b.card.title} (${b.card.lines.join(" / ")})` : b.kind === "chapter" ? `chapter card ${b.chapter.n}: ${b.chapter.title}` : b.kind === "outro" ? `logo, ${(b.urls ?? []).join(", ")}${b.cta ? `, button “${b.cta}”` : ""}` : "logo intro: mark draws in, wordmark, tagline";
    const act = [b.typing ? `types ${b.typing.map((x) => (x.secret ? "•••" : `“${x.text}”`)).join(", ")}` : "", b.click ? `clicks ${b.click}` : "", b.ring ? `ring ${[].concat(b.ring).join(" + ")}` : ""].filter(Boolean).join("; ");
    rows.push(`| ${b.id} | ${fmt(t)} | ${len.toFixed(1)} s | ${b.step ?? ""} | ${b.caption ?? (b.kind === "chapter" ? b.chapter.title : "")} | ${what}${act ? ` (${act})` : ""} | Pending Review |`);
    t += len;
  }
  const md = `# ${d.title}: Script

Video ${v}, 1920×1080${v === "VISITOR" ? " plus a 1080×1920 vertical cut" : ""}. Planned length ${fmt(t)} (before the final timing pass). No voiceover: the captions carry
everything; sound = UI clicks, blue-switch typing, soft whooshes and a low music bed. Every line below is **Pending Review**.
Screens are real captures of the product running locally with fictional demo data (see PROJECT_BRIEF.md).

${chapters.length ? `## Chapters\n\n${chapters.join("\n")}\n` : ""}
## Beats

| Beat | Start | Length | Step | On-screen caption | Screen and action | Status |
|---|---|---|---|---|---|---|
${rows.join("\n")}
`;
  writeFileSync(`scripts/${v}.md`, md);
  console.log(`scripts/${v}.md  ${d.beats.length} beats, ${fmt(t)}`);
}
