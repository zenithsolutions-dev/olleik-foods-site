# Sound Plan V2 (sound design first; music optional)

Status: Pending Review. For the V2 hero (“The night before”), its cuts, the visitor manual and the five admin episodes.
Rule from the brief: lead with sound design; music, if used, is a quiet bed under the effects. Ship every cut twice:
**no music** and **with a quiet bed**. No voice, no TTS (only if the owner approves later).

## 1. How it is built (unchanged tooling)
- Every sound comes from the same event list as the picture (`src/v2/hero.mjs` scenes and timings, `episodes.mjs` beats),
  so sync is automatic. Verification as before: isolated onsets within ±1 frame (33 ms), loudness measured on the encoded
  MP4: **−14 LUFS integrated, true peak ≤ −1 dBTP** for the promo cuts; the manuals **−16 LUFS** (calmer, speech-free).
- Real recordings only (Kenney CC0, Mixkit Sound Effects Free License), layered and varied per event (pitch, level, pan);
  every file listed in `audio-library/LICENSES.md` before it is used. No file with an unclear licence.
- Room tone per set (night kitchen, warehouse, morning kitchen) as a −36 dB bed so silence never sounds “digital”.

## 2. The hero, moment by moment

| Scene | Time | Sounds (in order) | Feel |
|---|---|---|---|
| H01 chaos | 0:00–0:05.5 | phone buzz ×3 (getting closer), a notification pop for each bubble (6, varied pitch), a voice-note blip, one knife on the board, fridge hum + room tone | tense, busy, no music even in the music version |
| H02 tap | 0:05.5–0:08 | speed-ramp “down” swoosh, **0.4 s of near silence**, one finger tap, then six soft snaps as the tiles lock (rising pitch) | the turn: from noise to order |
| H03–H04 phone | 0:08–0:15 | whoosh into the phone, phone glide, page flick on the shot change, a crisp tick as YOUR PRICE sharpens; music bed enters here (music version) | calm, warm |
| H05 three taps | 0:15–0:20 | tap 1 / 2 / 3, each with a short whip whoosh, counter clicks, a soft “received” chime | rhythmic, on the pulse |
| H06 slip | 0:20–0:23 | thermal-printer chatter, paper tear, whip to the right | satisfying |
| H07 warehouse | 0:23–0:36 | slip slides on wood, mouse click on Confirm, chip flip blip, **STAMP** (wood impact + punch layer + paper slap), three box thuds, tape strip, chip flip; warehouse room tone with a distant forklift-free hum | precise, tactile |
| H08 handoff | 0:36–0:38 | big whoosh left to right, three footsteps on concrete | quick |
| H09 morning | 0:38–0:54 | warm room tone, door bell, door swing, two box thuds, a mug on the counter; **0.5 s of silence**, then the **SENT stamp** (heavier than H07) | relief, payoff |
| H10 end | 0:54–1:00 | button pop, clean bell hit (no-music version) or the music's resolving chord + sting (music version), tail | warm close |

The cuts reuse the same events for the scenes they keep. The 6 s bumper: tap + snaps → SENT stamp → bell hit.

## 3. Inventory: what we have and what must be sourced in Phase 2

| Sound | Status | Source (all allowed for commercial video and ads, no attribution) |
|---|---|---|
| Finger tap, UI clicks, counter ticks, chime | in library | Kenney Interface Sounds / UI Audio (CC0) |
| Notification pop, message pop | in library | Mixkit #2357, #2364, #3005 (in library); #2354 “Message pop alert” (licensed index, download in Phase 2) |
| Whooshes, whip pans, swipe | in library | Mixkit #1490, #1492, #2627, #3115, #3120 |
| Box thuds, stamp body, wood slap | in library | Kenney Impact Sounds (impactSoft_heavy, impactWood_*, impactPunch_*, impactPlank_medium) (CC0) |
| Footsteps (concrete) | in library | Kenney Impact Sounds footstep_concrete_000–004 (CC0) |
| Typing (manual: application form) | in library | blue-switch kit from real recordings (V1) |
| Door bell | licensed index, not yet downloaded | Mixkit #2864 “Doorbell tone”, #333 “Doorbell single press” |
| Knife on a board | licensed index, not yet downloaded | Mixkit #2152 “Quick knife slice cutting” |
| Stapler / paper snap (stamp layer) | licensed index, not yet downloaded | Mixkit #2995 “Stapling paper” |
| **Phone buzz (vibration)** | **missing** | to source from Mixkit (notification / phone categories) or Kenney packs; if nothing with a clear licence exists, a vibration built from a recorded low hum is the fallback, and I will say so |
| **Thermal printer** | **missing** | to source (Mixkit office / machine categories) with the same licence checks |
| **Paper tear, tape strip, door swing, mug on counter** | **missing** | to source; Kenney packs first (CC0), then Mixkit |
| Room tones (kitchen night, warehouse, morning) | to build | from recorded hums in the library, low-passed; or sourced CC0 |

Nothing is downloaded in Phase 1. In Phase 2 each new file gets its source URL, licence and evidence in `LICENSES.md`
before it enters a cut; Pixabay and anything behind a login stay excluded.

## 4. Music (optional bed)
- No-music version: the effects, room tone and the final bell carry the film.
- Music version: a quiet bed (about 6–8 LU under the effects), entering on the tap (H02), not under the chaos. The V1
  candidates (A “Market Morning” 120 BPM, B “Open Kitchen” 124 BPM, C “Slow Simmer” 100 BPM) are too forward as written;
  for V2 I would render a sparser arrangement (pad, soft keys and a light pulse, no lead in the hero's phone scenes) of the
  owner's pick, at 100 BPM to match the calm half of the film.
- Honest note: the music is original MIDI rendered with a free SoundFont; it is fine as a bed but below a produced library
  track, and it is a separate stem so a licensed track can replace it.

## 5. Manuals (visitor and admin episodes)
- Restrained: a soft click or tap on every cursor or finger action, the marker “scribble” sound when a callout draws (very
  low), a paper-printer tick when a step ticket prints, one whoosh between beats, and the typed form gets its keys.
- Problem cards: a single low “hm” chord or a muted pluck, no comedy sound.
- Each episode ends on a short two-note sting (the “next” tease) — the same motif in every episode so they feel like a series.
- Loudness −16 LUFS integrated, true peak ≤ −1 dBTP; music bed optional and very low (−28 LUFS).
