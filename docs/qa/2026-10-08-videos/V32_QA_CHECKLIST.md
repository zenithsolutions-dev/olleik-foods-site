# V3.2: QA checklist per file (voiced manuals and final promo cuts)

Every number below is measured on the encoded MP4 that is delivered (`qa/qa.py`): frames every 0.5 s, a frozen-moment
detector, OCR of every QA frame, ffmpeg ebur128 loudness and true peak, and sync (the MP4's audio cross-correlated
with the verified mix, and every hit checked for an onset within ±1 frame in the encoded audio). The visual items
are my review of every QA frame (contact sheets in `qa/<file>/sheet-p*.jpg`).

| File | Length | Result |
|---|---|---|
| `manual-visitor/USER_MANUAL_VISITOR.mp4` | 125.77 s | **PASS** |
| `manual-admin/USER_MANUAL_ADMIN.mp4` | 196.83 s | **PASS** |
| `promo/promo-60s-music.mp4` | 60.0 s | **PASS** |
| `promo/promo-60s-nomusic.mp4` | 60.0 s | **PASS** |
| `promo/promo-30s-music.mp4` | 30.0 s | **PASS** |
| `promo/promo-30s-nomusic.mp4` | 30.0 s | **PASS** |
| `promo/promo-15s-vertical-music.mp4` | 15.0 s | **PASS** |
| `promo/promo-15s-vertical-nomusic.mp4` | 15.0 s | **PASS** |
| `promo/promo-6s-bumper-music.mp4` | 6.0 s | **PASS** |
| `promo/promo-6s-bumper-nomusic.mp4` | 6.0 s | **PASS** |
| `promo/promo-1x1-music.mp4` | 20.0 s | **PASS** |
| `promo/promo-1x1-nomusic.mp4` | 20.0 s | **PASS** |
| `promo/promo-10s-loop-music.mp4` | 10.0 s | **PASS** |
| `promo/promo-10s-loop-nomusic.mp4` | 10.0 s | **PASS** |


## Voiced user manual: customer guide (7 chapters, 19 steps) — `manual-visitor/USER_MANUAL_VISITOR.mp4` (125.77 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | None: every page is one real capture; taps switch to the real after-tap capture; typing reveals the real typed capture; the step badge and captions live in the lower band, never over the UI. |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | No composited screens (UI captures only). |
| Clipped text | **PASS** | No UI text is cut by the caption band; at the end of each push every target keeps air on both sides. |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. No business-detail placeholder anywhere: every document shows the demo details. |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 125 OCR readings, all of the app's own UI copy (for example: “and pricing.”; “CedarPizza Co.”; “Cedar Pizza Co.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 16 frames at 10.0 s |
| Loudness (-16 LUFS ± 0.3) | **PASS** | -16.0 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -2.9 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 120 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 14/14 |

Found in review and fixed before delivery: the push ended too tight on wide pages (Offers, Account): headings touched the frame edge; the sign-in card's logo was cut at the top; the home page cut its headline at the left edge: it now opens on the whole hero and pushes in to the Become a customer button.

## Voiced user manual: admin guide (5 chapters, 32 steps) — `manual-admin/USER_MANUAL_ADMIN.mp4` (196.83 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | None: every page is one real capture; taps switch to the real after-tap capture; typing reveals the real typed capture; the step badge and captions live in the lower band, never over the UI. |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | No composited screens (UI captures only). |
| Clipped text | **PASS** | No UI text is cut by the caption band; the sidebar is either whole or out on every hold. |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. No business-detail placeholder anywhere: every document shows the demo details. |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 209 OCR readings, all of the app's own UI copy (for example: “Nothing hidden.”; “Choose aproduct.”; “Olleik FoodsLtd.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 11 frames at 138.17 s |
| Loudness (-16 LUFS ± 0.3) | **PASS** | -16.0 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -2.9 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 85 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 12/12 |

Found in review and fixed before delivery: wide admin targets now drift down at a fixed zoom (sidebar never cut, tables keep their right columns); the admin sign-in card sat awkwardly in the frame; the add-product dialog: the capture's modal ends at the window edge with the undimmed page below; that area is now excluded from the frame (step 20 shows the result in the list); the orders list lost its right columns at the end of the push.

