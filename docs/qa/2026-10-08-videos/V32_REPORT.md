# Olleik Videos V3.2: demo business details, two voiced user manuals, the final promo cuts (2026-10-12)

**Branch:** `feat/videos` (draft PR #38, **not merged**). **Delivery:** `D:\olleik-videos\final\` (README there).
**Rules kept:**
- Everything was captured from the LOCAL demo stack; the hosted Supabase was never touched.
- All copy and narration is **Pending Review**.
- The local demo database was removed at the end (owner's approval, item 4).

## Part 1 · Demo business details in the documents
- **App change (small, owner-approved):** `src/lib/business.ts` now reads the legal name, address, phone and email from
  `BUSINESS_LEGAL_NAME`, `BUSINESS_ADDRESS`, `BUSINESS_PHONE` and `BUSINESS_EMAIL`.
  - When a variable is unset or blank, the field falls back to the current placeholder, so `main`, Vercel and every other
    environment render exactly as before.
  - Tax stays disabled.
- **Where the demo values live:** only in the videos' local launcher (`videos/devstack/dev.mjs`, which the
  `olleik-video-demo` launch entry runs). They are not in `.env.local` and not in the hosted project.
  - Olleik Foods Ltd.
  - 120 Market Street, Ottawa, ON K1A 0B1
  - (613) 555-0142
  - orders@olleik-demo.test
- **Re-captured with these details:** customer invoice, customer statement, admin invoice, admin customer statement,
  products statement, low stock, unavailable products and the report builder. The customer's order page (status) was also
  captured for the visitor manual.
- **Documents now open in full:** the forbidden-box rule for document headers is gone from the voiced manuals and the new cuts.
- **Before handover:** these are demo details. The client's real registered details still have to be entered (set the four
  variables in Vercel), and the pre-handover checklist in `business.ts` still applies.

## Part 2 · Two voiced user manuals (the main deliverable)
| File | Length | Loudness | True peak | Effects within ±1 frame | Longest still | Placeholders | Result |
|---|---|---|---|---|---|---|---|
| `manual-visitor/USER_MANUAL_VISITOR.mp4` | 125.77 s | -16.0 LUFS | -2.9 dBTP | 120/120 | 16 frames | 0 | PASS |
| `manual-admin/USER_MANUAL_ADMIN.mp4` | 196.83 s | -16.0 LUFS | -2.9 dBTP | 85/85 | 11 frames | 0 | PASS |

| Voiced manual | Lines | First word after its step's first frame (max) | Gap to the next line (min) | Music under the voice (min) |
|---|---|---|---|---|
| USER_MANUAL_VISITOR | 21 (none overlapping) | 3.5 frames (limit 5) | 0.6 s | 18.4 dB (limit 12) |
| USER_MANUAL_ADMIN | 34 (none overlapping) | 3.8 frames (limit 5) | 0.6 s | 17.8 dB (limit 12) |

- **Voice:**
  - Higgsfield speech, model `seed_audio`, preset **Holden** (`3c9d6053-…`), which you chose mid-run in place of Harrison.
  - Generated under your per-project exception, which is logged in the video-factory `PROPOSED_RULE_CHANGES.md` (proposal
    only; the locked rule is unchanged).
- **Pronunciation of "Olleik":**
  - With the plain spelling, Holden says "Olik". The narration text therefore spells it "Oh-lake", which the speech
    recognition hears as "O-Lake" (Harrison read the plain spelling the same way).
  - On screen it stays "Olleik".
  - **Please listen once to v00 / a00** and tell me if the brand should sound different; changing it means one word in the
    text and a re-generated line.
- **Narration scripts:** `videos/narration/VISITOR.json` (21 lines) and `ADMIN.json` (34 lines), each with id, text,
  spoken text, target length and on-screen caption.
  - Calm, short sentences.
  - No marketing claims, no delivery times, no prices spoken, no real names.
- **Takes:**
  - One WAV per line.
  - Every take was checked by speech recognition (faster-whisper) against its script: a missing word, stray syllables or a
    garbled word fails the take.
  - 14 takes were rejected and regenerated; they are kept in `narration/audio/rejected/`, and the ledger and
    `LICENSES.md` give the reason for each.
  - Each line is trimmed to its spoken span.
- **Pace:**
  - Each step holds for its line plus one beat.
  - The line starts one frame into its step; the first word lands within 3.8 frames at most (limit 5).
  - The camera glides to the step's target, then makes a slow push-in, so nothing freezes while the narrator speaks.
  - A tap that changes the page comes early in the step; a tap that opens another page comes at its end, before the whip.
  - Typing reveals the real typed capture.
