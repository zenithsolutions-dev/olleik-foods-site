"""Music v2: three original candidates composed in code as MIDI and rendered with REAL instrument samples (FluidSynth
2.6.1 + the GeneralUser GS 2.0.3 SoundFont, licence in audio-library/licenses/). No melody is borrowed; the
progressions are common-practice harmony (not copyrightable) voiced and arranged here. Each candidate follows a cut's
scene map (hook → problem build → answer drop → how it works → call-to-action breakdown → end hit and resolve).

Stems (drums, bass, chords, lead) render separately, then: side-chain to the kick, gentle saturation, EQ, a bus limiter.
"""
import os
import struct
import subprocess
import tempfile

import numpy as np
import soundfile as sf
from scipy import signal

from dsp import SR, from_db, haas_widen, high_shelf, hp, limiter, low_shelf, lp, lufs, peaking, rng_for

TOOLS = os.path.join(os.path.dirname(__file__), "..", "audio-library", "_tools")
FLUID = os.path.join(TOOLS, "fluidsynth", "fluidsynth-v2.6.1-win10-x64-cpp11", "bin", "fluidsynth.exe")
SF2 = os.path.join(TOOLS, "GeneralUser-GS.sf2")
TPQ = 480

# ——— Candidates ———————————————————————————————————————————————————————————————————————————————————

def chord(root, kind):
    iv = {"maj7": [0, 4, 7, 11], "maj9": [0, 4, 7, 11, 14], "m7": [0, 3, 7, 10], "m9": [0, 3, 7, 10, 14], "sus4": [0, 5, 7, 10], "7": [0, 4, 7, 10], "maj": [0, 4, 7], "add9": [0, 4, 7, 14], "6": [0, 4, 7, 9]}[kind]
    return [root + i for i in iv]


CANDIDATES = {
    "A": {
        "title": "Clear Launch",
        "bpm": 120,
        "kit": 24,  # Electronic
        "bass": 38,  # Synth Bass 1
        "keys": 5,  # Electric Piano 2 (FM, brighter)
        "pad": 89,  # Warm Pad
        "lead": 11,  # Vibraphone
        "lead2": 9,  # Glockenspiel (double, quiet)
        "prog": [(50, "maj9"), (54, "m7"), (55, "maj7"), (57, "sus4")],  # D F#m G A(sus→7)
        "late": (57, "7"),
        "motif": [(0, 74, 1), (1, 76, 0.5), (1.5, 78, 0.5), (2, 81, 1.5), (4, 79, 1), (5, 78, 0.5), (5.5, 76, 0.5), (6, 74, 2)],
        "bass_rhythm": [0, 1.5, 2, 3, 3.5],
        "tonic": (50, "maj9"),
    },
    "B": {
        "title": "Bright Pulse",
        "bpm": 124,
        "kit": 0,  # Standard
        "bass": 39,  # Synth Bass 2
        "keys": 0,  # Acoustic Grand
        "pad": 48,  # Strings
        "lead": 45,  # Pizzicato
        "lead2": 80,  # Square lead, very quiet
        "prog": [(57, "add9"), (52, "maj"), (54, "m7"), (50, "maj9")],  # A E F#m D
        "late": None,
        "motif": [(0, 76, 0.5), (0.5, 81, 0.5), (1, 80, 0.5), (1.5, 76, 1), (2.5, 73, 0.5), (3, 76, 1), (4, 78, 0.5), (4.5, 81, 0.5), (5, 83, 1), (6, 81, 0.5), (6.5, 80, 0.5), (7, 76, 1)],
        "bass_rhythm": [0.5, 1.5, 2.5, 3.5],  # off-beat house bass
        "tonic": (57, "add9"),
    },
    "C": {
        "title": "Warm Momentum",
        "bpm": 104,
        "kit": 8,  # Room
        "bass": 33,  # Fingered Bass
        "keys": 24,  # Nylon Guitar (arpeggio)
        "pad": 49,  # Slow Strings
        "lead": 12,  # Marimba
        "lead2": 0,  # Piano, doubles the motif an octave down, quiet
        "prog": [(53, "maj9"), (57, "m7"), (58, "maj7"), (60, "sus4")],  # F Am Bb C(sus→7)
        "late": (60, "7"),
        "motif": [(0, 72, 0.75), (0.75, 74, 0.75), (1.5, 77, 1.5), (3, 76, 1), (4, 74, 0.75), (4.75, 72, 0.75), (5.5, 69, 1.5), (7, 72, 1)],
        "bass_rhythm": [0, 0.75, 2, 2.75, 3.5],
        "tonic": (53, "maj9"),
    },
}

