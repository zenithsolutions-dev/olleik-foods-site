# Olleik Videos: report for Parts A, B and C (2026-10-12)

**Branch:** `feat/videos` (draft PR #38, **not merged**). **Status:**
- **Done:** Parts A, B and C.
- **Waiting for the owner's word:** the final promo cuts (60/30/15/6 s, 1:1, loop) and the merge.

**Rules:**
- Everything was captured from the LOCAL demo stack; the hosted Supabase was never touched.
- All copy is **Pending Review**.

## A · Gate F re-delivery (approved by the owner)
Eight proofs, all PASS. Details: `GATE_F2_REPORT.md`, `GATE_F2_QA_CHECKLIST.md`; files in `D:\olleik-videos\v3\gate-f2\` (with README).

## B · The complete usage videos
Files are in `D:\olleik-videos\v3\manuals\`, with a README, SRTs, silent copies, QA sheets and `qa\QA_CHECKLIST.md` (also in `MANUALS_QA_CHECKLIST.md`).

| File | Content | Length | Loudness | True peak | Effects within ±1 frame | Longest still | Result |
|---|---|---|---|---|---|---|---|
| `manual-visitor.mp4` | Marco's First Order: 1 Apply · 2 Sign in · 3 Your catalog · 4 Ordering · 5 Follow up | 44.9 s | −16.0 LUFS | −2.2 dBTP | 130/130 | 5 frames | PASS |
| `manual-ep1.mp4` | Orders (ends on the Invoice button) | 17.6 s | −16.2 | −3.0 | 28/28 | 10 frames | PASS |
| `manual-ep2.mp4` | Customers and approvals | 13.4 s | −16.1 | −3.0 | 20/20 | 6 frames | PASS |
| `manual-ep3.mp4` | Products and prices | 14.6 s | −16.1 | −3.0 | 33/33 | 7 frames | PASS |
| `manual-ep4.mp4` | Margins and reports | 14.1 s | −16.0 | −2.9 | 16/16 | 4 frames | PASS |
| `manual-ep5.mp4` | Invites and access | 11.4 s | −16.2 | −3.0 | 13/13 | 3 frames | PASS |

**The V3.1 language, as applied:**
- **Camera:** one continuous camera per page, with whips only between pages. Every camera move runs on the 108 BPM grid, and no hold is longer than one beat (measured).
- **Taps and typing:** a tap switches to the real after-tap capture. Typing reveals the real typed capture, covering only the text not yet typed, with the field's own background. There are no overlays and no halos.
- **Captions:** in a lower band that never covers UI, with a chapter label on the left. Each SRT has the same lines.
- **Validated on every frame:**
  - the camera rules (zoom ≤ 1.6, native density, an anchor in frame);
  - the forbidden boxes, which can never enter the picture: document headers with the unset business details, the public site footer, and the home page's sample stats (the home page isn't used at all).
- **Live-action openers:** each episode opens on a 2 s live-action hook with Salma (4 new Higgsfield clips for episodes 2–5).
- **Visitor manual opener:** Marco's "Running low again?".
- **Endings:**
  - the visitor manual and episode 5 end on the end card;
  - episodes 2–4 end on a "Next: …" line;
  - episode 1 ends on Salma's outro.
- **New captions (Pending Review):**
  - "Your offers, set up by your Olleik rep"
  - "Your account: contacts, address and terms"
  - "It's in the list, ready to assign"
  - the hook lines "A new restaurant wants an account" and "The new customer can't sign in yet".

  All other captions are the approved EPISODE_PLAN_V2 lines without periods.

**Fixed during self-review before delivery** (per file in the checklist):
- **Typing:** a typed field stayed on screen after its page switched.
- **Framing:** sidebar slivers at the frame edge on several admin views, and card or table edges cut on the Portal, Offers and Account pages and in five admin framings.
- **Report sheet:** the report framing sliced a line of the sheet.
- **Duplicate product:** the new product in episode 3 duplicated an existing item (Red Bell Peppers), so I re-captured with "Mini Sweet Peppers".
- **Logo:** I rejected one generated hook frame because it showed a brand logo on a tablet.
- **Render:** the visitor manual render ran out of browser memory, so I re-rendered it at lower concurrency.

## C · End-to-end viewer review
- **What I checked:** every QA frame (0.5 s) of all 14 delivered films (8 proofs + 6 usage videos), as a viewer would.
- **What I re-checked:** each fix on the re-encoded MP4, not on the source.
- **Remaining issues:** nothing I'd hesitate to show.

## Could not solve / for the owner
1. **Visitor manual length:** it runs about 45 s, not ~90 s. It covers every step of the planned manual (15 captions, 5 chapters) at the doubled pace your V3.1 notes asked for. A ~90 s version would mean slower moves and longer holds, which conflicts with note 5. Say if you want a calmer cut.
2. **Invoice and documents:** the app's document header still shows "[LEGAL NAME TBC]" etc. Episode 1 ends on the Invoice button. The statement and report appear, but only below their headers. Set the business details in the app and I can show whole documents.
3. **App copy:** the app's own UI text ends sentences with periods (left as is; changing it is an app change).
4. **Audio:** I can't listen. Sync and loudness are measured; how the mix sounds is your call.

## Changes and spend
- **Code:**
  - `videos/src/v3/manualsFull.ts`: the six films.
  - `World.tsx`: held typing ends exactly on the page switch.
  - `camera.ts`: forbidden boxes validated per frame, under the caption band.
  - `manuals.ts`, `Episode3.tsx`: chapter labels, end cards and episode 1 framing.
  - `capture/v3-full.mjs` (every remaining screen) and `capture/typed.py` (typed-text extents).
  - `qa/manuals.sh`; `v3.mjs srtfull`.
- **Local demo DB only:**
  - Marco's test application was removed after capture.
  - A test product was replaced.
  - Riverside Noodle Bar's invite was reset before capture.
  - The local DB is kept for the final promo cuts.
- **Higgsfield:** 12 new generations (8 start frames, 4 clips), each logged with prompt and status, for 128 in total (about 66 credits: 573.5 → 507.5). All sound files used have licence rows.
