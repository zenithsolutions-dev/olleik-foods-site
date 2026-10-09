// "The night before" — V2 film timing. One model for picture and sound: Film (HeroFilm.tsx) animates from these scenes,
// and `filmEvents()` places every sound on the same frames for audio/mix_v2.py (and the verifier). 30 fps.
// Rhythm: chaos cut every 12 frames, a hard stop on the tap, then calm.
export const FPS = 30;
const s = (sec) => Math.round(sec * FPS);

/** The chaos bubbles (illustrative texts, not quotes): z = frame each one pops in. */
export const CHAOS = [
  { kind: "file", text: "price list v3 (final) (2)", sub: "PDF · 4 pages", x: 1130, y: 190, z: 0 },
  { kind: "in", text: "Can you do 4 cases by Fri??", x: 1180, y: 360, z: 6 },
  { kind: "missed", text: "Missed call (3)", x: 980, y: 520, z: 12 },
  { kind: "voice", text: "0:47", x: 1240, y: 650, z: 18 },
  { kind: "in", text: "price changed again?", sub: "$?? → $??", x: 960, y: 760, z: 24 },
  { kind: "out", text: "send me the new list pls", x: 1300, y: 260, z: 30 },
];
/** The tap: finger lands at `tap`; tile i starts snapping at snap + i·stagger and lands `land` frames later. */
export const TAP = { tap: 12, snap: 30, stagger: 3, dur: 16, land: 6 };

// Footage shots on the phone (CSS px of the 390 × 844 captures).
const CARD = { x: 20, y: 380, w: 350, h: 200 };
const BADGE = { x: 116, y: 475, w: 80, h: 19 };
const ADD = { x: 45, y: 480, w: 300, h: 80 };
const CART = { x: 20, y: 600, w: 350, h: 220 };
const PLACED = { x: 20, y: 170, w: 350, h: 220 };
const TAPS_AT = [{ x: 195, y: 526 }, { x: 263, y: 792 }, { x: 258, y: 792 }];

export const HERO = {
  frames: s(60),
  scenes: [
    { id: "H01", kind: "chaos", from: 0, to: s(5.5), hook: { text: "One more text.", at: 48 }, beat: "Hook: 11:04 PM, one more text", sound: "phone buzz ×2, a notification pop per bubble, voice-note blip, a knife on the board once, room tone; NO music" },
    { id: "H02", kind: "tap", from: s(5.5), to: s(8), beat: "One tap. Everything stops, then snaps into a grid", sound: "speed-ramp stop, near silence, a single tap, then a soft snap per tile (6, rising pitch)" },
    {
      id: "H03", kind: "phone", from: s(8), to: s(12), beat: "The grid becomes his real catalog",
      shots: [{ at: 0, src: "visitor/p-catalog", cam: null }, { at: s(1.6), src: "visitor/p-catalog-card", cam: { rect: CARD, z: 1.4 } }],
      taps: [], tapAt: { x: 195, y: 520 },
      words: [{ t: "Your catalog.", at: s(0.6), x: 130, y: 300, size: 130, dir: -1 }],
      sound: "phone glides in, whip on the shot change",
    },
    {
      id: "H04", kind: "phone", from: s(12), to: s(15), beat: "His own price, on every item",
      shots: [{ at: 0, src: "visitor/p-catalog-card", cam: { rect: BADGE, z: 3.2 } }],
      taps: [], tapAt: { x: 156, y: 485 }, priceTick: s(0.5),
      words: [{ t: "Your catalog.", at: 0, x: 130, y: 300, size: 130, dir: -1 }, { t: "Your prices.", at: s(0.5), x: 130, y: 450, size: 140, italic: true, dir: -1 }],
      sound: "phone glide, a crisp tick as the price badge sharpens",
    },
    {
      id: "H05", kind: "phone", from: s(15), to: s(20), beat: "Three taps: add, checkout, submit",
      shots: [
        { at: 0, src: "visitor/p-catalog-card", cam: { rect: ADD, z: 1.6 } },
        { at: s(0.9), src: "visitor/p-catalog-added", cam: { rect: ADD, z: 1.6 } },
        { at: s(1.6), src: "visitor/p-cart", cam: { rect: CART, z: 1.3 } },
        { at: s(2.8), src: "visitor/p-checkout-filled", cam: { rect: CART, z: 1.3 } },
        { at: s(4.0), src: "visitor/p-placed", cam: { rect: PLACED, z: 1.3 } },
      ],
      taps: [s(0.8), s(2.5), s(3.9)], tapAt: { x: 195, y: 528 }, tapsAt: TAPS_AT, counter: true,
      words: [{ t: "Three taps.", at: s(0.3), x: 130, y: 300, size: 130, dir: -1, out: s(4.6) }],
      sound: "tap 1 / 2 / 3, a whip on every screen change, counter clicks, a soft chime on Received",
    },
    { id: "H06", kind: "print", from: s(20), to: s(23), beat: "The order slip prints; Marco exhales", sound: "printer (real paper feed + faint stepper chirp), paper tear, whip" },
    { id: "H07", kind: "warehouse", from: s(23), to: s(36), beat: "Olleik: Salma confirms on the real admin screen, stamps, boxes build, chips flip", t: { confirm: s(3), stamp: s(5.5), boxes: s(7), ready: s(10) }, sound: "slip slides in, click on Confirm, chip flip, STAMP, three box thuds, tape, chip flip" },
    { id: "H08", kind: "handoff", from: s(36), to: s(38), beat: "The driver's hands carry the box across", sound: "big whoosh L→R, footsteps on concrete ×3" },
    { id: "H09", kind: "morning", from: s(38), to: s(54), beat: "Morning: door bell, boxes land, sun, Marco smiles; SENT stamp", t: { door: s(2), boxes: s(3.2), line: s(6), stampSent: s(14.5) }, sound: "door bell, door swing, two box thuds, a mug, then 0.5 s of quiet, the SENT stamp" },
    { id: "H10", kind: "end", from: s(54), to: s(60), beat: "End card: mark, wordmark, tagline, button, address", sound: "button pop; bell (no-music version) or the music's resolving chord (music version)" },
  ],
};

