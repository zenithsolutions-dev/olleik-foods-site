"""SFX for the V2 story film and episodes. Real recordings from the bank (Kenney CC0, Mixkit SFX licence, OpenGameArt CC0),
layered and varied per event with a seeded rng. Two sounds are partly synthesised and named as such in the report:
  - phone buzz: a synthesised 165 Hz vibration-motor hum (with harmonics and the on/off pattern of a phone) over REAL
    recorded rattles of a phone on a hard counter (Kenney plate/wood light impacts);
  - thermal printer: a REAL paper-feed recording (Mixkit #2383) with a faint synthesised stepper-motor chirp on top.
Room tone is synthesised (very low brown noise, low-passed) and stays about 34 dB under the effects.
Every function returns a stereo array whose onset is at sample 0 (the event's frame)."""
import numpy as np

import bank
import sfx2
from dsp import SR, env_exp, hp, lp, secs, sine
from sfx2 import _pan, _pick, _place, _shift, _trim, _use

LEVEL = {
    "buzz": -9, "notif": -12, "voice": -14, "chop": -11, "rampdown": -9, "tap": -6, "snaplock": -10, "whoosh": -9, "whip": -10,
    "glide": -12, "tick": -14, "chime": -12, "printer": -10, "tear": -8, "slide": -12, "click": -9, "flip": -11, "stamp": -2,
    "stamp_big": 0, "box": -5, "tapeRip": -10, "step": -10, "doorbell": -9, "door": -12, "mug": -14, "bell": -8, "pop": -9,
    "marker": -20, "ticket": -14, "pluck": -12, "sting2": -10, "key": -9, "counterclick": -12, "room": -40,
}
DUCKERS = {"stamp", "stamp_big", "box", "tap", "doorbell", "chop", "tear", "pop", "bell"}


def _role(rng, role, seconds, pitch=0.0, gain=1.0):
    x, tag = _pick(rng, role)
    _use(tag)
    return _shift(_trim(x, seconds), pitch + rng.uniform(-0.5, 0.5)) * gain * rng.uniform(0.9, 1.05)


def buzz(rng, vel=0.8, dur=24, pan=0.0, **_):
    """Phone vibration: pulses of a 165 Hz motor hum (synthesised) + real counter rattles on each pulse start."""
    n = secs(dur / 30)
    out = np.zeros((n, 2))
    pulse = secs(0.32)
    gap = secs(0.12)
    at = 0
    k = 0
    while at < n - secs(0.05):
        m = min(pulse, n - at)
        t = np.arange(m) / SR
        f0 = 165 * rng.uniform(0.97, 1.03)
        hum = (np.sin(2 * np.pi * f0 * t) * 0.6 + np.sin(2 * np.pi * 2 * f0 * t) * 0.25 + np.sin(2 * np.pi * 3.02 * f0 * t) * 0.12)
        hum *= (1 + 0.35 * np.sin(2 * np.pi * 31 * t))  # surface chatter
        env = np.minimum(1, np.arange(m) / secs(0.012)) * np.minimum(1, (m - np.arange(m)) / secs(0.02))
        hum = lp(hum * env, 1800)
        _place(out, np.stack([hum, hum], 1) * 0.35, at)
        for j in range(3):  # real rattles of the phone on the counter
            r = _role(rng, "rattle", 0.05, pitch=6 + rng.uniform(0, 4), gain=0.35)
            _place(out, r, at + secs(0.004 + 0.09 * j))
        at += m + gap
        k += 1
    return _pan(out * vel, pan)


def notif(rng, vel=0.7, pitch=0, pan=0.0, **_):
    return _pan(_role(rng, "pop", 0.4, pitch * 0.5) * vel, pan)


def voice(rng, vel=0.6, pan=0.0, **_):
    """Voice-note blip: a short real UI confirm, pitched up."""
    return _pan(_role(rng, "ui_click", 0.12, 5) * vel, pan)


def chop(rng, vel=0.7, **_):
    """'A knife on the board': a real light wood impact (substitute for the Mixkit knife slice, which returned 403)."""
    a = _role(rng, "chop", 0.25, -2)
    b = _role(rng, "chop", 0.15, 3, 0.4)
    out = np.zeros((secs(0.3), 2))
    _place(out, a, 0)
    _place(out, b, secs(0.006))
    return out * vel


def rampdown(rng, vel=0.7, **_):
    """Speed-ramp stop: a real whoosh, pitched down and reversed so it collapses INTO the frame."""
    x, tag = _pick(rng, "whoosh")
    _use(tag)
    y = _shift(_trim(x, 0.6), -7)[::-1].copy()
    y[: secs(0.004)] += np.random.default_rng(2).standard_normal((secs(0.004), 2)) * 0.002  # measurable start
    return y * vel


def tap(rng, vel=0.8, pan=0.0, **_):
    out = np.zeros((secs(0.2), 2))
    _place(out, _role(rng, "ui_click", 0.12, -3), 0)
    _place(out, _role(rng, "tick", 0.05, -5, 0.4), secs(0.003))
    return _pan(out * vel, pan)


def snaplock(rng, vel=0.6, pitch=0, pan=0.0, **_):
    return _pan(_role(rng, "tick", 0.08, 3 + pitch) * vel, pan)


def _with_tick(x, rng, gain=0.22):
    """A faint real tick at the very start: the cut gets a crisp edge even when the whoosh recording fades in."""
    t = _role(rng, "tick", 0.03, -6, gain)
    _place(x, t, 0)
    return x


