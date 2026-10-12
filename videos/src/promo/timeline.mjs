// The Olleik Foods promo: one timing model for picture and sound (structure from the reference toolkit).
// Promo.tsx animates from `promoTimeline(cutId, opening)`; the audio pipeline (promo.mjs → audio/mix3.py) places every
// sound from `promoEvents(...)`, built from the same numbers. Copy comes from copy.json (all Pending Review).
// Tempo: the cut grid follows the music. Candidate A ("Market Morning") is 120 BPM = 15 frames a beat at 30 fps.
import P from "./copy.json" with { type: "json" };
import M from "../../public/footage/manifest.json" with { type: "json" };

export const FPS = 30;
export const BPM = 120;
export const BEAT = (FPS * 60) / BPM; // 15
export const b = (n) => Math.round(n * BEAT);
export const COPY = P;
/** Frames the incoming scene overlaps the outgoing one (the outgoing keeps rendering underneath). */
export const OVERLAP = 12;

export const typeFrames = (text, at, cps) => {
  const out = [];
  let f = at;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    out.push({ f: Math.round(f), ch });
    const jitter = ((i * 7919) % 7) / 7 - 0.45;
    f += FPS / cps + jitter + (ch === " " || ch === "@" ? (FPS / cps) * 0.7 : 0);
  }
  return out;
};
const box = (shot, name) => {
  const r = M.shots[shot]?.boxes?.[name];
  if (!r) throw new Error(`promo: box ${name} not measured on ${shot}`);
  return r;
};
const ctr = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

// ——— Scene lists ————————————————————————————————————————————————————————————————————————————————————————
const S = (id, kind, a, z, extra = {}) => ({ id, kind, beats: [a, z], in: "cut", ...extra });
const [P1, P2, P3] = P.promises.map((p, i) => ({ ...p, tone: ["teal", "orange", "paper"][i] }));
const PROBLEM = { lines: P.problem };
const MERGE = { items: ["Price lists", "Texts", "Calls"], headline: P.answer, pill: "One portal" };
const STEPS = { items: P.steps };
const TRIO = { headline: P.trio, chips: ["Catalog", "Prices", "Orders"] };

