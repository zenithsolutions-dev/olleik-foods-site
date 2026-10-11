#!/bin/sh
# Gate F V3.1 re-delivery: every proof rendered, mixed, muxed (loudness loop on the MP4) and QA'd from the MP4.
cd "$(dirname "$0")/.."
Q() { PYTHONIOENCODING=utf8 python qa/qa.py "$1" "$2" "out/qa-f2/$1" "$3"; }
step() { echo "=== $*"; "$@" || echo "!!! FAILED: $*"; }
mkdir -p out/qa-f2
if [ -z "$SKIP_PROMO" ]; then
  step sh qa/promo.sh
  for v in music nomusic; do Q promo-$v out/v3/mp4/promo-$v.mp4 out/v3/audio/promo-$v; done
fi
# V3 manuals
for m in "V3-VISITOR-CH4 visitor-ch4 visitorEvents VISITOR_CH4_FRAMES" "V3-EP1 ep1 ep1Events ADMIN_EP1_FRAMES"; do
  set -- $m
  step env CONC=4 ./run.sh v3.mjs render $1 $2
  step env EXTRA='{"wav_tp":-3}' ./run.sh v3.mjs audio $2 $3 -16 src/v3/manuals.ts $4
  step ./run.sh v3.mjs mux $2 sfx
  Q $2 out/v3/mp4/$2-sfx.mp4 out/v3/audio/$2
done
step ./run.sh v3.mjs srt
# V2 line
step env CONC=4 ./run.sh v2.mjs render film anim15
step ./run.sh v2.mjs audio film anim15 music
step ./run.sh v2.mjs audio film anim15 nomusic
step ./run.sh v2.mjs mux anim15 music
step ./run.sh v2.mjs mux anim15 nomusic
for v in music nomusic; do Q v2-anim15-$v out/v2/mp4/anim15-$v.mp4 out/v2/audio/anim15-$v; done
for e in VISITOR-CH4 EP1; do
  step env CONC=4 ./run.sh v2.mjs render ep $e
  step ./run.sh v2.mjs audio ep $e
  step ./run.sh v2.mjs mux $e sfx
  Q v2-$e out/v2/mp4/$e-sfx.mp4 out/v2/audio/$e-sfx
done
echo ALL DONE
