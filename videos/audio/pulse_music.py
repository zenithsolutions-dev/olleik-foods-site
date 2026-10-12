"""V3 rhythm-led sound (CREATIVE_BRIEF_V3 §6, Gate E):
  1. the PULSE: a percussive groove at exactly 108 BPM built only from the story's own recorded sounds (box thud as the
     kick, tap as the backbeat, knife-on-board chops as the 8ths, the stamp as the accent, a printer burst as the fill),
     placed sample-accurately on the grid (one beat = 26 666.67 samples at 48 kHz);
  2. three MUSIC BED candidates from Higgsfield (seedance_2_0 native audio of instrumental performance clips; the
     connector has no standalone music model): tempo measured, conformed to exactly 108.000 BPM with rubberband (pitch
     kept), phase-aligned to the grid, a clean section looped to 60 s with short crossfades on beat boundaries;
  3. previews: pulse alone and pulse + each bed (bed under the pulse), 20 s, −14 LUFS, true peak ≤ −1 dBTP on the WAV;
     plus 60 s stems.
Every bed is then re-measured: tempo and the beat-phase error against the grid (reported in out/v3/music/report.json).

  python audio/pulse_music.py
"""
import json
import os
import subprocess
import sys

import numpy as np
import soundfile as sf
from scipy import signal

sys.path.insert(0, os.path.dirname(__file__))
import sfx_v2  # noqa: E402
from dsp import SR, from_db, limiter, lufs, rng_for, true_peak_db, write_wav  # noqa: E402

BPM = 108.0
SPB = SR * 60 / BPM
OUT = "out/v3/music"
SRC = "higgsfield/music/wav"
CANDS = {  # name: (source take, loop start search from (s), loop length in beats, description)
    "A": ("A-soul-t1", 0.3, 16, "warm modern soul: Rhodes chords, upright bass, brushed kit"),
    "B": ("B-folk-t2", 7.6, 8, "bright Mediterranean folk-pop: nylon guitar ostinato, claps, shaker, frame drum"),
    "C": ("C-marimba-t2", 0.3, 16, "minimal modern: marimba, muted bass, minimal kick and rim"),
}


def onset_env(m, hop=128):
    f, t, S = signal.stft(m, SR, nperseg=1024, noverlap=1024 - hop)
    flux = np.maximum(0, np.diff(np.log1p(np.abs(S)), axis=1)).sum(axis=0)
    return flux / (flux.max() + 1e-9), hop


def comb(env, hop, bpm_lo, bpm_hi, step=0.01):
    """Best (bpm, phase in samples) by summing the onset envelope on a beat comb."""
    best = (0, 0, -1)
    for bpm in np.arange(bpm_lo, bpm_hi, step):
        p = SR * 60 / bpm / hop
        k = np.arange(int((len(env) - p) / p))
        for ph in np.arange(0, p, 1.0):
            idx = (ph + k * p).astype(int)
            s = env[idx].mean()
            if s > best[2]:
                best = (bpm, ph * hop, s)
    return best


def stretch(x, ratio, path_in, path_out):
    write_wav(path_in, x)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", path_in, "-af", f"rubberband=tempo={ratio:.6f}:pitchq=quality:transients=crisp", path_out], check=True)
    y, _ = sf.read(path_out)
    return y


def place(out, x, at):
    at = int(round(at))
    m = min(len(x), len(out) - at)
    if m > 0:
        out[at : at + m] += x[:m]


