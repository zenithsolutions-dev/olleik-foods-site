# Olleik Foods Videos: Stop-Gate Report (A and B)

Date: 2026-10-08. Branch: `feat/videos`. Playbook: video-factory skill (`references/PLAYBOOK.md`).
Inputs: VIDEOS = V-VISITOR, V-ADMIN, V-PROMO · LANGUAGE English · VOICEOVER no · MUSIC generated.
**Status: stopped at stop gates A (manuals) and B (promo). No final video has been rendered. Waiting for "Go".**
All copy is **Pending Review**; nothing is marked approved.

## 1. What is delivered (copy in `D:\olleik-videos\`)

| Item | File(s) | Notes |
|---|---|---|
| Phase 1 brief | `docs\PROJECT_BRIEF.md` (= `videos/PROJECT_BRIEF.md`) | Product, audiences, promises, brand tokens and fonts, roles, every screen and route, demo-data plan, compliance list, product issues seen |
| V-VISITOR storyboard + script | `manual-visitor\VISITOR-storyboard.png`, `VISITOR-vertical-storyboard.png`, `VISITOR.md` | 20 beats, planned 1:29 (target 75–90 s); 9:16 vertical cut boarded too |
| V-ADMIN storyboard + script | `manual-admin\ADMIN-storyboard.png`, `ADMIN.md` | 38 beats, 7 chapters, planned 2:47 (target 2–4 min) |
| V-STAFF | **skipped** | The product has no staff role (admin is a single email allowlist with no role levels; customers use the portal) |
| Promo copy | `promo\PROMO_COPY.md` | 8 hooks, 3 chosen openings (H1, H2, H7), every scene's on-screen text and caption for every cut; all Pending Review |
| Promo storyboards | `promo\storyboards\promo-*.png` | master 60 s 16:9 + openings sheet; short 45 s 9:16 + openings sheet; bumper 20 s; angle cuts “New accounts” and “Approved customers” (40 s 9:16); website hero loop 12 s |
| 20-second proof of the look, with audio | `promo\proof\proof-20s-16x9-H1-music-A.mp4` (+ silent version, QA frame sheet from the MP4, audio levels and onset data) | 1920×1080, 30 fps, H.264 + AAC 256 kb/s, 20.0 s, 6.0 MB |
| Music candidates | `promo\music-candidates\` | A “Market Morning” 120 BPM, B “Open Kitchen” 124 BPM, C “Slow Simmer” 100 BPM; each as master 60 s, short 45 s and bumper 20 s edits, plus the master stems (drums, bass, chords, lead) |
| Audio licences | `docs\LICENSES.md` (= `videos/audio-library/LICENSES.md`) | every sample with source URL, licence and evidence file |

## 2. Capture source and demo data (important decision)

- The Supabase project configured in `.env.local` is treated as production. A read-only count of its tables was refused by
  the session's safety layer, which is the right outcome: **nothing in that project was read or written.**
- Instead `videos/devstack/` runs a **local stand-in on 127.0.0.1 only**: embedded Postgres 18 with this repo's 15 migrations,
  the official PostgREST 14.18 Windows binary (MIT, GitHub release), and a small auth emulator written for this task (no
  email is ever sent; invites and password resets are no-ops). The app's dev server ran on port 3100 with every `.env.local`
  key overridden by local test values (Stripe unset). The capture browser allowed only localhost plus the site's own
  public photo host; **0 outbound requests were blocked or made** across all capture runs. Gateway log: 1,760 local requests.
- Demo data (`videos/devstack/seed.mjs`): 6 fictional businesses (Copperleaf Kitchen, Bluestone Bakehouse, Juniper & Rye
  Café, Harbourline Catering, Ember Lane Pizza, Saffron Courtyard) with invented contacts, `@olleik-demo.test` emails,
  (613) 555-01xx phones and “Demo Lane / Sample Street” addresses; 5 leads; 82 seeded orders over 11 weeks; 30 generic
  products with demo prices, costs and stock; 2 offers, 2 offer templates; 1 demo admin. The 0001 migration's own sample
  customers and leads (realistic business names) were deleted in the local copy so they never appear on screen.
- Counts now (local only): 6 auth users (all `@olleik-demo.test`), 6 customers, 5 leads, 93 orders (82 seeded + orders and
  an application placed during the captures), 31 products. The local database is kept until the final renders, then
  deleted (`node videos/devstack/stack.mjs --reset` or delete `videos/devstack/_data`). No account exists anywhere else.
- The browser bar in the videos shows the public host `olleik-foods-site.vercel.app`; the pictures are the same code.

## 3. The promo look (proof)

Product-launch motion graphics built only from the brand and real captures: deep-green, amber and warm-paper colour
fields; Geist heavy + Fraunces italic accent (the site's own fonts); kinetic type that slams on the beat; real 3× captures
in a browser frame and a phone with camera pushes, cursor and taps with ripples, typed text, rings and callouts; colour
wipes, pushes, slides and circle reveals; grain and light sweeps; end card with mark, wordmark, tagline, button and URL.
No characters, story scenes, AI footage, stock or city imagery. The product has no dark mode; the deep-green field is the
dark scene.

QA of the proof, from frames of the encoded MP4 at full and phone size: frame 0 shows the hook (not blank); two defects
found and fixed before delivery (the checkout note was drawn twice; the application “sent” screen was mostly empty white,
now ends on the button press with a “Sent to the Olleik team” callout).

## 4. Audio (measured; I cannot listen)

| File | Integrated | True peak | Notes |
|---|---|---|---|
| proof MP4 (after AAC) | −14.0 LUFS | −1.9 dBTP | measured on the encoded file with ffmpeg ebur128 |
| proof WAV mix | −14.04 LUFS | −2.0 dBTP | mono − stereo −0.78 LU, L/R correlation 0.64 |
| Music A / B / C master edits | −14.3 / −14.1 / −14.0 LUFS | −1.8 dBTP each | power-weighted spectral centroid 1,131 / 1,048 / 692 Hz (the accepted reference track: 867 Hz) |

Sound alignment (proof): every sound comes from the same event list as the picture. Each type rendered alone:
**141 of 141 onsets within one frame** (typing: 108 keystrokes, mean 9 ms, max 30 ms). In the full SFX stem 139 of 141
(two masked by overlapping sounds: a slow whoosh and a ring pop); hits in the full mix 13 of 13; 1 grid hit off the beat
grid, to be fixed in the final pass.

Honest notes:
- Sound effects are **real recordings** (Kenney CC0 packs, Mixkit Sound Effects Free License). Typing is a blue-switch
  keystroke assembled from real recordings (switch click + bottom-out clack + key-up) with one faint synthesised ring layer.
  These are the same licensed files the toolkit sourced on 2026-10-05, copied locally (no new downloads).
- The music is **original MIDI composed in code** for this project and rendered with FluidSynth and the GeneralUser GS
  SoundFont (licence recorded; the author notes a small residual uncertainty about sample origins). It is good enough for
  an ad but sounds like sampled MIDI and is below a produced library track. It is a separate stem in every cut, so a
  licensed track can replace it in minutes.

## 5. Compliance (food wholesale; see brief section 8)

No prices, discounts, minimums, terms, delivery times, stock counts, statistics, testimonials, customer names,
comparisons, guarantees or health / allergen / freshness / origin claims in any caption or hook. Promises used are product
facts verified in the code. Demo prices appear only inside product screens (manual videos; promo phone screens as UI
texture). No admin screens in any promo cut. No licence or disclaimer line applies to this business.

## 6. Open questions for the owner (and the client)

1. **Approve or change the copy** in `PROMO_COPY.md`, `VISITOR.md` and `ADMIN.md` (all Pending Review).
2. **Music:** pick A, B or C by ear (`promo\music-candidates`). The cut grid is built for A (120 BPM); B or C needs a
   re-timed render (the timeline takes the BPM as a parameter).
3. **Address on the end cards:** `olleik-foods-site.vercel.app` is the live address. If a custom domain (the site's
   email uses olleikfoods.com) will be live at launch, tell me and it replaces the URL everywhere.
4. **Region line:** “Wholesale food supply, Ottawa region” is taken from the site; confirm it is right to say in ads.
5. The site itself shows statistics, testimonials, “Trusted by” names, a placeholder phone (000) 000-0000 and business
   identity placeholders on documents. They were kept out of every promo frame and out of manual close-ups; the client should
   confirm or remove them before launch (not changed here).

## 7. Things in the product that looked wrong while capturing (not fixed; product code untouched)

- `src/lib/business.ts` placeholders print on invoices, statements and reports (“[LEGAL NAME TBC]”, “[STREET ADDRESS]”,
  “[PHONE]”, “[EMAIL]”).
- Footer phone “(000) 000-0000”; homepage stats, testimonials and customer names look like placeholders; the hero mockup
  shows a sample customer name and prices.
- No product has a photo: portal cards show a letter tile (“A”).
- On a 390 px phone the cart truncates product names to “Aged…”, “Atlan…”.
- The desktop customer portal is a narrow column with wide empty margins at 1440 px.
- `npm run lint` already fails on `main` (7 `react/no-unescaped-entities` errors in `src/app/(marketing)/page.tsx`, 1 unused
  import in `suppliers/page.tsx`). Not caused by this branch; `videos/` is excluded from the app's lint and type-check.

## 8. Repository, branch and CI

- Branch `feat/videos`, commits per deliverable: phase-1 brief + local stack; manual engine + captures + scripts; promo
  engine + copy + music + licences; this report. App code is unchanged except `tsconfig.json` / `eslint.config.mjs`
  (exclude `videos/`) and `.claude/launch.json` (the local demo server entry). The user's uncommitted `.env.example` change
  was left untouched and is not in any commit.
- The repo has no GitHub Actions; the PR check is the Vercel preview build. The PR stays open (not merged) until “Go”.
- Video outputs, captures and audio files are git-ignored (`videos/out`, `videos/public/footage`, `videos/audio-library/raw`).
- Disk: C: has about 2 GB free, so every Remotion temp bundle is written to D: and deleted after each run (`videos/run.sh`).
  Memory ran short once (the dev server held ~2 GB); the dev server and the local stack are stopped now.

## 9. After “Go” (plan)

1. Re-seed, re-capture any stale shot, render V-VISITOR (16:9 + 9:16) and V-ADMIN with the restrained sound bed; SRT,
   poster, chapter list, silent captioned versions; frame-by-frame QA from the MP4s.
2. Promo: master 60 s first, polished hard (two full frame reviews at full and phone size), then the 45 s, bumper (9:16 and
   1:1), the two angle cuts, the hero loop; three openings for the master and the 45 s; SRTs, posters, three thumbnails,
   `CUE_SHEET.md`, `PROMO_CAMPAIGN.md`; −14 LUFS / ≤ −1 dBTP on every encoded file.
3. Delete the local demo database; verify zero demo accounts remain; merge after green CI (Rebase and merge).
