# Olleik Videos V2: Gate C Report (Phase 1 of CREATIVE_BRIEF_V2)

Date: 2026-10-08. Branch `feat/videos` (draft PR #38, **not merged**). Stopped at **Gate C**. No final renders, no AI
media, no new downloads. All copy **Pending Review**.

## Delivered (copies in `D:\olleik-videos\v2\`)

| Item | File | Notes |
|---|---|---|
| Hero storyboard “The night before” (60 s) | `storyboards\V2-hero-60s-storyboard.png` | 23 stills rendered from the actual scene code (`videos/src/v2/HeroFilm.tsx`), each with its story beat and its sound |
| Character model sheet | `storyboards\V2-characters-model-sheet.png` | Marco (tired, surprised, focus, relieved, wink, blink), Salma (calm, focus, stamp, smile, wave), driver (hands only). Flat 2D vector rigs built in code (`videos/src/v2/characters.tsx`): head turn, blink, brows and mouth per expression, two-joint arms, lean, hand props. No real faces, no stock, no AI |
| Visitor manual storyboard “Marco's First Order” | `storyboards\V2-VISITOR-storyboard.png` | 16 beats, 1:22, Marco as guide |
| Admin episodes 1–5 storyboards | `storyboards\V2-EP1…EP5-storyboard.png` | Orders 0:38 · Customers and Approvals 0:32 · Products and Prices 0:32 · Margins and Reports 0:32 · Invites and Access 0:31; Salma as guide |
| Promo copy V2 | `PROMO_COPY_V2.md` | the hero scene by scene with every on-screen word, 4 hooks, 6 cuts, the changes made against the brief and why |
| Sound plan | `SOUND_PLAN_V2.md` | moment-by-moment sound for the hero, the inventory (what is in the licensed library, what is in the licensed index, what must be sourced), music-bed option, manuals' sound |
| Episode plan | `EPISODE_PLAN_V2.md` | every beat of the visitor manual and the five episodes: screen (real capture), callout target, step, caption, guide gesture |

## How V2 is built (and what stayed)
- **Stayed:** the 3× captures (no re-capture was needed), the local fictional demo stack (stopped; its data is kept for
  Gate D), the Remotion engine, the audio tooling and licences.
- **New:** `videos/src/v2/` — look (palette, easing), characters, story props (phone and monitor that show real captures,
  chat bubbles, order slip, rubber stamp, chips with the portal's real labels and colours, hand-drawn marker circle,
  arrow and underline, three flat sets: night kitchen, warehouse, morning kitchen, film grain), `HeroFilm.tsx` (a real
  animated 60 s timeline, already the base of the Gate D animatic), `Episode.tsx` (manual episodes), `hero.mjs` and
  `episodes.mjs` (one timing model for picture, sound plan and documents), `v2-board.mjs`, `episode-plan.mjs`.
- The V1 reference-style promo is dropped visually; its files stay in the repo for reference.

## Decisions against the brief (for your review)
1. **“6:00 AM” → “Morning.”** A clock time on the delivery reads as a delivery-time promise, which the compliance list keeps
   out. One-word change if you approve the time.
2. **Marco's “Sent.” → “Done.”** so the SENT stamp at the end stays the payoff.
3. **The order slip** that prints from the phone is a story device; the product does not print tickets. It is never named
   as a feature. Alternative: a paper plane or envelope with the same motion.
4. **Episode 5 “Invites and settings” → “Invites and Access”.** The product has no settings page; the episode covers the
   portal invite (email or copy link), catalog visibility and the admin email allowlist — all real.
5. **Stamp red** (`#b5452b`) is the only colour outside the brand palette, used only for stamps.
6. **Placeholder rule:** the visitor manual's opening crop was tightened so the site's placeholder stats (“1,500+ SKUs”,
   “6 days/wk”, “Same-day”) are out of frame. No “[LEGAL NAME TBC]”, testimonials or “(000) 000-0000” appear anywhere.
7. **Characters vs the playbook:** the video-factory playbook (written for an earlier project) says “no characters, no story
   scenes”. Your brief for this project asks for both, so the brief wins here; I recorded it as a project-specific choice
   and proposed a playbook change rather than editing the locked rule.

## Known polish items (fixed in the Gate D animatic, not blocking review)
- H01 close-up: “One more text.” sits partly behind Marco's shoulder on the close frames.
- H09: the “Your catalog. Your prices.” line overlaps the shelf; the second box floats against the door.
- H05: the first frame of each whip is very blurred by design; check the speed feels right in motion.
- Manuals: the hand-drawn circle can run past the browser frame edge on wide targets.
- The guide's arm poses are deliberately simple; at Gate D they get eased keyframes (point, thumbs, wave) and a nod on
  each caption.

## Gate D (after your approval) — the plan
A 15 s animatic/proof with characters and sound (chaos → tap → three taps → morning + SENT → end), both no-music and quiet-bed
versions, loudness and sync measured on the MP4; source the missing sounds (phone buzz, printer, paper tear, tape, door
swing) with recorded licences first. Then stop again.

## Questions
1. Approve the characters (model sheet), the story and the words in PROMO_COPY_V2?
2. Default hook A “One more text.”, or B/C/D?
3. “Morning.” or “6:00 AM”?
4. Keep the order slip, or switch to a paper plane / envelope?
5. Music version: which bed (A, B or C from V1, rearranged sparse at 100 BPM), or a new one?
6. AI-generated live-action people (brief option) stay off unless you approve the credits.
7. Arabic caption versions (phase 2) only if you confirm.