/** Gate D animatic: 15 s, hook A, chaos → catalog morph → three taps → slip → stamp → SENT → end card. */
export const ANIM15 = {
  frames: s(15),
  scenes: [
    { id: "A01", kind: "chaos", from: 0, to: 84, hook: { text: "One more text.", at: 46 }, t: { close: 60, chop: 32 } },
    { id: "A02", kind: "tap", from: 84, to: 132, t: { tap: 10, snap: 20, stagger: 2, dur: 12, land: 5 } },
    {
      id: "A03", kind: "phone", from: 132, to: 246,
      shots: [
        { at: 0, src: "visitor/p-catalog", cam: null },
        { at: 14, src: "visitor/p-catalog-card", cam: { rect: BADGE, z: 2.6 } },
        { at: 40, src: "visitor/p-catalog-card", cam: { rect: ADD, z: 1.6 } },
        { at: 54, src: "visitor/p-catalog-added", cam: { rect: ADD, z: 1.6 } },
        { at: 66, src: "visitor/p-cart", cam: { rect: CART, z: 1.3 } },
        { at: 84, src: "visitor/p-checkout-filled", cam: { rect: CART, z: 1.3 } },
        { at: 104, src: "visitor/p-placed", cam: { rect: PLACED, z: 1.3 } },
      ],
      taps: [52, 80, 100], tapAt: { x: 195, y: 528 }, tapsAt: TAPS_AT, counter: true, priceTick: 20,
      words: [
        { t: "Your catalog.", at: 2, x: 130, y: 260, size: 120, dir: -1, out: 38 },
        { t: "Your prices.", at: 16, x: 130, y: 400, size: 130, italic: true, dir: -1, out: 38 },
        { t: "Three taps.", at: 44, x: 130, y: 300, size: 130, dir: -1, out: 110 },
      ],
    },
    { id: "A04", kind: "print", from: 246, to: 288, t: { print: [2, 24], fly: 26, word: 10 } },
    { id: "A05", kind: "warehouse", from: 288, to: 348, t: { confirm: 8, stamp: 24, boxes: 30, ready: 46 } },
    { id: "A06", kind: "morning", from: 348, to: 402, t: { door: -20, boxes: 0, line: 999, stampSent: 30 } },
    { id: "A07", kind: "end", from: 402, to: 450 },
  ],
};

export const FILMS = { hero: HERO, anim15: ANIM15 };

