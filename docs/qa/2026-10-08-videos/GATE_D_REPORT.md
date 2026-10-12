# Olleik Videos V2: Gate D Report (proofs with characters and sound)

Date: 2026-10-09. Branch `feat/videos` (draft PR #38, **not merged**). Stopped at **Gate D**. No final renders, no AI
media, no downloads beyond the approved sounds. All copy **Pending Review** (the story, characters and PROMO_COPY_V2 were
approved at Gate C; hook A on the master and C on the 15 s vertical, “Morning.”, the slip as a story prop only, music
bed A rearranged sparse plus a no-music version).

## Proofs (copies in `D:\olleik-videos\v2\gate-d\`)

| File | What | Length | Loudness on the encoded MP4 | True peak | Sync (effects placed within 1 frame) |
|---|---|---|---|---|---|
| `anim15-music.mp4` | 15 s animatic, hook A, quiet bed A | 15.0 s, 5.6 MB | −14.3 LUFS | −1.5 dBTP | 100 % of 48 (each type on its own track) |
| `anim15-nomusic.mp4` | same, sound design only | 15.0 s, 5.6 MB | −14.4 LUFS | −1.6 dBTP | 100 % of 49 |
| `VISITOR-CH4-sfx.mp4` | visitor manual, Chapter 4 “Ordering”, Marco guiding | 38.0 s, 13.8 MB | −16.3 LUFS | −2.0 dBTP | 100 % of 23 |
| `EP1-sfx.mp4` | admin Episode 1 “Orders”, Salma guiding | 38.0 s, 19.1 MB | −16.1 LUFS | −1.9 dBTP | 100 % of 23 |
| `*-silent.mp4` | the same pictures without audio | | | | |
| `qa\*.png` | frames taken from the encoded MP4s (phone size) | | | | |

All files 1920×1080, 30 fps, H.264 + AAC 256 kb/s 48 kHz. Targets: promo −14 LUFS, manuals −16 LUFS, true peak ≤ −1 dBTP,
measured with ffmpeg ebur128 on the final MP4s. In the full effects stem 92–100 % land within a frame; the rest are quiet
sounds masked by a louder one at the same moment (each one lands correctly on its own track). Swells by design (the
speed-ramp stop, marker draws, camera glides) are reported, not scored. Music bed (music version): silent under the chaos,
enters on the snap about 15 dB under the effects, drops out for the half second before SENT (the mix falls about 12 dB there).

Animatic content: 11:04 PM chaos and “One more text.” → the tap and the grid morph → his real catalog with “Your catalog.
Your prices.” → three taps on the real portal screens → the slip rises out of his phone (real “Order received” screen) →
Salma confirms on the real admin screen and stamps CONFIRMED, boxes, chips Received → Confirmed → Ready → morning, boxes at
the door, half a second of quiet, SENT → end card.

## Rough edges fixed (from Gate C)
- **Close-up text vs Marco:** the hook line moved to the dark wall under the clock on a soft dark plate, smaller, and the
  close-up now frames Marco right of centre; the first bubble moved right so the line is clear. (On the close frames the
  bubbles now pile onto his face; that reads as “buried in messages” and is intentional.)
- **Morning line over the shelf:** split into two rows (“Your catalog.” / “Your prices.”) on the clear wall; Marco moved right.
- **Floating box at the door:** the second box now sits on the first box's top face, both in front of the door.
- **Smoother guide gestures:** gestures ease in with a small overshoot, hold, and ease out before the cut; a damped nod when
  each caption lands; a slow idle breath; thumbs-up only when the arm is up.
- Also fixed while checking the encoded proofs: the slip used to “print” from an invisible slot in the air (it now rises out
  of Marco's phone); marker circles now fade when the screen changes after a tap (one stayed on the wrong content);
  manuals got a pointer (desktop) or finger (phone) that travels to the target and taps it.

## Sounds sourced (licences recorded before use; `videos/audio-library/LICENSES.md`)
| Sound | Source | Licence |
|---|---|---|
| Door bell | Mixkit #2864 “Doorbell tone”, #333 “Doorbell single press” | Mixkit Sound Effects Free License |
| Stapler (stamp layer) | Mixkit #2995 “Stapling paper” | Mixkit Sound Effects Free License |
| Tape | Mixkit #3102 “Duct tape bandage” | Mixkit Sound Effects Free License |
| Paper tear | OpenGameArt “Various Paper Sound Effects”, paper_ripped_-_1.mp3 | CC0 (evidence saved) |
| Thermal printer | Mixkit #2383 “Paper scroll in an office” (real paper feed) + a faint synthesised stepper chirp | Mixkit licence; chirp is ours |
| Phone buzz | synthesised 165 Hz motor hum + REAL counter rattles (Kenney Impact Sounds) | ours + CC0 |
| Knife on the board | Mixkit #2152 refused the download (HTTP 403); replaced by a real light wood impact (Kenney) | CC0 |

Honest notes: no phone-vibration or thermal-printer recording with a clear licence exists on Mixkit, Kenney or
OpenGameArt, so those two are part-synthesised as described. Every other sound is a real recording. 56 sound files are used
across the four proofs; all 56 have licence rows. Downloads were limited to the six Mixkit items and the one OpenGameArt file
above (one failed). The music is original MIDI rendered with a free SoundFont: fine as a quiet bed, below a produced library
track, and a separate stem.

## Playbook
Applied your approval: the video-factory playbook (section 5) now allows characters and story scenes when the owner explicitly
asks for them; AI-generated footage or people still need explicit approval.

## What Gate D does not include (after your Go)
The 60 s hero, 30 s, 15 s vertical with hook C, 6 s bumper, 1:1 and 10 s loop; the full visitor manual and episodes 2–5;
SRTs, posters; final frame-by-frame QA on every cut; deleting the local demo database; merging after green CI.

## Questions
1. Approve the look and sound of the proofs, or list changes.
2. Music: keep the quiet bed A for the music versions, or go no-music only?
3. Are the part-synthesised phone buzz and printer acceptable, or should those moments use only real sounds (for example
   a notification pop instead of a buzz)?
