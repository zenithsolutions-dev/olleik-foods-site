# Olleik videos — Creative brief V3 (owner feedback on Gate D proofs)

Status: Pending Review. Supersedes V2 direction where they conflict. Keep: local fictional demo stack, audio tooling, licence discipline, loudness/sync QA, gates.

## 0. Owner feedback on the Gate D proofs (verbatim intent)
1. Videos are clean but have no soul: no hooks that grab you.
2. The same page is cut as if it were a new scene every time a button is tapped. A tap on the same page must never feel like a scene change.
3. The zoom is crude: it distorts the layout and hides the site's features.
4. The site has no product photos and looks bare. The videos must show product images, done the right way (research the proper technique, don't fake it badly).
5. Real people are allowed. Use Higgsfield for the promo. Credit consumption is NOT a constraint; do not ask about it again.
6. Motion design must not fragment scenes. Treat each page as one big world the camera travels through, pulling the viewer from spot to spot.
7. Creativity, distinctiveness, out-of-the-box ideas. Music vs rhythm-only is the session's own creative call; decide and justify.
8. Apply all of this to the usage videos too, not only the promo.

## 1. Non-negotiables (carry over)
- Fictional demo data only; never touch the hosted Supabase project.
- No placeholders on screen ("[LEGAL NAME TBC]", fake stats, "(000) 000-0000"), no delivery-time promises (no clock on delivery).
- Every external asset (sound, image, clip, font) gets a licence row BEFORE use. Higgsfield outputs: record generation IDs, prompts, model, date and the terms of use in LICENSES.md.
- Measured QA on encoded files: loudness, true peak, effect sync within one frame, QA frames pulled from the MP4.

## 2. Camera language: "one page, one world" (fixes feedback 2, 3, 6)
- One continuous camera per page. The camera glides, pans, tilts and dollies across the captured page; it NEVER hard-cuts because of a tap. A tap produces a reaction in the same shot (chip flips, cart badge bumps, row appears) while the camera is already moving to where the result lands.
- Zoom rules: never scale a capture above its native 3x pixel density (so UI never blurs or distorts); max zoom factor 1.6x of the full-frame framing; every push-in is an eased dolly with motion blur, never a jump; the layout must stay recognisable (keep at least one anchor like the nav or the page title in frame during the move).
- Parallax: split captures into layers (background page / cards / floating chips and badges / cursor-finger) so camera moves have depth. Document the layering method in the engine.
- Cuts happen only at story beats (page change, location change, time change) and are motivated: match cut on a shape, a whip pan, a light change, a hand passing the lens.
- Study and emulate: Apple product-page scroll films, Stripe/Linear launch films, Figma Config openers, Cash App and Duolingo ads. Write a one-page "motion notes" file with the specific techniques you borrow (long-take UI travel, speed ramps, kinetic type bound to UI elements, object-to-UI morphs).

## 3. Hooks (fixes feedback 1)
- The first 1.5 s must be a pattern interrupt with no logo and no UI: a sound and a picture that make you ask "what is this?".
- Produce 5 hook candidates as 3-second motion tests (not stills) and rank them. Starting points:
  H-A "The 11:04 PM text" (chef's thumb hovering, 37 unread, kitchen dark).
  H-B "Price roulette" (same tomato crate, five different prices spin like a slot machine, lock on one: "your price").
  H-C "Receipt rain" (dozens of paper slips fall, one lands flat and turns into the Olleik order screen).
  H-D "Two hands" (a knife chopping in rhythm; each chop is a tap that adds an item to the cart).
  H-E "The wall of sticky notes" (a supplier wall of handwritten orders peels away into one clean catalog grid).
- The chosen hook sets the rhythm for the whole film (see section 6).

## 4. Product images (fixes feedback 4) — do it the right way
The product has letter tiles because no photos exist. For the videos:
1. Generate a consistent product photo set with Higgsfield (generate_image): one style guide prompt (warm paper backdrop, soft top light, 3/4 angle, no text, no brand marks), one image per demo product (30 products), same lens and lighting. Keep a reference element for style consistency.
2. Put the generated images INTO the local demo stack (upload to the local storage stand-in or inline URLs served locally, set the product image field), then RE-CAPTURE the catalog, cart, checkout, product editor and order screens. The video then shows the real UI rendering real image fields; nothing is pasted over the UI.
3. If the product has no image field, add the images only in the videos' local copy (document exactly what was changed and mark it "video demo stack only"); never commit app changes for this without owner approval. Also write a one-paragraph product recommendation: the site needs real product photos at launch.
4. Hero product shots in the promo may be Higgsfield video (slow macro pans of produce, steam, flour dust) matched to the same style guide.

## 5. Real people via Higgsfield (feedback 5)
- Cast: Marco (chef, 40s, tired-then-relieved), Salma (warehouse lead, calm), a driver (hands and silhouette). Build each as a reference element first for consistency across shots (use ai_influencer_prepare / manage_reference_elements or the character-sheet workflow; read get_workflow_instructions first).
- Shot list to generate (each 3–6 s, 24 fps, 16:9 and 9:16 variants): kitchen at night, thumb on phone; close on tired eyes lit by the phone; warehouse, Salma reading a screen and nodding; hands stacking boxes; van door closing; morning light, boxes on the doorstep; Marco's small smile.
- Rules: no visible text on generated screens (the real UI is composited into phones/monitors from the captures), no logos, no recognisable real places. Generate 2–3 takes per shot, pick the best, log every generation ID.
- The vector characters from V2 stay only for the manuals' corner guide, if at all; the promo uses the live-action people.

## 6. Sound and music (feedback 7) — recommended decision
- Decision: rhythm-led. The film is cut to a percussive pulse built from the story's own sounds (chop, tap, stamp, printer, box thud) at a fixed tempo (108 BPM for the 60 s, same grid for every cut). A real music bed is added UNDER the pulse from the hook's snap point to the end card, generated with Higgsfield audio (generate_audio) in 3 candidates matching the tempo; replace the MIDI-sounding candidates A/B/C. Ship with-music as the default and no-music as the alternate. Justify any deviation in the report.
- Loudness: promo −14 LUFS, manuals −16 LUFS, true peak ≤ −1 dBTP.

## 7. Usage videos (feedback 8)
- Same camera language: one continuous travel per page, taps react in-shot, no cut per click, zoom rules apply, product images visible.
- Visitor manual "Marco's First Order" (~90 s) and the five admin episodes (30–45 s each) stay as the structure. Each opens with a 2-second hook of its own (a question or a small problem on screen), not a title card.
- Hand-drawn callouts stay but travel with the camera. Captions burned in (EN) plus SRT.
- Optional: short live-action inserts (Higgsfield) at the start and end of each episode (Salma at her desk, Marco in the kitchen) to carry the story; keep under 4 s each.

## 8. Deliverables and gates
Phase A (Gate E): motion-notes page; 5 hook motion tests (3 s each) with a ranked pick; style-frame set; product photo set generated and loaded into the local stack with 6 re-captured screens; 3 Higgsfield people test shots (one per character) and 3 music candidates; a 10 s continuous-camera test on the catalog page (no cuts, taps react in-shot) with sound. STOP and report.
Phase B (Gate F): 20 s promo proof with the chosen hook, real people, product images and music; one full visitor chapter and one admin episode in the new camera language. STOP and report.
Phase C: final renders of all cuts and manuals, QA, licences, REPORT.md, delivery to D:\olleik-videos\final\, local DB removed. No PR merge without the owner's word.

## 9. Owner notes on the Gate F proofs (V3.1, 2026-10-11) — Gate F is NOT approved
1. Pasted-on overlays are visible and must go: the cursor click halo, the floating "Cart 3" pill sitting in a white patch over the header, the double-layered RECEIVED badge. Tap reactions must be invisible as technique: patch only the exact pixels the app changed, matched to the page background, no white rectangles, no rings, no raised chips. If a patch cannot be made invisible, use the real "after" capture instead.
2. Remove the morning coffee shot (Marco smiling with the mug) from the promo entirely. End on the SENT stamp and the end card; find a different, faster closing beat if one is needed.
3. No trailing periods on any on-screen line: "One more text" not "One more text.", "Three taps" not "Three taps.", "Morning" is gone with its shot. Apply across promo, hooks, manuals, episodes and end cards.
4. Screen composites (phone and monitor) are not right: the phone UI is skewed and the header sits under the bezel; the monitor UI is soft and unreadable. Required: UI sharp at the delivered resolution, true perspective fit to the actual screen rectangle, header fully visible, no spill, no drift. Composite at 2x the delivery size and downsample. If a generated shot cannot be fitted cleanly, regenerate the shot with a flatter screen angle.
5. Rhythm: faster. Fast motion graphics, no shot holds for more than one beat without something moving, smooth eased motion with momentum, speed ramps on transitions. Cut density roughly double the Gate F proofs. Same rule for the manuals and episodes.
6. Strict self-review before delivery: pull QA frames every 0.5 s from the encoded files, inspect each one for pasted overlays, misaligned screens, clipped text, placeholders, trailing periods and frozen moments; write a checklist with pass/fail per file; fix and re-render before sending anything.
7. Continue the Gate D (V2) work too: the vector-character animatic and manuals from V2 are kept as a second style line and are brought up to the same notes (speed, no periods, clean overlays), so both lines are delivered.

## 10. V3.2 (2026-10-12): demo business details, two voiced user manuals, then the final promo
Usage videos (Part B/C) and the Gate F re-delivery are approved as a base. Three additions, in this order.

### 10.1 Demo business details in documents (owner decision: fill everything with demo values)
- Source: `src/lib/business.ts` hard-codes the placeholders and 19 pages read it through `getBusinessIdentity()`.
- Change (small, on the videos branch): read each field from an env var (`BUSINESS_LEGAL_NAME`, `BUSINESS_ADDRESS`, `BUSINESS_PHONE`, `BUSINESS_EMAIL`) with the current placeholder as the default, so Vercel and `main` behave exactly as before. Set the demo values only in the videos' local demo launcher (`.claude/launch.json` entry and `videos/devstack` env), never in `.env.local` or the hosted project.
- Demo values (clearly fictional, Pending Review): legal name "Olleik Foods Ltd.", address "120 Market Street, Ottawa, ON K1A 0B1", phone "(613) 555-0142", email "orders@olleik-demo.test". Keep tax disabled.
- Then re-capture every document screen (customer invoice, admin invoice, customer statement, admin statement, products statement, low-stock, out-of-stock, reports) and drop the forbidden-box rule for document headers. Episode 1 / the admin manual may now open the invoice.
- Report line for the owner: these are demo details; the real registered details still have to be entered before handover.

### 10.2 Two voiced user manuals (the main deliverable)
Model: the Marwah Amer manuals (narrated, calm, numbered steps, chapters), produced in the V3 engine.
- Deliverables: `USER_MANUAL_VISITOR.mp4` (one film, about 2 min: home and apply, sign in, catalog with photos, cart and checkout, order status, invoice and statement, offers and account) and `USER_MANUAL_ADMIN.mp4` (one film, about 4 min, chapters with title cards: dashboard and orders incl. invoice, customers and approvals incl. invite, products and prices, margins and reports, documents). Both 1920x1080 30 fps, voice + captions, plus a silent captioned copy, an SRT, a poster, a chapter list with timestamps. The short episodes stay as extras.
- Pace: narration-led, not the promo's doubled rhythm. Each step holds as long as its narration line plus one beat; camera moves stay smooth and continuous (V3 rules: no cut on taps, zoom cap, anchors, no pasted overlays, no trailing periods on screen). Slick and simple: one idea per step, a numbered step badge, a cursor or finger that really taps, a soft low music bed (bed C sparse) under the voice.
- Narration: write `videos/narration/VISITOR.json` and `ADMIN.json` (id, text, targetSeconds), calm professional English, short sentences, no marketing claims, no delivery-time promises, no prices spoken, no real names. Files are Pending Review.
- Voice: owner-approved per-project exception to the playbook's "never generate voice" rule: generate with Higgsfield speech (prefer the voice used for Marwah Amer, Harrison id 573e5163-59b3-4926-aab1-951ef2985f81, or a close equivalent) one WAV per line into `videos/narration/audio/`; test the pronunciation of "Olleik" first and, if needed, spell it phonetically in the narration text only (on screen stays "Olleik"). Log the exception in PROPOSED_RULE_CHANGES.md and every generation in LICENSES.md.
- Mix: voice on top at -16 LUFS integrated for the file, music ducked at least 12 dB under the voice, effects as before, true peak <= -1 dBTP; sync of every effect within one frame; narration lines must start within 5 frames of their step's first frame.
- QA: the existing per-file checklist plus: every narration line audible and not overlapping the next; captions match narration meaning; no document header placeholder remains anywhere.

### 10.3 Final promo cuts (after 10.2 is delivered)
60 s hero, 30 s, 15 s vertical 9:16 (hook A), 6 s bumper, 1:1 cut, 10 s loop; each with-music (bed C) and no-music; all Gate F fixes applied; end-card URL olleik-foods-site.vercel.app. Same measured QA. Then LICENSES.md, REPORT.md, everything to `D:\olleik-videos\final\` (`manual-visitor\`, `manual-admin\`, `episodes\`, `promo\`, `docs\`) with a README, remove the local demo database, stop. No PR merge without the owner's word.