/** Sound events for a film cut, from the same scene data the picture uses. `music` adds the bed's map and envelope. */
export function filmEvents(cut, music = false) {
  const F = FILMS[cut];
  const ev = [];
  let musicIn = null;
  let sentAt = null;
  for (const sc of F.scenes) {
    const len = sc.to - sc.from;
    const add = (f, sfx, extra = {}) => {
      if (f >= 0 && f < len) ev.push({ f: sc.from + f, sfx, scene: sc.id, vel: 0.8, pan: 0, pitch: 0, ...extra });
    };
    const t = sc.t ?? {};
    switch (sc.kind) {
      case "chaos":
        add(2, "buzz", { dur: 22, note: "phone buzz" });
        add(Math.round(len * 0.55), "buzz", { dur: 16, vel: 0.9, note: "phone buzz again" });
        CHAOS.forEach((c, i) => add(c.z, c.kind === "missed" ? "flip" : "notif", { pitch: i, pan: (c.x - 960) / 960, note: `bubble '${c.text}'` }));
        CHAOS.forEach((c) => c.kind === "voice" && add(c.z + 5, "voice", { note: "voice-note blip" }));
        add(t.chop ?? 58, "chop", { note: "a knife on the board (wood chop)" });
        break;
      case "tap": {
        const T = { ...TAP, ...t };
        add(0, "rampdown", { note: "speed-ramp stop" });
        add(T.tap, "tap", { vel: 0.9, note: "the tap" });
        for (let i = 0; i < CHAOS.length; i++) add(T.snap + i * T.stagger + T.land, "snaplock", { pitch: i * 1.5, vel: 0.55, note: `tile ${i + 1} snaps` });
        musicIn = sc.from + T.snap;
        break;
      }
      case "phone":
        add(0, "glide", { note: "phone glides in" });
        sc.shots.forEach((sh, i) => i > 0 && add(sh.at, "whip", { vel: 0.45, note: "whip to the next screen" }));
        (sc.taps ?? []).forEach((tp, i) => {
          add(tp, "tap", { note: `tap ${i + 1}` });
          if (sc.counter) add(tp + 1, "counterclick", { vel: 0.5, note: `counter ${i + 1}` });
        });
        if (sc.priceTick != null) add(sc.priceTick, "tick", { vel: 0.6, pitch: 4, note: "YOUR PRICE sharpens" });
        sc.shots.forEach((sh) => sh.src.endsWith("p-placed") && add(sh.at + 4, "chime", { note: "Order received" }));
        break;
      case "print": {
        const T = { print: [6, 46], fly: len - 16, ...t };
        add(T.print[0], "printer", { dur: T.print[1] - T.print[0], note: "the slip prints" });
        add(T.fly - 2, "tear", { note: "paper tear" });
        add(T.fly, "whip", { sweep: [-0.6, 0.9], note: "whip right (match cut)" });
        break;
      }
      case "warehouse":
        add(0, "slide", { note: "slip slides onto the bench" });
        add(t.confirm - 2, "click", { note: "click Confirm" });
        add(t.confirm, "flip", { pitch: 2, note: "chip → Confirmed" });
        add(t.stamp, "stamp", { note: "STAMP: CONFIRMED" });
        [0, 1, 2].forEach((i) => add(t.boxes + i * 6 + 8, "box", { pan: (i - 1) * 0.4, vel: 0.75, note: `box ${i + 1} lands` }));
        add(t.boxes + 26, "tapeRip", { vel: 0.6, note: "tape" });
        add(t.ready, "flip", { pitch: 4, note: "chip → Ready" });
        break;
      case "handoff":
        add(0, "whoosh", { sweep: [-0.9, 0.9], dur: len, vel: 0.8, note: "the box crosses" });
        [8, 22, 36].forEach((f, i) => add(f, "step", { pan: -0.5 + 0.5 * i, note: "footstep" }));
        break;
      case "morning":
        add(t.door - 10, "doorbell", { note: "door bell" });
        add(t.door, "door", { note: "door swings" });
        add(t.boxes + 8, "box", { note: "box lands" });
        add(t.boxes + 16, "box", { vel: 0.6, note: "second box lands" });
        add(t.line + 10, "mug", { note: "mug on the counter" });
        add(t.stampSent + 4, "stamp_big", { note: "SENT stamp (after 0.5 s of quiet)" });
        sentAt = sc.from + t.stampSent + 4;
        break;
      case "end":
        add(34, "pop", { pitch: 2, note: "button pops" });
        if (!music) add(2, "bell", { note: "end bell (no-music version)" });
        break;
      default:
        break;
    }
  }
  const out = { cut, engine: "v2", frames: F.frames, target_lufs: -14, room: true, music, events: ev.sort((a, b) => a.f - b.f) };
  if (music) {
    const part = { chaos: "Hook", tap: "Answer", phone: "How it works", print: "Answer", warehouse: "How it works", handoff: "How it works", morning: "Call to action", end: "End" };
    out.music_map = F.scenes.map((sc) => ({ scene: sc.id, from: sc.from, to: sc.to, part: part[sc.kind], kind: sc.kind === "end" ? "end" : sc.kind }));
    // silent under the chaos; the bed enters on the snap; a dip to silence for the half second before SENT
    const env = [[0, -90], [musicIn, -90], [musicIn + 20, 0]];
    if (sentAt) env.push([sentAt - 18, 0], [sentAt - 15, -90], [sentAt - 1, -90], [sentAt + 8, 0]);
    out.music_env = env;
    out.music_under_lu = 8;
  }
  return out;
}