export const CUTS = {
  master: {
    title: "Master Promo", w: 1920, h: 1080, beats: 120, openings: ["H1", "H2", "H7"],
    scenes: [
      S("M01", "hook", 0, 5, { part: "Hook" }),
      S("M02", "words", 5, 10, { in: "wipe", part: "Problem", props: PROBLEM }),
      S("M03", "merge", 10, 16, { in: "push", part: "Answer", props: MERGE }),
      S("M04", "brand", 16, 22, { in: "circle", part: "Answer", caption: "Meet Olleik Foods: wholesale food supply, Ottawa region." }),
      S("M05", "service", 22, 28, { in: "wipe", part: "Answer", props: P1, caption: "Your catalog shows only the products set up for you." }),
      S("M06", "service", 28, 34, { in: "push", part: "Answer", props: P2, caption: "Every item at your account's price." }),
      S("M07", "service", 34, 40, { in: "push", part: "Answer", props: P3, caption: "Order online and follow it to completed." }),
      S("M08", "steps", 40, 46, { in: "wipe", part: "How it works", props: STEPS, caption: "Apply online, we set up your account, you order." }),
      S("M09", "screen", 46, 54, { in: "slide", part: "How it works", props: { screen: "apply-d" }, caption: "Apply for a wholesale account in one short form." }),
      S("M10", "screen", 54, 62, { in: "push", part: "How it works", props: { screen: "catalog-p", word: "Your price" }, caption: "Sign in to your catalog, at your prices." }),
      S("M11", "screen", 62, 70, { part: "How it works", props: { screen: "checkout-p", word: "Checkout" }, caption: "Choose delivery or pickup and leave a note." }),
      S("M12", "screen", 70, 77, { in: "circle", part: "How it works", props: { screen: "placed-p", word: "Received" }, caption: "Your order goes straight to the Olleik team." }),
      S("M13", "screen", 77, 84, { in: "slide", part: "How it works", props: { screen: "orders-p", word: "Every order" }, caption: "Follow every order to completed." }),
      S("M14", "trio", 84, 90, { in: "wipe", part: "Answer", props: TRIO }),
      S("M15", "trust", 90, 98, { in: "push", part: "Trust", props: { text: P.trust } }),
      S("M16", "cta", 98, 108, { in: "wipe", part: "Call to action", props: { text: P.ctaLine } }),
      S("M17", "end", 108, 120, { in: "circle", part: "Call to action", caption: `${P.cta} at ${P.url}` }),
    ],
  },
  short45: {
    title: "Short Promo", w: 1080, h: 1920, beats: 90, openings: ["H1", "H2", "H7"],
    scenes: [
      S("S01", "hook", 0, 5, { part: "Hook" }),
      S("S02", "words", 5, 10, { in: "wipe", part: "Problem", props: PROBLEM }),
      S("S03", "merge", 10, 15, { in: "push", part: "Answer", props: MERGE }),
      S("S04", "service", 15, 20, { in: "wipe", part: "Answer", props: P1, caption: "Only the products set up for you." }),
      S("S05", "service", 20, 25, { in: "push", part: "Answer", props: P2, caption: "Every item at your account's price." }),
      S("S06", "service", 25, 30, { in: "push", part: "Answer", props: P3, caption: "Order online, follow it to completed." }),
      S("S07", "steps", 30, 36, { in: "wipe", part: "How it works", props: STEPS }),
      S("S08", "screen", 36, 44, { in: "slide", part: "How it works", props: { screen: "apply-p" }, caption: "Apply in one short form." }),
      S("S09", "screen", 44, 51, { in: "push", part: "How it works", props: { screen: "catalog-p" }, caption: "Your catalog, at your prices." }),
      S("S10", "screen", 51, 58, { part: "How it works", props: { screen: "checkout-p" }, caption: "Delivery or pickup, with a note." }),
      S("S11", "screen", 58, 64, { in: "circle", part: "How it works", props: { screen: "placed-p" }, caption: "Straight to the Olleik team." }),
      S("S12", "screen", 64, 70, { in: "slide", part: "How it works", props: { screen: "orders-p" }, caption: "Follow every order to completed." }),
      S("S13", "trust", 70, 76, { in: "push", part: "Trust", props: { text: P.trust } }),
      S("S14", "cta", 76, 82, { in: "wipe", part: "Call to action", props: { text: P.ctaLine } }),
      S("S15", "end", 82, 90, { in: "circle", part: "Call to action" }),
    ],
  },
  bumper: {
    title: "Bumper", w: 1080, h: 1920, square: true, beats: 40, openings: ["H1"],
    scenes: [
      S("B01", "hook", 0, 5, { part: "Hook" }),
      S("B02", "trio", 5, 11, { in: "wipe", part: "Answer", props: TRIO }),
      S("B03", "screen", 11, 19, { in: "slide", part: "How it works", props: { screen: "catalog-p" }, caption: "Your catalog, at your prices." }),
      S("B04", "screen", 19, 25, { in: "circle", part: "How it works", props: { screen: "orders-p" }, caption: "Follow every order to completed." }),
      S("B05", "cta", 25, 31, { in: "wipe", part: "Call to action", props: { text: P.ctaLine } }),
      S("B06", "end", 31, 40, { in: "circle", part: "Call to action" }),
    ],
  },
  "new-accounts": {
    title: "Angle: New Accounts", w: 1080, h: 1920, beats: 80, openings: ["H1"],
    scenes: [
      S("N01", "hook", 0, 5, { part: "Hook" }),
      S("N02", "words", 5, 10, { in: "wipe", part: "Problem", props: PROBLEM }),
      S("N03", "brand", 10, 16, { in: "circle", part: "Answer", caption: "Meet Olleik Foods: wholesale food supply, Ottawa region." }),
      S("N04", "steps", 16, 22, { in: "wipe", part: "How it works", props: STEPS }),
      S("N05", "screen", 22, 32, { in: "slide", part: "How it works", props: { screen: "apply-p" }, caption: "Apply in one short form." }),
      S("N06", "service", 32, 37, { in: "wipe", part: "Answer", props: P1, caption: "Only the products set up for you." }),
      S("N07", "service", 37, 42, { in: "push", part: "Answer", props: P2, caption: "Every item at your account's price." }),
      S("N08", "screen", 42, 50, { in: "slide", part: "How it works", props: { screen: "catalog-p" }, caption: "Order from your phone." }),
      S("N09", "trust", 50, 56, { in: "push", part: "Trust", props: { text: P.trust } }),
      S("N10", "cta", 56, 64, { in: "wipe", part: "Call to action", props: { text: P.ctaLine } }),
      S("N11", "end", 64, 80, { in: "circle", part: "Call to action" }),
    ],
  },
  "approved-customers": {
    title: "Angle: Approved Customers", w: 1080, h: 1920, beats: 80, openings: ["H7"], cta: "Sign in to order", ctaLine: "Sign in and order.",
    scenes: [
      S("A01", "hook", 0, 5, { part: "Hook" }),
      S("A02", "words", 5, 10, { in: "wipe", part: "Problem", props: { lines: P.problem.slice(1).concat(["All in one portal now."]) } }),
      S("A03", "screen", 10, 16, { in: "slide", part: "How it works", props: { screen: "portal-p" }, caption: "Your portal: your catalog and your offers." }),
      S("A04", "screen", 16, 24, { in: "push", part: "How it works", props: { screen: "catalog-p" }, caption: "Your catalog, at your prices." }),
      S("A05", "screen", 24, 32, { part: "How it works", props: { screen: "checkout-p" }, caption: "Delivery or pickup, with a note." }),
      S("A06", "screen", 32, 38, { in: "circle", part: "How it works", props: { screen: "placed-p" }, caption: "Straight to the Olleik team." }),
      S("A07", "screen", 38, 45, { in: "slide", part: "How it works", props: { screen: "orders-p" }, caption: "Follow every order to completed." }),
      S("A08", "service", 45, 51, { in: "wipe", part: "Answer", props: P3, caption: "Placed online, followed to completed." }),
      S("A09", "trust", 51, 57, { in: "push", part: "Trust", props: { text: P.trust } }),
      S("A10", "cta", 57, 65, { in: "wipe", part: "Call to action", props: { text: "Sign in and order." } }),
      S("A11", "end", 65, 80, { in: "circle", part: "Call to action" }),
    ],
  },
  proof: {
    title: "20-Second Proof of the Look", w: 1920, h: 1080, beats: 40, openings: ["H1"],
    scenes: [
      S("P01", "hook", 0, 5, { part: "Hook" }),
      S("P02", "merge", 5, 11, { in: "wipe", part: "Answer", props: MERGE }),
      S("P03", "screen", 11, 19, { in: "slide", part: "How it works", props: { screen: "apply-d" }, caption: "Apply for a wholesale account in one short form." }),
      S("P04", "screen", 19, 26, { in: "push", part: "How it works", props: { screen: "catalog-p", word: "Your price" }, caption: "Sign in to your catalog, at your prices." }),
      S("P05", "screen", 26, 32, { part: "How it works", props: { screen: "checkout-p", word: "Checkout" }, caption: "Choose delivery or pickup and leave a note." }),
      S("P06", "end", 32, 40, { in: "circle", part: "Call to action" }),
    ],
  },
  hero: { title: "Website Hero Loop", w: 1920, h: 1080, beats: 24, openings: [null], silent: true, loop: true, scenes: [S("L01", "loop", 0, 24, { part: "Loop" })] },
};