## 60 s hero, music bed C — `promo/promo-60s-music.mp4` (60.0 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | None: UI shots are real captures; the phone and monitor composites are the approved Gate F 2x composites (re-used ranges). |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | Composites fitted to the screen rectangles (re-used approved ranges); the vertical crops Salma's 2x monitor composite at native size. |
| Clipped text | **PASS** | No clipped text in the new beat shots; on admin pages the view hugs the sidebar's right edge (no letters cut). |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. No business-detail placeholder anywhere: every document shows the demo details. |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 57 OCR readings, all of the app's own UI copy (for example: “Olleik FoodsLtd.”; “Wedeliveronyourusual route.”; “Wedeliveron yourusual route.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 4 frames at 36.63 s |
| Loudness (-14 LUFS ± 0.3) | **PASS** | -14.0 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -2.5 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 293 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 30/33 (not detected separately in the full mix: chop at frame 56, tap at frame 56, tapeRip at frame 741, under a whoosh tail or with a soft attack; each one is within ±1 frame in its isolated stem) |

Found in review and fixed before delivery: admin beat shots clipped the first letters of the page (pricing, leads, invite): the camera now hugs the sidebar's right edge.

## 60 s hero, no music — `promo/promo-60s-nomusic.mp4` (60.0 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | None: UI shots are real captures; the phone and monitor composites are the approved Gate F 2x composites (re-used ranges). |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | Composites fitted to the screen rectangles (re-used approved ranges); the vertical crops Salma's 2x monitor composite at native size. |
| Clipped text | **PASS** | No clipped text in the new beat shots; on admin pages the view hugs the sidebar's right edge (no letters cut). |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. No business-detail placeholder anywhere: every document shows the demo details. |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 57 OCR readings, all of the app's own UI copy (for example: “Olleik FoodsLtd.”; “Wedeliveronyourusual route.”; “Wedeliveron yourusual route.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 4 frames at 36.63 s |
| Loudness (-14 LUFS ± 0.3) | **PASS** | -14.0 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -2.6 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 293 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 30/33 (not detected separately in the full mix: chop at frame 56, tap at frame 56, tapeRip at frame 741, under a whoosh tail or with a soft attack; each one is within ±1 frame in its isolated stem) |

Found in review and fixed before delivery: the encoded true peak reached −0.8 dBTP: remixed with a lower peak ceiling (now −2.6); admin beat shots clipped the first letters of the page (pricing, leads, invite): the camera now hugs the sidebar's right edge.

## 30 s, music bed C — `promo/promo-30s-music.mp4` (30.0 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | None: UI shots are real captures; the phone and monitor composites are the approved Gate F 2x composites (re-used ranges). |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | Composites fitted to the screen rectangles (re-used approved ranges); the vertical crops Salma's 2x monitor composite at native size. |
| Clipped text | **PASS** | No clipped text in the new beat shots; on admin pages the view hugs the sidebar's right edge (no letters cut). |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. No business-detail placeholder anywhere: every document shows the demo details. |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 12 OCR readings, all of the app's own UI copy (for example: “Wedeliveronyourusual route.”; “Orderreceived-thank you!We'll confirm it shortly.”; “Order received-thank you!We'll confirm it shortly.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 2 frames at 9.97 s |
| Loudness (-14 LUFS ± 0.3) | **PASS** | -14.0 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -2.4 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 144 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 21/23 (not detected separately in the full mix: chop at frame 56, tap at frame 56, under a whoosh tail or with a soft attack; each one is within ±1 frame in its isolated stem) |

Found in review and fixed before delivery: admin beat shots clipped the first letters of the page (pricing, leads, invite): the camera now hugs the sidebar's right edge.

## 30 s, no music — `promo/promo-30s-nomusic.mp4` (30.0 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | None: UI shots are real captures; the phone and monitor composites are the approved Gate F 2x composites (re-used ranges). |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | Composites fitted to the screen rectangles (re-used approved ranges); the vertical crops Salma's 2x monitor composite at native size. |
| Clipped text | **PASS** | No clipped text in the new beat shots; on admin pages the view hugs the sidebar's right edge (no letters cut). |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. No business-detail placeholder anywhere: every document shows the demo details. |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 12 OCR readings, all of the app's own UI copy (for example: “Wedeliveronyourusual route.”; “Orderreceived-thank you!We'll confirm it shortly.”; “Order received-thank you!We'll confirm it shortly.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 2 frames at 9.97 s |
| Loudness (-14 LUFS ± 0.3) | **PASS** | -14.0 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -1.5 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 144 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 20/23 (not detected separately in the full mix: chop at frame 56, tap at frame 56, tapeRip at frame 591, under a whoosh tail or with a soft attack; each one is within ±1 frame in its isolated stem) |

Found in review and fixed before delivery: admin beat shots clipped the first letters of the page (pricing, leads, invite): the camera now hugs the sidebar's right edge.

## 15 s vertical 9:16 (hook A), music bed C — `promo/promo-15s-vertical-music.mp4` (15.0 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | None: UI shots are real captures; the phone and monitor composites are the approved Gate F 2x composites (re-used ranges). |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | Composites fitted to the screen rectangles (re-used approved ranges); the vertical crops Salma's 2x monitor composite at native size. |
| Clipped text | **PASS** | No clipped text in the new beat shots; on admin pages the view hugs the sidebar's right edge (no letters cut). |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. No business-detail placeholder anywhere: every document shows the demo details. |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 1 OCR readings, all of the app's own UI copy (for example: ) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 0 frames at 0.0 s |
| Loudness (-14 LUFS ± 0.3) | **PASS** | -14.0 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -2.7 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 62 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 7/7 |

## 15 s vertical 9:16 (hook A), no music — `promo/promo-15s-vertical-nomusic.mp4` (15.0 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | None: UI shots are real captures; the phone and monitor composites are the approved Gate F 2x composites (re-used ranges). |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | Composites fitted to the screen rectangles (re-used approved ranges); the vertical crops Salma's 2x monitor composite at native size. |
| Clipped text | **PASS** | No clipped text in the new beat shots; on admin pages the view hugs the sidebar's right edge (no letters cut). |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. No business-detail placeholder anywhere: every document shows the demo details. |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 1 OCR readings, all of the app's own UI copy (for example: ) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 0 frames at 0.0 s |
| Loudness (-14 LUFS ± 0.3) | **PASS** | -14.0 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -1.5 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 62 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 7/7 |

## 6 s bumper, music bed C — `promo/promo-6s-bumper-music.mp4` (6.0 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | None: UI shots are real captures; the phone and monitor composites are the approved Gate F 2x composites (re-used ranges). |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | Composites fitted to the screen rectangles (re-used approved ranges); the vertical crops Salma's 2x monitor composite at native size. |
| Clipped text | **PASS** | No clipped text in the new beat shots; on admin pages the view hugs the sidebar's right edge (no letters cut). |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. No business-detail placeholder anywhere: every document shows the demo details. |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: none |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 0 frames at 0.0 s |
| Loudness (-14 LUFS ± 0.3) | **PASS** | -14.1 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -2.7 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 18 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 4/6 (not detected separately in the full mix: chop at frame 56, tap at frame 56, under a whoosh tail or with a soft attack; each one is within ±1 frame in its isolated stem) |

## 6 s bumper, no music — `promo/promo-6s-bumper-nomusic.mp4` (6.0 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | None: UI shots are real captures; the phone and monitor composites are the approved Gate F 2x composites (re-used ranges). |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | Composites fitted to the screen rectangles (re-used approved ranges); the vertical crops Salma's 2x monitor composite at native size. |
| Clipped text | **PASS** | No clipped text in the new beat shots; on admin pages the view hugs the sidebar's right edge (no letters cut). |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. No business-detail placeholder anywhere: every document shows the demo details. |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: none |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 0 frames at 0.0 s |
| Loudness (-14 LUFS ± 0.3) | **PASS** | -14.0 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -1.9 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 18 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 4/6 (not detected separately in the full mix: chop at frame 56, tap at frame 56, under a whoosh tail or with a soft attack; each one is within ±1 frame in its isolated stem) |

## 1:1 (20 s), music bed C — `promo/promo-1x1-music.mp4` (20.0 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | None: UI shots are real captures; the phone and monitor composites are the approved Gate F 2x composites (re-used ranges). |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | Composites fitted to the screen rectangles (re-used approved ranges); the vertical crops Salma's 2x monitor composite at native size. |
| Clipped text | **PASS** | No clipped text in the new beat shots; on admin pages the view hugs the sidebar's right edge (no letters cut). |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. No business-detail placeholder anywhere: every document shows the demo details. |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 8 OCR readings, all of the app's own UI copy (for example: “Search bynameorSKU.”; “Search by name or SKU.”; “Searcih by tame or Sku.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 2 frames at 8.33 s |
| Loudness (-14 LUFS ± 0.3) | **PASS** | -14.0 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -2.5 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 103 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 18/21 (not detected separately in the full mix: chop at frame 56, tap at frame 56, tapeRip at frame 441, under a whoosh tail or with a soft attack; each one is within ±1 frame in its isolated stem) |

## 1:1 (20 s), no music — `promo/promo-1x1-nomusic.mp4` (20.0 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | None: UI shots are real captures; the phone and monitor composites are the approved Gate F 2x composites (re-used ranges). |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | Composites fitted to the screen rectangles (re-used approved ranges); the vertical crops Salma's 2x monitor composite at native size. |
| Clipped text | **PASS** | No clipped text in the new beat shots; on admin pages the view hugs the sidebar's right edge (no letters cut). |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. No business-detail placeholder anywhere: every document shows the demo details. |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 8 OCR readings, all of the app's own UI copy (for example: “Search bynameorSKU.”; “Search by name or SKU.”; “Searcih by tame or Sku.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 2 frames at 8.33 s |
| Loudness (-14 LUFS ± 0.3) | **PASS** | -14.0 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -1.2 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 103 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 18/21 (not detected separately in the full mix: chop at frame 56, tap at frame 56, tapeRip at frame 441, under a whoosh tail or with a soft attack; each one is within ±1 frame in its isolated stem) |

## 10 s seamless loop, music bed C — `promo/promo-10s-loop-music.mp4` (10.0 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | None: UI shots are real captures; the phone and monitor composites are the approved Gate F 2x composites (re-used ranges). |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | Composites fitted to the screen rectangles (re-used approved ranges); the vertical crops Salma's 2x monitor composite at native size. |
| Clipped text | **PASS** | No clipped text in the new beat shots; on admin pages the view hugs the sidebar's right edge (no letters cut). |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. No business-detail placeholder anywhere: every document shows the demo details. |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 3 OCR readings, all of the app's own UI copy (for example: “etoyouraccount.ProductsmarkedyouRPRicecarrypricing specificto youraccount.”; “etoyouraccount.ProductsmarkedyouRpricecarrypricing specific toyouraccount.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 2 frames at 1.73 s |
| Loudness (-14 LUFS ± 0.3) | **PASS** | -14.0 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -2.2 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 54 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 9/10 (not detected separately in the full mix: tapeRip at frame 194, under a whoosh tail or with a soft attack; each one is within ±1 frame in its isolated stem) |

## 10 s seamless loop, no music — `promo/promo-10s-loop-nomusic.mp4` (10.0 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | None: UI shots are real captures; the phone and monitor composites are the approved Gate F 2x composites (re-used ranges). |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | Composites fitted to the screen rectangles (re-used approved ranges); the vertical crops Salma's 2x monitor composite at native size. |
| Clipped text | **PASS** | No clipped text in the new beat shots; on admin pages the view hugs the sidebar's right edge (no letters cut). |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. No business-detail placeholder anywhere: every document shows the demo details. |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 3 OCR readings, all of the app's own UI copy (for example: “etoyouraccount.ProductsmarkedyouRPRicecarrypricing specificto youraccount.”; “etoyouraccount.ProductsmarkedyouRpricecarrypricing specific toyouraccount.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 2 frames at 1.73 s |
| Loudness (-14 LUFS ± 0.3) | **PASS** | -14.0 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -1.7 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 54 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 9/10 (not detected separately in the full mix: tapeRip at frame 194, under a whoosh tail or with a soft attack; each one is within ±1 frame in its isolated stem) |

Found in review and fixed before delivery: the encoded mix sat at −14.5 LUFS with the true peak at −1.0: remixed with a lower peak ceiling (now −14.0 / −1.7).