# ——— Minimal SMF writer ————————————————————————————————————————————————————————————————————————————

def _vlq(n):
    out = [n & 0x7F]
    n >>= 7
    while n:
        out.insert(0, (n & 0x7F) | 0x80)
        n >>= 7
    return bytes(out)


def write_midi(path, bpm, events):
    """events: (beat, kind, channel, a, b) with kind in 'on','off','prog','cc'. One track."""
    evs = []
    for beat, kind, ch, a, b_ in events:
        t = int(round(beat * TPQ))
        if kind == "on":
            evs.append((t, 1, bytes([0x90 | ch, a, b_])))
        elif kind == "off":
            evs.append((t, 0, bytes([0x80 | ch, a, 0])))
        elif kind == "prog":
            evs.append((t, -2, bytes([0xC0 | ch, a])))
        elif kind == "cc":
            evs.append((t, -1, bytes([0xB0 | ch, a, b_])))
    evs.sort(key=lambda e: (e[0], e[1]))
    tempo = int(60_000_000 / bpm)
    data = b"\x00\xff\x51\x03" + tempo.to_bytes(3, "big")
    last = 0
    for t, _, msg in evs:
        data += _vlq(t - last) + msg
        last = t
    data += b"\x00\xff\x2f\x00"
    with open(path, "wb") as f:
        f.write(b"MThd" + struct.pack(">IHHH", 6, 0, 1, TPQ))
        f.write(b"MTrk" + struct.pack(">I", len(data)) + data)


def render_midi(events, bpm, seconds, reverb=True, chorus=False):
    with tempfile.TemporaryDirectory() as d:
        mid, wav = os.path.join(d, "x.mid"), os.path.join(d, "x.wav")
        write_midi(mid, bpm, events)
        args = [FLUID, "-ni", "-q", "-g", "0.5", "-r", str(SR), "-o", f"synth.reverb.active={1 if reverb else 0}", "-o", f"synth.chorus.active={1 if chorus else 0}", "-o", "synth.reverb.room-size=0.5", "-o", "synth.reverb.level=0.35", "-F", wav, SF2, mid]
        subprocess.run(args, check=True, capture_output=True)
        x, sr = sf.read(wav, always_2d=True)
    n = int(seconds * SR)
    if len(x) < n:
        x = np.concatenate([x, np.zeros((n - len(x), x.shape[1]))])
    return x[:n]


# ——— Arrangement ———————————————————————————————————————————————————————————————————————————————————

PARTS = ["Hook", "Problem", "Answer", "How it works", "Call to action", "End"]


def parts_per_beat(music, frames, bpm):
    """Part of each beat on the candidate's own grid (scene map given in frames at 30 fps)."""
    beat_f = 1800 / bpm
    n = int(round(frames / beat_f))
    out = []
    for k in range(n):
        f = k * beat_f
        seg = next((m for m in music if m["from"] <= f < m["to"]), music[-1])
        out.append("End" if seg["kind"] == "end" else seg["part"])
    return out


