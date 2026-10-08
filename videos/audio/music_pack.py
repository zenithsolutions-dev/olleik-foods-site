"""Music review pack: each candidate (A, B, C) rendered alone along the scene maps exported by `promo.mjs music`
(master 60 s, short 45 s, bumper 20 s), mastered to −14 LUFS, plus the master edit's stems (drums, bass, chords, lead).

  python audio/music_pack.py out/promo/music master short45 bumper
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import music2  # noqa: E402
from dsp import lufs, true_peak_db, write_wav  # noqa: E402

d = sys.argv[1]
rows = []
for cut in sys.argv[2:]:
    m = json.load(open(os.path.join(d, f"{cut}-map.json"), encoding="utf8"))
    for cid, C in music2.CANDIDATES.items():
        stems, info = music2.render(cid, m["music"], m["frames"], seed=f"{cut}-{cid}")
        mix = music2.master(stems, cid=cid, fade_s=0.8)
        name = f"music-{cid}-{C['title'].replace(' ', '-')}-{C['bpm']}bpm-{cut}"
        write_wav(os.path.join(d, f"{name}.wav"), mix)
        if cut == "master":
            sd = os.path.join(d, "stems", f"{cid}-{C['title'].replace(' ', '-')}")
            os.makedirs(sd, exist_ok=True)
            for k, v in stems.items():
                write_wav(os.path.join(sd, f"{k}.wav"), v)
        mono = mix.mean(axis=1)
        # power-weighted spectral centroid of the first 30 s (the reference toolkit's accepted track measures ~870 Hz)
        spec = np.abs(np.fft.rfft(mono[: min(len(mono), 48000 * 30)])) ** 2
        freqs = np.fft.rfftfreq(min(len(mono), 48000 * 30), 1 / 48000)
        centroid = float((spec * freqs).sum() / (spec.sum() + 1e-9))
        low_share = float(spec[freqs < 200].sum() / (spec.sum() + 1e-9))
        row = {"file": f"{name}.wav", "cand": cid, "title": C["title"], "bpm": C["bpm"], "cut": cut, "seconds": round(len(mix) / 48000, 2), "lufs": round(lufs(mix), 2), "true_peak_db": round(true_peak_db(mix), 2), "spectral_centroid_hz": round(centroid), "energy_below_200hz": round(low_share, 2), "lr_correlation": round(float(np.corrcoef(mix[:, 0], mix[:, 1])[0, 1]), 3)}
        rows.append(row)
        print(row)
json.dump(rows, open(os.path.join(d, "music-levels.json"), "w"), indent=1)
