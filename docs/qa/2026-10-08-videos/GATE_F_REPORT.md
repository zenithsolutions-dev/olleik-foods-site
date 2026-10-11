# Olleik Videos V3: Gate F Report (Phase B proofs)

**Date:** 2026-10-11. **Branch:** `feat/videos` (draft PR #38, **not merged**). **Status:** stopped at **Gate F**. No final renders.
- The hosted Supabase project was never touched; everything was captured from the local demo stand-in.
- All copy is **Pending Review**.
- Deliverables are in `D:\olleik-videos\v3\gate-f\`.

## The three proofs
| Proof | File | Length | Loudness (encoded MP4) | True peak | Effects within 1 frame |
|---|---|---|---|---|---|
| 20 s promo, with music (bed C), the default | `promo-music.mp4` | 20.0 s | −14.0 LUFS | −2.3 dBTP | 98 / 98 |
| 20 s promo, no music | `promo-nomusic.mp4` | 20.0 s | −14.1 LUFS | −1.3 dBTP | 98 / 98 |
| Visitor manual, Chapter 4 "Ordering" | `visitor-ch4.mp4` + `visitor-ch4.en.srt` | 44.2 s | −16.5 LUFS | −2.2 dBTP | 45 / 45 |
| Admin Episode 1 "Orders" | `ep1.mp4` + `ep1.en.srt` | 33.2 s | −16.5 LUFS | −2.9 dBTP | 26 / 26 |
| Fixed hooks (standalone) | `hook-D.mp4`, `hook-A.mp4` | 3 s each | −13.9 / −14.4 LUFS | −2.7 / −2.9 dBTP | 11 / 11, 16 / 16 |

- **Format:** all files are 1920×1080, 30 fps, H.264 + AAC 256 kb/s. Every proof also has a `-silent` copy.
- **Measurement:** loudness and true peak were measured with ffmpeg ebur128 on the final MP4s. Sync was checked with each
  effect type on its own track; in the full stem, 93–100 % land within a frame, and the rest are quiet sounds masked by a
  louder hit on the same frame.
- **QA frames:** taken from the encoded files, in `qa\`.

## The promo, beat by beat (108 BPM; the grid starts on the first chop)
1. **0:00, D "Two hands."** A clean, single-knife take. Each real knife impact is re-timed onto a beat. At 1.5 s the frame
   splits and every chop drops a real catalog card (basil, then lemons) into the real cart, and the badge counts.
2. **0:03, match cut on the downbeat into A "11:04 PM text."** Messages pile up beside the phone ("price list v3 (final)
   (2)" … ending on a small joke, "you up?"), and the unread pill climbs to 37. "One more text." lands on beat 8.
3. **0:06, Marco's phone, over the shoulder.** The **real portal is composited into the green screen**: planar-tracked,
   with his thumb staying in front of the screen. His thumb taps "Add to cart" and the screen flips to "1 in cart".
4. **0:08, push through the screen, then a match cut on the cheddar photo** into the desktop catalog. One continuous
   camera, two more taps reacting in the shot. The badge lands "3" on the beat, with "Your catalog. Your prices." and
   "Three taps." bound to the page.
5. **0:12, the order slip** (the real local order #ca6e00ac: Copperleaf Kitchen, 3 items, Delivery, "Back door, before 9
   please.") prints out of the cart and shoots up out of frame.
6. **0:13, the slip lands on Salma's bench.** Her **monitor shows the real admin order** (composited). Her rubber stamp hits
   the slip on the same frame the screen flips from "Confirm order" to "Mark prepared", and the CONFIRMED ink appears as the
   stamp lifts.
7. **0:16, the driver squares the box. SENT** slams on it on the beat, then a light flash into morning.
8. **0:17, "Morning."** Marco's relieved smile over his coffee, his phone face down: the relief beat.
9. **0:19, end card:** "The supplier behind great kitchens.", "Become a customer →" and the site address.

**Sound.**
- **The pulse:** a box thud on every beat and a knife chop on the off-beats, from A's line to the end card.
- **Story sounds on their frames:** buzz, thumb tap, printer, slide, stamp, SENT, mug, end bell.
- **Bed C** (marimba, Higgsfield, conformed to 108 BPM) sits about 6 LU under the effects. It enters on "One more text.",
  ducks under the hits and fades on the end card. The no-music version is the same mix without the bed.

## Manuals in the new camera language
- **The page rule holds:** one continuous camera per page, and page changes only on a motivated whip pan.
- **Taps change only what the app changed.** `capture/diffs.py` diffs consecutive real captures and finds the exact
  changed rectangles:
  - the button turns into "1 in cart", and the cart badge counts;
  - Pickup becomes Delivery, and the note types on;
  - the New tab filters the list;
  - New → Confirmed → Prepared → Completed changes the action bar, the status badge and the sidebar's "3 new" → "2 new".
- **Each 2 s hook is a live-action insert:**
  - Visitor: Marco at night, "Running low again?" (new line, Pending Review).
  - Admin: Salma, "Three new orders, and the day just started." (the approved problem line). The demo DB now really has
    three new orders.
- **Captions:** the approved EPISODE_PLAN_V2 lines, burned in, plus the `.en.srt` files.
- **Photos:** only where the app shows them, which is the catalog. Cart, checkout and order screens are the real
  text-only UI.
- **Overscroll margin:** pages that end right below their last button got a margin under the page, made by repeating the
  page's own last pixel row (`capture/tile.py`, documented). The camera can then frame that button above the caption band.
  Nothing in the UI is added or changed.

**Needs your decision: the invoice is not shown.** The app's invoice header still reads "[LEGAL NAME TBC]",
"[STREET ADDRESS], Ottawa, ON [POSTAL CODE]" and "[PHONE] · [EMAIL]" (the business details are not set). The brief forbids
placeholders on screen, so Episode 1 ends on the order's Invoice button with the caption "Every order has an invoice to
print or save." and never opens it. Once the real legal name, address and contact are set in the app, the invoice beat
can be added back.

## Fixes asked at Gate E
- **Hook D:** regenerated from a cleaner start frame (low side angle, single knife, the guide hand flat and far from the
  blade). I checked every second frame of the chosen take for a second knife or a hand near the blade; there are none. The
  two other takes were rejected (odd arm swings; the hand near the blade). The take is cropped to drop a paper notice on
  the back wall and time-remapped so each knife impact lands on a beat. The old clip with the doubled knife is no longer
  used anywhere.
- **Hook A:** the unread count is now a pill above the message stack, so it can't overlap a bubble. The bubble lines are
  the approved illustrative ones.
- **Hook B:** dropped, as decided.

## How the real UI gets into the live shots (`capture/composite.py`)
1. Generate the phone and monitor with a flat chroma-green screen (Higgsfield, approved references).
2. Key the screen in HSV, so fingers in front of it stay in front.
3. Track the screen: SIFT features on the bezel and hand ring, matched to the least-occluded frame with a RANSAC homography
   per frame (no chained drift), then one ECC refinement on the key mask.
4. Perspective-warp the real capture into the screen with a slight overscan; the key decides which pixels change. Add a
   faint glow and suppress green spill on the hand edges.
5. Switch the UI state on the frame of the on-screen action: the thumb tap, or the stamp hitting the slip.

## Also changed
- **Local demo DB (local only):** removed the two Gate E/F test orders, restocked the salmon (it had 0 stock, which forced
  an oversell warning on Confirm), and re-captured one consistent run: catalog → cart → checkout states → order #ca6e00ac →
  admin dashboard, orders, every status. Generated photo PRD-007 is also loaded.
- **Code:**
  - `videos/src/v3/{Promo20.tsx, promoTiming.ts, promoEvents.ts, manuals.ts, Episode3.tsx}`;
  - `World.tsx` gained plate states and swap/wipe patches, and patches now expire after their reaction;
  - camera validator messages now name the page;
  - `capture/{composite.py, diffs.py}`, `capture/v3.mjs` (manuals step), `tile.py` (overscroll);
  - `audio/mix_v2.py`: recorded bed and WAV true-peak option;
  - `v3.mjs`: per-variant audio directories.
- **Higgsfield:** 17 new generations (8 start frames, 9 clips), all logged with prompts, models and status in
  `higgsfield/ledger.json`, `prompts_gate_f.json` and `LICENSES.md` (95 generations in total). Spend this gate: about 95
  credits (794 → 700).
- **Sounds:** all 80 sound files used across the V3 mixes have licence rows.

## Known limits (honest list)
- I can't listen. Sync and loudness are measured; whether the bed and pulse feel right is your call.
- The composited phone UI is slightly soft (the green screen is about 700 px tall), and its top edge sits under the bezel,
  so the portal header is partly hidden.
- Hook D in the master runs about 1.6x faster than the take was shot, with variable speed between impacts: a deliberate
  speed ramp, visible if you look for it.
- On Episode 1's Complete tap, the page reflows (the action bar becomes a notice), so for 8 frames the old and new content
  cross-fade.

## Questions for you (Gate F)
1. Approve the promo proof's structure and pace, D → A → phone → catalog → warehouse → SENT → morning → end card, as the
   base for the 60 s, 30 s and 15 s cuts?
2. Approve the manuals' language (live hook, one camera per page, diff-patched taps, captions) for the full visitor
   manual and the other admin episodes?
3. **Invoice:** fill in the real business details in the app so the invoice can appear, or keep it off screen?
4. The new visitor hook line "Running low again?": keep it or change it?
