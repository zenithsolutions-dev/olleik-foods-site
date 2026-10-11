"""Strict self-review of an ENCODED deliverable (owner notes V3.1 §6). Everything is measured on the MP4 itself:

  1. QA frames every 0.5 s (frames/t000.0.jpg …) and contact-sheet pages of 12 for the visual review;
  2. frozen moments: the 99.8th percentile of the absolute difference between consecutive frames (luma, 480 × 270,
     blurred σ 3 so grain and encoder noise do not count; a percentile, not a mean, so a small element moving on a
     still background counts as movement); any run of near-identical
     frames longer than one beat at 108 BPM (17 frames) fails;
  3. text on screen: OCR (RapidOCR) of every QA frame; every line that ends with a period and every placeholder
     pattern ([…], TBC, 000-0000, placeholder, lorem, TODO) is listed for the review;
  4. loudness and true peak (ffmpeg ebur128 on the MP4);
  5. sync: the MP4's audio is cross-correlated with the verified mix (audio/verify.py, effects within ±1 frame) to
     measure the encode offset, and every hit with velocity ≥ 0.6 is checked for an onset within ±1 frame in the
     encoded audio itself.

usage: python qa/qa.py <name> <mp4> <out_dir> [<audio_dir with events.json and mix.wav>]   → <out_dir>/qa.json
"""
import json
import os
import re
import subprocess
import sys

import cv2
import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "audio"))
name, mp4, out = sys.argv[1:4]
adir = sys.argv[4] if len(sys.argv) > 4 else None
os.makedirs(f"{out}/frames", exist_ok=True)
for f in os.listdir(f"{out}/frames"):
    os.remove(f"{out}/frames/{f}")
rep = {"name": name, "file": mp4}

# 1 + 2: frames, motion
cap = cv2.VideoCapture(mp4)
fps = cap.get(cv2.CAP_PROP_FPS)
n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
rep.update(fps=fps, frames=n, seconds=round(n / fps, 2))
prev, diffs, saved = None, [], []
for i in range(n):
    ok, fr = cap.read()
    if not ok:
        break
    # blurred so film grain / encoder noise cannot count as movement; a real move or change still does
    g = cv2.GaussianBlur(cv2.cvtColor(cv2.resize(fr, (480, 270), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY), (0, 0), 3).astype(np.float32)
    if prev is not None:
        diffs.append(float(np.percentile(np.abs(g - prev), 99.8)))
    prev = g
    if i % round(fps / 2) == 0:
        p = f"{out}/frames/t{i / fps:05.1f}.jpg"
        cv2.imwrite(p, fr, [cv2.IMWRITE_JPEG_QUALITY, 92])
        saved.append(p)
STILL = 1.2  # 99.8th percentile of |Δ| (blurred luma, 0-255) below this = nothing anywhere on screen moved
BEAT = round(fps * 60 / 108)
runs, start = [], None
for i, d in enumerate(diffs + [99]):
    if d < STILL and start is None:
        start = i
    elif d >= STILL and start is not None:
        if i - start >= 2:
            runs.append([start + 1, i, i - start])
        start = None
longest = max(runs, key=lambda r: r[2]) if runs else [0, 0, 0]
rep["motion"] = {"still_threshold": STILL, "beat_frames": BEAT, "longest_still_run_frames": longest[2], "longest_still_run_at_s": round(longest[0] / fps, 2),
                 "still_runs_over_one_beat": [r for r in runs if r[2] > BEAT], "pass": all(r[2] <= BEAT for r in runs)}
subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "sheet.py"), f"{out}/sheet"] + saved, check=True, capture_output=True)

# 3: OCR
from rapidocr_onnxruntime import RapidOCR  # noqa: E402

ocr = RapidOCR()
PLACEHOLDER = re.compile(r"\[[^\]]*\]|\bTBC\b|000-0000|placeholder|lorem|\bTODO\b|\bXXX\b", re.I)
periods, placeholders, texts = [], [], {}
for p in saved:
    res, _ = ocr(p)
    t = os.path.basename(p)[1:-4]
    lines = [r[1].strip() for r in (res or []) if float(r[2]) > 0.6]
    texts[t] = lines
    for ln in lines:
        if re.search(r"[A-Za-z]\.$", ln) and not re.search(r"\b[A-Za-z]{1,3}\.[a-z]{2,}", ln):
            periods.append({"t": t, "text": ln})
        if PLACEHOLDER.search(ln):
            placeholders.append({"t": t, "text": ln})
rep["ocr"] = {"lines_ending_with_period": periods, "placeholder_patterns": placeholders}
json.dump(texts, open(f"{out}/ocr.json", "w", encoding="utf8"), indent=1, ensure_ascii=False)

# 4: loudness
r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", mp4, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
summ = r.stderr[r.stderr.rfind("Summary:"):]
I = re.search(r"I:\s+(-?[\d.]+) LUFS", summ)
TP = re.search(r"Peak:\s+(-?[\d.]+) dBFS", summ)
rep["loudness"] = {"integrated_lufs": float(I.group(1)) if I else None, "true_peak_dbtp": float(TP.group(1)) if TP else None}

# 5: sync on the encoded audio
if adir:
    from verify import SWELLS, onsets  # noqa: E402
    from dsp import SR  # noqa: E402

    wav = f"{out}/_enc.wav"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", mp4, "-vn", "-ac", "1", "-ar", str(SR), wav], check=True)
    enc, _ = sf.read(wav)
    os.remove(wav)
    mix, sr2 = sf.read(f"{adir}/mix.wav")
    mix = mix.mean(axis=1) if mix.ndim > 1 else mix
    L = min(len(enc), len(mix), SR * 12)
    a, b = enc[:L], mix[:L]
    nfft = 1 << (2 * L - 1).bit_length()
    xc = np.fft.irfft(np.fft.rfft(a, nfft) * np.conj(np.fft.rfft(b, nfft)), nfft)
    lag = int(np.argmax(np.concatenate([xc[-SR // 10:], xc[: SR // 10]]))) - SR // 10
    ev = json.load(open(f"{adir}/events.json"))["events"]
    on = np.array(onsets(enc))
    hits = [e for e in ev if e.get("vel", 0) >= 0.6 and e["sfx"] not in SWELLS]  # swells grow out of silence: no onset to score
    ok = 0
    worst = []
    for e in hits:
        t = e["f"] / 30
        d = on[np.argmin(np.abs(on - t))] - t if len(on) else 9
        if abs(d) <= 1 / 30 + 0.002:
            ok += 1
        else:
            worst.append({"f": e["f"], "sfx": e["sfx"], "offset_ms": round(d * 1000, 1)})
    vj = json.load(open(f"{adir}/verify.json")) if os.path.exists(f"{adir}/verify.json") else {}
    iso = vj.get("isolated_per_type", {})
    rep["sync"] = {"encode_offset_ms": round(lag / SR * 1000, 2), "loud_hits_within_1_frame": f"{ok}/{len(hits)}", "misses": worst[:12],
                   "mix_effects_within_1_frame_pct": iso.get("percent"), "mix_effects_scored": iso.get("scored"), "events": len(ev)}
json.dump(rep, open(f"{out}/qa.json", "w", encoding="utf8"), indent=1, ensure_ascii=False)
print(json.dumps({k: v for k, v in rep.items() if k in ("seconds", "motion", "loudness", "sync")}, ensure_ascii=False))
print("OCR period lines:", len(periods), "| placeholder patterns:", len(placeholders))
for x in periods[:40]:
    print("  .", x["t"], x["text"])
for x in placeholders:
    print("  [", x["t"], x["text"])