// ——— Product screens (captures in videos/public/footage, 3×; coordinates are the capture's CSS px) ———————————
const DEMO_NOTE = "Back door, before 9 please.";
const SCREENS = {
  "apply-d": (len) => {
    const sh = "visitor/apply-empty";
    const clicks = [];
    const cam = [];
    const typed = [];
    let f = b(0.75);
    for (const [name, text, cps] of [["businessName", "Riverbend Bistro", 16], ["contactName", "Clara Morin", 16], ["email", "riverbend@olleik-demo.test", 30]]) {
      const r = box(sh, name);
      clicks.push({ f, at: ctr(r) });
      cam.push({ f: f - 6, rect: r, z: 1.25 });
      const t = typeFrames(text, f + 6, cps);
      typed.push({ box: r, chars: t });
      f = t[t.length - 1].f + 8;
    }
    const sub = box(sh, "submit");
    const send = Math.min(f + 8, len - 26);
    cam.push({ f: send - 12, rect: { x: 689, y: 560, w: 542, h: 260 } });
    clicks.push({ f: send, at: ctr(sub), button: true });
    return {
      device: "browser", url: `${P.url}/apply`, kicker: "Apply Online", view: { x: 650, y: 236, w: 620, h: 610 }, frameW: 1100,
      shot0: sh, shots: [{ f: send - 2, src: "visitor/apply-filled", fade: true }], typed, typedUntil: send - 2, cam,
      cursor: [{ f: 3, x: 1180, y: 700 }, ...clicks.map((c) => ({ f: c.f, x: c.at.x - 40, y: c.at.y + 6 }))], clicks,
      callouts: [{ f: send + 8, at: ctr(sub), text: "Sent to the Olleik team" }],
    };
  },
  "apply-p": (len) => {
    const sh = "visitor/p-apply-empty";
    const clicks = [];
    const cam = [];
    const typed = [];
    let f = b(0.75);
    for (const [name, text, cps] of [["businessName", "Riverbend Bistro", 16], ["contactName", "Clara Morin", 16], ["email", "riverbend@olleik-demo.test", 30]]) {
      const r = box(sh, name);
      clicks.push({ f, at: ctr(r) });
      cam.push({ f: f - 6, rect: r, z: 1.2 });
      const t = typeFrames(text, f + 6, cps);
      typed.push({ box: r, chars: t });
      f = t[t.length - 1].f + 8;
    }
    const end = Math.min(f + 4, len - 10);
    cam.push({ f: end - 8, rect: { x: 0, y: 60, w: 390, h: 460 } });
    return {
      device: "phone", url: `${P.url}/apply`, kicker: "Apply Online", view: { x: 0, y: 0, w: 390, h: 844 },
      shot0: sh, shots: [{ f: end, src: "visitor/p-apply-filled", fade: true }], typed, typedUntil: end, cam,
      cursor: clicks.map((c) => ({ f: c.f, x: c.at.x + 60, y: c.at.y + 4 })), touch: true, clicks,
      callouts: [{ f: b(0.4), until: cam[1].f + 2, at: { x: 120, y: 117 }, text: "Your business", wideOnly: true }],
    };
  },
  "catalog-p": (len) => {
    const sh = "visitor/p-catalog-card";
    const badge = box(sh, "priceBadge");
    const add = box(sh, "addToCart");
    const tap = Math.round(len * 0.62);
    return {
      device: "phone", url: `${P.url}/portal/catalog`, kicker: "My Catalog", view: { x: 0, y: 0, w: 390, h: 844 },
      shot0: sh, shots: [{ f: tap + 3, src: "visitor/p-catalog-added", fade: true }],
      cam: [{ f: 2, rect: { x: 20, y: 380, w: 350, h: 200 }, z: 1.3 }, { f: tap - 10, rect: add, z: 1.3 }],
      cursor: [{ f: tap, ...ctr(add) }], touch: true, clicks: [{ f: tap, button: true }],
      rings: [{ f: b(0.75), until: tap - 4, rect: badge, radius: 10 }, { f: tap + 6, rect: box("visitor/p-catalog-added", "stepper"), radius: 10 }],
      callouts: [{ f: b(1), until: tap - 4, at: ctr(badge), text: "Your account's price" }],
    };
  },
  "checkout-p": (len) => {
    const sh = "visitor/p-checkout-filled";
    const del = box(sh, "delivery");
    const notes = box(sh, "notes");
    const sub = box(sh, "submit");
    const tap1 = b(0.75);
    const t = typeFrames(DEMO_NOTE, tap1 + 16, 22);
    const done = t[t.length - 1].f;
    const tap2 = Math.min(done + 12, len - 12);
    return {
      device: "phone", url: `${P.url}/portal/checkout`, kicker: "Checkout", view: { x: 0, y: 0, w: 390, h: 844 },
      shot0: sh, typed: [{ box: notes, chars: t, multiline: true }], typedUntil: len + 20,
      cam: [{ f: 2, rect: del, z: 1.25 }, { f: tap1 + 10, rect: notes, z: 1.25 }, { f: done, rect: sub, z: 1.2 }],
      cursor: [{ f: tap1, ...ctr(del) }, { f: tap2, ...ctr(sub) }], touch: true, clicks: [{ f: tap1 }, { f: tap2, button: true }],
      rings: [{ f: tap1 + 3, until: tap1 + 26, rect: del, radius: 12 }],
      callouts: [{ f: tap1 + 6, until: tap1 + 30, at: { x: del.x + 60, y: del.y + 20 }, text: "Delivery or pickup", wideOnly: true }],
    };
  },
  "placed-p": (len) => {
    const sh = "visitor/p-placed";
    const banner = box(sh, "banner");
    return {
      device: "phone", url: `${P.url}/portal/orders`, kicker: "Order Received", view: { x: 0, y: 0, w: 390, h: 844 },
      shot0: sh, cam: [{ f: 0, rect: { x: 20, y: 170, w: 350, h: 220 }, z: 1.2 }],
      rings: [{ f: b(0.5), rect: banner, radius: 12 }],
      pops: [{ f: b(0.25), rect: banner }],
      callouts: [{ f: b(1), at: { x: banner.x + 60, y: banner.y + banner.h }, text: "The team confirms it next", wideOnly: true }],
    };
  },
  "orders-p": (len) => {
    const sh = "visitor/p-orders";
    const first = box(sh, "first");
    return {
      device: "phone", url: `${P.url}/portal/orders`, kicker: "My Orders", view: { x: 0, y: 0, w: 390, h: 844 },
      shot0: sh, cam: [{ f: 0, rect: { x: 20, y: 320, w: 350, h: 420 }, z: 1.15 }],
      rings: [{ f: b(0.75), rect: first, radius: 12 }],
      callouts: [{ f: b(1.25), at: { x: 90, y: first.y + 62 }, text: "Every status, at a glance" }],
    };
  },
  "portal-p": (len) => {
    const sh = "visitor/p-portal";
    return {
      device: "phone", url: `${P.url}/portal`, kicker: "Your Portal", view: { x: 0, y: 0, w: 390, h: 844 },
      shot0: sh, cam: [{ f: 0, rect: { x: 20, y: 160, w: 350, h: 420 }, z: 1.15 }],
      rings: [{ f: b(0.75), until: b(2), rect: box(sh, "catalogCard"), radius: 14 }, { f: b(2), rect: box(sh, "offersCard"), radius: 14 }],
      callouts: [{ f: b(1), until: b(2), at: { x: 200, y: 351 }, text: "Your catalog", wideOnly: true }, { f: b(2.25), at: { x: 200, y: 497 }, text: "Your offers", wideOnly: true }],
    };
  },
};
export const screenRecipe = (name, len) => SCREENS[name](len);

