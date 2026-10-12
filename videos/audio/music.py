"""Original 120 BPM music, composed in code (no samples, no borrowed melody). Key: D major. Progression per bar:
Dmaj9 · Bm9 · Gmaj9 · Asus4→A, the end card always lands on D. Instruments: kick, clap, hats, crash (drums), sub/saw
bass, detuned-saw pad (chords) and a plucked 16th-note arpeggio (lead). The arrangement follows each cut's scene map:

  Hook            sparse kick and a soft click, a closed pad
  Problem         four-on-the-floor kick, 8th hats, sustained bass, the pad filter opens across the whole problem span
  Answer          the groove drops: clap on 2 and 4, 16th hats, syncopated bass, open pad, arpeggio
  How it works    steady groove, arpeggio in 8ths, slightly lower
  Call to action  breakdown: drums out (one beat of silence before it), pad and bass hold, filter closes
  End             a full hit (crash) on the end card, one bar of groove, then a clean ringing tail

Pads and bass are side-chained to the kick. Stems: drums, bass, chords, lead."""
import numpy as np

from dsp import (
    SR, bp, env_adsr, env_exp, hp, lp, noise, note_hz, pan_stereo, rng_for, saw, secs, sine, sweep_lp, tri, widen,
)

BPM = 120
BEAT_S = 60 / BPM
BEAT = int(SR * BEAT_S)  # 24000 samples
PROG = [
    {"root": 38, "tones": [62, 66, 69, 73, 76]},  # Dmaj9: D F# A C# E
    {"root": 35, "tones": [59, 62, 66, 69, 73]},  # Bm9: B D F# A C#
    {"root": 31, "tones": [55, 59, 62, 66, 69]},  # Gmaj9: G B D F# A
    {"root": 33, "tones": [57, 62, 64, 69, 74], "late": [57, 61, 64, 69, 73]},  # Asus4 → A on beat 3
]
TONIC = PROG[0]
ARP = [0, 2, 1, 3, 2, 4, 3, 1, 0, 2, 4, 3, 2, 1, 3, 4]  # chord-tone indexes, 16 steps per bar (original pattern)
BASS8 = [1, 0, 1, 1, 0, 1, 1, 0]  # syncopated 8ths per bar


def beat_parts(music, frames):
    """Part and intensity of each beat, plus progress through the problem span (for the filter opening)."""
    n_beats = int(np.ceil(frames / 15))
    parts, inten = [], []
    for k in range(n_beats):
        f = k * 15
        seg = next((m for m in music if m["from"] <= f < m["to"]), music[-1])
        parts.append(seg["part"])
        inten.append(seg["intensity"])
    prob = [k for k, p in enumerate(parts) if p == "Problem"]
    prog = np.zeros(n_beats)
    if prob:
        lo, hi = min(prob), max(prob)
        for k in prob:
            prog[k] = (k - lo) / max(1, hi - lo)
    end_start = next((k for k, p in enumerate(parts) if p == "End"), n_beats)
    return parts, inten, prog, end_start