def pulse(seconds, start=0.0):
    """The groove. Bars of 4 beats; 8ths for the chops. Returns stereo and the list of hit times (s)."""
    n = int(seconds * SR)
    out = np.zeros((n, 2))
    hits = []
    beats = int((seconds - start) * BPM / 60)
    for b in range(beats):
        t = start * SR + b * SPB
        bar, beat = divmod(b, 4)
        def hit(name, vel, at=t, **kw):
            x = sfx_v2.LIBRARY[name](rng_for(name, int(at // 1600), b), vel=vel, **kw) * from_db(sfx_v2.LEVEL.get(name, -10))
            place(out, x, at)
            hits.append((round(at / SR, 4), name))
        if beat in (0, 2):
            hit("box", 0.85 if beat == 0 else 0.6)  # kick
        if beat in (1, 3):
            if beat == 3 and bar % 4 == 3:
                hit("stamp", 0.85)  # accent at the end of every 4-bar phrase
            else:
                hit("tap", 0.75, pan=0.1)  # backbeat
        hit("chop", 0.32 if beat % 2 else 0.4, at=t + SPB / 2)  # off-beat 8th
        if bar % 8 == 7 and beat == 3:
            hit("printer", 0.5, at=t + SPB / 4, dur=8)  # fill into the next phrase
    return out, hits


def bed(name):
    take, loop_from, loop_beats, desc = CANDS[name]
    x, sr = sf.read(f"{SRC}/{take}.wav")
    assert sr == SR
    env, hop = onset_env(x.mean(axis=1))
    bpm0, ph0, _ = comb(env, hop, 100, 116, 0.02)
    ratio = BPM / bpm0
    y = stretch(x, ratio, f"{OUT}/_tmp_in.wav", f"{OUT}/_tmp_out.wav")
    env2, hop = onset_env(y.mean(axis=1))
    bpm1, ph1, _ = comb(env2, hop, 107, 109, 0.01)
    # first beat at or after the loop start
    k0 = int(np.ceil((loop_from * SR - ph1) / SPB))
    a = int(round(ph1 + k0 * SPB))
    L = int(round(loop_beats * SPB))
    if a + L > len(y):
        a = int(round(ph1 + int((len(y) - L - ph1) // SPB) * SPB))
    seg = y[a : a + L]
    xf = int(0.015 * SR)
    total = int(60 * SR)
    out = np.zeros((total + L, 2))
    fade_in, fade_out = np.linspace(0, 1, xf)[:, None], np.linspace(1, 0, xf)[:, None]
    pos = 0
    while pos < total:
        s = seg.copy()
        s[:xf] *= fade_in
        s[-xf:] *= fade_out
        place(out, np.concatenate([s, y[a + L : a + L + xf] * fade_out if a + L + xf <= len(y) else np.zeros((xf, 2))]), pos)
        pos += L
    out = out[:total]
    # verify on the result: tempo and phase against the 108 grid starting at 0
    env3, hop = onset_env(out.mean(axis=1))
    bpm3, ph3, _ = comb(env3, hop, 107, 109, 0.01)
    phase_ms = ((ph3 + SPB / 2) % SPB - SPB / 2) / SR * 1000
    info = {"take": take, "desc": desc, "measured_source_bpm": round(bpm0, 2), "stretch_ratio": round(ratio, 5), "after_stretch_bpm": round(bpm1, 2),
            "loop_beats": loop_beats, "loop_start_s": round(a / SR, 3), "bed_bpm": round(bpm3, 2), "beat_phase_error_ms": round(phase_ms, 1), "lufs_raw": round(lufs(out), 1)}
    return out, info


def norm_to(x, target, tp=-1.5):
    """Gain to the target loudness through a true-peak-safe limiter; a few passes because limiting lowers loudness."""
    g = target - lufs(x)
    for _ in range(6):
        y = limiter(x * from_db(g), tp)
        err = target - lufs(y)
        if abs(err) < 0.2:
            break
        g += err
    return y


def main():
    os.makedirs(OUT, exist_ok=True)
    report = {"bpm": BPM, "samples_per_beat": SPB, "beds": {}}
    p60, hits = pulse(60)
    write_wav(f"{OUT}/pulse-60s.wav", norm_to(p60, -16))
    report["pulse"] = {"hits": len(hits), "sounds": sorted({h[1] for h in hits}), "files_used": sorted(sfx_v2.sfx2.USED)}
    # 20 s previews: 1.5 s of hook (no pulse), snap at 1.5 s, pulse + bed from the snap
    snap = 1.5
    pz, _ = pulse(20, start=snap)
    write_wav(f"{OUT}/preview-pulse-only-20s.wav", norm_to(pz, -14))
    for name in CANDS:
        b, info = bed(name)
        write_wav(f"{OUT}/bed-{name}-60s.wav", norm_to(b, -16))
        n20 = int(20 * SR)
        bb = np.zeros((n20, 2))
        seg = b[: n20 - int(snap * SR)]
        bb[int(snap * SR) :] = seg
        fade = np.ones(n20)
        fade[int(snap * SR) : int((snap + 0.6) * SR)] = np.linspace(0, 1, int(0.6 * SR))
        fade[-int(1.2 * SR) :] = np.linspace(1, 0, int(1.2 * SR))
        mix = pz + bb * fade[:, None] * from_db(lufs(pz) - lufs(bb) - 7)  # the bed sits about 7 LU under the pulse
        out = norm_to(mix, -14)
        write_wav(f"{OUT}/preview-{name}-20s.wav", out)
        info["preview_lufs"] = round(lufs(out), 2)
        info["preview_true_peak_dbtp"] = round(true_peak_db(out), 2)
        report["beds"][name] = info
        print(name, info)
    for f in ("_tmp_in.wav", "_tmp_out.wav"):
        if os.path.exists(f"{OUT}/{f}"):
            os.remove(f"{OUT}/{f}")
    json.dump(report, open(f"{OUT}/report.json", "w"), indent=1)


if __name__ == "__main__":
    main()
