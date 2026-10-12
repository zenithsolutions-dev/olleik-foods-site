# Gate F V3.1: QA checklist per file

Every number below is measured on the encoded MP4 that is delivered (`qa/qa.py`): frames every 0.5 s, a frozen-moment
detector, OCR of every QA frame, ffmpeg ebur128 loudness and true peak, and sync (the MP4's audio cross-correlated
with the verified mix, and every hit checked for an onset within ±1 frame in the encoded audio). The visual items
are my review of every QA frame (contact sheets in `qa/<file>/sheet-p*.jpg`).

| File | Length | Result |
|---|---|---|
| `promo-music.mp4` | 20.0 s | **PASS** |
| `promo-nomusic.mp4` | 20.0 s | **PASS** |
| `visitor-ch4.mp4` | 22.8 s | **PASS** |
| `ep1.mp4` | 17.57 s | **PASS** |
| `v2-animatic-music.mp4` | 15.0 s | **PASS** |
| `v2-animatic-nomusic.mp4` | 15.0 s | **PASS** |
| `v2-visitor-ch4.mp4` | 21.13 s | **PASS** |
| `v2-ep1.mp4` | 21.13 s | **PASS** |


## 20 s promo, with music (bed C) — `promo-music.mp4` (20.0 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | Taps switch the whole page to the real after-tap capture on the beat; no halo, no patch, no pill, no lifted card. Pointer only. CONFIRMED is printed inside the generated ink border in its perspective; SENT sits on the box as before. |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | Phone: true perspective fit (edge-fitted corners, no overscan), composited at 2x, portal header fully visible in the wide and the punch-in. Monitor: frontal 16:10 screen, the real admin captured at monitor size (1152 × 720), readable. |
| Clipped text | **PASS** | No text cut by an overlay. Edges cut page content only during camera travel and whips. |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. None. Demo data has no placeholder-like names left. |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 6 OCR readings, all of the app's own UI copy (for example: “leto your account.ProductsmarkedyouR PRicecarrypricing specificto your account.”; “products availableto your account.Products marked youRpRicecarry pricing specificto your account.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 2 frames at 9.97 s |
| Loudness (-14 LUFS ± 0.3) | **PASS** | -14.0 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -2.5 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 103 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 18/21 (not detected separately in the full mix: chop at frame 56, tap at frame 56, tapeRip at frame 441, under a whoosh tail or with a soft attack; each one is within ±1 frame in its isolated stem) |

Found in review and fixed before delivery: the phone punch-in no longer crops the portal header; the end-card address arrived at 19.6 s, now 19.1 s; the end card held still for 31 frames, now it moves on every beat; "Three taps" moved off the nav bar onto the page's empty background; the CONFIRMED ink letters did not render, now printed inside the ink border.

## 20 s promo, no music — `promo-nomusic.mp4` (20.0 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | Same picture as the music version. |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | Same picture as the music version. |
| Clipped text | **PASS** | Same picture as the music version. |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. None. |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 6 OCR readings, all of the app's own UI copy (for example: “leto your account.ProductsmarkedyouR PRicecarrypricing specificto your account.”; “products availableto your account.Products marked youRpRicecarry pricing specificto your account.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 2 frames at 9.97 s |
| Loudness (-14 LUFS ± 0.3) | **PASS** | -14.0 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -1.2 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 103 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 18/21 (not detected separately in the full mix: chop at frame 56, tap at frame 56, tapeRip at frame 441, under a whoosh tail or with a soft attack; each one is within ±1 frame in its isolated stem) |

## V3 visitor manual, Chapter 4 "Ordering" — `visitor-ch4.mp4` (22.8 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | Every tap is a real plate switch; typing shows the real typed capture and covers only the not-yet-typed text with the field's own white. |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | Live hook only (no composited screen). |
| Clipped text | **PASS** | Captions live in their own lower band, never on UI text; every tapped control is framed above it. |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. None (the field's grey placeholder text is the app's own, shown before typing as in a browser). |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 22 OCR readings, all of the app's own UI copy (for example: “Search by name or Sku.”; “Wedeliver onyour usualroute.”; “We deliveron yourusual route.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 3 frames at 17.27 s |
| Loudness (-16 LUFS ± 0.3) | **PASS** | -16.0 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -2.5 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 48 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 8/8 |

Found in review and fixed before delivery: the placeholder stayed visible beside the typed note; captions sat over UI text (moved to a lower band); the chapter tag overlapped the first page for a few frames; the pointer covered the typed note; "your statement" capitalised.

