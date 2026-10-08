"""Proof v3 audio: real-recording SFX (sfx2) placed on the proof's event frames + the chosen music candidate
(music2, FluidSynth + GeneralUser GS) following the proof's scene map; music ducked under hits and typing, a light
shared reverb (send high-passed), −14 LUFS integrated, true peak ≤ −2.0 dBTP on the WAV (headroom for AAC).

  python audio/mix3.py out/promo/v3/audio/proof-A [...]   (each dir holds events.json from `node promo-v3.mjs events`)
"""
import json
import os
import sys

import numpy as np
from scipy import signal

sys.path.insert(0, os.path.dirname(__file__))
import music2  # noqa: E402
import sfx2  # noqa: E402
from dsp import SPF, from_db, hp, limiter, lufs, rng_for, secs, true_peak_db, write_wav  # noqa: E402
from mix import reverb, reverb_ir  # noqa: E402

TARGET = -14.0


def build_sfx(events, n):
    out = np.zeros((n, 2))
    for i, e in enumerate(events):
        fn = sfx2.LIBRARY[e["sfx"]]
        kw = {k: v for k, v in e.items() if k in ("vel", "pitch", "pan", "sweep", "dur", "ch", "steps")}
        x = fn(rng_for(e["sfx"], e["f"], i), **kw) * from_db(sfx2.LEVEL.get(e["sfx"], -10))
        at = e["f"] * SPF
        m = min(len(x), n - at)
        if m > 0:
            out[at : at + m] += x[:m]
    return out


def duck_env(events, n):
    g = np.ones(n)
    for e in events:
        if e["sfx"] not in sfx2.DUCKERS:
            continue
        depth = from_db(-2 if e["sfx"] == "key" else -6 if e["sfx"] in ("slam", "impact") else -4)
        a, h, r = secs(0.01), secs(0.15), secs(0.12)
        seg = np.concatenate([np.linspace(1, depth, a), np.full(h, depth), np.linspace(depth, 1, r)])
        s0 = max(0, e["f"] * SPF - a // 2)
        m = min(len(seg), n - s0)
        if m > 0:
            g[s0 : s0 + m] = np.minimum(g[s0 : s0 + m], seg[:m])
    return g


def build(d):
    data = json.load(open(os.path.join(d, "events.json"), encoding="utf8"))
    n = data["frames"] * SPF
    ev = data["events"]
    stems, info = music2.render(data["cand"], data["music"], data["frames"], seed=data["cut"])
    mus = music2.master(stems, cid=data["cand"], fade_s=0.8)
    fx = build_sfx(ev, n)
    ir = reverb_ir(1.1)
    fx_bus = fx + reverb(fx, 0.1, ir)
    music_bus = mus * duck_env(ev, n)[:, None]
    lm, lf = lufs(music_bus), lufs(fx_bus)
    music_bus *= from_db((lf - 4.5) - lm)  # music about 4.5 LU under the sound design
    mix = music_bus + fx_bus
    mix = np.stack([hp(mix[:, c], 30) for c in range(2)], 1)
    fade = np.ones(n)
    fade[-secs(0.5) :] = np.linspace(1, 0, secs(0.5)) ** 2
    mix *= fade[:, None]
    for _ in range(3):
        mix = limiter(mix * from_db(TARGET - lufs(mix)), -2.1)
    mix *= from_db(max(0.0, min(TARGET - lufs(mix), -2.0 - true_peak_db(mix))))
    os.makedirs(os.path.join(d, "stems"), exist_ok=True)
    for k, v in stems.items():
        write_wav(os.path.join(d, "stems", f"{k}.wav"), v)
    write_wav(os.path.join(d, "music.wav"), mus)
    write_wav(os.path.join(d, "sfx.wav"), limiter(fx_bus * from_db(min(0, TARGET - lufs(fx_bus))), -1.8))
    write_wav(os.path.join(d, "mix.wav"), mix)
    mono = mix.mean(axis=1, keepdims=True).repeat(2, axis=1)
    lv = {"lufs_integrated": round(lufs(mix), 2), "true_peak_dbtp": round(true_peak_db(mix), 2), "mono_minus_stereo_lufs": round(lufs(mono) - lufs(mix), 2), "lr_correlation": round(float(np.corrcoef(mix[:, 0], mix[:, 1])[0, 1]), 3), "events": len(ev), "seconds": round(data["frames"] / 30, 2), "bpm": info["bpm"], "files_used": sorted(sfx2.USED)}
    json.dump(lv, open(os.path.join(d, "levels.json"), "w"), indent=1)
    print(d, {k: v for k, v in lv.items() if k != "files_used"})
    return lv


if __name__ == "__main__":
    for d in sys.argv[1:]:
        build(d)
