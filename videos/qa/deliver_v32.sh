#!/bin/sh
# V3.2 delivery: copies the measured MP4s and their companions into D:\olleik-videos\final\ (README written separately).
set -e
cd "$(dirname "$0")/.."
F=/d/olleik-videos/final
mkdir -p $F/manual-visitor $F/manual-admin $F/episodes $F/promo $F/docs
for n in VISITOR ADMIN; do
  d=$F/manual-$(echo $n | tr 'A-Z' 'a-z')
  cp out/v3/mp4/USER_MANUAL_$n-voice.mp4 $d/USER_MANUAL_$n.mp4
  cp out/v3/mp4/USER_MANUAL_$n-silent.mp4 $d/USER_MANUAL_$n-silent-captioned.mp4
  ffmpeg -hide_banner -loglevel error -y -ss 6.0 -i $d/USER_MANUAL_$n.mp4 -frames:v 1 $d/USER_MANUAL_$n.poster.png
  node voiced.mjs docs V32-$n USER_MANUAL_$n $d > /dev/null
done
# the short usage videos (Part B) stay as extras
cp /d/olleik-videos/v3/manuals/*.mp4 /d/olleik-videos/v3/manuals/*.srt $F/episodes/ 2>/dev/null || true
for c in promo-60s promo-30s promo-15s-vertical promo-6s-bumper promo-1x1 promo-10s-loop; do
  cp out/v3/mp4/$c-music.mp4 out/v3/mp4/$c-nomusic.mp4 $F/promo/
done
cp ../docs/qa/2026-10-08-videos/V32_REPORT.md ../docs/qa/2026-10-08-videos/V32_QA_CHECKLIST.md ../docs/qa/2026-10-08-videos/CREATIVE_BRIEF_V3.md $F/docs/
cp audio-library/LICENSES.md $F/docs/LICENSES.md
cp narration/VISITOR.json narration/ADMIN.json $F/docs/
ls -R $F | head -80