## V3 admin Episode 1 "Orders" — `ep1.mp4` (17.57 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | Plate switches only; the New tab and Complete are hard switches (the earlier cross-dissolve showed two lists at once). |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | Live hook and outro only. |
| Clipped text | **PASS** | Held framings sit exactly between the sidebar and the status badge (no sliver of either at an edge); captions in the lower band. |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. None. The invoice page stays off screen (the app's invoice header shows unset business details). |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 10 OCR readings, all of the app's own UI copy (for example: “erswaitingfor confinmamon.”; “3 new orders waiting for confirmation.”; “Thisorderis completed-nofurtheractions.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 10 frames at 12.7 s |
| Loudness (-16 LUFS ± 0.3) | **PASS** | -16.2 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -3.0 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 28 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 9/9 |

Found in review and fixed before delivery: a cross-dissolve showed two order lists at once; a sliver of the sidebar's green "3 new" item at the frame edge; the status badge half cut at the right edge; a 32-frame hold between Mark prepared and Complete (the camera's drift was clamped at the page top).

## V2 line: 15 s animatic, with music (bed C) — `v2-animatic-music.mp4` (15.0 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | Tap ripples and rings removed; the phone shows the real captures switching on the tap (2-frame dissolve of identical captures). |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | Vector phone and monitor show the real captures; the phone, the slip and the monitor show the same order #5928f131. |
| Clipped text | **PASS** | None found. |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. None. |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 4 OCR readings, all of the app's own UI copy (for example: “We deliver on your usual route.”; “You collect from the Olleik warehouse.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 12 frames at 2.23 s |
| Loudness (-14 LUFS ± 0.3) | **PASS** | -14.0 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -2.6 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 50 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 30/33 (not detected separately in the full mix: tick at frame 110, printer at frame 211, tear at frame 225, under a whoosh tail or with a soft attack; each one is within ±1 frame in its isolated stem) |

Found in review and fixed before delivery: the morning scene with Marco's mug is gone: the box lands and SENT slams; the slip and the monitor showed two different orders; a mouse-click transient overshot to -0.2 dBTP after AAC (softened).

## V2 line: 15 s animatic, no music — `v2-animatic-nomusic.mp4` (15.0 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | Same picture as the music version. |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | Same picture as the music version. |
| Clipped text | **PASS** | Same picture as the music version. |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. None. |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 4 OCR readings, all of the app's own UI copy (for example: “We deliver on your usual route.”; “You collect from the Olleik warehouse.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 12 frames at 2.23 s |
| Loudness (-14 LUFS ± 0.3) | **PASS** | -14.0 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -1.7 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 51 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 31/34 (not detected separately in the full mix: tear at frame 225, slide at frame 240, tapeRip at frame 290, under a whoosh tail or with a soft attack; each one is within ±1 frame in its isolated stem) |

## V2 line: visitor manual, Chapter 4 "Ordering" — `v2-visitor-ch4.mp4` (21.13 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | No tap rings; hand-drawn callouts only on beats without a tap (V2 style line). |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | Real phone captures, re-captured with product photos. |
| Clipped text | **PASS** | None found. |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. None. |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 21 OCR readings, all of the app's own UI copy (for example: “Dlleik repforanychange.”; “Dlleik rep forany change.”; “Wedeliveronyourusual route.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 0 frames at 0.0 s |
| Loudness (-16 LUFS ± 0.3) | **PASS** | -16.2 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -2.9 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 23 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 5/5 |

Found in review and fixed before delivery: holds of up to 41 frames (title, late screen beats): every beat now drifts.

## V2 line: admin Episode 1 "Orders" — `v2-ep1.mp4` (21.13 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | No tap rings; no callout on the small Invoice button (it ran over the text around it). |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | The admin order is Marco's order #5928f131 through every status; the sidebar counts read 3 new → 2 new as in the app. |
| Clipped text | **PASS** | Admin views show the whole sidebar or none of it (no sliver). |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. None. The invoice page is no longer shown (it showed unset business details); the beat ends on the order's Invoice button. |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 8 OCR readings, all of the app's own UI copy (for example: “3 new orders waiting for confirmation.”; “Thisorderis completed-nofurtheractions.”; “yourwnote aayataglance-oraers,money,stock,anaanytning tnatneeasattention.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 2 frames at 0.03 s |
| Loudness (-16 LUFS ± 0.3) | **PASS** | -16.1 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -3.0 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 22 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 5/5 |

Found in review and fixed before delivery: holds of up to 35 frames: every beat now drifts; the invoice page was replaced by the order's Invoice button; a sidebar sliver at the frame edge.
