# Part B usage videos: QA checklist per file

Every number below is measured on the encoded MP4 that is delivered (`qa/qa.py`): frames every 0.5 s, a frozen-moment
detector, OCR of every QA frame, ffmpeg ebur128 loudness and true peak, and sync (the MP4's audio cross-correlated
with the verified mix, and every hit checked for an onset within ±1 frame in the encoded audio). The visual items
are my review of every QA frame (contact sheets in `qa/<file>/sheet-p*.jpg`).

| File | Length | Result |
|---|---|---|
| `manual-visitor.mp4` | 44.87 s | **PASS** |
| `manual-ep1.mp4` | 17.57 s | **PASS** |
| `manual-ep2.mp4` | 13.4 s | **PASS** |
| `manual-ep3.mp4` | 14.6 s | **PASS** |
| `manual-ep4.mp4` | 14.07 s | **PASS** |
| `manual-ep5.mp4` | 11.37 s | **PASS** |


## Visitor manual "Marco's First Order" (5 chapters) — `manual-visitor.mp4` (44.87 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | Taps switch to the real after-tap capture; typing reveals the real typed capture over the field's own background; pointer only, no halos. |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | No composited screens; real full-page captures through the continuous camera. |
| Clipped text | **PASS** | Captions and chapter labels in the lower band; held framings show whole cards and tables. |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. Validated on every frame: document headers with unset business details, the public footer and the home page's sample stats never enter the frame (camera.ts forbid). The home page is not used. |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 42 OCR readings, all of the app's own UI copy (for example: “and pricing.”; “Search by name or Sku.”; “terms-no onlinepayment.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 5 frames at 40.73 s |
| Loudness (-16 LUFS ± 0.3) | **PASS** | -16.0 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -2.2 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 130 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 13/13 |

Found in review and fixed before delivery: a typed field kept showing after the plate switched (held typing now ends exactly on the switch); Portal, Offers and Account framings cut card edges (widened); the render ran out of browser memory at concurrency 4 (rendered at 2).

## Admin Episode 1 · Orders (ends on the Invoice button) — `manual-ep1.mp4` (17.57 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | Taps switch to the real after-tap capture; typing reveals the real typed capture over the field's own background; pointer only, no halos. |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | No composited screens; real full-page captures through the continuous camera. |
| Clipped text | **PASS** | The sidebar is whole in frame or fully out. |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. Validated on every frame: document headers with unset business details, the public footer and the home page's sample stats never enter the frame (camera.ts forbid). Ends on the order's Invoice button; the invoice is never opened. |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 16 OCR readings, all of the app's own UI copy (for example: “3neworders waitingforconfirmation.”; “3neworderswaiting forconfirmation.”; “3 new orders waiting for confirmation.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 10 frames at 12.7 s |
| Loudness (-16 LUFS ± 0.3) | **PASS** | -16.2 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -3.0 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 28 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 9/9 |

Found in review and fixed before delivery: the dashboard and New-tab framings showed a sliver of the sidebar (re-framed).

## Admin Episode 2 · Customers and approvals — `manual-ep2.mp4` (13.4 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | Taps switch to the real after-tap capture; typing reveals the real typed capture over the field's own background; pointer only, no halos. |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | No composited screens; real full-page captures through the continuous camera. |
| Clipped text | **PASS** | Lead row, customer cards and price table framed whole. |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. Validated on every frame: document headers with unset business details, the public footer and the home page's sample stats never enter the frame (camera.ts forbid). |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 10 OCR readings, all of the app's own UI copy (for example: “Convertanapproved application into anaccount-oraddawalk-inmanually.”; “Convert an approved application into anaccount-or add awalk-inmanually.”; “Restaurants who submitted the /apply form.Triageand convert to customers.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 6 frames at 4.5 s |
| Loudness (-16 LUFS ± 0.3) | **PASS** | -16.1 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -3.0 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 20 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 4/4 |

Found in review and fixed before delivery: sidebar slivers on the leads, add-customer, customers and prices framings; the add-customer framing cut the page title.

## Admin Episode 3 · Products and prices — `manual-ep3.mp4` (14.6 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | Taps switch to the real after-tap capture; typing reveals the real typed capture over the field's own background; pointer only, no halos. |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | No composited screens; real full-page captures through the continuous camera. |
| Clipped text | **PASS** | Product form and table framed whole. |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. Validated on every frame: document headers with unset business details, the public footer and the home page's sample stats never enter the frame (camera.ts forbid). |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 7 OCR readings, all of the app's own UI copy (for example: “All fields exceptdescriptionare required.”; “3trackedproductsareatorbelowthelow-stockalert level.”; “3tracked products are atorbelowthelow-stock alertlevel.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 7 frames at 9.4 s |
| Loudness (-16 LUFS ± 0.3) | **PASS** | -16.1 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -3.0 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 33 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 3/3 |

Found in review and fixed before delivery: the new product was a duplicate of an existing item: re-captured with a new one (Mini Sweet Peppers); sidebar slivers on products and categories; the Add product button half cut at the right edge.

## Admin Episode 4 · Margins and reports — `manual-ep4.mp4` (14.07 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | Taps switch to the real after-tap capture; typing reveals the real typed capture over the field's own background; pointer only, no halos. |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | No composited screens; real full-page captures through the continuous camera. |
| Clipped text | **PASS** | The report preview starts below the sheet's header rule. |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. Validated on every frame: document headers with unset business details, the public footer and the home page's sample stats never enter the frame (camera.ts forbid). |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 22 OCR readings, all of the app's own UI copy (for example: “3trackedproductsareatorbelowthelow-stockalert level.”; “3tracked products are at orbelow the low-stock alert level.”; “Noglobal marginyet-products withoutanyapplicablerule sell at list price.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 4 frames at 8.73 s |
| Loudness (-16 LUFS ± 0.3) | **PASS** | -16.0 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -2.9 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 16 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 1/1 |

Found in review and fixed before delivery: the report framing sliced a line of the sheet; now it begins under the header rule; the analytics framing cut the chart card; the margin-rules framing cut the next card.

## Admin Episode 5 · Invites and access — `manual-ep5.mp4` (11.37 s) — **PASS**

| Check | Result | Detail |
|---|---|---|
| Pasted-looking overlays (halos, patches, pills, lifted or doubled UI) | **PASS** | Taps switch to the real after-tap capture; typing reveals the real typed capture over the field's own background; pointer only, no halos. |
| Screens aligned (composites fitted, header visible, no spill or drift) | **PASS** | No composited screens; real full-page captures through the continuous camera. |
| Clipped text | **PASS** | Portal card and visibility card framed whole. |
| Placeholders on screen | **PASS** | OCR placeholder patterns: 0. Validated on every frame: document headers with unset business details, the public footer and the home page's sample stats never enter the frame (camera.ts forbid). The generated invite URL is never shown (the email path is used). |
| Trailing periods on our lines | **PASS** | Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: 20 OCR readings, all of the app's own UI copy (for example: “Nothing hidden.”; “it aorked beiore.”; “it worked before.”) |
| Frozen moments (no hold longer than one beat, 17 frames) | **PASS** | longest still run 3 frames at 3.13 s |
| Loudness (-16 LUFS ± 0.3) | **PASS** | -16.2 LUFS |
| True peak (≤ −1 dBTP) | **PASS** | -3.0 dBTP |
| Effect sync (±1 frame) | **PASS** | mix: 100.0 % of 13 effects (isolated per effect); encode offset 0.98 ms; hits found in the encoded full mix: 2/2 |

Found in review and fixed before delivery: the invite-link framing cut the page title; the sidebar sliver on the visibility framing.