// ——— Per-scene timing ————————————————————————————————————————————————————————————————————————————————————
function sceneT(kind, props, len) {
  switch (kind) {
    case "slam2": // H1
      return { a: 0, b: b(1), rule: b(1.5), sub: b(2.25), sweep: [b(3), b(4.5)] };
    case "question": // H2
      return { bubbles: [0, b(0.5), b(1)], head: b(2), accent: b(2.5) };
    case "status": // H7
      return { chips: [0, b(0.75), b(1.5), b(2.25)], line: b(3) };
    case "cta":
      return { words: props.text.split(" ").map((_, i) => b(i * 0.5)), rule: b(props.text.split(" ").length * 0.5) };
    case "trust":
      return { words: props.text.split(" ").map((_, i) => b(i * 0.35)), rule: b(props.text.split(" ").length * 0.35 + 0.5), quiet: len - b(1) };
    case "words":
      return { lines: props.lines.map((_, i) => b(i)), rule: 0 };
    case "merge":
      return { cards: [0, b(0.5), b(1)], converge: [b(1.5), b(2.5)], snap: b(2.5), head: b(3) };
    case "brand":
      return { mark: [0, b(1)], name: b(1), place: b(2), rule: b(2.5) };
    case "service":
      return { num: 0, icon: 2, title: b(0.5), sub: b(1.5) };
    case "trio":
      return { chips: [0, b(0.5), b(1)], bracket: [b(1.5), b(2.2)], head: b(2) };
    case "steps":
      return { heading: 0, nums: [b(0.5), b(1.5), b(2.5)], rule: b(3.5) };
    case "end": {
      const t = { mark: [0, b(1)], name: b(1), tagline: b(2), button: b(3), url: typeFrames(P.url, b(3.5), 22), tail: b(5), pulses: [] };
      for (let f = b(5.5); f < len - b(1); f += b(2)) t.pulses.push(f);
      return t;
    }
    default:
      return {};
  }
}
const HOOK_KIND = { H1: "slam2", H2: "question", H7: "status" };