- **On screen:**
  - A lower band carries the chapter (left), a numbered step badge and the caption. The captions are short, meaning-matched
    versions of the narration, with no trailing periods.
  - Chapter title cards; a live-action opener (Marco for the customer guide, Salma for the admin guide) under the title card.
- **Mix:**
  - The voice leads.
  - Effects sit 9 LU under the voice.
  - Music bed C is looped on its bar grid and ducked around every line; it is at least 17.8 dB under the voice during
    speech (limit 12).
  - −16 LUFS integrated.
- **Extras per manual:**
  - A silent captioned copy, the SRT, a poster (the title card) and a chapter list with timestamps.
  - The short usage videos from Part B stay as extras in `episodes\`.

**Fixed in my frame-by-frame review before delivery (both manuals re-rendered):**
- The slow push ended too tight on wide pages (Offers, Account, admin lists), so headings touched the frame edge. Every
  target now keeps ≥ 70 px of air at the end of its push.
- On admin pages, a target too wide for a push now gets a slow downward drift at a fixed zoom, so the sidebar is never cut
  and tables keep their right-hand columns.
- The sign-in cards (customer and admin) were cut at the top.
- The add-product dialog: the capture shows the dialog cut at the browser window's bottom edge (y 900), with the
  undimmed page below it. That area is now excluded from the frame. The Create button lies below that edge in the capture,
  so step 20 shows its result (the new product in the list) rather than the click.
- The home page cut its headline at the left edge. It now opens on the whole hero and pushes in to the "Become a customer" button as the narrator names it.

**Deviations, for you to decide:**
- **Admin guide length:** 3 min 17 s, not ~4 min. Every chapter you listed is covered (32 steps), and each step holds
  for its line plus one beat. Longer would mean slower holds or more steps; say which.
- **The home page:** the customer guide shows it framed on the header and the "Become a customer" button, with the
  sample hero stats kept out of frame.
- **App copy:** the app's own copy still ends sentences with periods; that is app text, unchanged.

## Part 3 · The final promo cuts
| File | Length | Loudness | True peak | Effects within ±1 frame | Longest still | Placeholders | Result |
|---|---|---|---|---|---|---|---|
| `promo/promo-60s-music.mp4` | 60.0 s | -14.0 LUFS | -2.5 dBTP | 293/293 | 4 frames | 0 | PASS |
| `promo/promo-60s-nomusic.mp4` | 60.0 s | -14.0 LUFS | -2.6 dBTP | 293/293 | 4 frames | 0 | PASS |
| `promo/promo-30s-music.mp4` | 30.0 s | -14.0 LUFS | -2.4 dBTP | 144/144 | 2 frames | 0 | PASS |
| `promo/promo-30s-nomusic.mp4` | 30.0 s | -14.0 LUFS | -1.5 dBTP | 144/144 | 2 frames | 0 | PASS |
| `promo/promo-15s-vertical-music.mp4` | 15.0 s | -14.0 LUFS | -2.7 dBTP | 62/62 | 0 frames | 0 | PASS |
| `promo/promo-15s-vertical-nomusic.mp4` | 15.0 s | -14.0 LUFS | -1.5 dBTP | 62/62 | 0 frames | 0 | PASS |
| `promo/promo-6s-bumper-music.mp4` | 6.0 s | -14.1 LUFS | -2.7 dBTP | 18/18 | 0 frames | 0 | PASS |
| `promo/promo-6s-bumper-nomusic.mp4` | 6.0 s | -14.0 LUFS | -1.9 dBTP | 18/18 | 0 frames | 0 | PASS |
| `promo/promo-1x1-music.mp4` | 20.0 s | -14.0 LUFS | -2.5 dBTP | 103/103 | 2 frames | 0 | PASS |
| `promo/promo-1x1-nomusic.mp4` | 20.0 s | -14.0 LUFS | -1.2 dBTP | 103/103 | 2 frames | 0 | PASS |
| `promo/promo-10s-loop-music.mp4` | 10.0 s | -14.0 LUFS | -2.2 dBTP | 54/54 | 2 frames | 0 | PASS |
| `promo/promo-10s-loop-nomusic.mp4` | 10.0 s | -14.0 LUFS | -1.7 dBTP | 54/54 | 2 frames | 0 | PASS |

- **Structure:**
  - Every cut re-uses the approved 20 s promo (Gate F re-delivery) for the story beats: chops, the 11:04 PM text, Marco's
    phone, the catalog, Salma's monitor, the stamp, the tape, the van and SENT.
  - New beat shots of the real UI fill the rest, in the same V3.1 language: on the 108 BPM grid, a real tap on the beat,
    whips, no hold over one beat.
  - Every re-used range is shifted by whole multiples of 3 beats, so the cut stays on the grid and on the music.
- **60 s hero:** Marco orders at night → checkout and received → "New orders, first thing" (Salma) → dashboard, the New
  tab → confirm, stamp, tape, van, SENT → invoice and statement with the demo details → "One place for the whole business":
  products, margins, analytics, report → "New customers apply online": apply, leads, the invite → "Your catalog, your
  prices" → catalog, search, offers → end card.
- **30 s:** the promo's story, plus checkout/received, Salma, and the invoice and statement.
- **15 s vertical 9:16 (hook A):**
  - Marco's 9:16 take with the 11:04 PM texts and "One more text".
  - The real phone catalog at full width (native density): a fast scroll through the photos, then "Add to cart" → "1 in cart".
  - Salma's Confirm, cropped from the 2x monitor composite at native size.
  - The driver's 9:16 take, door shut, SENT.
  - The end card.
  - No new generations were needed: the two 9:16 takes were already approved test shots.
- **6 s bumper:** the three chops, then "the chop is the tap", then the end card.
- **1:1:** the 20 s promo in the square between two brand bands; the end card full frame.
- **10 s loop:** the catalog → Confirm → stamp → tape → van → SENT. It ends on paper, which dissolves into its own first
  frames, so it loops seamlessly. The music continues the promo's bed with no fade at the seam.
- **Music and no-music:**
  - Every cut comes in both versions, and the end-card URL is olleik-foods-site.vercel.app.
  - Two no-music mixes (60 s and the loop) were remixed with a lower peak ceiling: their encoded true peak had reached
    −0.8 / −1.0 dBTP. They now measure −2.6 / −1.7.

## QA
- **How it was checked:**
  - Everything was measured on the delivered MP4s (`qa/qa.py`): frames every 0.5 s, the frozen-moment detector, OCR for
    trailing periods and placeholders, ebur128 loudness and true peak, and sync.
  - I reviewed every 0.5 s frame as a viewer, 30 frames per sheet (`out/qa-v32/<file>/review-NN.jpg`).
- **Results:** in `docs\V32_QA_CHECKLIST.md` (pass/fail per file) and the table above.
- **Placeholders:** no `[...]`, "TBC" or other placeholder pattern remains anywhere.
- **Loud hits:** a few are not found as separate onsets in the encoded full mix. They sit under a swell or have a soft
  attack, and each one is within ±1 frame in its isolated stem (the column above).

## Could not solve / for you
1. **Audio:** I can't listen. Sync, loudness and the voice-over-music gap are measured, and every narration line is checked
   by speech recognition; how the voice sounds (Holden, the "Oh-lake" reading) is your call.
2. **Admin guide length:** 3 min 17 s vs ~4 min (see above).
3. **Real business details:** the real registered details must replace the demo ones before handover.
4. **Merge:** the PR is not merged; it waits for your word.

## Changes and spend
- **App:** `src/lib/business.ts` (env overrides with the placeholders as defaults).
- **Videos code:**
  - `src/v3/voiced.ts`, `VoicedFilm.tsx` (the voiced manuals).
  - `src/v3/cuts.ts`, `CutFilms.tsx` (the final cuts).
  - `audio/mix_voice.py` (narration mixer); `audio/mix_v2.py` (bed offset, loop flag, auto music envelope).
  - `voiced.mjs` (sound, SRT and chapter list).
  - `narration/` (scripts, timing index, `check.py`, `retake.py`).
  - `capture/v3-full.mjs` (the `docs` step); `capture/tile.py`.
  - `devstack/dev.mjs` (the demo values).
  - `qa/cuts.sh`, `qa/review_sheets.py`, `qa/final_table.py`, `qa/review-v32.json`.
- **Higgsfield:**
  - 74 speech generations: 4 pronunciation tests, the 55 lines in use, 14 rejected takes and 1 unused alternate. 202
    generations recorded in total.
  - Credits: 507.5 → 471.1.
  - Every generation is in `higgsfield/ledger.json` and `audio-library/LICENSES.md`.
