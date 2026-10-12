#!/bin/sh
# Part B: the six usage videos. Each one: picture → mix → mux (loudness loop on the MP4) → strict QA from the MP4.
#   sh qa/manuals.sh [comp …]     (default: all six)
cd "$(dirname "$0")/.."
ALL="V3-VISITOR-FULL:manual-visitor:visitorFullEvents:VISITOR_FULL_FRAMES V3-EP1-FULL:manual-ep1:ep1FullEvents:EP1_FULL_FRAMES V3-EP2:manual-ep2:ep2Events:EP2_FRAMES V3-EP3:manual-ep3:ep3Events:EP3_FRAMES V3-EP4:manual-ep4:ep4Events:EP4_FRAMES V3-EP5:manual-ep5:ep5Events:EP5_FRAMES"
SEL="${*:-$ALL}"
for item in $ALL; do
  comp=${item%%:*}; rest=${item#*:}; name=${rest%%:*}; rest=${rest#*:}; fn=${rest%%:*}; frames=${rest#*:}
  case " $SEL " in *" $item "*|*" $comp "*) ;; *) continue ;; esac
  echo "=== $comp → $name"
  CONC=${CONC:-4} ./run.sh v3.mjs render $comp $name || echo "!!! FAILED render $comp"
  EXTRA='{"wav_tp":-3}' ./run.sh v3.mjs audio $name $fn -16 src/v3/manualsFull.ts $frames || echo "!!! FAILED audio $name"
  ./run.sh v3.mjs mux $name sfx || echo "!!! FAILED mux $name"
  PYTHONIOENCODING=utf8 python qa/qa.py $name out/v3/mp4/$name-sfx.mp4 out/qa-b/$name out/v3/audio/$name || echo "!!! FAILED qa $name"
done
./run.sh v3.mjs srtfull
echo ALL DONE