def chord_at(k, end_start):
    if k >= end_start:
        return TONIC, False
    c = PROG[(k // 4) % 4]
    late = "late" in c and (k % 4) >= 2
    return c, late


def kick(rng, vel=1.0):
    n = secs(0.35)
    f = np.geomspace(140, 46, secs(0.07))
    f = np.concatenate([f, np.full(n - len(f), 46.0)])
    body = sine(f, n) * env_exp(n, 0.15)
    click = hp(noise(n, rng), 2000) * env_exp(n, 0.002) * 0.3
    return (body + click) * vel


def clap(rng, vel=1.0):
    n = secs(0.3)
    x = np.zeros(n)
    for k in range(3):
        at = secs(0.008) * k
        m = n - at
        x[at:] += bp(noise(m, rng), 900, 3200) * env_exp(m, 0.006 if k < 2 else 0.11)
    return x * vel * 0.8


def hat(rng, vel=1.0, open_=False):
    n = secs(0.25 if open_ else 0.06)
    return hp(noise(n, rng), 7500) * env_exp(n, 0.12 if open_ else 0.018) * vel * 0.5


def crash(rng, vel=1.0):
    n = secs(2.5)
    return (hp(noise(n, rng), 4000) * env_exp(n, 0.7) + bp(noise(n, rng), 3000, 9000) * env_exp(n, 0.25)) * vel * 0.35


def pluck(rng, midi, n, vel):
    f = note_hz(midi)
    x = 0.6 * tri(f, n) + 0.4 * saw(f * 1.003, n, rng)
    cut = 800 + 5200 * env_exp(n, 0.06)
    return sweep_lp(x, cut, block=128) * env_exp(n, 0.16) * vel


def render(music, frames, seed="promo"):
    """Returns the four stems (stereo) for a cut whose scene map is `music` and length `frames` (30 fps)."""
    N = frames * (SR // 30)
    parts, inten, prog, end_start = beat_parts(music, frames)
    nb = len(parts)
    drums = np.zeros((N, 2))
    bass = np.zeros(N)
    pad = np.zeros(N)
    lead = np.zeros((N, 2))
    kicks = []
    rng = rng_for(seed, "music")

    def put(dst, x, at, pan=0.0):
        if at >= N:
            return
        m = min(len(x), N - at)
        if dst.ndim == 2:
            dst[at : at + m] += pan_stereo(x[:m], pan)
        else:
            dst[at : at + m] += x[:m]

    cta_first = next((k for k, p in enumerate(parts) if p == "Call to action"), None)
    for k in range(nb):
        at = k * BEAT
        part = parts[k]
        bar_pos = k % 4
        if cta_first is not None and k == cta_first - 1:
            continue  # one beat of silence before the breakdown: the riser carries it
        if part == "Call to action" or (part == "End" and k >= end_start + 4):
            continue
        if part == "End" and k == end_start:
            put(drums, crash(rng), at, 0.1)
        # Kick
        if part == "Hook":
            if bar_pos in (0, 2):
                put(drums, kick(rng, 0.7), at)
                kicks.append(at)
        else:
            put(drums, kick(rng, 0.95 if part in ("Answer", "End") else 0.85), at)
            kicks.append(at)
        # Clap on 2 and 4
        if part in ("Answer", "How it works", "End") and bar_pos in (1, 3):
            put(drums, clap(rng, 0.9 if part != "How it works" else 0.75), at, 0.05)
        # Hats
        if part == "Hook":
            for e in (0.5,):
                put(drums, hat(rng, 0.35), at + int(e * BEAT), 0.25)
        elif part == "Problem":
            for e in (0, 0.5):
                put(drums, hat(rng, 0.35 + 0.35 * prog[k] if e else 0.25), at + int(e * BEAT), 0.25)
        else:
            steps = (0, 0.25, 0.5, 0.75) if part in ("Answer", "End") else (0, 0.5)
            for e in steps:
                v = 0.55 if e == 0.5 else 0.3
                open_ = e == 0.5 and bar_pos == 3 and part == "Answer"
                put(drums, hat(rng, v * rng.uniform(0.85, 1.1), open_), at + int(e * BEAT), 0.25)

    # Bass: sustained root in the problem and the breakdown, syncopated 8ths in the groove, long tonic on the end.
    for k in range(nb):
        at = k * BEAT
        part = parts[k]
        c, _ = chord_at(k, end_start)
        f = note_hz(c["root"])
        if part == "Hook":
            continue
        if part == "End" and k > end_start + 4:
            continue
        if part in ("Problem", "Call to action") or (part == "End" and k >= end_start + 4):
            if k % 4 == 0 or (part == "End" and k == end_start + 4) or (part == "Call to action" and parts[k - 1] != part):
                n = min(4, nb - k) * BEAT if not (part == "End" and k == end_start + 4) else N - at
                x = (0.7 * sine(f, n) + 0.3 * lp(saw(f, n, rng), 300)) * env_adsr(n, 0.02, 0.2, 0.8, 0.3)
                put(bass, x * (0.4 if part != "End" else 0.45), at)
            continue
        if part == "End" and k >= end_start + 4:
            continue
        for e in range(2):
            idx = (k % 4) * 2 + e
            if not BASS8[idx]:
                continue
            n = BEAT // 2
            x = (0.55 * sine(f, n) + 0.4 * lp(saw(f * 2, n, rng), 500)) * env_adsr(n, 0.004, 0.08, 0.6, 0.04)
            put(bass, x * (0.8 if part in ("Answer", "End") else 0.7), at + e * BEAT // 2)

    # Pad: one chord per bar (late change on the A bar), cross-faded; cutoff follows the arrangement.
    cut = np.zeros(N)
    gain = np.zeros(N)
    for k in range(nb):
        at, to = k * BEAT, min(N, (k + 1) * BEAT)
        part = parts[k]
        c = {"Hook": 600, "Problem": 600 + 2600 * prog[k], "Answer": 4200, "How it works": 3200, "Call to action": 3000 - 1800 * ((k - (cta_first or k)) / 6), "End": 4500}[part]
        g = {"Hook": 0.35, "Problem": 0.5, "Answer": 0.6, "How it works": 0.5, "Call to action": 0.7, "End": 0.7}[part]
        cut[at:to] = c
        gain[at:to] = g
    cut = np.convolve(cut, np.ones(4800) / 4800, mode="same")
    gain = np.convolve(gain, np.ones(4800) / 4800, mode="same")
    for k in range(0, nb, 1):
        c, late = chord_at(k, end_start)
        tones = c["late"] if late else c["tones"]
        at = k * BEAT
        n = BEAT + secs(0.15)
        voices = sum(saw(note_hz(m) * 2 ** (d / 1200), n, rng) for m in tones for d in (-7, 7)) / (2 * len(tones))
        e = np.ones(n)
        e[: secs(0.06)] = np.linspace(0, 1, secs(0.06))
        e[-secs(0.15) :] = np.linspace(1, 0, secs(0.15))
        if parts[k] == "End" and k >= end_start + 4:
            n2 = N - at
            voices = sum(saw(note_hz(m) * 2 ** (d / 1200), n2, rng) for m in tones for d in (-7, 7)) / (2 * len(tones))
            put(pad, voices * np.linspace(1, 0, n2) ** 1.5, at)
            break
        put(pad, voices * e, at)
    pad = sweep_lp(pad, cut) * gain

    # Lead: the arpeggio, 16ths in the answer and on the end bar, 8ths through "how it works".
    for k in range(nb):
        part = parts[k]
        if part not in ("Answer", "How it works", "End") or (part == "End" and k >= end_start + 4):
            continue
        c, late = chord_at(k, end_start)
        tones = c["late"] if late else c["tones"]
        steps = range(4) if part != "How it works" else (0, 2)
        for s in steps:
            idx = ARP[(k % 4) * 4 + s]
            midi = tones[idx] + 12
            n = secs(0.3)
            x = pluck(rng, midi, n, (0.32 if part != "How it works" else 0.24) * (1.15 if s == 0 else 1.0) * rng.uniform(0.9, 1.05))
            put(lead, x, k * BEAT + s * BEAT // 4, 0.35 * np.sin(k * 1.3 + s))

    # Side-chain pad and bass to the kick.
    sc = np.ones(N)
    for at in kicks:
        m = min(secs(0.3), N - at)
        sc[at : at + m] = np.minimum(sc[at : at + m], 1 - 0.55 * np.exp(-np.arange(m) / (SR * 0.09)))
    bass_st = pan_stereo(hp(lp(bass, 900), 38) * sc, 0)
    drums = np.stack([hp(drums[:, c], 30) for c in range(2)], axis=1)
    pad_st = widen(pan_stereo(pad * sc, 0), 0.5)
    lead_st = widen(lead, 0.2)
    return {"drums": drums, "bass": bass_st, "chords": pad_st, "lead": lead_st}
