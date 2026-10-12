#!/bin/sh
# V3.2 §10.3 final promo cuts: picture → music and no-music mixes → mux (loudness loop on the MP4) → strict QA on the MP4.
#   sh qa/cuts.sh [CUT …]   (default: all six)
cd "$(dirname "$0")/.."
ALL="HERO60:promo-60s:139:0 CUT30:promo-30s:139:0 BUMPER6:promo-6s-bumper:56:0 LOOP10:promo-10s-loop:0:3.6 SQUARE:promo-1x1:139:0 VERTICAL15:promo-15s-vertical:45:0"
SEL="${*:-HERO60 CUT30 BUMPER6 LOOP10 SQUARE VERTICAL15}"
for item in $ALL; do
  key=${item%%:*}; rest=${item#*:}; name=${rest%%:*}; rest=${rest#*:}; bf=${rest%%:*}; off=${rest#*:}
  case " $SEL " in *" $key "*) ;; *) continue ;; esac
  echo "=== $key → $name"
  CONC=${CONC:-3} ./run.sh v3.mjs render V32-$key $name || echo "!!! FAILED render $key"
  if [ "$key" = "LOOP10" ]; then ENV="[[0,0],[300,0]]"; LOOP=',"loop":true'; else ENV="\"auto\""; LOOP=""; fi
  EXTRA="{\"bed_file\":\"out/v3/music/bed-C-60s.wav\",\"bed_from\":$bf,\"bed_offset_s\":$off,\"music_env\":$ENV,\"music_under_lu\":6,\"wav_tp\":-3.2$LOOP}" ./run.sh v3.mjs audio $name-music ev$key -14 src/v3/cuts.ts FR_$key || echo "!!! FAILED audio music $key"
  EXTRA="{\"wav_tp\":-3.2$LOOP}" ./run.sh v3.mjs audio $name-nomusic ev$key -14 src/v3/cuts.ts FR_$key || echo "!!! FAILED audio nomusic $key"
  ./run.sh v3.mjs mux $name music && ./run.sh v3.mjs mux $name nomusic || echo "!!! FAILED mux $key"
  for v in music nomusic; do PYTHONIOENCODING=utf8 python qa/qa.py $name-$v out/v3/mp4/$name-$v.mp4 out/qa-v32/$name-$v out/v3/audio/$name-$v > out/qa-v32/$name-$v.log 2>&1 || echo "!!! FAILED qa $name-$v"; done
done
echo ALL DONE
