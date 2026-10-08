"""SFX v2: every event plays REAL recordings from the bank (Kenney CC0, Mixkit SFX licence), picked per event from
several variants with a seeded rng, lightly pitch-shifted, velocity-scaled and panned. Big hits layer three
recordings (sub + transient + tail). Typing is assembled as a blue-switch keystroke from real parts (see key()).
Only two small things are synthesised and are named as such: a faint 3.6–4.8 kHz ring under the switch click (−24 dB) and
the musical sting, which is rendered by the music engine with the track's instruments (music2.py)."""
import numpy as np

import bank
from dsp import SR, env_exp, hp, lp, pan_stereo, secs, sine

LEVEL = {
    "slam": -2, "impact": -1, "sting": -2, "riser": -7, "wipe": -6, "whoosh": -8, "swish": -11, "tilt": -9, "snap": -6,
    "pin": -6, "button": -6, "pop": -7, "message": -6, "key": -6, "tick": -13, "counter": -11, "lock": -10, "line": -18,
    "icon": -16, "progress": -15, "pulse": -16, "tail": -14, "click": -8, "cam": -8,
}
DUCKERS = {"slam", "impact", "snap", "pin", "button", "key", "sting", "lock", "click"}


def _pick(rng, role):
    src, name = bank.BANK[role][rng.integers(len(bank.BANK[role]))]
    return bank.load(src, name), f"{src}:{name}"


def _shift(x, st):
    """Pitch-shift by resampling (duration changes with pitch, as a real varispeed would)."""
    if abs(st) < 1e-3:
        return x
    f = 2 ** (st / 12)
    n = max(8, int(len(x) / f))
    idx = np.arange(n) * f
    i0 = np.floor(idx).astype(int)
    fr = (idx - i0)[:, None]
    i1 = np.minimum(i0 + 1, len(x) - 1)
    i0 = np.minimum(i0, len(x) - 1)
    return x[i0] * (1 - fr) + x[i1] * fr


def _pan(st, pan):
    a = (np.clip(pan, -1, 1) + 1) * np.pi / 4
    return np.stack([st[:, 0] * np.cos(a) * np.sqrt(2), st[:, 1] * np.sin(a) * np.sqrt(2)], axis=1)


def _place(dst, src, at):
    if at < 0:
        src = src[-at:]
        at = 0
    n = min(len(src), len(dst) - at)
    if n > 0:
        dst[at : at + n] += src[:n]


def _trim(x, seconds):
    n = min(len(x), secs(seconds))
    y = x[:n].copy()
    f = min(n, secs(0.02))
    y[-f:] *= np.linspace(1, 0, f)[:, None]
    return y


USED = set()


def _use(tag):
    USED.add(tag)


# ——— Blue-switch keystroke ————————————————————————————————————————————————————————————————————————

def key(rng, ch="a", vel=0.6, **_):
    """Key-down click (real switch recording, click jacket) → 6–12 ms later the bottom-out clack (a real keystroke
    sliced from a typing recording) → 70–120 ms later a smaller key-up click. Space/Enter: heavier, lower clack plus a
    light stabiliser rattle. Every stroke varies pitch, level, timing and pan."""
    space = ch == " "
    heavy = space or ch in ("\n", "@")
    n = secs(0.26)
    out = np.zeros((n, 2))
    click, t1 = _pick(rng, "key_click")
    click = _shift(_trim(click, 0.05), rng.uniform(-1.2, 1.2) - (1.5 if heavy else 0))
    _use(t1)
    _place(out, click * (0.75 if heavy else 1.0), 0)
    # faint synthetic metallic ring under the click (named in the report)
    m = secs(0.012)
    ring = sine(rng.uniform(3600, 4800), m) * env_exp(m, 0.003) * 0.063
    _place(out, np.stack([ring, ring], 1), 0)
    slices = bank.keystroke_slices("heavy" if heavy else "clack")
    seg, tag = slices[rng.integers(len(slices))]
    _use(tag.split("@")[0])
    clack = seg.copy()
    clack = np.stack([lp(clack[:, c], 3200 if heavy else 6500) for c in range(2)], 1)
    clack = _shift(clack, rng.uniform(-1, 1) - (2.5 if space else 0))
    _place(out, clack * (0.95 if heavy else 0.7), secs(rng.uniform(0.006, 0.012)))
    if heavy:  # stabiliser rattle: two or three tiny real ticks
        for k in range(int(rng.integers(2, 4))):
            t, tg = _pick(rng, "tick")
            _use(tg)
            _place(out, _shift(_trim(t, 0.02), 7 + rng.uniform(0, 3)) * 0.08, secs(0.014 + 0.005 * k))
    up, t2 = _pick(rng, "key_click")
    _use(t2)
    _place(out, _shift(_trim(up, 0.03), 2 + rng.uniform(-1, 1)) * 0.32, secs(rng.uniform(0.07, 0.12)))
    return _pan(out * vel * rng.uniform(0.85, 1.1), rng.uniform(-0.15, 0.15))


# ——— Other types ———————————————————————————————————————————————————————————————————————————————————

def _one(role, seconds, gain=1.0):
    def f(rng, vel=0.7, pitch=0, pan=0.0, **_):
        x, tag = _pick(rng, role)
        _use(tag)
        x = _shift(_trim(x, seconds), pitch * 0.5 + rng.uniform(-0.6, 0.6))
        return _pan(x * vel * gain * rng.uniform(0.9, 1.05), pan)

    return f


