# Promo Copy V2: "The night before"

**Status: every line is PENDING REVIEW** (owner and client). Nothing is approved. Follows
`docs/qa/2026-10-08-videos/CREATIVE_BRIEF_V2.md` and replaces the visual and story direction of `PROMO_COPY.md`
(the V1 copy stays on file for reference). Timing lives in `src/v2/hero.mjs`; stills in
`out/storyboards/v2/V2-hero-60s-storyboard.png`.

## Principles applied
- A short film, not a slideshow: few words, big, moving with the action (slides, skews, whips), never a title over a
  screenshot. Real product footage appears only inside the story (Marco's phone, Salma's monitor).
- People: Chef Marco (owner of the fictional Copperleaf Kitchen, the same demo account the phone footage shows) and Salma
  (warehouse lead at Olleik); the driver appears as hands only. Flat 2D vector characters built in code; no real faces,
  no stock, no AI media.
- Compliance (unchanged from PROJECT_BRIEF section 8): no prices, discounts, minimums, terms, delivery times or windows,
  stock counts, statistics, testimonials, real names, comparisons, guarantees, or health / freshness / origin claims.
  The placeholder rule stays: no "[LEGAL NAME TBC]", no fake stats or testimonials, no "(000) 000-0000" in any frame.

## Hero 60 s (16:9), scene by scene

| Scene | Time | What happens | Words on screen | Status |
|---|---|---|---|---|
| H01 chaos | 0:00–0:05.5 | 11:04 PM, empty kitchen, pendant light. Marco slumped over his phone; chat bubbles, a PDF price list, a missed call, a voice note and a "price changed again?" (shown as `$?? → $??`, no figure) fly at the camera; cuts between wide and close every 12 frames | `11:04 PM` · `One more text.` · bubble texts: “price list v3 (final) (2)”, “Can you do 4 cases by Fri??”, “Missed call (3)”, voice note “0:47”, “price changed again?”, “send me the new list pls” (illustrative, not quotes) | Pending Review |
| H02 tap | 0:05.5–0:08 | Speed ramp to a stop. One finger, one amber ripple, half a second of quiet; the bubbles snap into a clean grid of tiles (chaos → catalog) | none | Pending Review |
| H03 catalog | 0:08–0:12 | The grid becomes his real catalog on the phone (portal capture, demo data); the phone rises into his hand | `Your catalog.` (slides in with the phone) | Pending Review |
| H04 prices | 0:12–0:15 | Push-in on the real YOUR PRICE badge | `Your catalog.` `Your prices.` (accent) | Pending Review |
| H05 three taps | 0:15–0:20 | Add to cart → checkout (delivery, note) → submit, each tap a whip pan between real screens; counter 1 · 2 · 3; lands on the real “Order received” screen | `Three taps.` · `1 2 3` | Pending Review |
| H06 slip | 0:20–0:23 | A paper order slip prints out of the phone (story object: an illustration of the order travelling, not a product feature); Marco exhales and smiles; whip right | `Done.` · slip: COPPERLEAF KITCHEN · Order #15d6e77c · 3 items · Delivery · Note: Back door, before 9 please. (fictional order from the local demo data; no prices) | Pending Review |
| H07 warehouse | 0:23–0:36 | Match cut: the slip slides onto Salma's bench at Olleik. Her monitor shows the REAL admin order screen; she confirms (screen flips to the real confirmed state), stamps the slip, three boxes build themselves, the chip flips Received → Confirmed → Ready | `OLLEIK FOODS · WAREHOUSE` · chips `RECEIVED` / `CONFIRMED` / `READY` (the portal's real labels) · stamp `CONFIRMED` · box label `COPPERLEAF` | Pending Review |
| H08 handoff | 0:36–0:38 | Whip pan: the driver's hands carry a box across the frame | none | Pending Review |
| H09 morning | 0:38–0:54 | Morning at Marco's: sun through the window, door bell, the door swings, two boxes land, Marco with his coffee, then a wave; half a second of quiet; the SENT stamp slams over the boxes | `Morning.` · `Your catalog. Your prices.` · stamp `SENT` | Pending Review |
| H10 end | 0:54–1:00 | End card: mark, wordmark, the site's tagline, the button, the address | `Olleik Foods` · `The supplier behind great kitchens.` · `Become a customer →` · `olleik-foods-site.vercel.app` | Pending Review |

