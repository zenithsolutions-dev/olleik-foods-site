// "The night before" — hero cut timing (V2). One model for picture and sound: HeroFilm.tsx animates from these scenes,
// the sound plan (SOUND_PLAN_V2.md) and later the mixer place every effect from `heroSound()`. 30 fps, 60 s.
// Rhythm: chaos at ~150 BPM cuts (every 12 frames), a hard stop on the tap, then a calm 100 BPM pulse (18 frames).
export const FPS = 30;
const s = (sec) => Math.round(sec * FPS);

// Footage shots on the phone (CSS px of the 390 × 844 captures).
const CARD = { x: 20, y: 380, w: 350, h: 200 };
const BADGE = { x: 116, y: 475, w: 80, h: 19 };

export const HERO = {
  frames: s(60),
  scenes: [
    { id: "H01", kind: "chaos", from: 0, to: s(5.5), beat: "Hook: 11:04 PM, one more text", sound: "phone buzz ×3 (rising), notification pops per bubble, voice-note blip, a knife on the board once, room tone; NO music" },
    { id: "H02", kind: "tap", from: s(5.5), to: s(8), beat: "One tap. Everything stops, then snaps into a grid", sound: "speed-ramp swoosh down, 0.4 s silence, a single tap, then a soft 'snap' per tile (6, rising pitch)" },
    {
      id: "H03", kind: "phone", from: s(8), to: s(12), beat: "The grid becomes his real catalog",
      shots: [{ at: 0, src: "visitor/p-catalog", cam: null }, { at: s(1.6), src: "visitor/p-catalog-card", cam: { rect: CARD, z: 1.4 } }],
      taps: [], tapAt: { x: 195, y: 520 },
      words: [{ t: "Your catalog.", at: s(0.6), x: 130, y: 300, size: 130, dir: -1 }],
      sound: "whoosh into the phone, phone glide, a light page-turn on the shot change",
    },
    {
      id: "H04", kind: "phone", from: s(12), to: s(15), beat: "His own price, on every item",
      shots: [{ at: 0, src: "visitor/p-catalog-card", cam: { rect: BADGE, z: 3.2 } }],
      taps: [], tapAt: { x: 156, y: 485 },
      words: [{ t: "Your catalog.", at: 0, x: 130, y: 300, size: 130, dir: -1 }, { t: "Your prices.", at: s(0.5), x: 130, y: 450, size: 140, italic: true, dir: -1 }],
      sound: "camera push swell, a crisp tick as the price badge sharpens",
    },
    {
      id: "H05", kind: "phone", from: s(15), to: s(20), beat: "Three taps: add, checkout, submit",
      shots: [
        { at: 0, src: "visitor/p-catalog-card", cam: { rect: { x: 45, y: 480, w: 300, h: 80 }, z: 1.6 } },
        { at: s(0.9), src: "visitor/p-catalog-added", cam: { rect: { x: 45, y: 480, w: 300, h: 80 }, z: 1.6 } },
        { at: s(1.6), src: "visitor/p-cart", cam: { rect: { x: 20, y: 600, w: 350, h: 220 }, z: 1.3 } },
        { at: s(2.8), src: "visitor/p-checkout-filled", cam: { rect: { x: 20, y: 600, w: 350, h: 220 }, z: 1.3 } },
        { at: s(4.0), src: "visitor/p-placed", cam: { rect: { x: 20, y: 170, w: 350, h: 220 }, z: 1.3 } },
      ],
      taps: [s(0.8), s(2.5), s(3.9)], tapAt: { x: 195, y: 528 }, tapsAt: [{ x: 195, y: 526 }, { x: 263, y: 792 }, { x: 258, y: 792 }], counter: true,
      words: [{ t: "Three taps.", at: s(0.3), x: 130, y: 300, size: 130, dir: -1, out: s(4.6) }],
      sound: "tap 1 / 2 / 3 on the pulse (each with a whip-pan whoosh), counter clicks, a soft 'received' chime from the library",
    },
    { id: "H06", kind: "print", from: s(20), to: s(23), beat: "The order slip prints; Marco exhales", sound: "thermal printer chatter (needs sourcing), paper rip, Marco's exhale is NOT voiced (no voice), whip to the right" },
    { id: "H07", kind: "warehouse", from: s(23), to: s(36), beat: "Olleik: Salma confirms on the real admin screen, stamps, boxes build, chips flip", t: { confirm: s(3), stamp: s(5.5), boxes: s(7), ready: s(10) }, sound: "slip slides in (paper slide), mouse click on Confirm, chip flip blip, STAMP (wood impact + punch layer), 3 box thuds, tape strip, chip flip" },
    { id: "H08", kind: "handoff", from: s(36), to: s(38), beat: "The driver's hands carry the box across", sound: "big whoosh L→R, footsteps on concrete ×3" },
    { id: "H09", kind: "morning", from: s(38), to: s(54), beat: "Morning: door bell, boxes land, sun, Marco smiles; SENT stamp", t: { door: s(2), boxes: s(3.2), line: s(6), stampSent: s(14.5) }, sound: "door bell (library index), door swing, 2 box thuds, birds-free warm room tone, then 0.5 s silence, STAMP on SENT" },
    { id: "H10", kind: "end", from: s(54), to: s(60), beat: "End card: mark, wordmark, tagline, button, address", sound: "logo sting (music engine, or a clean bell hit if no music), button pop, tail" },
  ],
};

/** The cut list derived from the hero (all from the same scenes; numbers in seconds of the hero). */
export const CUTS_V2 = {
  hero60: { title: "Hero 60 s", format: "16:9", w: 1920, h: 1080, uses: "H01–H10 as above" },
  cut30: { title: "30 s", format: "16:9", w: 1920, h: 1080, uses: "H01 (3 s) · H02 (2 s) · H04+H05 (8 s) · H06 (2 s) · H07 compressed: confirm + stamp + chip (7 s) · H09 door + smile + SENT (5 s) · end (3 s)" },
  vertical15: { title: "15 s vertical", format: "9:16", w: 1080, h: 1920, uses: "chaos (4 s) → tap (2 s) → Three taps on the phone, full screen (4 s) → morning + SENT (3 s) → end (2 s)" },
  bumper6: { title: "6 s bumper", format: "16:9 and 9:16", uses: "the tap and the snap (2 s) → SENT stamp on the morning (2 s) → end card (2 s)" },
  square: { title: "1:1 (30 s edit reframed)", format: "1:1", w: 1080, h: 1080, uses: "the 30 s edit, characters re-staged to the square safe area" },
  loop10: { title: "Loopable 10 s hero", format: "16:9", uses: "silent: the warehouse slip → boxes → driver → door → back to the slip (match cut at the seam); no text claims" },
};

export const HOOKS_V2 = [
  { id: "A", text: "One more text.", note: "default: the chaos says it; the line lands at 1.6 s over the bubbles" },
  { id: "B", text: "Still ordering supplies by text?", note: "brief option; replaces 'One more text.'" },
  { id: "C", text: "11:04 PM. One more text.", note: "brief option; clock and line together in the first second" },
  { id: "D", text: "Your supplier, in your pocket.", note: "brief option; lands on the tap (H02) instead of the chaos" },
];
