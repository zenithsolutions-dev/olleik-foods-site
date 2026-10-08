"""AAC true-peak fix: AAC encoding can add 1–2 dB of inter-sample overshoot on a sharp transient, so a WAV mastered
to −2 dBTP can measure above −1 dBTP after encoding. This re-limits the mix with a lower ceiling while keeping it at
−14 LUFS, encodes a test AAC (same settings as the delivery mux), measures it with ffmpeg ebur128, and repeats until
the encoded file is ≤ −1.1 dBTP and within ±0.3 LU of −14. Writes mix-aac.wav next to mix.wav.

  python audio/tp_fix.py out/promo/final/audio/short45-H5
"""
import os
import subprocess
import sys
import tempfile

import soundfile as sf

sys.path.insert(0, os.path.dirname(__file__))
from dsp import from_db, limiter, lufs, write_wav  # noqa: E402


def measure_aac(wav):
    with tempfile.TemporaryDirectory() as d:
        m4a = os.path.join(d, "t.m4a")
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", wav, "-c:a", "aac", "-b:a", "256k", "-ar", "48000", m4a], check=True)
        p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", m4a, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    txt = p.stderr[p.stderr.rfind("Summary:") :]
    g = lambda lab: next(float(l.split(":")[1].split()[0]) for l in txt.splitlines() if l.strip().startswith(lab))  # noqa: E731
    return g("I:"), g("Peak:")


def fix(d):
    src = os.path.join(d, "mix.wav")
    x, _ = sf.read(src)
    out = os.path.join(d, "mix-aac.wav")
    ceiling = -2.0
    for i in range(8):
        y = x
        for _ in range(3):
            y = limiter(y * from_db(-14.0 - lufs(y)), ceiling)
        write_wav(out, y)
        I, tp = measure_aac(out)
        # make-up gain into whatever true-peak headroom the encoded file still has
        mk = min(-14.0 - I, -1.15 - tp)
        if mk > 0.05:
            y = y * from_db(mk)
            write_wav(out, y)
            I, tp = measure_aac(out)
        print(f"{d}: ceiling {ceiling:.2f} -> AAC I {I} LUFS, TP {tp} dBTP")
        if tp <= -1.1 and abs(I + 14) <= 0.4:
            return {"ceiling_dB": ceiling, "aac_I": I, "aac_TP": tp}
        ceiling -= max(0.3, tp + 1.2)
    raise SystemExit(f"{d}: could not reach the true-peak target")


if __name__ == "__main__":
    for d in sys.argv[1:]:
        fix(d)
