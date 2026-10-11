"""V2 mixer (story film and episodes): real-recording SFX placed on the exact frames from events.json (exported by
`v2.mjs audio`), an optional quiet music bed (candidate A, sparse arrangement) with its own gain envelope, a synthesised
room tone, ducking under hits, a light shared reverb, and loudness to the cut's target (−14 LUFS promo, −16 LUFS manuals;
true peak −2 dBTP on the WAV, then the AAC loop in v2.mjs measures the encoded file).

  python audio/mix_v2.py out/v2/audio/<id>-music out/v2/audio/<id>-nomusic ...
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import music2  # noqa: E402
import sfx_v2  # noqa: E402
from dsp import SPF, SR, from_db, hp, limiter, lp, lufs, rng_for, secs, true_peak_db, write_wav  # noqa: E402
from mix import reverb, reverb_ir  # noqa: E402


def build_sfx(events, n):
    if not sfx_v2.PLUCKS:  # the verifier calls build_sfx directly: make sure the FluidSynth notes exist
        plucks()
    out = np.zeros((n, 2))
    for i, e in enumerate(events):
        fn = sfx_v2.LIBRARY[e["sfx"]]
        kw = {k: v for k, v in e.items() if k in ("vel", "pitch", "pan", "sweep", "dur", "ch", "steps")}
        x = fn(rng_for(e["sfx"], e["f"], i), **kw) * from_db(sfx_v2.LEVEL.get(e["sfx"], -10))
        at = e["f"] * SPF
        m = min(len(x), n - at)
        if m > 0:
            out[at : at + m] += x[:m]
    return out


def duck_env(events, n, depth_db=-6):
    g = np.ones(n)
    for e in events:
        if e["sfx"] not in sfx_v2.DUCKERS:
            continue
        a, h, r = secs(0.01), secs(0.18), secs(0.2)
        seg = np.concatenate([np.linspace(1, from_db(depth_db), a), np.full(h, from_db(depth_db)), np.linspace(from_db(depth_db), 1, r)])
        s0 = max(0, e["f"] * SPF - a // 2)
        m = min(len(seg), n - s0)
        if m > 0:
            g[s0 : s0 + m] = np.minimum(g[s0 : s0 + m], seg[:m])
    return g


def gain_env(keys, n):
    """[[frame, dB], …] linear in dB between keys (−inf written as −90)."""
    if not keys:
        return np.ones(n)
    fr = np.array([k[0] * SPF for k in keys], dtype=float)
    db = np.array([k[1] for k in keys], dtype=float)
    return from_db(np.interp(np.arange(n), fr, db))


def room_tone(n, seed=7):
    rng = np.random.default_rng(seed)
    w = rng.standard_normal((n, 2))
    b = np.cumsum(w, axis=0)
    b -= np.convolve(b[:, 0], np.ones(4800) / 4800, mode="same")[:, None]  # remove drift
    b = np.stack([lp(hp(b[:, c], 40), 900) for c in range(2)], 1)
    return b / (np.abs(b).max() + 1e-9)


def plucks():
    """FluidSynth-rendered notes in candidate A's instruments: a low muted pluck (problem cards) and the two-note
    'coming up' sting (episodes)."""
    C = music2.CANDIDATES["A"]
    ev = [(0, "prog", 3, C["lead"], 0), (0, "on", 3, 52, 90), (0.8, "off", 3, 52, 0)]
    p = music2.render_midi(ev, 120, 1.2, reverb=True)
    ev2 = [(0, "prog", 3, C["lead"], 0), (0, "prog", 4, C["lead2"], 0), (0, "on", 3, 76, 95), (0.45, "off", 3, 76, 0), (0.5, "on", 3, 83, 100), (1.6, "off", 3, 83, 0), (0.5, "on", 4, 83, 60), (1.6, "off", 4, 83, 0)]
    s = music2.render_midi(ev2, 120, 1.8, reverb=True)
    norm = lambda x: x / (np.abs(x).max() + 1e-9) * 0.9  # noqa: E731
    sfx_v2.PLUCKS["pluck"] = norm(p)
    sfx_v2.PLUCKS["sting2"] = norm(s)


def build(d):
    data = json.load(open(os.path.join(d, "events.json"), encoding="utf8"))
    n = data["frames"] * SPF
    ev = data["events"]
    target = data.get("target_lufs", -14.0)
    plucks()
    fx = build_sfx(ev, n)
    ir = reverb_ir(1.0)
    fx_bus = fx + reverb(fx, 0.08, ir)
    bus = fx_bus.copy()
    if data.get("room", True):
        bus += room_tone(n) * from_db(sfx_v2.LEVEL["room"])
    mus = None
    if data.get("music"):
        stems, info = music2.render("A", data["music_map"], data["frames"], seed=data["cut"], sparse=True)
        mus = music2.master(stems, cid="A", fade_s=0.8)
        mus = mus * gain_env(data.get("music_env"), n)[:, None] * duck_env(ev, n)[:, None]
        lm = lufs(mus) if np.abs(mus).max() > 1e-6 else -70
        lf = lufs(fx_bus)
        mus *= from_db((lf - data.get("music_under_lu", 7.0)) - lm)  # a quiet bed under the effects
        bus = bus + mus
    if data.get("bed_file"):  # V3: a recorded music bed (conformed to the grid) placed from a frame, under the effects
        import soundfile as sf
        x, sr = sf.read(data["bed_file"])
        assert sr == SR
        at = int(data.get("bed_from", 0) * SPF)
        mus = np.zeros((n, 2))
        m = min(len(x), n - at)
        mus[at : at + m] = x[:m]
        mus = mus * gain_env(data.get("music_env"), n)[:, None] * duck_env(ev, n, data.get("duck_db", -5))[:, None]
        mus *= from_db((lufs(fx_bus) - data.get("music_under_lu", 7.0)) - lufs(mus))
        bus = bus + mus
    mix = np.stack([hp(bus[:, c], 30) for c in range(2)], 1)
    fade = np.ones(n)
    fade[-secs(0.4) :] = np.linspace(1, 0, secs(0.4)) ** 2
    mix *= fade[:, None]
    for _ in range(3):
        mix = limiter(mix * from_db(target - lufs(mix)), data.get("wav_tp", -2.1))
    write_wav(os.path.join(d, "sfx.wav"), limiter(fx_bus * from_db(min(0, target - lufs(fx_bus))), -1.8))
    if mus is not None:
        write_wav(os.path.join(d, "music.wav"), mus)
    write_wav(os.path.join(d, "mix.wav"), mix)
    mono = mix.mean(axis=1, keepdims=True).repeat(2, axis=1)
    lv = {"lufs_integrated": round(lufs(mix), 2), "true_peak_dbtp": round(true_peak_db(mix), 2), "mono_minus_stereo_lufs": round(lufs(mono) - lufs(mix), 2), "lr_correlation": round(float(np.corrcoef(mix[:, 0], mix[:, 1])[0, 1]), 3), "events": len(ev), "seconds": round(data["frames"] / 30, 2), "music": bool(data.get("music")), "files_used": sorted(sfx_v2.sfx2.USED)}
    json.dump(lv, open(os.path.join(d, "levels.json"), "w"), indent=1)
    print(d, {k: v for k, v in lv.items() if k != "files_used"})
    return lv


if __name__ == "__main__":
    for d in sys.argv[1:]:
        build(d)