def compose(cid, parts, seed="m"):
    """Returns per-stem MIDI event lists, the kick beats (for side-chain) and the sting events."""
    C = CANDIDATES[cid]
    rng = rng_for(seed, cid)
    nb = len(parts)
    D, BS, CH, LD = 9, 0, 1, 3
    drums, bass, chords, lead = [(0, "prog", D, C["kit"], 0)], [(0, "prog", BS, C["bass"], 0)], [(0, "prog", CH, C["keys"], 0), (0, "prog", 2, C["pad"], 0)], [(0, "prog", LD, C["lead"], 0), (0, "prog", 4, C["lead2"], 0)]
    chords += [(0, "cc", CH, 10, 76), (0, "cc", 2, 10, 64), (0, "cc", 2, 91, 90)]
    lead += [(0, "cc", LD, 10, 46), (0, "cc", 4, 10, 86), (0, "cc", LD, 91, 70)]
    kicks = []

    def note(lst, beat, ch, n, vel, dur, hum=True):
        j = rng.uniform(-0.012, 0.012) if hum else 0
        v = int(np.clip(vel + (rng.integers(-6, 7) if hum else 0), 1, 127))
        lst.append((max(0, beat + j), "on", ch, int(n), v))
        lst.append((max(0, beat + j + dur), "off", ch, int(n), 0))

    end_start = parts.index("End") if "End" in parts else nb
    cta_first = parts.index("Call to action") if "Call to action" in parts else None
    prob = [k for k, p in enumerate(parts) if p == "Problem"]
    for bar in range(0, nb, 4):
        p = parts[bar]
        idx = (bar // 4) % 4
        root, kind = C["tonic"] if bar >= end_start else C["prog"][idx]
        tones = chord(root, kind)
        # ——— drums
        for k in range(bar, min(bar + 4, nb)):
            pk = parts[k]
            pos = k % 4
            if cta_first is not None and k == cta_first - 1:
                # one-beat fill into the breakdown: snare 16ths rising
                for s in range(4):
                    note(drums, k + s * 0.25, D, 38, 50 + 15 * s, 0.2)
                continue
            if pk == "Call to action":
                if k >= (cta_first or 0) + 4:  # last bar of the breakdown: snare roll riser
                    for s in range(4):
                        note(drums, k + s * 0.25, D, 38, 40 + int(70 * ((k - cta_first - 4) * 4 + s) / 8), 0.2)
                continue
            if pk == "End" and k >= end_start + 4:
                continue
            if pk == "End" and k == end_start:
                note(drums, k, D, 49, 120, 2)
                note(drums, k, D, 57, 90, 2)
            kick_here = pk != "Hook" or pos in (0, 2)
            if kick_here:
                note(drums, k, D, 36, 118 if pk in ("Answer", "End") else 100, 0.3, hum=False)
                kicks.append(k)
            if pk in ("Answer", "How it works", "End") and pos in (1, 3):
                note(drums, k, D, 39 if cid != "C" else 38, 105, 0.3)
                if cid == "A":
                    note(drums, k, D, 38, 70, 0.3)
            if pk == "Hook":
                note(drums, k + 0.5, D, 42, 55, 0.1)
            elif pk == "Problem":
                pr = (k - prob[0]) / max(1, len(prob) - 1) if prob else 0
                for e in (0, 0.5):
                    note(drums, k + e, D, 42, int(45 + 50 * pr) if e else 40, 0.1)
                if pr > 0.75 and pos == 3:
                    note(drums, k + 0.5, D, 38, int(60 + 40 * pr), 0.2)
            else:
                steps = (0, 0.25, 0.5, 0.75) if pk in ("Answer", "End") else (0, 0.5)
                for e in steps:
                    note(drums, k + e, D, 46 if (e == 0.5 and cid == "B") else 42, 105 if e == 0.5 else 80, 0.1)
                for e in (0.25, 0.75):
                    note(drums, k + e, D, 82 if cid != "C" else 70, 52, 0.1)  # shaker / maracas
                if cid == "B" and pk == "Answer" and pos == 3:
                    note(drums, k + 0.75, D, 54, 60, 0.1)  # tambourine lift
        # ——— bass
        if p not in ("Hook",) and not (p == "End" and bar >= end_start + 4):
            for k in range(bar, min(bar + 4, nb)):
                pk = parts[k]
                if pk in ("Problem", "Call to action"):
                    if k % 4 == 0:
                        note(bass, k, BS, root - 12, 80, min(4, nb - k) - 0.1)
                    continue
                if pk == "End" and k >= end_start + 4:
                    continue
                r = (C["late"][0] if (C["late"] and k % 4 >= 2 and bar < end_start and idx == 3) else root) - 12
                for e in C["bass_rhythm"]:
                    if int(e) == k % 4:
                        note(bass, bar + e, BS, r if e % 1 == 0 or cid != "B" else r + (12 if e == 3.5 else 0), 100, 0.4 if cid != "C" else 0.6)
        if p == "End" and bar >= end_start + 4:
            note(bass, bar, BS, root - 12, 85, max(1, nb - bar) - 0.2)
        # ——— chords: pad holds; keys play stabs (A, B) or an arpeggio (C)
        late = C["late"] and idx == 3 and bar < end_start
        ptones = tones
        pad_vel = {"Hook": 45, "Problem": 55, "Answer": 70, "How it works": 62, "Call to action": 85, "End": 80}[p]
        for t in ptones:
            note(chords, bar, 2, t, pad_vel, (2 if late else min(4, nb - bar)) - 0.05)
        if late:
            for t in chord(*C["late"]):
                note(chords, bar + 2, 2, t, pad_vel, 1.95)
        if p in ("Answer", "How it works", "End", "Call to action") and not (p == "End" and bar >= end_start + 4):
            for k in range(bar, min(bar + 4, nb)):
                tt = chord(*C["late"]) if (late and k % 4 >= 2) else tones
                if cid == "C":
                    for s, ti in enumerate([0, 2, 1, 3]):
                        note(chords, k + s * 0.25, CH, tt[ti % len(tt)] + (12 if s == 3 else 0), 70 if parts[k] != "Call to action" else 55, 0.4)
                elif cid == "B":
                    for e in ((0.5,) if k % 2 else (0.5, 0.75)):
                        for t in tt[1:]:
                            note(chords, k + e, CH, t + 12, 78, 0.22)
                else:
                    if k % 4 in (0, 2):
                        for t in tt:
                            note(chords, k + (0.5 if k % 4 == 2 else 0), CH, t + 12, 72, 0.9)
        if p == "End" and bar >= end_start + 4:
            for t in chord(*C["tonic"]):
                note(chords, bar, CH, t + 12, 80, max(1, nb - bar) - 0.2)
        # ——— lead: the motif over two bars in the answer and on the end, a fragment in the hook
        if p in ("Answer", "End") and not (p == "End" and bar >= end_start + 4):
            half = 0 if (bar // 4) % 2 == 0 else 4
            for (b0, n0, d0) in C["motif"]:
                if half <= b0 < half + 4:
                    note(lead, bar + b0 - half, LD, n0 + (0 if cid != "B" else 0), 92, d0 * 0.95)
                    note(lead, bar + b0 - half, 4, n0 - (12 if cid == "C" else 0), 50 if cid != "B" else 30, d0 * 0.95)
        elif p == "How it works" and (bar // 4) % 2 == 1:
            for (b0, n0, d0) in C["motif"][:3]:
                note(lead, bar + b0, LD, n0, 70, d0 * 0.95)
        elif p == "Hook" and bar == 0:
            for (b0, n0, d0) in C["motif"][:2]:
                note(lead, bar + b0 + 2, LD, n0, 60, d0)
    return {"drums": drums, "bass": bass, "chords": chords, "lead": lead}, kicks


def sting_events(cid):
    """The logo sting in the candidate's key and instruments: a 4-note rise (motif head) + the tonic chord + crash."""
    C = CANDIDATES[cid]
    ev = [(0, "prog", 3, C["lead"], 0), (0, "prog", 1, C["keys"], 0), (0, "prog", 2, C["pad"], 0), (0, "prog", 9, C["kit"], 0)]
    root, kind = C["tonic"]
    tones = chord(root, kind)
    for i, t in enumerate([tones[0] + 12, tones[1] + 12, tones[2] + 12, tones[0] + 24]):
        ev += [(i * 0.25, "on", 3, t, 100), (i * 0.25 + 1.5, "off", 3, t, 0)]
    for t in tones:
        ev += [(1, "on", 1, t + 12, 90), (4, "off", 1, t + 12, 0), (1, "on", 2, t, 80), (4, "off", 2, t, 0)]
    ev += [(1, "on", 9, 49, 115), (3, "off", 9, 49, 0), (1, "on", 9, 36, 120), (1.3, "off", 9, 36, 0)]
    return ev


def render(cid, music, frames, seed="promo"):
    """Stems for candidate `cid` following `music` (scene map in 30 fps frames) over `frames` frames."""
    C = CANDIDATES[cid]
    bpm = C["bpm"]
    parts = parts_per_beat(music, frames, bpm)
    stems_ev, kicks = compose(cid, parts, seed)
    seconds = frames / 30
    stems = {}
    for k, ev in stems_ev.items():
        x = render_midi(ev, bpm, seconds + 0.5, chorus=(k == "chords"))[: int(seconds * SR)]
        stems[k] = x
    # Side-chain bass and chords to the kick; gentle saturation; EQ.
    n = int(seconds * SR)
    sc = np.ones(n)
    for kb in kicks:
        at = int(kb * 60 / bpm * SR)
        m = min(int(0.3 * SR), n - at)
        if m > 0:
            sc[at : at + m] = np.minimum(sc[at : at + m], 1 - 0.5 * np.exp(-np.arange(m) / (SR * 0.09)))
    for k in ("bass", "chords"):
        stems[k] = stems[k] * sc[:, None]
    stems["bass"] = np.tanh(stems["bass"] * 1.6) / 1.6
    stems["drums"] = np.stack([hp(stems["drums"][:, c], 28) for c in range(2)], 1)
    stems["chords"] = np.stack([hp(stems["chords"][:, c], 120) for c in range(2)], 1)
    stems["lead"] = np.stack([hp(stems["lead"][:, c], 250) for c in range(2)], 1)
    # Drums: the hats and shaker get width (Haas on the band above 5 kHz), the kick stays centred.
    hi = np.stack([hp(stems["drums"][:, c], 5000, order=4) for c in range(2)], 1)
    stems["drums"] = stems["drums"] - hi + haas_widen(hi, 11, 1.2)
    stems["chords"] = haas_widen(stems["chords"], 15, 0.7)
    return stems, {"bpm": bpm, "beats": len(parts), "kicks": kicks, "parts": parts}


def render_sting(cid):
    x = render_midi(sting_events(cid), CANDIDATES[cid]["bpm"], 3.0)
    x = np.tanh(x * 1.2)
    return x / (np.abs(x).max() + 1e-9) * 0.9


def master(stems, gains=None, target=-14.0, fade_s=0.6, cid=None):
    g = gains or {"drums": -1, "bass": -5 if cid != "C" else -8, "chords": -8, "lead": -4 if cid != "C" else -2}
    mix = sum(stems[k] * from_db(g[k]) for k in stems)
    mix = low_shelf(mix, 120, -2.0)
    mix = peaking(mix, 380, -3.5, 0.8)  # take the boxiness out of the GM pads/keys
    mix = peaking(mix, 3000, 5.0 if cid == "A" else 3.5, 0.7)  # presence the SoundFont renders lack
    mix = low_shelf(mix, 70, -2.5 if cid != "C" else 0)
    mix = high_shelf(mix, 9000, 1.0)
    n = len(mix)
    f = int(fade_s * SR)
    mix[-f:] *= np.linspace(1, 0, f)[:, None] ** 1.5
    for _ in range(3):
        mix = limiter(mix * from_db(target - lufs(mix)), -1.8)
    return mix
