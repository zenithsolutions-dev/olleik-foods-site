"""Where are the true peaks of an encoded file? usage: python qa/peaks.py <mp4> [events.json] → top 6 peaks (s, frame, dBTP, nearest event)"""
import json, subprocess, sys
import numpy as np, soundfile as sf
from scipy.signal import resample_poly
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", sys.argv[1], "-vn", "-ar", "48000", "_peaks.wav"], check=True)
x, sr = sf.read("_peaks.wav"); import os; os.remove("_peaks.wav")
a = np.abs(resample_poly(x, 4, 1, axis=0)).max(1)
ev = json.load(open(sys.argv[2]))["events"] if len(sys.argv) > 2 else []
win = sr * 4 // 10; out = []
for _ in range(6):
    i = int(np.argmax(a)); f = i / 4 / sr * 30
    near = min(ev, key=lambda e: abs(e["f"] - f)) if ev else {}
    out.append((round(i / 4 / sr, 2), round(f, 1), round(20 * np.log10(a[i]), 2), near.get("sfx"), near.get("f"), near.get("note")))
    a[max(0, i - win): i + win] = 0
for o in out: print(o)
