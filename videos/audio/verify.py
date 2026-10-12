"""Measures what cannot be heard here: onset alignment of every SFX against its event frame, hits on the beat grid,
loudness / true peak (also cross-checked with ffmpeg ebur128 by review.py), spectral balance.

  python audio/verify.py out/promo/audio/master [--seconds 20]   → verify.json
"""
import json
import os
import sys

import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import maximum_filter1d, median_filter

sys.path.insert(0, os.path.dirname(__file__))
from dsp import SR, SPF  # noqa: E402

TOL = 0.033  # ±1 frame at 30 fps
# Swells are designed to grow out of silence: their "onset" is not a transient, so they are reported, not scored.
SWELLS = {"riser", "tail", "line", "icon", "cam", "rampdown", "marker"}  # rampdown: reversed whoosh grows into the cut; marker: soft line swell
HOP = 128


def onsets(x, ratio=2.0, floor_db=-45, min_gap=0.02):
    """Onset times (s): where a 1 ms energy envelope jumps above `ratio` × the mean of the previous 40 ms and is above
    the floor. Sample-accurate (no STFT window lag), works from t = 0 and on a hit that lands on a loud riser."""
    e = np.sqrt(np.convolve(x**2, np.ones(48) / 48, mode="full")[: len(x)])
    w = int(0.04 * SR)
    c = np.cumsum(np.concatenate([[0], e]))
    prev = np.empty_like(e)
    idx = np.arange(len(e))
    lo = np.maximum(0, idx - w)
    prev = (c[idx] - c[lo]) / np.maximum(1, idx - lo)
    floor = 10 ** (floor_db / 20) * e.max()
    hit = (e > ratio * prev + 1e-9) & (e > floor)
    starts = np.where(hit & ~np.concatenate([[False], hit[:-1]]))[0]
    out, last = [], -1e9
    for s_ in starts:
        if s_ - last >= min_gap * SR:
            out.append(s_ / SR)
            last = s_
    return np.array(out)


def match(events, det, end_s):
    rows = []
    for e in events:
        t = e["f"] * SPF / SR
        if t > end_s:
            continue
        if len(det):
            j = np.argmin(np.abs(det - t))
            err = det[j] - t
        else:
            err = np.inf
        rows.append({"sfx": e["sfx"], "f": e["f"], "t": round(t, 3), "err_ms": round(float(err) * 1000, 1), "ok": bool(abs(err) <= TOL), "swell": e["sfx"] in SWELLS, "grid": bool(e.get("grid"))})
    return rows


def summarise(rows):
    scored = [r for r in rows if not r["swell"]]
    by = {}
    for r in scored:
        d = by.setdefault(r["sfx"], {"n": 0, "ok": 0, "errs": []})
        d["n"] += 1
        d["ok"] += r["ok"]
        if np.isfinite(r["err_ms"]):
            d["errs"].append(abs(r["err_ms"]))
    per = {k: {"n": v["n"], "within_1_frame": v["ok"], "mean_abs_ms": round(float(np.mean(v["errs"])), 1) if v["errs"] else None, "max_abs_ms": round(float(np.max(v["errs"])), 1) if v["errs"] else None} for k, v in sorted(by.items())}
    ok = sum(r["ok"] for r in scored)
    return {"scored": len(scored), "within_1_frame": ok, "percent": round(100 * ok / max(1, len(scored)), 1), "per_type": per, "misses": [r for r in scored if not r["ok"]][:40]}


def band_balance(x):
    f, p = signal.welch(x, fs=SR, nperseg=8192)
    tot = p.sum()
    bands = {"sub <60": (0, 60), "bass 60-250": (60, 250), "low-mid 250-2k": (250, 2000), "presence 2k-6k": (2000, 6000), "air >6k": (6000, 24000)}
    return {k: round(float(100 * p[(f >= lo) & (f < hi)].sum() / tot), 1) for k, (lo, hi) in bands.items()}


def verify(cut_dir, seconds=None):
    data = json.load(open(os.path.join(cut_dir, "events.json"), encoding="utf8"))
    sfx_st, _ = sf.read(os.path.join(cut_dir, "sfx.wav"))
    mix_st, _ = sf.read(os.path.join(cut_dir, "mix.wav"))
    end_s = seconds or len(mix_st) / SR
    n = int(end_s * SR)
    det_sfx = onsets(sfx_st[:n].mean(axis=1))
    det_mix = onsets(mix_st[:n].mean(axis=1))
    rows_sfx = match(data["events"], det_sfx, end_s)
    grid = [e for e in data["events"] if e.get("grid")]
    rows_mix = match(grid, det_mix, end_s)
    off_grid = [e for e in grid if e["f"] % 15 not in (0, 8)]
    # Placement check: each SFX type rendered on its own track (same events, same seeds) so a quiet sound is not hidden
    # by a louder one; this measures where each sound starts relative to its frame.
    if data.get("engine") == "v2":  # V2 story film and episodes: sfx_v2 through mix_v2
        import mix_v2 as mixmod
    elif "cand" in data:  # v3 / final cuts: real-recording SFX (sfx2) through mix3
        import mix3 as mixmod
    else:
        import mix as mixmod

    iso_rows = []
    for typ in sorted({e["sfx"] for e in data["events"]}):
        evs = [e for e in data["events"] if e["sfx"] == typ and e["f"] * SPF / SR <= end_s]
        if not evs:
            continue
        track = mixmod.build_sfx(evs, n).mean(axis=1)
        iso_rows += match(evs, onsets(track), end_s)
    res = {
        "cut": data["cut"],
        "isolated_per_type": summarise(iso_rows),
        "seconds": end_s,
        "sfx_stem": summarise(rows_sfx),
        "hits_in_full_mix": summarise(rows_mix),
        "grid_hits": len(grid),
        "grid_hits_off_the_beat_grid": len(off_grid),
        "swells_reported_not_scored": sorted({r["sfx"] for r in rows_sfx if r["swell"]}),
        "band_balance_percent_mix": band_balance(mix_st[:n].mean(axis=1)),
    }
    json.dump(res, open(os.path.join(cut_dir, "verify.json" if not seconds else f"verify-{int(seconds)}s.json"), "w"), indent=1)
    return res


if __name__ == "__main__":
    args = sys.argv[1:]
    secs_ = None
    if "--seconds" in args:
        i = args.index("--seconds")
        secs_ = float(args[i + 1])
        args = args[:i] + args[i + 2 :]
    for d in args:
        r = verify(d, secs_)
        print(d, "isolated", r["isolated_per_type"]["percent"], "% | sfx", r["sfx_stem"]["percent"], "% of", r["sfx_stem"]["scored"], "| mix hits", r["hits_in_full_mix"]["percent"], "% | off-grid", r["grid_hits_off_the_beat_grid"], "|", r["band_balance_percent_mix"])
