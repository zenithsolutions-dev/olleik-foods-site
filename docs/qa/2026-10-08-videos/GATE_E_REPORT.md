# Olleik Videos V3: Gate E Report (Phase A)

**Date:** 2026-10-11. **Branch:** `feat/videos` (draft PR #38, **not merged**). **Status:** stopped at **Gate E**. No final renders.
- The hosted Supabase project was never touched; every capture comes from the local demo stand-in.
- All copy is **Pending Review**.
- This phase follows `CREATIVE_BRIEF_V3.md`. Deliverables are in `D:\olleik-videos\v3\gate-e\`.

## What to look at first
| Deliverable | File(s) | Result |
|---|---|---|
| 10 s continuous-camera test (catalog, 3 taps in shot, sound) | `camera-test\camera-test-sfx.mp4` (+ `-silent`) | −14.5 LUFS, −1.1 dBTP; 29 of 29 effects within 1 frame |
| 5 hook motion tests, 3 s each, ranked below | `hooks\hook-A…E-sfx.mp4` (+ `-silent`), `hooks\hooks-encoded.jpg` | −14.0 to −14.4 LUFS, TP −1.5 to −2.3 dBTP; every effect within 1 frame |
| Product photo set (31 photos, one style) in the local stack | `products\contact.jpg`, `products\web\*.jpg` | All 31 demo products now have a photo |
| Re-captured screens with product images | `screens\*.png` (full page, 3x), `screens\recaptures.jpg`, `screens\catalog-3.jpg` | See the note on which screens show photos |
| Three characters as Higgsfield reference elements + test shots (16:9 and 9:16) | `characters\character-references.jpg`, `characters\*-t*.mp4`, `characters\characters-test-shots.jpg` | No text or logos in the picked takes |
| Three music candidates at 108 BPM + the story-sound pulse | `music\preview-A/B/C-20s.wav`, `music\preview-pulse-only-20s.wav`, `music\bed-*-60s.wav`, `music\pulse-60s.wav`, `music\report.json` | Beds conformed to 108.0 BPM; beat phase within 9 ms |
| Motion notes | `MOTION_NOTES.md` | Researched references with links |

## Hook ranking (my recommendation; your call)
1. **H-D "Two hands" (recommended for the master).**
   - The first 1.5 s is pure rhythm: a knife hitting the board on the beat. That is the strongest pattern interrupt, and it
     is the sound the whole film's pulse is built from (feedback 7).
   - At the snap, each chop becomes a tap: real catalog cards (basil, lemons, tomatoes) drop into the real cart and the badge
     counts up. That explains the product in 3 s, on mute or with sound.
   - The clip's real knife impacts are time-remapped onto the 108 BPM grid, so the picture truly lands on the beat (a visible
     speed ramp).
   - **Weakness:** the AI hands show small artifacts on close inspection (take 2 briefly had two knives and was rejected).
     The final needs a cleaner take or a tighter crop.
2. **H-A "The 11:04 PM text"** (recommended for the 15 s vertical; it carries your approved line "11:04 PM. One more text.").
   - It has the most heart: a real tired chef, a hesitating thumb, messages piling up, the badge climbing to 37.
   - It is less of a visual surprise than D, because dark-kitchen phone scenes are common. It works best as the story beat
     right after D in the master.
3. **H-E "The sticky-note wall."**
   - The cleanest "what is this?" picture: a whole wall of notes peels away in a wave and reveals the real catalog with photos.
     It reads perfectly on mute and is cheap to make.
   - It is generic office imagery, though, and less about food and kitchens than D or A.
4. **H-C "Receipt rain."** A nice paper-to-digital morph into the real "Order received" screen. The slips are graphic rather
   than tactile, and paper slips risk suggesting a printed-slip feature (you asked to keep the slip a story prop only).
5. **H-B "Price roulette."**
   - The idea is clear, but it puts dollar figures in the first second and implies prices that change. That is a compliance
     risk under our no-price-claims rule.
   - The locked price ($46.45) is the demo account's real price, taken from the captured card. The five spinning values are
     invented.
   - **I would not use it.**

**Recommended combination:** D opens the master, cutting to A as the first story beat, with your approved line on A. A also
opens the 15 s vertical. This changes your Gate D choice (hook A for the master), so it needs your decision.

## Camera engine: "one page, one world" (`videos/src/v3/camera.ts`, `World.tsx`)
- **One continuous camera per page.** Keyframes `{f, cx, cy, zoom}` are set in page coordinates. Moves ease in log-zoom space
  (glide, arrive and in-out curves). A tap never cuts the shot; it patches only the region that changed, cut from the real
  after-tap capture: the press (0.96), a spring overshoot, a ring ripple, then the cart badge bumps.
- **Rules enforced in code.** `validateCamera()` throws, so a bad move cannot render:
  - zoom ≤ 1.6x;
  - never more than 3 output px per page CSS px (native capture density);
  - the view stays inside the page;
  - at least one structural anchor (nav, title, search or cart) is ≥ 60 % in frame on every frame, and each key's `eye`
    target is in frame when the camera arrives.
  - It caught a real problem during this gate: at 1.38x over the third card the search bar fell to 32 %, so the row framing
    became 1.3x with the title in view.
- **Parallax.** Layer L0 is the page plate captured with the cards hidden. L1 is the cards (p 0.035), L2 the chips and badges
  (0.07), L3 the cursor (0.12). Every layer lands exactly on the plate at the rest framing, so a still frame equals the real
  screenshot.
- **Motion blur.** Camera-only, with a 180° shutter: 1 sample when the camera is still and up to 14 at speed, so text in
  still frames stays sharp.
- **Tiles.** Full-page captures are 4320 × 9285 px, which Chrome can't decode in one piece. `capture/tile.py` splits them into
  600-CSS-px tiles, and only the tiles in view are drawn.
- **Camera test content.** Wide catalog → push to the first card → tap → travel along the row → tap → tap → rise to the cart
  as the badge lands "3" on beat 14 → pull back wide.
  - Taps fall on beats 4, 8 and 12 of the 108 BPM grid.
  - The line "Your catalog. Your prices." is bound to the page beside the title and travels with it.

## Product photos: how it was done
- **Style guide.** One prompt shared by all 31 photos:
  - warm off-white handmade-paper sweep;
  - soft overhead key light from back-left at about 4500 K, with a fill card front-right;
  - 3/4 high angle, 100 mm lens at f/8;
  - no text or brand marks, plain packaging;
  - the style anchor image passed as a reference to every other photo, also saved as the Higgsfield element
    `olleik-demo-catalog-style`.
- **Generation.** Nano Banana Pro at 2K, 4:3 (matching the app's 4:3 card).
  - One retake: the burger patties' backdrop had drifted.
  - The full set is in `products\contact.jpg`.
- **Loading.** `videos/devstack/photos.mjs` (**video demo stack only**):
  - copies the photos into the local storage stand-in, using the app's own bucket and path shape
    (`product-images/products/<uuid>.jpg`);
  - sets `products.image_url` in the LOCAL database.
  - **No app code was changed.** The real UI renders the real image field; nothing is pasted over it.
- **Which screens show photos.** The app renders product photos in only three places: the portal catalog, the public
  category pages and the product editor. Cart, checkout, order detail and admin orders were re-captured as asked, but **the
  app itself shows no thumbnails there**, so those captures show the real UI without photos. Adding images there would
  misrepresent the product, so I didn't fake it.
- **Re-captured screens** (full page, 3x): portal catalog (empty, background plate and 3 tap states), cart, checkout,
  customer order detail, admin orders, admin order detail, the product editor (Vine-Ripe Tomatoes with its photo) and the
  public Produce page.

**Product recommendation (for the owner).** The site should launch with real photos of the products Olleik actually sells.
- The catalog is the first thing a new customer sees, and the generated set shows how much warmer and more trustworthy the
  same pages look with photos.
- The generated images are fine for videos labelled as a demo, but they are not your products. Showing them on the live
  site could mislead buyers about pack sizes, brands and quality.
- A one-day shoot is enough: one paper backdrop, one soft light and the same angle for every SKU, so the catalog stays
  consistent (the style guide above can serve as the brief).
- Also consider showing a small thumbnail on the cart, checkout and order lines. Today those screens are text-only, which
  makes them the plainest part of the flow.

## Characters (Higgsfield)
- **Built as references.** Following the character-sheet workflow (photoreal, unretouched, original characters from text;
  no real person's photo was used), each character became a reusable element:
  - `olleik-marco`: chef, mid-40s, tired;
  - `olleik-salma`: warehouse lead, calm;
  - `olleik-driver`: hands and silhouette.
  - Every shot then starts from a start frame generated with the element, animated with Kling 3.0 Pro (5 s, 24 fps,
    silent).
- **Picks** (two takes per shot):
  - Marco 16:9 take 1 (thumb hesitating at night, slow dolly in) and 9:16 take 2 (rubs his face).
  - Salma 16:9 take 1 (reads the screen, nods, takes the clipboard) and 9:16 take 1 (nod and a small smile).
  - Driver 16:9 take 2 (hands square the box in the van) and 9:16 take 2 (silhouette slides the side door shut and walks
    away).
- **Rejected for visible text:** the first four driver takes. Two showed a garbled licence plate and van badge, two showed a
  "RESTAURANT" shop sign. They were regenerated at the van's side door against trees. Three Salma takes failed on the
  provider side and were re-run without the element placeholder.
- **Known limits:**
  - Salma's warehouse boxes carry small blank label rectangles (no legible text).
  - In the 9:16 silhouette the driver's navy jacket reads as a dark t-shirt.
  - Any screen in a live shot faces away from the camera; the real UI will be composited in Phase B.

## Sound and music (decision: rhythm-led, as recommended)
- **The pulse.** Built only from story sounds:
  - box thud as the kick, tap as the backbeat, knife chop on the off-beats;
  - the stamp as the accent every 4 bars, a printer burst as a fill every 8 bars.
  - It is placed to the sample at exactly 108 BPM; 218 of 219 hits land within one frame (mean 3.9 ms). The single outlier is
    the printer fill, which has a soft attack and sits on a 16th by design.
- **Deviation: Higgsfield has no standalone music model in this connector.** `generate_audio` is speech-only, its music model
  is restricted to the game pipeline, and the marketplace has no music app. So I used the one Higgsfield route left:
  1. Generated instrumental performance clips with Seedance 2.0's native audio (prompted at 108 BPM, two takes per style).
  2. Took only the audio.
  3. Measured the tempo, conformed it to exactly 108.000 BPM with rubberband (pitch kept), aligned it to the grid, and looped
     a clean 16- or 8-beat section to 60 s.
- **The three candidates:**
  - **A, warm soul** (Rhodes, upright bass, brushes): source 107.5 BPM, now 108.0, beat phase −8.9 ms.
  - **B, Mediterranean folk-pop** (nylon guitar ostinato, claps, shaker): source 107.6 BPM, now 108.0, phase −3.6 ms. Only
    the steady second half of the take is looped, as an 8-beat loop.
  - **C, minimal marimba** (marimba, muted bass, rim): source 108.0 BPM, phase +2.7 ms.
  - Each preview is 20 s: the hook, the snap at 1.5 s, then the pulse with the bed about 7 LU underneath.
  - Previews measure −14.1 LUFS / −1.5 dBTP. The pulse-only preview reaches −15.3 LUFS: pure transients can't be pushed further
    without crushing the hits.
  - **Caveats:**
    - I can't listen. I checked the spectrograms for vocals (none visible), noise and structure, but your ears decide.
    - Short loops can feel repetitive over 60 s.
    - These are AI-generated music; the provider's terms are recorded below.
- **Recommendation.** Ship with music as the default, as the brief says. My pick is **C** (it leaves the most room for the
  story sounds), with **A** as the warmer alternative.

## Licences (`videos/audio-library/LICENSES.md`, recorded before use)
- **All 78 Higgsfield generations** are listed, used or not. Each row has the generation ID, kind, model and date, and the
  file, product and status. The full prompts are in `videos/higgsfield/ledger.json` and `prompts_people_music_hooks.json`.
  The four element IDs are listed too.
- **Terms.** Higgsfield Terms of Use §4.4: Higgsfield claims no ownership of outputs and does not restrict commercial use.
  Outputs may not be used to train AI models, and no likeness or IP infringement is allowed. IP indemnity is Enterprise-only.
  Evidence: `licenses/higgsfield-terms-2026-10-11.txt`. The API reports Nano Banana Pro jobs as `nano_banana_2`, and the
  ledger keeps both names.
- **Sounds.** All 60 sound files used in the V3 mixes have rows (Kenney CC0, Mixkit SFX licence, OpenGameArt CC0).
- **Spend.** 362 Higgsfield credits (balance went from 1,156.51 to 794.26; you asked me not to ask about credits).

## What changed in the repo (commit on `feat/videos`)
- **Camera engine and compositions:** `videos/src/v3/{camera.ts, World.tsx, shots.ts, Hooks.tsx, hookEvents.ts,
  hooksRoot.tsx, V3Root.tsx}`, registered in `src/Root.tsx`.
- **Tools:** `videos/v3.mjs` (stills, render, audio, mux, qa), `videos/capture/{v3.mjs, tile.py}`, `videos/devstack/photos.mjs`
  and `videos/audio/pulse_music.py`.
- **Generation records:** `videos/higgsfield/{product_prompts.mjs, fetch.py, fetch_products.py, ledger.json, prompts…json,
  jobs_*.json, music/*.py}`.
- **Licences and docs:** the licence generator now includes the Higgsfield section; added `MOTION_NOTES.md` and this report.
- **Not in git:** generated media is git-ignored (`public/v3/`, `higgsfield/**` media). The copies are on D:.
- **Local stack:** the demo database now also holds one more order (from the checkout capture) and 31 product photos.
- **Machine note:** an out-of-memory crash in another project's headless Chrome corrupted this repo's Turbopack dev cache.
  I cleared `.next/dev`, which is regenerable; nothing else was touched.

## Questions for you (Gate E)
1. **Hooks:** D for the master and A for the vertical, as recommended? Or keep A on the master?
2. **Music:** A, B or C, and are the Seedance-sourced beds acceptable? The alternative is a licensed library track, which
   would need your OK to download.
3. **Characters:** approve Marco, Salma and the driver as cast? Any changes to look or wardrobe?
4. **Photos:** approve the photo style for the videos? For the live site, see the recommendation above.
5. **Camera language:** approve the camera test as the template for the promo and the manuals?
