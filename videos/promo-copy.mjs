// Writes PROMO_COPY.md from src/promo/copy.json and timeline.mjs (the same data the picture uses). All Pending Review.
//   node promo-copy.mjs
import { writeFileSync } from "node:fs";
import { COPY, CUTS, promoTimeline } from "./src/promo/timeline.mjs";

const t = (f) => `${Math.floor(f / 30 / 60)}:${String(((f / 30) % 60).toFixed(1)).padStart(4, "0")}`;
const line = (s) => {
  if (s.kind === "slam2" || s.kind === "question" || s.kind === "status") return { screen: `Opening ${s.hook}: ${s.props.text}`, caption: "(the hook is the caption)" };
  if (s.kind === "words") return { screen: s.props.lines.join(" / "), caption: s.props.lines.join(" ") };
  if (s.kind === "merge") return { screen: `Cards “${s.props.items.join("”, “")}” merge into “${s.props.pill}”; ${s.props.headline}`, caption: s.props.headline };
  if (s.kind === "brand") return { screen: `MEET · ${COPY.brand} · ${COPY.kicker}, ${COPY.region}`, caption: s.caption };
  if (s.kind === "service") return { screen: `0${s.props.n} ${s.props.title} · ${s.props.sub}`, caption: s.caption };
  if (s.kind === "steps") return { screen: `How it works: 1 ${s.props.items[0]} · 2 ${s.props.items[1]} · 3 ${s.props.items[2]}`, caption: s.caption ?? "(steps are the caption)" };
  if (s.kind === "screen") return { screen: `Real capture: ${s.scr.kicker}${s.props.word ? ` · keyword “${s.props.word}”` : ""}${(s.scr.callouts ?? []).length ? ` · callouts: ${s.scr.callouts.map((c) => `“${c.text}”`).join(", ")}` : ""}`, caption: s.caption };
  if (s.kind === "trio") return { screen: `Chips ${s.props.chips.join(" · ")}; ${s.props.headline}`, caption: s.props.headline };
  if (s.kind === "trust") return { screen: s.props.text, caption: s.props.text };
  if (s.kind === "cta") return { screen: s.props.text, caption: s.props.text };
  if (s.kind === "end") return { screen: `Mark, “${COPY.brand}”, “${COPY.tagline}”, button “${s.props.cta} →”, ${COPY.url}`, caption: s.caption ?? "(end card text)" };
  if (s.kind === "loop") return { screen: `Mark and wordmark; “Your catalog · Your prices · Your orders” glow in turn; two real phone screens float behind`, caption: "(silent, no captions)" };
  return { screen: s.kind, caption: s.caption ?? "" };
};

const L = [
  "# Promo Copy: Olleik Foods",
  "",
  "**Status: every line in this file is PENDING REVIEW** (owner and client). Nothing is approved. Generated from",
  "`src/promo/copy.json` and `src/promo/timeline.mjs` by `node promo-copy.mjs`, so it always matches the picture.",
  "",
  "## Compliance applied (see PROJECT_BRIEF.md section 8)",
  "",
  "- No prices, discounts, minimums, terms, delivery times or windows, stock counts, statistics, testimonials, customer names,",
  "  comparisons with other suppliers, guarantees, or health / allergen / freshness / origin claims in any line.",
  "- Every promise is a product fact verified in the code: per-customer catalog and prices, online ordering with delivery or",
  "  pickup and a note, order statuses Received → Confirmed → Ready → Completed, orders confirmed by the team, online application.",
  "- Product screens are real captures from a local copy with fictional demo data; the demo prices visible inside the phone",
  "  screens are UI texture, never mentioned in a caption. No admin screens in any promo cut.",
  "- Open question for the owner: the end card shows `olleik-foods-site.vercel.app` (the live address). If a custom domain",
  "  (for example olleikfoods.com, used in the site's email) will be live at launch, it should replace it before rendering.",
  "",
  "## Hooks (8 options; the first 2.5 s)",
  "",
  "| Id | On-screen text | First visual | Rendered as an opening | Status |",
  "|---|---|---|---|---|",
  ...Object.entries(COPY.hooks).map(([k, h]) => `| ${k} | ${h.text} | ${h.visual} | ${h.render ? "**yes**" : "option"} | Pending Review |`),
  "",
  "Chosen openings to render and A/B test: **H1** (brand promise, strongest on mute), **H2** (problem question, best for cold",
  "audiences), **H7** (the product's own four status chips: most product-specific). H2's three bubbles are illustrative",
  "message texts (“Price list attached (v3)”, “Need 4 cases for Friday?”, “Is it on the truck yet?”), not quotes from anyone.",
  "",
  "## Lines used across the cuts",
  "",
  `- Problem: ${COPY.problem.map((p) => `“${p}”`).join(" ")} → Answer: “${COPY.answer}” (Pending Review)`,
  `- Promises: ${COPY.promises.map((p) => `“${p.title}: ${p.sub}”`).join(" · ")} (Pending Review)`,
  `- How it works: ${COPY.steps.map((p, i) => `${i + 1} “${p}”`).join(" · ")} (taken from the site's own How it works) (Pending Review)`,
  `- Trust line: “${COPY.trust}” (true: every order starts as Received and is confirmed by the admin) (Pending Review)`,
  `- Call to action: “${COPY.ctaLine}” · button “${COPY.cta}” (the site's own button) · ${COPY.url}; approved-customer cut: “Sign in and order.” · “Sign in to order” (Pending Review)`,
  `- Tagline on the end card: “${COPY.tagline}” (the site's hero line) (Pending Review)`,
  "",
];
for (const [id, c] of Object.entries(CUTS)) {
  const T = promoTimeline(id);
  L.push(`## Cut: ${c.title} (\`${id}\`, ${c.w}×${c.h}${c.square ? " + 1080×1080" : ""}, ${c.beats / 2} s${c.openings.filter(Boolean).length ? `, openings ${c.openings.join(" / ")}` : ""})`, "", "| Scene | Time | Part | On screen | Caption (burned in) | Status |", "|---|---|---|---|---|---|");
  for (const s of T.scenes) {
    const x = line(s);
    L.push(`| ${s.id} | ${t(s.from)}–${t(s.to)} | ${s.part} | ${x.screen} | ${x.caption ?? ""} | Pending Review |`);
  }
  L.push("");
}
writeFileSync("PROMO_COPY.md", L.join("\n"));
console.log("PROMO_COPY.md", L.length, "lines");