def slam(rng, vel=0.8, pitch=0, pan=0.0, big=False, **_):
    """Three real layers: sub hit + transient (punch/plate) + a short cinematic tail."""
    sub, a = _pick(rng, "hit_sub")
    tr, b = _pick(rng, "hit_transient")
    tl, c = _pick(rng, "hit_tail")
    for t in (a, b, c):
        _use(t)
    n = secs(1.2 if big else 0.7)
    out = np.zeros((n, 2))
    _place(out, _shift(_trim(sub, 0.7), rng.uniform(-1, 0.5)) * 0.9, 0)
    _place(out, _shift(_trim(tr, 0.3), rng.uniform(-1.5, 1.5) + pitch * 0.3) * 0.75, 0)
    t = _trim(tl, 1.1 if big else 0.6)
    t = np.stack([hp(t[:, ch], 180) for ch in range(2)], 1)
    _place(out, t * (0.45 if big else 0.25), 0)
    return _pan(out * vel, pan * 0.4)


def impact(rng, **kw):
    return slam(rng, big=True, **kw)


def whoosh(rng, vel=0.6, sweep=(0.6, 0.0), dur=None, role="whoosh", **_):
    x, tag = _pick(rng, role)
    _use(tag)
    x = _trim(x, max(0.35, (dur or 12) / 30 + 0.25))
    pan = np.linspace(sweep[0], sweep[1], len(x))
    a = (pan + 1) * np.pi / 4
    m = x.mean(axis=1)
    st = np.stack([m * np.cos(a), m * np.sin(a)], 1) * np.sqrt(2)
    return st * vel * rng.uniform(0.9, 1.05)


def wipe(rng, **kw):
    return whoosh(rng, role="wipe", **kw)


def swish(rng, vel=0.5, pan=0.2, **_):
    return whoosh(rng, vel=vel, sweep=(pan, 0), role="swish")


def tilt(rng, vel=0.55, pan=0.5, **_):
    return whoosh(rng, vel=vel, sweep=(pan, 0), role="whoosh")


def counter(rng, steps=(3, 1), vel=0.6, **_):
    n = secs(0.2)
    out = np.zeros((n, 2))
    k = max(2, abs(steps[1] - steps[0]) + 2)
    for i in range(k):
        t, tag = _pick(rng, "tick")
        _use(tag)
        _place(out, _shift(_trim(t, 0.04), i * 2) * (0.6 + 0.4 * i / k), int(i * secs(0.13) / k))
    return out * vel


def line(rng, vel=0.45, dur=12, sweep=(0.0, 0.0), **_):
    """A line drawing: a soft swish across its length (real recording, low)."""
    return whoosh(rng, vel=vel * 0.6, sweep=sweep, dur=dur, role="swish")


def icon(rng, vel=0.4, dur=30, pan=0.0, **_):
    n = secs(max(0.2, dur / 30))
    out = np.zeros((n, 2))
    at, gap, i = 0, secs(0.07), 0
    while at < n - secs(0.02):
        t, tag = _pick(rng, "tick")
        _use(tag)
        _place(out, _shift(_trim(t, 0.03), 4 + i), at)
        at += gap
        gap = max(secs(0.035), int(gap * 0.85))
        i += 1
    return _pan(out * vel, pan)


def pin(rng, vel=0.7, pitch=0, pan=0.0, **_):
    d, a = _pick(rng, "drop")
    _use(a)
    return _pan(_shift(_trim(d, 0.4), pitch * 0.5) * vel, pan)


def snap(rng, vel=0.8, **_):
    c, a = _pick(rng, "ui_click")
    f, b = _pick(rng, "confirm")
    _use(a)
    _use(b)
    n = secs(0.8)
    out = np.zeros((n, 2))
    _place(out, _trim(c, 0.1), 0)
    _place(out, _trim(f, 0.7) * 0.6, secs(0.01))
    return out * vel


def riser(rng, vel=0.8, dur=60, **_):
    """A real riser recording, trimmed/faded so that its loudest point lands exactly on the event's end frame."""
    x, tag = _pick(rng, "riser")
    _use(tag)
    n = secs(dur / 30)
    env = np.abs(x).max(axis=1)
    peak = int(np.argmax(np.convolve(env, np.ones(2400) / 2400, mode="same")))
    start = max(0, peak - n)
    y = x[start:peak].copy()
    if len(y) < n:
        y = np.concatenate([np.zeros((n - len(y), 2)), y])
    f = secs(0.08)
    y[:f] *= np.linspace(0, 1, f)[:, None]
    y[: secs(0.005)] += np.random.default_rng(1).standard_normal((secs(0.005), 2)) * 0.002  # measurable onset
    return y * vel


def tail(rng, vel=0.5, dur=120, **_):
    return np.zeros((secs(0.1), 2))  # the sting's own reverb tail carries the end card


STING = {}  # filled by music2 with the candidate's rendered sting


def sting(rng, vel=0.85, **_):
    x = STING.get("x")
    if x is None:
        return slam(rng, big=True)
    return x * vel


LIBRARY = {
    "key": key, "tick": _one("tick", 0.08), "counter": counter, "lock": _one("confirm", 0.6), "slam": slam, "impact": impact,
    "whoosh": whoosh, "wipe": wipe, "swish": swish, "tilt": tilt, "pin": pin, "snap": snap, "line": line, "icon": icon,
    "button": _one("pop", 0.4), "pulse": _one("ui_click", 0.1, 0.5), "progress": _one("tick", 0.05), "pop": _one("pop", 0.4),
    "message": _one("message", 0.6), "riser": riser, "sting": sting, "tail": tail, "click": _one("ui_click", 0.15), "cam": whoosh,
}