/** The resolved timeline of one cut with one opening (hook id). */
export function promoTimeline(cutId, opening) {
  const cut = CUTS[cutId];
  const op = opening ?? cut.openings[0];
  const scenes = cut.scenes.map((s, i) => {
    const from = b(s.beats[0]);
    const to = b(s.beats[1]);
    const len = to - from;
    let kind = s.kind;
    let props = s.props ?? {};
    let caption = s.caption;
    if (kind === "hook") {
      kind = HOOK_KIND[op];
      props = { ...P.hooks[op] };
    }
    if (kind === "end") props = { ...props, cta: cut.cta ?? P.cta };
    const scr = kind === "screen" ? screenRecipe(props.screen, len) : null;
    return { ...s, i, kind, props, caption, from, to, len, render: len + (cut.scenes[i + 1] ? OVERLAP : 0), t: sceneT(kind, props, len), scr, hook: s.kind === "hook" ? op : null };
  });
  return { cutId, opening: op, w: cut.w, h: cut.h, frames: b(cut.beats), scenes, silent: !!cut.silent, loop: !!cut.loop };
}
export const promoFrames = (cutId) => b(CUTS[cutId].beats);

// ——— Sound events (the same frames as the picture) ———————————————————————————————————————————————————————
export function promoEvents(cutId, opening, fmt = "auto") {
  const T = promoTimeline(cutId, opening);
  const wide = fmt === "auto" ? T.w > T.h : fmt === "wide";
  const ev = [];
  for (const s of T.scenes) {
    const add = (f, sfx, extra = {}) => ev.push({ f: s.from + f, sfx, scene: s.id, pan: 0, vel: 0.8, pitch: 0, ...extra });
    const slam = (f, note, extra = {}) => add(f, "slam", { grid: true, note, ...extra });
    const t = s.t;
    if (s.i > 0) {
      if (s.in === "wipe") add(0, "wipe", { sweep: [-0.8, 0.8], note: "colour wipe" });
      else if (s.in === "slide") add(0, "whoosh", { sweep: [0.8, 0], note: "slide in" });
      else if (s.in === "push") add(0, "whoosh", { sweep: [0.6, -0.6], vel: 0.6, note: "whip push" });
      else if (s.in === "circle") add(0, "whoosh", { vel: 0.55, sweep: [0, 0], note: "circle reveal" });
    }
    switch (s.kind) {
      case "slam2":
        slam(t.a, "'Your catalog.' slams", { vel: 0.95 });
        add(t.b, "impact", { grid: true, note: "'Your prices.' lands" });
        add(t.rule, "line", { dur: 10, vel: 0.4, note: "rule draws" });
        add(t.sub, "tick", { grid: true, vel: 0.45, note: "kicker rises" });
        add(t.sweep[0], "line", { dur: t.sweep[1] - t.sweep[0], vel: 0.35, sweep: [-0.6, 0.6], note: "light sweep" });
        break;
      case "question":
        t.bubbles.forEach((f, i) => add(f, "message", { grid: true, pan: wide ? -0.5 + 0.5 * i : (i - 1) * 0.3, pitch: [0, 2, 4][i], note: `bubble ${i + 1}` }));
        slam(t.head, "question slams", { vel: 0.95 });
        add(t.accent, "tick", { grid: true, vel: 0.5, note: "accent word" });
        break;
      case "status":
        t.chips.forEach((f, i) => add(f, "lock", { grid: true, pitch: i * 2, vel: 0.65, pan: wide ? -0.45 + 0.3 * i : 0, note: `status chip ${i + 1}` }));
        slam(t.line, "line lands", { vel: 0.8 });
        break;
      case "cta":
        t.words.forEach((f, i) => slam(f, `word '${s.props.text.split(" ")[i]}'`, { vel: 0.7 + 0.05 * i, pitch: i }));
        add(t.rule, "line", { dur: 10, vel: 0.4, note: "rule draws" });
        if (s.i > 0) ev.push({ f: s.from - b(4), sfx: "riser", scene: s.id, dur: b(4) - b(1), vel: 0.8, pan: 0, pitch: 0, note: "riser into the call to action (stops 1 beat early: the quiet before the payoff)" });
        break;
      case "trust":
        t.words.forEach((f, i) => add(f, "tick", { grid: false, vel: 0.45, pitch: i, note: i === 0 ? "trust line, word by word" : undefined }));
        add(t.rule, "line", { dur: 10, vel: 0.35, note: "underline" });
        break;
      case "words":
        add(t.rule, "line", { vel: 0.4, dur: 10, note: "rule draws" });
        t.lines.forEach((f, i) => slam(f, `'${s.props.lines[i]}'`, { vel: 0.75 + 0.1 * (i === t.lines.length - 1) }));
        break;
      case "merge":
        t.cards.forEach((f, i) => add(f, "pin", { grid: true, pan: wide ? -0.6 + 0.6 * i : (i - 1) * 0.4, pitch: [0, 3, 7][i], note: `card '${s.props.items[i]}'` }));
        add(t.converge[0], "whoosh", { vel: 0.4, sweep: [0.5, 0], dur: t.converge[1] - t.converge[0], note: "cards slide together" });
        add(t.snap, "snap", { grid: true, note: "cards snap into One portal" });
        slam(t.head, "headline", { vel: 0.7 });
        break;
      case "brand":
        add(t.mark[0], "line", { dur: t.mark[1], vel: 0.45, note: "mark draws" });
        slam(t.name, "name", { vel: 0.7 });
        add(t.place, "tick", { grid: true, vel: 0.45, note: "region line" });
        add(t.rule, "line", { dur: 10, vel: 0.35, note: "rule draws" });
        break;
      case "service":
        add(t.num, "swish", { pan: wide ? 0.4 : 0.2, note: "numeral and card in" });
        add(t.icon, "icon", { dur: 30, note: `icon '${s.props.icon}' draws` });
        slam(t.title, `title '${s.props.title}'`);
        add(t.sub, "tick", { grid: true, vel: 0.45, note: "support line" });
        break;
      case "trio":
        t.chips.forEach((f, i) => slam(f, `chip ${i + 1}`, { vel: 0.6, pitch: i * 2, pan: wide ? (i - 1) * 0.5 : 0 }));
        add(t.bracket[0], "line", { dur: t.bracket[1] - t.bracket[0], vel: 0.5, sweep: [-0.5, 0.5], note: "bracket draws" });
        slam(t.head, "headline", { vel: 0.75 });
        break;
      case "steps":
        slam(t.heading, "'How it works'", { vel: 0.7 });
        t.nums.forEach((f, i) => {
          add(f - 4, "counter", { steps: [i, i + 1], note: `numeral rolls to ${i + 1}` });
          add(f, "lock", { grid: true, pitch: i * 2, vel: 0.6, note: `step ${i + 1} '${s.props.items[i]}'` });
        });
        add(t.rule, "line", { dur: 10, vel: 0.4, note: "rule draws" });
        break;
      case "screen": {
        const r = s.scr;
        add(0, r.device === "phone" ? "tilt" : "swish", { pan: r.device === "phone" && wide ? 0.5 : 0, note: r.device === "phone" ? "phone glides in" : "screen rises in" });
        for (const k of r.clicks ?? []) add(k.f, k.button ? "button" : "click", { note: k.button ? "button pressed" : "tap / click" });
        (r.cam ?? []).forEach((k, j) => (j > 0 || k.f > 2 ? add(k.f, "cam", { vel: 0.22, sweep: [0.1, -0.1], note: "camera move (soft swell)" }) : null));
        for (const fl of r.typed ?? []) fl.chars.forEach((c, j) => add(c.f, "key", { ch: c.ch, vel: 0.7, note: j === 0 ? "typing (blue-switch)" : undefined }));
        for (const g of r.rings ?? []) add(g.f, "pop", { grid: false, vel: 0.55, note: "ring" });
        for (const c of (r.callouts ?? []).filter((c) => wide || !c.wideOnly)) add(c.f, "line", { dur: 12, vel: 0.45, note: `callout '${c.text}'` });
        for (const p of r.pops ?? []) add(p.f, "message", { note: "banner pops" });
        if (s.props.word && wide) slam(b(0.5), `keyword '${s.props.word}'`, { vel: 0.55, pan: -0.4 });
        break;
      }
      case "end":
        add(0, "sting", { note: "logo sting" });
        add(t.name, "tick", { grid: true, vel: 0.4, note: "wordmark rises" });
        add(t.tagline, "tick", { grid: true, vel: 0.45, pitch: 4, note: "tagline" });
        add(t.button, "button", { grid: true, note: `'${s.props.cta}' pops` });
        t.pulses.forEach((f) => add(f, "pulse", { vel: 0.35, note: "button pulse" }));
        t.url.forEach((c, j) => add(c.f, "key", { ch: c.ch, vel: 0.4, note: j === 0 ? "URL types on" : undefined }));
        add(t.tail, "tail", { dur: s.len - t.tail, note: "end-card tail" });
        break;
      default:
        break;
    }
  }
  const music = T.scenes.map((s) => ({ scene: s.id, from: s.from, to: s.to, part: s.part === "Trust" ? "How it works" : s.part, kind: s.kind }));
  const tag = `${cutId}-${T.opening ?? "loop"}${fmt === "square" ? "-square" : ""}`;
  return { cut: tag, cand: "A", bpm: BPM, fps: FPS, frames: T.frames, music, events: ev.filter((e) => e.f >= 0 && e.f < T.frames).sort((x, y) => x.f - y.f) };
}
