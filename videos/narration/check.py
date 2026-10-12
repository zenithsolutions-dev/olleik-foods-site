"""Check every narration WAV without listening: a faster-whisper transcript (word timestamps) is aligned with the script.
A line fails when a scripted word is missing or the take has stray words (garbled syllables before/after the line).
The aligned span gives the exact speech start/end used to place the line on its step.
Writes narration/audio/index.json: {id: {file, seconds, speech_start, speech_end, transcript, missing, extra, ok}}.
usage: python narration/check.py [id …]"""
import difflib
import json
import os
import re
import sys

import numpy as np
import soundfile as sf
from faster_whisper import WhisperModel

HERE = os.path.dirname(os.path.abspath(__file__))
lines = [l for f in ("VISITOR", "ADMIN", "FULL") for l in json.load(open(f"{HERE}/{f}.json", encoding="utf8"))["lines"]]
only = set(sys.argv[1:])
model = WhisperModel("small", device="cpu", compute_type="int8")
ALIAS = {"organized": "organised", "1": "one", "oh": "o"}


def norm(t):
    """Words of a text; every spelling of the brand ("Oh-lake", "O'Lake", "O Lake", "Olleik") folds to "o lake"."""
    t = t.lower()
    for v in ("oh-lake", "o-lake", "o'lake", "olake", "olleik"):
        t = t.replace(v, "o lake")
    return [ALIAS.get(w, w) for w in re.findall(r"[a-z0-9']+", t)]


IDX = f"{HERE}/audio/index.json"
out = json.load(open(IDX, encoding="utf8")) if os.path.exists(IDX) and only else {}
bad = []
for ln in lines:
    if only and ln["id"] not in only:
        continue
    p = f"{HERE}/audio/{ln['id']}.wav"
    x, sr = sf.read(p)
    # whisper drops a first word that starts at the very first sample: transcribe with 0.4 s of silence in front
    PAD = 0.4
    tmp = f"{HERE}/audio/_pad.wav"
    sf.write(tmp, np.concatenate([np.zeros((int(sr * PAD),) + x.shape[1:]), x]), sr)
    segs, _ = model.transcribe(tmp, beam_size=5, language="en", word_timestamps=True)
    ws = [w for s in segs for w in s.words]
    for w in ws:
        w.start, w.end = max(0.0, w.start - PAD), max(0.0, w.end - PAD)
    # one entry per normalised token, each keeping its whisper word's timing ("O-Lake" → "o", "lake")
    flat = [(tok, w) for w in ws for tok in norm(w.word)]
    got = [t for t, _ in flat]
    ws = [w for _, w in flat]
    want = norm(ln.get("speak", ln["text"]))
    sm = difflib.SequenceMatcher(a=want, b=got, autojunk=False)
    blocks = [b for b in sm.get_matching_blocks() if b.size]
    matched = sum(b.size for b in blocks)
    missing = len(want) - matched
    extra = len(got) - matched
    first = blocks[0].b if blocks else 0
    last = blocks[-1].b + blocks[-1].size - 1 if blocks else len(ws) - 1
    # stray words before/after the line are acceptable only when a clear pause (>= 0.25 s) separates them from the
    # line, so the take can be trimmed to the line itself; the placed audio always starts at speech_start
    gap_in = ws[first].start - ws[first - 1].end if first > 0 else 9
    gap_out = ws[last + 1].start - ws[last].end if last < len(ws) - 1 else 9
    s0 = max(0.0, ws[first].start - min(0.08, gap_in / 2)) if ws else 0.0
    s1 = min(len(x) / sr, ws[last].end + min(0.15, gap_out / 2)) if ws else len(x) / sr
    # whisper places a first word's start early (leading silence or breath): refine both ends on the energy envelope
    # (10 ms RMS, −28 dB under the line's peak, sustained 40 ms), searched just around the aligned bounds
    mono = x.mean(axis=1) if x.ndim > 1 else x
    env = np.sqrt(np.convolve(mono ** 2, np.ones(int(sr * 0.01)) / int(sr * 0.01), "same"))
    thr = env.max() * 10 ** (-28 / 20)
    a0, a1 = int(s0 * sr), min(len(env), int((s0 + 0.9) * sr))
    above = (env[a0:a1] > thr).astype(float)
    hold = int(sr * 0.04)  # sustained for 40 ms: a click at the file start does not count
    run = np.convolve(above, np.ones(hold), "full")[hold - 1: hold - 1 + len(above)]
    hit = np.nonzero(run >= hold)[0] - (hold - 1)
    if len(hit):
        s0 = max(0.0, (a0 + hit[0]) / sr - 0.03)
    b0, b1 = max(0, int((s1 - 0.6) * sr)), int(s1 * sr)
    tail = np.nonzero(env[b0:b1] > thr)[0]
    if len(tail):
        s1 = min(len(mono) / sr, (b0 + tail[-1]) / sr + 0.08)
    inner_extra = extra - first - (len(ws) - 1 - last)
    ok = missing <= 1 and inner_extra <= 1 and gap_in >= 0.25 and gap_out >= 0.25
    tr = "".join(w.word for w in ws).strip()
    out[ln["id"]] = {"file": f"narration/audio/{ln['id']}.wav", "seconds": round(len(x) / sr, 3), "sr": sr, "speech_start": round(s0, 3), "speech_end": round(s1, 3), "transcript": tr, "missing": missing, "extra": extra, "trimmed_words": int(first + (len(ws) - 1 - last)), "ok": bool(ok)}
    if not ok:
        bad.append(ln["id"])
    print(f"{ln['id']} {len(x) / sr:5.2f}s speech {s0:5.2f}-{s1:5.2f} miss {missing} extra {extra} {'ok ' if ok else 'BAD'} | {tr}")
json.dump(out, open(IDX, "w", encoding="utf8"), indent=1, ensure_ascii=False)
print("to check:", bad or "none")
