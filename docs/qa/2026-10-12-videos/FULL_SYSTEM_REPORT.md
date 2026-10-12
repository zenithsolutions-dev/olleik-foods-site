# Olleik Foods: the whole system, full-system film report

Date: 2026-10-12 · Branch `feat/videos-full` · Status of all copy: **Pending Review**.
Delivered to `D:\olleik-videos\final\full-system\`.

## What was made

- **`FULL_SYSTEM.mp4`** (12:28, 1920×1080, 30 fps): one narrated film of the whole Olleik system.
  - It follows one fictional restaurant, **Cedar Table Bistro**, from its first visit to its invoices.
  - It is told as linked cause and effect between the two sides.
  - **Split screen:** the visitor/customer on a phone on the left, the admin on a desktop on the right.
  - **Role labels** above each pane show who is on that side, the page's address, and an orange dot on the side that acts in each step.
  - **Thread:** a line of light travels from the tap on one side to the place that changes on the other, and that pane switches to its real "after" capture when the line arrives (25 threads).
- **Companions:**
  - `FULL_SYSTEM-silent-captioned.mp4` (same picture with burned-in captions, no sound)
  - `FULL_SYSTEM.en.srt`
  - `FULL_SYSTEM.chapters.txt`
  - `FULL_SYSTEM.poster.png`
- **`docs/` folder:**
  - this report
  - the QA checklist
  - `FEATURE_INVENTORY.md`
  - the narration script
  - `LICENSES.md`

## How it was built

- **Data:** the local demo stack only (`videos/devstack`; the hosted Supabase was never touched).
  - Rebuilt and reseeded for this run, with the demo business details on every document.
  - The seed is now relative to the day of seeding, so "Today" on the dashboard is real.
- **Captures:** `capture/full.mjs` walks the whole story in order with two browsers open (customer phone at 390 px, admin desktop at 1440 px, both at 3×).
  - That gives 138 full-page captures, so every "before" and "after" is a real state of the same data.
  - Zero outbound requests were made.
- **Local stand-in fixes needed by the story:**
  - One-time invite links now verify (the real invite → welcome page → set password → portal flow).
  - Photo uploads are stored correctly.
  - Server dates use Toronto time.
- **Camera:** the V3 camera rules, applied per pane:
  - continuous camera, no cut on taps
  - real after-captures only, typing revealed from the real typed capture
  - zoom ≤ 1.6 and native density
  - an anchor or eye target in frame
  - the admin sidebar whole or out
  - forbidden boxes never visible: the public footer's placeholder phone number, and the home page's sample stats
  - every tap point visible, and no stretch longer than a beat without motion

  All of these are checked at import, so a bad move cannot render. Phone taps show as a soft fingertip, never an arrow.
- **Narration:**
  - Script: `narration/FULL.json`, 80 lines. Calm, short sentences, with linking phrases ("Now watch the admin side"). No marketing claims, no delivery promises, no spoken prices. "Olleik" is written "Oh-lake" in the spoken text only.
  - Voice: Higgsfield speech, preset voice **Holden**.
  - Checking: every take was checked against the script with faster-whisper. Takes with stray or garbled words, a clipped first word, or a repeated phrase were regenerated.
  - Log: all **115** generations are in `higgsfield/ledger.json` and `LICENSES.md` (80 used, 28 rejected, 7 unused parallel alternates).
- **Sound:**
  - Music bed C runs sparse, at least 19.6 dB under the voice.
  - Soft effects: taps, typing, page updates, whips, a whoosh for each thread, and the admin's new-order bell.
  - Final mix: −16 LUFS, −2.9 dBTP on the encoded file.

## QA (on the encoded MP4)

All checks pass; see `FULL_SYSTEM_QA_CHECKLIST.md`.

| Check | Result |
|---|---|
| Length | 12:28 (brief: 12–18 min) |
| Loudness / true peak | −16.0 LUFS / −2.9 dBTP |
| Narration onset | every line within 4.1 frames of its step (limit 5); no overlaps (min gap 1.36 s) |
| Music under the voice | at least 19.6 dB (limit 12) |
| Effects sync | 347 of 347 within ±1 frame |
| Picture/sound offset | 1 ms |
| Frozen moments | longest still run 10 frames (limit 17) |
| Placeholders (OCR, every 0.5 s) | 0 |
| Our lines ending with a period | 0 |

**Visual review:**
- I looked at every one of the 1,497 frames (one every 0.5 s) in dense sheets, on the first render and again on the re-render.
- The first render had four defects:
  - a blank first frame
  - two places where a pane re-opened on an older state after a chapter card (the old Romaine price at 5:01, the "Unavailable" cups at 10:49)
  - an end card that repeated the caption

  All four were fixed, re-rendered and re-checked on the new frames.

## Feature coverage

Timestamps are the start of each step in `FULL_SYSTEM.mp4` (m:ss); the step number is the badge shown in the film's caption band.

| ID | Feature | Shown at (step) | Covered |
|---|---|---|---|
| V1 | Home page and its call to action | 0:10 (1), 0:20 (2), 0:53 (5) | yes |
| V2 | Public catalog (categories, no prices) | 0:32 (3) | yes |
| V3 | Category page: active products with photos, no prices | 0:40 (4), 11:00 (69), 11:07 (70) | yes |
| V4 | Application form → Application received | 1:01 (6), 1:12 (7), 1:26 (8) | yes |
| V5 | Contact form (stored, no admin screen) | 1:45 (10) | yes |
| V6 | Become a vendor form (stored, no admin screen) | 1:45 (10) | yes |
| V7 | Customer sign-in and password reset | 11:36 (74), 12:01 (77) | yes |
| V8 | Invite link → welcome page → set password | 2:40 (16), 2:53 (17) | yes |
| V9 | Static pages (About, Delivery, FAQ; also Who we serve, Careers, Resources) | 1:55 (11) | yes |
| V10 | Newsletter box | — | no: Decorative: it has no handler and writes nothing (reported in the inventory). |
| C1 | Portal dashboard and welcome banner | 2:53 (17), 3:04 (18) | yes |
| C2 | My catalog: Your price, offer price, Unavailable | 3:10 (19), 3:27 (21), 3:37 (22), 3:48 (23), 3:58 (24), 4:08 (25), 4:19 (26), 4:26 (27), 4:37 (28), 5:18 (32), 7:31 (46), 10:00 (63), 11:13 (71), 11:44 (75) | yes |
| C3 | Catalog search and category filter | 5:57 (36) | yes |
| C4 | Add to cart and quantity stepper | 5:57 (36), 6:04 (37) | yes |
| C5 | Cart with live prices | 6:13 (38) | yes |
| C6 | Checkout: pickup or delivery, note, no online payment | 6:20 (39), 6:31 (40) | yes |
| C7 | Order page and its status (Received, Confirmed, Ready, Completed, Cancelled) | 6:31 (40), 6:43 (41), 7:21 (45), 7:42 (47), 7:49 (48), 7:57 (49), 8:05 (50) | yes |
| C8 | My orders history | 8:17 (51) | yes |
| C9 | Invoice (and the cancelled watermark) | 8:28 (52), 9:02 (56) | yes |
| C10 | Statement for a period | 8:37 (53), 8:43 (54) | yes |
| C11 | Offers page | 5:13 (31), 5:35 (34) | yes |
| C12 | Account page | 11:29 (73) | yes |
| C13 | Locked out when not active | 11:36 (74) | yes |
| A1 | Admin sign-in (approved emails only) | 12:01 (77) | yes |
| A2 | Dashboard: new orders, revenue, profit, attention, offers, leads | 0:10 (1), 1:26 (8), 6:43 (41), 9:21 (58), 9:28 (59), 9:37 (60) | yes |
| A3 | Order alerts: count badge, sound | 6:31 (40), 12:11 (78) | yes |
| A4 | Leads: status tabs and status change | 1:12 (7), 1:34 (9), 2:05 (12) | yes |
| A5 | Add a customer: from approved leads, manual entry | 2:12 (13), 2:21 (14) | yes |
| A6 | Customers list | 11:51 (76) | yes |
| A7 | Customer page: badge (Not invited / Active), setup checklist | 2:31 (15), 2:53 (17), 3:10 (19) | yes |
| A8 | Portal access: Send email / Copy link | 2:40 (16) | yes |
| A9 | Assigned products: picker, manual price, source, profit | 3:20 (20), 3:27 (21), 3:37 (22), 3:48 (23) | yes |
| A10 | Customer margin | 3:58 (24) | yes |
| A11 | Catalog visibility and hidden products | 4:08 (25), 4:19 (26) | yes |
| A12 | Table tools: Export CSV, Recompute, Copy from customer, bulk prices | 4:48 (29) | yes |
| A13 | Per-customer offers | 5:03 (30), 5:13 (31), 5:18 (32) | yes |
| A14 | Edit account, suspend and restore | 11:29 (73), 11:36 (74), 11:44 (75) | yes |
| A15 | Customer statement: customer copy and internal copy | 8:37 (53), 8:51 (55) | yes |
| A16 | Assign products to many customers | 4:26 (27) | yes |
| A17 | Margin rules with automatic recompute | 3:37 (22), 4:37 (28) | yes |
| A18 | Offer library: templates, apply to many, running now, undo batch | 5:27 (33), 5:35 (34), 5:47 (35) | yes |
| A19 | Orders list: status tabs and date filter | 5:57 (36), 6:31 (40), 8:17 (51) | yes |
| A20 | Order page: cost and profit, confirm, stock check and oversell, prepared, complete, cancel with reason, invoice | 6:56 (42), 7:06 (43), 7:12 (44), 7:21 (45), 7:42 (47), 7:49 (48), 8:05 (50), 8:28 (52) | yes |
| A21 | Auto-assignment of ordered products on confirmation | 7:21 (45), 7:31 (46) | yes |
| A22 | Products: cost, price, profit, stock flags | 0:40 (4), 9:11 (57), 9:53 (62) | yes |
| A23 | Product dialog with photo upload | 10:51 (68), 11:00 (69) | yes |
| A24 | Receive stock | 10:00 (63) | yes |
| A25 | Deactivate a product | 11:07 (70), 11:13 (71) | yes |
| A26 | Categories and subcategories | 0:20 (2), 11:18 (72) | yes |
| A27 | Documents: product list, low-stock, unavailable | 9:45 (61), 10:41 (67) | yes |
| A28 | Analytics | 10:11 (64), 10:21 (65) | yes |
| A29 | Report builder | 10:31 (66) | yes |
| A30 | Date filters | 8:17 (51) | yes |

52 of 53 features shown; every step shows at least one feature.


## Chapters (also in `FULL_SYSTEM.chapters.txt`)

| Time | Chapter |
|---|---|
| 0:00 | Introduction |
| 0:07 | 1 · The public site |
| 0:50 | 2 · Applying for an account |
| 2:03 | 3 · Approval and invitation |
| 3:18 | 4 · Catalog and prices |
| 5:01 | 5 · Offers |
| 5:55 | 6 · Placing an order |
| 6:54 | 7 · Fulfilment |
| 8:25 | 8 · Invoices and statements |
| 9:09 | 9 · Stock, margins and reports |
| 10:49 | 10 · Managing the catalog |
| 11:27 | 11 · Accounts and access |
| 12:19 | End |

## What I could not cover or verify

- **Not shown:** the newsletter box in the footer. It has no handler and does nothing, so there is nothing to show.
- **Shown only in passing:**
  - Static pages: About, Delivery and FAQ are shown; Who we serve, Careers and Resources are not opened.
  - Bulk price tools: the table shows the buttons, but the film does not run Set flat price or % off list.
  - Export CSV: the button is on screen; the download itself is not shown.
  - Copy from customer: the dialog was captured, but the film shows only the Recompute dialog.
  - Undo batch: the button is on screen; it is not pressed.
- **Contact and supplier forms:** the film shows both forms and says plainly that their messages are saved but the admin does not show them. There is no admin screen for them in the app.
- **Invitations:**
  - The real app emails invites through Supabase. The local stack sends no email, so the film shows the "Copy link" path, which is the app's own no-email alternative, and mentions the email option.
  - The password-reset notice is shown; the email is not.
- **Alert sound:** the admin's new-order alert sound in the film is the film's own bell effect placed on the moment the order appears. The app's real chime is not recorded.
- **Voice:** I cannot hear audio. Holden's delivery and the "Oh-lake" pronunciation were checked only by speech recognition against the script, so please listen once.
- **App findings (the app was not changed):**
  - **Offer library → Running now crashes** when an amount-off or fixed-price offer is running (`src/app/admin/offers/running-now.tsx` → `formatDiscount` calls the client `formatMoney` on the server). The film uses a percent-off template, so the page renders.
  - On the phone, the app's cart and the phone invoice and statement squeeze the product-name column (one word per line). It is shown as it is.
  - The app's own UI copy has many sentences ending with periods; they are listed in the checklist.
- **Business details:** the documents show the fictional demo details from the local launcher. The real registered details must still be set before handover.
- **Pending Review:** all narration and caption copy is Pending Review. Nothing is marked approved.

## Repository

- **Branch:** `feat/videos-full`, pushed. No PR was merged.
- **Code:**
  - `videos/capture/full.mjs`
  - `videos/src/v3/full.ts`, `fullStory.ts`, `FullFilm.tsx`
  - `videos/full.mjs`
  - `videos/narration/FULL.json`, `FULL.coverage.json`
  - `videos/qa/full_checklist.py`, `full_docs.py`, `deliver_full.sh`
- **Not in git:** no media (captures, WAVs and MP4s are ignored).
- **Local demo database:** removed at the end of the run.
