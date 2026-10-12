"""Measures keyboard recordings against the blue-switch spec: per keystroke, the share of energy in 2.5–5 kHz in the
first 6 ms (click-jacket transient), whether a second transient (bottom-out clack) follows within 4–25 ms, the
spectral centroid, and the stroke rate. Prints one line per file, best candidates first.

  python audio/analyse_keys.py audio-library/raw/mixkit/2531.wav ...
"""
import sys

import numpy as np
import soundfile as sf
from scipy import signal

SR = 48000


def load(path):
    x, sr = sf.read(path, always_2d=True)
    x = x.mean(axis=1)
    if sr != SR:
        x = signal.resample_poly(x, SR, sr)
    return x / (np.max(np.abs(x)) + 1e-9)


def strokes(x):
    e = np.sqrt(np.convolve(x**2, np.ones(48) / 48, mode="same"))
    w = int(0.04 * SR)
    c = np.cumsum(np.concatenate([[0], e]))
    idx = np.arange(len(e))
    lo = np.maximum(0, idx - w)
    prev = (c[idx] - c[lo]) / np.maximum(1, idx - lo)
    hit = (e > 3 * prev + 1e-9) & (e > 0.05 * e.max())
    starts = np.where(hit & ~np.concatenate([[False], hit[:-1]]))[0]
    out, last = [], -1e9
    for s in starts:
        if s - last > 0.06 * SR:
            out.append(s)
            last = s
    return np.array(out), e


def band(seg, lo, hi):
    f, p = signal.periodogram(seg * np.hanning(len(seg)), SR)
    return p[(f >= lo) & (f < hi)].sum() / (p.sum() + 1e-12), (f * p).sum() / (p.sum() + 1e-12)


def analyse(path):
    x = load(path)
    st, env = strokes(x)
    clicks, centroids, doubles = [], [], 0
    for s in st:
        a = x[s : s + int(0.006 * SR)]
        if len(a) < 64:
            continue
        r, cen = band(a, 2500, 5000)
        clicks.append(r)
        centroids.append(cen)
        # A second transient 4–25 ms after the first (the bottom-out "clack").
        seg = env[s + int(0.004 * SR) : s + int(0.025 * SR)]
        base = env[s : s + int(0.003 * SR)].max()
        if len(seg) and seg.max() > 0.5 * base and np.argmax(seg) > int(0.002 * SR):
            doubles += 1
    n = len(clicks)
    dur = len(x) / SR
    return {
        "file": path.split("/")[-1].split("\\")[-1],
        "seconds": round(dur, 1),
        "strokes": n,
        "per_s": round(n / dur, 1) if dur else 0,
        "click_2.5-5k_share": round(float(np.median(clicks)), 3) if n else 0,
        "centroid_hz": int(np.median(centroids)) if n else 0,
        "double_transient_pct": round(100 * doubles / max(1, n)),
    }


if __name__ == "__main__":
    rows = [analyse(p) for p in sys.argv[1:]]
    rows.sort(key=lambda r: -(r["click_2.5-5k_share"] * 2 + r["double_transient_pct"] / 100))
    for r in rows:
        print(r)
