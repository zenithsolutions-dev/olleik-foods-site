// Writes EPISODE_PLAN_V2.md from src/v2/episodes.mjs (the same data the V2 manual compositions use). All Pending Review.
import { writeFileSync } from "node:fs";
import { EPISODES } from "./src/v2/episodes.mjs";

const t = (f) => `${Math.floor(f / 30 / 60)}:${String(Math.floor((f / 30) % 60)).padStart(2, "0")}`;
const L = [
  "# Episode Plan V2: the visitor manual and five admin episodes",
  "",
  "**Status: all captions Pending Review.** Generated from `src/v2/episodes.mjs` by `node episode-plan.mjs`; storyboards in",
  "`out/storyboards/v2/V2-<EPISODE>-storyboard.png`. Same world as the hero film: Marco guides the visitor manual, Salma guides",
  "the admin episodes. Every screen is a real capture from the local demo copy (fictional data). Style: the guide in a round",
  "window reacting (point, thumbs up, nod, blink), the camera easing onto the active control, a hand-drawn marker circle and",
  "arrow drawing on, step numbers printing as small order tickets, a burned-in English caption, SRT alongside, no voiceover.",
  "Admin episodes open with a one-line problem, show the fix, and end with a “Coming up” tease (episode 5 ends the tour).",
  "",
  "Brief vs product: the brief's episode 5 is “Invites and settings”. The product has **no settings page** (business details",
  "live in code, `src/lib/business.ts`, still placeholders). Episode 5 is therefore **“Invites and Access”**: the portal",
  "invite on the customer page, catalog visibility, and the admin email allowlist. If a settings page is built later, a",
  "short episode 6 can be added.",
  "",
  "| Episode | Length | Guide | Beats |",
  "|---|---|---|---|",
  ...EPISODES.map((e) => `| ${e.title} | ${t(e.frames)} (${e.length}) | ${e.guide === "marco" ? "Marco" : "Salma"} | ${e.beats.length} |`),
  "",
];
for (const e of EPISODES) {
  L.push(`## ${e.title}`, "", "| # | Time | Kind | Screen (real capture) | Callout on | Step | Caption / line | Guide | Status |", "|---|---|---|---|---|---|---|---|---|");
  e.beats.forEach((b, i) => {
    const screen = b.kind === "screen" ? `${b.shot}${b.then ? ` → ${b.then}` : ""}` : "—";
    const line = b.caption ?? b.line ?? b.title ?? "";
    L.push(`| ${i + 1} | ${t(b.from)} | ${b.kind} | ${screen} | ${b.box ?? "—"} | ${b.step ?? ""} | ${line} | ${b.gesture ?? (b.kind === "screen" ? "focus" : "")} | Pending Review |`);
  });
  L.push("");
}
L.push("## Deliverables per episode (after Go)", "", "1920×1080 30 fps H.264 with sound design (no-music and quiet-bed versions), burned-in English captions, a separate SRT,", "a poster, and for the visitor manual a 1080×1920 vertical cut. Re-capture only if a scene needs a new angle.", "");
writeFileSync("EPISODE_PLAN_V2.md", L.join("\n"));
console.log("EPISODE_PLAN_V2.md", EPISODES.map((e) => `${e.id} ${t(e.frames)}`).join(", "));
