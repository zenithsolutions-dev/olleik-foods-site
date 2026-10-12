#!/bin/sh
# FULL SYSTEM film delivery: the measured MP4s and their companions into D:\olleik-videos\final\full-system\
# (README, report and checklist are written separately into the same folder).
set -e
cd "$(dirname "$0")/.."
F=/d/olleik-videos/final/full-system
mkdir -p $F/docs
cp out/v3/mp4/FULL_SYSTEM-voice.mp4 $F/FULL_SYSTEM.mp4
cp out/v3/mp4/FULL_SYSTEM-silent.mp4 $F/FULL_SYSTEM-silent-captioned.mp4
# poster: the split screen at the first cross-side thread of chapter 2 (the application reaching the admin)
ffmpeg -hide_banner -loglevel error -y -ss "${POSTER_AT:-82.0}" -i $F/FULL_SYSTEM.mp4 -frames:v 1 $F/FULL_SYSTEM.poster.png
node full.mjs docs FULL_SYSTEM $F > /dev/null
rm -f $F/FULL_SYSTEM.steps.json
cp ../docs/qa/2026-10-12-videos/FEATURE_INVENTORY.md ../docs/qa/2026-10-12-videos/FULL_SYSTEM_REPORT.md ../docs/qa/2026-10-12-videos/FULL_SYSTEM_QA_CHECKLIST.md $F/docs/
cp audio-library/LICENSES.md $F/docs/LICENSES.md
cp narration/FULL.json $F/docs/FULL.narration.json
ls -la $F $F/docs
