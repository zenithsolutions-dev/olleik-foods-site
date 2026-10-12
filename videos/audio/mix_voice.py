"""V3.2 voiced manuals mixer: the narration on top, the effects under it, music bed C as a soft bed ducked under every
line. Writes voice.wav, sfx.wav, music.wav, mix.wav and levels.json (with the per-line checks) into the cut folder.

events.json (written by voiced.mjs): frames, target_lufs, events (sfx, as mix_v2), voice [{f, id, file, s0, s1}],
bed_file, wav_tp.

  * each line is trimmed to its aligned speech (narration/check.py) with 10 ms / 60 ms fades and levelled to the same
    loudness, then placed so its first word starts on its frame;
  * effects sit VOICE_TO_SFX LU under the voice;
  * the music bed (looped on its bar grid) sits MUSIC_UNDER LU under the voice and is ducked DUCK_DB more around every
    line (150 ms ahead, 450 ms release), so during speech it is at least 12 dB under the voice (measured per line);
  * loudness to the target (−16 LUFS) with a true-peak ceiling on the WAV; the AAC mux loop measures the encoded file.

  python audio/mix_voice.py out/v3/audio/<name>
"""
import json
import os
import sys

import numpy as np
import soundfile as sf
from scipy import signal

sys.path.insert(0, os.path.dirname(__file__))
from dsp import SPF, SR, from_db, hp, limiter, lufs, secs, true_peak_db, write_wav  # noqa: E402
from mix_v2 import build_sfx, plucks  # noqa: E402

LINE_LUFS = -18.0
VOICE_TO_SFX = 9.0
MUSIC_UNDER = 17.0
DUCK_DB = -7.0
ROOT = os.path.join(os.path.dirname(__file__), "..")


def load_line(v):
    x, sr = sf.read(os.path.join(ROOT, v["file"]))
    x = x.mean(axis=1) if x.ndim > 1 else x
    if sr != SR:
        g = np.gcd(SR, sr)
        x = signal.resample_poly(x, SR // g, sr // g)
    a, b = int(v["s0"] * SR), min(len(x), int(v["s1"] * SR))
    y = x[a:b].copy()
    fi, fo = secs(0.01), secs(0.06)
    y[:fi] *= np.linspace(0, 1, fi)
    y[-fo:] *= np.linspace(1, 0, fo) ** 2
    y = hp(y, 70)
    y *= from_db(LINE_LUFS - lufs(np.stack([y, y], 1)))
    return y


def loop_bed(path, n):
    """The 60 s bed (a whole number of bars at 108 BPM) repeated, with a 50 ms equal-gain crossfade at each join."""
    x, sr = sf.read(path)
    assert sr == SR
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    out = np.zeros((n, 2))
    k = secs(0.05)
    at = 0
    while at < n:
        m = min(len(x), n - at)
        seg = x[:m].copy()
        if at > 0:
            kk = min(k, m)
            seg[:kk] *= np.linspace(0, 1, kk)[:, None]
            out[at: at + kk] *= np.linspace(1, 0, kk)[:, None]
        out[at: at + m] += seg
        at += len(x) - k
    return out


def build(d):
    data = json.load(open(os.path.join(d, "events.json"), encoding="utf8"))
    n = data["frames"] * SPF
    target = data.get("target_lufs", -16.0)
    plucks()
    # voice
    voice = np.zeros(n)
    spans = []
    for v in data["voice"]:
        y = load_line(v)
        at = v["f"] * SPF
        m = min(len(y), n - at)
        voice[at: at + m] += y[:m]
        spans.append((at, at + m, v["id"], v["f"]))
    vst = np.stack([voice, voice], 1)
    lv = lufs(vst)
    # effects
    fx = build_sfx(data["events"], n)
    lf = lufs(fx) if np.abs(fx).max() > 1e-6 else -70
    fx *= from_db((lv - VOICE_TO_SFX) - lf)
    # music: looped bed, ducked around every line
    mus = loop_bed(os.path.join(ROOT, data["bed_file"]), n)
    g = np.ones(n)
    pre, rel = secs(0.15), secs(0.45)
    for a, b, _, _ in spans:
        s0, s1 = max(0, a - pre), min(n, b + rel)
        env = np.ones(s1 - s0)
        r1 = a - s0
        env[:r1] = np.linspace(1, from_db(DUCK_DB), r1) if r1 > 0 else env[:r1]
        env[r1: r1 + (b - a)] = from_db(DUCK_DB)
        tail = len(env) - r1 - (b - a)
        if tail > 0:
            env[-tail:] = np.linspace(from_db(DUCK_DB), 1, tail)
        g[s0:s1] = np.minimum(g[s0:s1], env)
    fade = np.ones(n)
    fade[: secs(1.0)] = np.linspace(0, 1, secs(1.0))
    fade[-secs(1.5):] = np.linspace(1, 0, secs(1.5)) ** 2
    mus = mus * (g * fade)[:, None]
    mus *= from_db((lv - MUSIC_UNDER) - lufs(mus))
    bus = vst + fx + mus
    mix = np.stack([hp(bus[:, c], 30) for c in range(2)], 1)
    out_fade = np.ones(n)
    out_fade[-secs(0.4):] = np.linspace(1, 0, secs(0.4)) ** 2
    mix *= out_fade[:, None]
    gain = target - lufs(mix)
    for _ in range(3):
        mix = limiter(mix * from_db(target - lufs(mix)), data.get("wav_tp", -2.1))
    k = from_db(gain)
    write_wav(os.path.join(d, "voice.wav"), vst * k)
    write_wav(os.path.join(d, "sfx.wav"), limiter(fx * from_db(min(0, target - lufs(fx))), -1.8))
    write_wav(os.path.join(d, "music.wav"), mus * k)
    write_wav(os.path.join(d, "mix.wav"), mix)
    # per-line checks: voice-to-music difference during the line (K-weighted, whole line), the first word's onset
    # relative to the line's frame, and the gap to the next line
    rows = []
    for i, (a, b, lid, f) in enumerate(spans):
        lv_line = lufs(vst[a:b] * k)
        lm_line = lufs(mus[a:b] * k) if np.abs(mus[a:b]).max() > 1e-7 else -70
        e = np.sqrt(np.convolve(voice[a: a + secs(0.5)] ** 2, np.ones(48) / 48, "same"))
        on = int(np.argmax(e > e.max() * 0.1)) / SR
        nxt = spans[i + 1][0] if i + 1 < len(spans) else n
        rows.append({"id": lid, "frame": f, "onset_ms_after_frame": round(on * 1000, 1), "seconds": round((b - a) / SR, 2), "voice_lufs": round(lv_line, 1), "music_lufs": round(lm_line, 1),
                     "voice_over_music_db": round(lv_line - lm_line, 1), "gap_to_next_s": round((nxt - b) / SR, 2)})
    res = {"lufs_integrated": round(lufs(mix), 2), "true_peak_dbtp": round(true_peak_db(mix), 2), "voice_lines": len(spans),
           "min_voice_over_music_db": min(r["voice_over_music_db"] for r in rows), "max_onset_ms": max(r["onset_ms_after_frame"] for r in rows),
           "min_gap_s": min(r["gap_to_next_s"] for r in rows), "events": len(data["events"]), "seconds": round(data["frames"] / 30, 2), "lines": rows}
    json.dump(res, open(os.path.join(d, "levels.json"), "w"), indent=1)
    print(d, {k2: v for k2, v in res.items() if k2 != "lines"})
    return res


if __name__ == "__main__":
    for d in sys.argv[1:]:
        build(d)