def whoosh(rng, vel=0.6, sweep=(0.6, -0.6), dur=12, **_):
    return _with_tick(sfx2.whoosh(rng, vel=vel, sweep=sweep, dur=dur), rng)


def whip(rng, vel=0.55, sweep=(0.8, -0.8), **_):
    return _with_tick(sfx2.whoosh(rng, vel=vel, sweep=sweep, dur=6), rng)


def glide(rng, vel=0.5, **_):
    return sfx2.swish(rng, vel=vel, pan=0.3)


def tick(rng, vel=0.5, pitch=0, **_):
    return _role(rng, "tick", 0.06, pitch) * vel


def chime(rng, vel=0.6, **_):
    return _role(rng, "confirm", 0.7, 0) * vel


def printer(rng, vel=0.7, dur=36, **_):
    """Thermal printer: the REAL paper-feed recording stretched over the print time by looping its body, plus a faint
    synthesised stepper chirp (named in the report)."""
    n = secs(dur / 30)
    x, tag = _pick(rng, "paper_feed")
    _use(tag)
    body = x[: secs(1.2)]
    out = np.zeros((n, 2))
    at = 0
    while at < n:
        seg = body[: min(len(body), n - at)].copy()
        f = min(len(seg), secs(0.02))
        seg[:f] *= np.linspace(0, 1, f)[:, None]
        seg[-f:] *= np.linspace(1, 0, f)[:, None]
        _place(out, seg * 0.8, at)
        at += len(body) - secs(0.04)
    t = np.arange(n) / SR
    chirp = np.sign(np.sin(2 * np.pi * 820 * t)) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 9 * t)))
    chirp = lp(hp(chirp, 600), 2400) * 0.025
    out += np.stack([chirp, chirp], 1)
    out[: secs(0.004)] += np.random.default_rng(3).standard_normal((secs(0.004), 2)) * 0.01
    fade = secs(0.06)
    out[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return out * vel


def tear(rng, vel=0.8, **_):
    return _role(rng, "tear", 0.6, 0) * vel


def slide(rng, vel=0.6, **_):
    """The slip sliding onto the bench: the paper-feed recording, short and filtered."""
    y = _role(rng, "paper_feed", 0.35, 2)
    return np.stack([hp(y[:, c], 400) for c in range(2)], 1) * vel


def click(rng, vel=0.7, **_):
    return _role(rng, "ui_click", 0.1, -1) * vel


def flip(rng, vel=0.6, pitch=0, **_):
    return _role(rng, "pop", 0.3, pitch) * vel


def stamp(rng, vel=0.9, big=False, **_):
    """Rubber stamp: real wood body + punch transient + the stapler's paper snap; the big one adds a heavy box body."""
    out = np.zeros((secs(0.8), 2))
    _place(out, _role(rng, "stamp_body", 0.4, -3 if big else 0), 0)
    _place(out, _role(rng, "stamp_punch", 0.3, -2, 0.8), 0)
    _place(out, _role(rng, "stapler", 0.12, -4, 0.35), secs(0.004))
    if big:
        _place(out, _role(rng, "box_body", 0.5, -5, 0.7), 0)
    return out * vel


def stamp_big(rng, vel=1.0, **kw):
    return stamp(rng, vel=vel, big=True)


def box(rng, vel=0.8, pan=0.0, **_):
    out = np.zeros((secs(0.6), 2))
    _place(out, _role(rng, "box_thud", 0.45, -2), 0)
    _place(out, _role(rng, "box_body", 0.35, -4, 0.45), secs(0.003))
    return _pan(out * vel, pan)


def tapeRip(rng, vel=0.7, **_):
    return _role(rng, "tape", 0.8, 1) * vel


def step(rng, vel=0.6, pan=0.0, **_):
    return _pan(_role(rng, "step", 0.25, 0) * vel, pan)


def doorbell(rng, vel=0.8, **_):
    return _role(rng, "doorbell", 1.6, 0) * vel


def door(rng, vel=0.5, **_):
    return sfx2.whoosh(rng, vel=vel, sweep=(0.4, 0.6), dur=12)


def mug(rng, vel=0.5, **_):
    return _role(rng, "mug", 0.2, -4) * vel


def bell(rng, vel=0.7, **_):
    """End-card bell (no-music version): the doorbell press, pitched down a fourth."""
    return _role(rng, "doorbell_press", 1.3, -5) * vel


def pop(rng, vel=0.7, pitch=0, **_):
    return _role(rng, "pop", 0.4, pitch) * vel


def marker(rng, vel=0.5, dur=18, **_):
    return sfx2.line(rng, vel=vel, dur=dur)


def ticket(rng, vel=0.6, dur=14, **_):
    return printer(rng, vel=vel, dur=dur)


def counterclick(rng, vel=0.5, **_):
    return sfx2.counter(rng, steps=(0, 1), vel=vel)


def key(rng, **kw):
    return sfx2.key(rng, **kw)


PLUCKS = {}  # filled by mix_v2 with FluidSynth-rendered notes (problem pluck, two-note "next" sting)


def pluck(rng, vel=0.7, **_):
    return PLUCKS.get("pluck", np.zeros((secs(0.1), 2))) * vel


def sting2(rng, vel=0.7, **_):
    return PLUCKS.get("sting2", np.zeros((secs(0.1), 2))) * vel


LIBRARY = {k: v for k, v in globals().items() if k in LEVEL and callable(v)}
