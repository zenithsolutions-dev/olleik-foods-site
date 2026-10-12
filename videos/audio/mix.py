"""Builds one cut's audio from its events.json (exported by `node promo.mjs events`): the SFX stem placed on the exact
event frames, the music stems from the cut's scene map, then the mix: music under SFX, music ducked a few dB for 150 ms
under hits and typing bursts, a light shared reverb, a look-ahead true-peak limiter, −14 LUFS integrated, ≤ −1 dBTP,
a clean fade at the end.

  python audio/mix.py out/promo/audio/master            → music.wav, sfx.wav, mix.wav, stems/*.wav, levels.json
"""
import json
import os
import sys

import numpy as np
from scipy import signal

sys.path.insert(0, os.path.dirname(__file__))
from dsp import SR, SPF, from_db, hp, limiter, low_shelf, lp, lufs, place, rng_for, secs, true_peak_db, write_wav  # noqa: E402
import music  # noqa: E402
import sfx  # noqa: E402

TARGET_LUFS = -14.0
CEILING = -1.8  # dBTP: leaves ~0.5 dB for AAC encoding overshoot (final MP4s must stay ≤ −1.0 dBTP)


def build_sfx(events, n):
    out = np.zeros((n, 2))
    for i, e in enumerate(events):
        fn = sfx.LIBRARY[e["sfx"]]
        rng = rng_for(e["sfx"], e["f"], i)
        kw = {k: v for k, v in e.items() if k in ("vel", "pitch", "pan", "sweep", "dur", "ch", "steps", "wide")}
        x = fn(rng, **kw) * from_db(sfx.LEVEL.get(e["sfx"], -10))
        place(out, x, e["f"] * SPF)
    return out


def duck_env(events, n, depth_db=-4.0, attack=0.01, hold=0.15, release=0.12):
    g = np.ones(n)
    d = from_db(depth_db)
    for e in events:
        if e["sfx"] not in sfx.DUCKERS:
            continue
        depth = from_db(depth_db / 2) if e["sfx"] == "key" else from_db(depth_db - 2) if e["sfx"] in ("slam", "impact", "sting") else d
        at = e["f"] * SPF
        a, h, r = secs(attack), secs(hold), secs(release)
        seg = np.concatenate([np.linspace(1, depth, a), np.full(h, depth), np.linspace(depth, 1, r)])
        s0 = max(0, at - a // 2)
        m = min(len(seg), n - s0)
        if m > 0:
            g[s0 : s0 + m] = np.minimum(g[s0 : s0 + m], seg[:m])
    return g


def reverb_ir(seconds=1.3, seed="room"):
    rng = rng_for(seed)
    n = secs(seconds)
    t = np.arange(n) / SR
    decay = np.exp(-t * 6.9 / seconds)
    ir = np.stack([lp(rng.standard_normal(n), 6000) * decay, lp(rng.standard_normal(n), 6000) * decay], axis=1)
    ir[: secs(0.012)] = 0  # pre-delay
    return ir / np.sqrt(np.sum(ir**2, axis=0, keepdims=True))


def reverb(st, send, ir):
    # The send is high-passed at 250 Hz so the room never smears the kick, the bass or the slams' sub.
    src = np.stack([hp(st[:, c], 250) for c in range(2)], axis=1)
    wet = np.stack([signal.fftconvolve(src[:, c], ir[:, c])[: len(st)] for c in range(2)], axis=1)
    return wet * send


def build(cut_dir):
    data = json.load(open(os.path.join(cut_dir, "events.json"), encoding="utf8"))
    n = data["frames"] * SPF
    events = data["events"]
    if data.get("silent"):
        print(cut_dir, "silent cut (website hero loop): no audio")
        return None
    stems = music.render(data["music"], data["frames"], seed=data["cut"])
    gains = {"drums": from_db(-3), "bass": from_db(-6), "chords": from_db(-9), "lead": from_db(-10)}
    ir = reverb_ir()
    mus = sum(stems[k] * gains[k] for k in stems)
    mus = mus + reverb(stems["chords"] * gains["chords"] + stems["lead"] * gains["lead"], 0.25, ir)
    fx = build_sfx(events, n)
    fx_wet = reverb(fx, 0.12, ir)
    duck = duck_env(events, n)
    # Tone: phones and laptops cannot play deep sub, so the music's lows are shelved down (−4 dB under 150 Hz).
    music_bus = low_shelf(mus, 150, -4.0) * duck[:, None]
    fx_bus = fx + fx_wet
    # Balance music under SFX: music bus about 6 dB below the SFX bus by loudness (when there is SFX).
    lm, lf = lufs(music_bus), lufs(fx_bus) if len(events) else -70
    if lf > -60:
        music_bus *= from_db((lf - 6) - lm)
    mix = music_bus + fx_bus
    mix = np.stack([hp(mix[:, c], 30) for c in range(2)], axis=1)  # nothing useful lives under 30 Hz
    # Fade out the last 0.4 s; then level to −14 LUFS and limit (two passes so the limiter's loss is made up).
    fade = np.ones(n)
    fade[-secs(0.4) :] = np.linspace(1, 0, secs(0.4)) ** 2
    mix *= fade[:, None]
    for _ in range(3):
        mix *= from_db(TARGET_LUFS - lufs(mix))
        mix = limiter(mix, CEILING)
    # Final trim to the target, never past −1.6 dBTP (the limiter costs a little loudness on the last pass).
    trim = min(TARGET_LUFS - lufs(mix), -1.6 - true_peak_db(mix))
    mix *= from_db(max(0.0, trim))
    g_total = 1.0  # stems are written at the same gain staging as the mix (pre-master), normalised for listening
    os.makedirs(os.path.join(cut_dir, "stems"), exist_ok=True)
    for k, v in stems.items():
        write_wav(os.path.join(cut_dir, "stems", f"{k}.wav"), v * gains[k] * from_db(-3))
    write_wav(os.path.join(cut_dir, "music.wav"), limiter(music_bus * from_db(TARGET_LUFS - lufs(music_bus)) * fade[:, None], CEILING))
    write_wav(os.path.join(cut_dir, "sfx.wav"), limiter(fx_bus * from_db(min(0, TARGET_LUFS - lufs(fx_bus))) * g_total, CEILING) if len(events) else fx_bus)
    write_wav(os.path.join(cut_dir, "mix.wav"), mix)
    mono = mix.mean(axis=1, keepdims=True).repeat(2, axis=1)
    levels = {
        "lufs_integrated": round(lufs(mix), 2),
        "true_peak_dbtp": round(true_peak_db(mix), 2),
        "mono_minus_stereo_lufs": round(lufs(mono) - lufs(mix), 2),
        "lr_correlation": round(float(np.corrcoef(mix[:, 0], mix[:, 1])[0, 1]), 3),
        "events": len(events),
        "seconds": data["frames"] / 30,
    }
    json.dump(levels, open(os.path.join(cut_dir, "levels.json"), "w"), indent=1)
    print(cut_dir, levels)
    return levels


if __name__ == "__main__":
    for d in sys.argv[1:]:
        build(d)