Captions: the words above ARE the burned-in text (the film has no dialogue and no voiceover). The SRT carries the same
lines with their times, plus `[phone buzzing]`, `[door bell]` style sound tags for viewers with the sound off.

## Hooks (same story; the first 2 s are always the chaos, no logo)

| Id | Line | How it plays | Status |
|---|---|---|---|
| A (default) | One more text. | lands at 1.6 s over the flying bubbles | Pending Review |
| B | Still ordering supplies by text? | replaces A at the same moment (brief option) | Pending Review |
| C | 11:04 PM. One more text. | clock and line together in the first second (brief option) | Pending Review |
| D | Your supplier, in your pocket. | the chaos runs wordless; the line lands on the tap (H02) (brief option) | Pending Review |

A/B plan: render A, B and C as alternative openings of the 30 s and the 15 s vertical (D needs the tap in the first
3 s; test it on the 6 s bumper only).

## Cuts (all from the same scenes)

| Cut | Format | Uses | Status |
|---|---|---|---|
| Hero 60 s | 16:9 | H01–H10 as above | Pending Review |
| 30 s | 16:9 | chaos 3 s · tap 2 s · prices + three taps 8 s · slip 2 s · warehouse: confirm + stamp + chip 7 s · morning: door + smile + SENT 5 s · end 3 s | Pending Review |
| 15 s vertical | 9:16 | chaos 4 s → tap 2 s → three taps on the phone, full height 4 s → morning + SENT 3 s → end 2 s | Pending Review |
| 6 s bumper | 16:9 and 9:16 | the tap and the snap 2 s → SENT on the morning 2 s → end card 2 s | Pending Review |
| 1:1 | 1080×1080 | the 30 s edit, characters re-staged for the square safe area | Pending Review |
| Loop 10 s | 16:9, silent | slip → boxes build → driver → door → back to the slip (match cut at the seam); no words except the logo | Pending Review |
| Versions | all cuts | **no-music** (sound design only) and **with a quiet music bed** (see SOUND_PLAN_V2.md) | Pending Review |

## Changes against the brief, and why (decide at Gate C)

1. **“6:00 AM” → “Morning.”** A clock time on the delivery implies a delivery time, which the compliance list keeps out
   (no delivery times or windows until the client approves them). If the owner confirms a morning delivery promise is
   fine to show, “6:00 AM” is a one-word change.
2. **Marco's line when the order goes is “Done.”**, not “Sent.”: the brief's SENT stamp lands at the end, so the word
   is saved for that payoff.
3. **SENT stamp colour:** stamp red (`#b5452b`), the only colour outside the brand palette, used only for stamps.
4. **The printed slip** is a story device (the order travelling to the warehouse). Olleik's product does not print order
   tickets; the slip is shown printing out of the phone in a stylised way and is never named as a feature. If the client
   would rather avoid any possible confusion, the slip can become a paper plane or an envelope with the same motion.
5. **Marco = Copperleaf Kitchen.** The phone footage shows the demo account “Copperleaf Kitchen”. Its demo contact is
   “Nadia Haddad” in the seed; that name never appears in the hero, but if the account page is ever shown, I will rename
   the demo contact to a fictional “Marco” and re-capture.
6. **Settings episode:** the product has no settings page; admin episode 5 is “Invites and Access” (see EPISODE_PLAN_V2.md).

## Open questions for the owner
- Approve the story, the characters (model sheet) and the words above.
- Hooks: keep A as default?
- Music: ship both versions (the brief asks for both); for the music version, which bed (A, B or C from the V1 pack, or a
  new softer bed)?
- “Morning.” or “6:00 AM”?
- AI-generated live-action people for the hero scene (brief option): not used; needs your explicit approval and credits.
- Arabic caption versions (phase 2): not started; only if you confirm.
