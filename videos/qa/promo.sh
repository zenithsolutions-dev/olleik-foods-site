#!/bin/sh
# Promo proof pipeline (Gate F V3.1): picture → both mixes → mux with loudness loop → strict QA on the MP4s.
set -e
cd "$(dirname "$0")/.."
CONC=4 ./run.sh v3.mjs render V3-Promo20 promo
EXTRA='{"bed_file":"out/v3/music/bed-C-60s.wav","bed_from":139,"music_env":[[0,-90],[139,-90],[143,0],[539,0],[556,-3],[598,-60]],"music_under_lu":6,"wav_tp":-3.2}' ./run.sh v3.mjs audio promo-music promoEvents -14 src/v3/promoEvents.ts PROMO_FRAMES
EXTRA='{"wav_tp":-3.2}' ./run.sh v3.mjs audio promo-nomusic promoEvents -14 src/v3/promoEvents.ts PROMO_FRAMES
./run.sh v3.mjs mux promo music
./run.sh v3.mjs mux promo nomusic

