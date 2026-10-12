# Olleik Videos: Gate F re-delivery (owner notes V3.1)

**Date:** 2026-10-12. **Branch:** `feat/videos` (draft PR #38, **not merged**). **Status:** stopped at **Gate F** again. No final renders.
- Every item of CREATIVE_BRIEF_V3 §9 was treated as mandatory.
- Everything was captured from the LOCAL demo stack; the hosted Supabase was never touched.
- All copy is **Pending Review**.
- Deliverables: `D:\olleik-videos\v3\gate-f2\`.
- Per-file pass/fail checklist: `qa\QA_CHECKLIST.md`.

## The files (all measured on the encoded MP4)

| File | Length | Loudness | True peak | Sync (±1 frame) | Longest still run | Checklist |
|---|---|---|---|---|---|---|
| `promo-music.mp4` (default) | 20.0 s | −14.0 LUFS | −2.5 dBTP | 103/103 effects | 2 frames | PASS |
| `promo-nomusic.mp4` | 20.0 s | −14.0 LUFS | −1.2 dBTP | 103/103 | 2 frames | PASS |
| `visitor-ch4.mp4` + `.en.srt` | 22.8 s | −16.0 LUFS | −2.5 dBTP | 48/48 | 3 frames | PASS |
| `ep1.mp4` + `.en.srt` | 17.6 s | −16.2 LUFS | −3.0 dBTP | 28/28 | 10 frames | PASS |
| V2 line: `v2-animatic-music.mp4` | 15.0 s | −14.0 LUFS | −2.6 dBTP | 50/50 | 12 frames | PASS |
| V2 line: `v2-animatic-nomusic.mp4` | 15.0 s | −14.0 LUFS | −1.7 dBTP | 51/51 | 12 frames | PASS |
| V2 line: `v2-visitor-ch4.mp4` + `.en.srt` | 21.1 s | −16.2 LUFS | −2.9 dBTP | 23/23 | 0 frames | PASS |
| V2 line: `v2-ep1.mp4` + `.en.srt` | 21.1 s | −16.1 LUFS | −3.0 dBTP | 22/22 | 2 frames | PASS |

Format: 1920×1080, 30 fps, H.264 + AAC. Each file also has a `-silent` copy.

**How each measurement was taken:**
- **Sync:** every effect sits within ±1 frame in its isolated stem. The encoded audio's offset from that verified mix is 1 ms.
- **Frozen moments:** a frame counts as still only if nothing anywhere in it moved, measured on blurred luma so grain doesn't count.

## What changed, note by note

1. **Pasted overlays: gone.**
   - The UI is never patched, lifted, scaled or ringed. A tap switches the whole page to the real "after" capture on the tap frame, exactly as the app does. Unchanged pixels are identical, so only what the app changed changes.
   - No click halo, no white patch, no raised cards, no double badge. The cross-dissolves that caused double images are now hard switches.
   - Typing shows the real typed capture. The not-yet-typed text is covered with the field's own white.
   - Engine: `src/v3/World.tsx`.
2. **Morning coffee shot: deleted.** The promo now ends: stamp → tape → van door slams → **SENT** → end card. The V2 animatic also lost its mug scene; it ends on the box landing and SENT.
3. **No trailing periods anywhere.**
   - Every caption, hook line, kinetic type, slip and end card goes through `assertLine()`, so a period fails the render.
   - OCR of every QA frame finds no period on our lines. The only hits are the app's own UI copy (see question 4).
   - Demo data was cleaned and re-seeded locally: the note is now "Back door, before 9 please", and addresses like "Placeholder Road" are gone.
4. **Screen composites: rebuilt.**
   - **New takes:** a flatter phone shot and a frontal monitor shot (Higgsfield).
   - **Fit (`capture/composite2.py`):** the screen corners are fitted from the screen's real edges (no overscan, true perspective), with a soft key, composited at 2x and downsampled.
   - **Phone:** the portal header is fully visible, including in the punch-in.
   - **Monitor:** shows the admin captured at the monitor's own size (1152 × 720, 16:10), so it is sharp and readable.
5. **Rhythm doubled.**
   - **Promo:** 19 shots instead of 9, all on the 108 BPM grid. Each knife chop is a tap: match cuts between the knife and the real catalog. Then punch-ins, whips and speed-ramped camera moves.
   - **Manuals:** about half their former length (Visitor Ch.4 44 → 23 s, EP1 33 → 18 s).
   - **Holds:** no hold longer than one beat anywhere, measured.
6. **Strict self-review.**
   - `qa/qa.py` runs on each encoded MP4: frames every 0.5 s, the frozen-moment detector, OCR for periods and placeholders, loudness and true peak, and sync.
   - I reviewed every QA frame by eye and fixed and re-rendered before sending. The issues found are listed per file in the checklist, for example: a phone punch-in that cropped the header, a double image on the New tab, a sidebar sliver at the frame edge, held end cards, a click transient that peaked at −0.2 dBTP after AAC.
7. **V2 vector line brought up to the same notes.**
   - Faster, no periods, no tap rings, no mug scene.
   - Callouts only on informational beats.
   - Re-captured with product photos.
   - The phone, the slip and the warehouse monitor all show the same order, #5928f131.

**Licences:**
- 21 new Higgsfield generations (13 start frames, 8 Kling clips). Each is logged with prompt, model and used/rejected status in `higgsfield/ledger.json`, `prompts_gate_f2.json` and `LICENSES.md`. Total: 116 generations.
- All 86 sound files in the mixes have licence rows.
- This round cost about 126 credits (699.5 → 573.5).

## Questions for you
1. **Approve this promo structure and pace** as the base for the 60/30/15 s cuts?
2. **Approve the manual language** (live hook, one camera per page, real page switches, captions in a lower band) for the full visitor manual and admin episodes 2–5?
3. **Invoice:** the app's invoice header still shows "[LEGAL NAME TBC]" etc., so the invoice page stays off screen in both lines. Set the business details in the app, or keep it off screen?
4. **The app's own UI copy ends sentences with periods**, for example "We deliver on your usual route." and "Order received — thank you! We'll confirm it shortly." I left the real product text as it is. Changing it is an app change for you to decide.

## Known limits
- I can't listen. Sync and loudness are measured; whether the mix feels right is your call.
- The admin dashboard shows the local database's live numbers (for example, today's revenue $0.00 in the V3 episode). That is real data from the demo stack, not a placeholder.
