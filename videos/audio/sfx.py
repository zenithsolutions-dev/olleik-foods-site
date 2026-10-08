"""The promo's SFX library, synthesised (no samples). Each function returns a stereo array whose audible onset is at
sample 0 (the frame of its event), so the mix places it exactly on the frame the animation shows. Every call takes a
seeded rng: slight random pitch and velocity, so repeats never sound mechanical, and renders stay deterministic."""
import numpy as np

from dsp import (
    SR, bp, env_adsr, env_exp, hp, karplus, lp, noise, note_hz, pan_stereo, saw, secs, sine, sweep_filter, sweep_lp, tri, widen,
)

# The music's key (D major); the sting and chimes use it.
KEY_ROOT = 62  # D4


def _jit(rng, cents=40):
    return 2 ** (rng.uniform(-cents, cents) / 1200)


def key(rng, ch="a", vel=0.5, **_):
    """Keyboard: a click on top, a soft 'thock' under it; space bar lower and longer, Enter/@ a little heavier."""
    big = ch in (" ",)
    heavy = ch in ("@", "\n", ".")
    n = secs(0.09 if big else 0.06)
    click = hp(noise(n, rng), 2500 * _jit(rng, 200)) * env_exp(n, 0.0025)
    body_f = (150 if big else 230 if heavy else 260) * _jit(rng, 120)
    thock = sine(body_f, n) * env_exp(n, 0.03 if big else 0.018)
    knock = bp(noise(n, rng), 700, 1600) * env_exp(n, 0.012)
    x = 0.55 * click + 0.9 * thock + 0.35 * knock
    v = vel * rng.uniform(0.82, 1.08) * (1.2 if heavy else 1.0)
    return pan_stereo(x * v, rng.uniform(-0.12, 0.12))


def tick(rng, vel=0.5, pitch=0, **_):
    """A soft woody tick."""
    n = secs(0.05)
    f = 1500 * 2 ** (pitch / 12) * _jit(rng, 50)
    x = sine(f, n) * env_exp(n, 0.008) + 0.25 * hp(noise(n, rng), 3000) * env_exp(n, 0.002)
    return pan_stereo(x * vel * rng.uniform(0.9, 1.05), 0)


def counter(rng, steps=(3, 1), vel=0.6, **_):
    """Digit roll: a short train of soft clicks rising in pitch (one per digit step) over 4 frames."""
    n = secs(0.16)
    out = np.zeros(n)
    k = max(2, abs(steps[1] - steps[0]) + 2)
    for i in range(k):
        at = int(i * secs(0.13) / k)
        m = secs(0.02)
        f = 1800 * 2 ** ((i * 2) / 12) * _jit(rng, 30)
        out[at : at + m] += sine(f, m) * env_exp(m, 0.004) * (0.6 + 0.4 * i / k)
    return pan_stereo(out * vel, 0)


def lock(rng, vel=0.6, pitch=0, **_):
    """The 'lock' when a number lands: a click and a small two-note chime in the key."""
    n = secs(0.35)
    r = note_hz(KEY_ROOT + 12 + pitch) * _jit(rng, 10)
    chime = (sine(r * 2, n) * 0.6 + sine(r * 3, n) * 0.35) * env_exp(n, 0.12)
    click = hp(noise(n, rng), 4000) * env_exp(n, 0.0015)
    return pan_stereo((chime * 0.5 + click * 0.6) * vel, 0)


def slam(rng, vel=0.8, pitch=0, pan=0.0, **_):
    """Text slam: sub drop + noise transient + short tail."""
    n = secs(0.35)
    f = np.geomspace(110, 42, n) * _jit(rng, 60)
    sub = sine(f, n) * env_exp(n, 0.09)
    trans = lp(noise(n, rng), 9000) * env_exp(n, 0.004)
    tail = bp(noise(n, rng), 250, 2200) * env_exp(n, 0.06)
    x = 0.75 * sub + 0.6 * trans + 0.3 * tail
    st = pan_stereo(x * vel * rng.uniform(0.9, 1.05), pan * 0.5)
    return widen(st, 0.15)


def impact(rng, vel=0.9, pan=0.0, **_):
    """A bigger hit for collisions: deeper sub, longer tail."""
    n = secs(0.7)
    f = np.geomspace(90, 32, n)
    sub = sine(f, n) * env_exp(n, 0.18)
    trans = lp(noise(n, rng), 7000) * env_exp(n, 0.006)
    tail = bp(noise(n, rng), 150, 1500) * env_exp(n, 0.16)
    st = pan_stereo((1.1 * sub + 0.6 * trans + 0.35 * tail) * vel, pan * 0.4)
    return widen(st, 0.25)


def whoosh(rng, vel=0.6, sweep=(0.6, 0.0), dur=None, wide=False, **_):
    """Band-passed noise sweep, panned from sweep[0] to sweep[1] (matches the on-screen direction)."""
    d = (dur / 30) if dur else 0.42
    n = secs(max(0.25, d + 0.12))
    t = np.linspace(0, 1, n)
    centre = 350 + 3200 * np.sin(np.pi * np.clip(t * 1.1, 0, 1)) ** 1.5
    x = sweep_filter(noise(n, rng), centre, q=1.4)
    e = np.sin(np.pi * np.clip(t, 0, 1)) ** 1.6
    # Onset: the sweep starts audibly at sample 0 (no silent lead-in).
    e = np.maximum(e, env_exp(n, 0.03) * 0.6)
    pan = np.linspace(sweep[0], sweep[1], n)
    st = pan_stereo(x * e * vel * 2.2, pan)
    return widen(st, 0.4 if wide else 0.2)


def wipe(rng, vel=0.75, sweep=(-0.8, 0.8), **_):
    """The orange wipe: a brighter, faster whoosh with a little tonal rise underneath."""
    n = secs(0.45)
    t = np.linspace(0, 1, n)
    centre = 800 + 5000 * t**1.2
    x = sweep_filter(noise(n, rng), centre, q=2.0)
    tone = sine(np.linspace(300, 900, n), n) * 0.08
    e = np.sin(np.pi * np.clip(t * 1.15, 0, 1)) ** 1.2
    e = np.maximum(e, env_exp(n, 0.02) * 0.6)
    st = pan_stereo((x * 2.4 + tone) * e * vel, np.linspace(sweep[0], sweep[1], n))
    return widen(st, 0.25)


def swish(rng, vel=0.5, pan=0.2, **_):
    """Card swish: a short high whoosh."""
    n = secs(0.22)
    t = np.linspace(0, 1, n)
    x = sweep_filter(noise(n, rng), 2500 + 4000 * t, q=1.8)
    e = np.maximum(np.sin(np.pi * t) ** 1.3, env_exp(n, 0.02) * 0.6)
    return pan_stereo(x * e * vel * 2.0, np.linspace(pan, 0, n))


def tilt(rng, vel=0.55, pan=0.5, **_):
    """Phone tilt-in: a low whoosh that lands on a small 'tock'."""
    n = secs(0.4)
    t = np.linspace(0, 1, n)
    x = sweep_filter(noise(n, rng), 300 + 1400 * t, q=1.2) * np.maximum(np.sin(np.pi * t), env_exp(n, 0.02) * 0.5)
    tock = np.zeros(n)
    at = secs(0.2)
    m = n - at
    tock[at:] = sine(320, m) * env_exp(m, 0.02)
    return pan_stereo((x * 1.8 + tock * 0.6) * vel, np.linspace(pan, 0, n))


def pin(rng, vel=0.7, pitch=0, pan=0.0, **_):
    """Pin drop: soft thud + a small pluck."""
    n = secs(0.5)
    thud = sine(np.geomspace(120, 60, n), n) * env_exp(n, 0.05) + 0.3 * lp(noise(n, rng), 800) * env_exp(n, 0.02)
    pl = karplus(note_hz(KEY_ROOT + 12 + pitch) * _jit(rng, 8), n, rng, damp=0.993, bright=0.6) * 0.5
    return pan_stereo((thud + pl) * vel, pan)


def snap(rng, vel=0.8, **_):
    """Merge / snap: a magnetic click and a short chime."""
    n = secs(0.6)
    click = hp(noise(n, rng), 3000) * env_exp(n, 0.002) + sine(70, n) * env_exp(n, 0.03)
    r = note_hz(KEY_ROOT + 12)
    chime = sum(a * sine(r * m, n) * env_exp(n, d) for m, a, d in ((1, 0.5, 0.25), (2.76, 0.22, 0.12), (5.4, 0.1, 0.06)))
    return widen(pan_stereo((click * 0.8 + chime * 0.6) * vel, 0), 0.2)


def line(rng, vel=0.45, dur=12, sweep=(0.0, 0.0), **_):
    """Line draw: an airy rising sweep with a faint tick-train, as long as the drawing."""
    n = secs(max(0.15, dur / 30))
    t = np.linspace(0, 1, n)
    air = sweep_filter(noise(n, rng), 1500 + 5000 * t, q=3.0) * np.sin(np.pi * t) ** 0.8
    ticks = np.zeros(n)
    for k in range(int(n / secs(0.045))):
        at = k * secs(0.045)
        m = min(secs(0.008), n - at)
        ticks[at : at + m] += sine(3200 + 400 * rng.random(), m) * env_exp(m, 0.002) * 0.25
    x = air * 1.6 + ticks
    x[: secs(0.01)] += hp(noise(secs(0.01), rng), 4000) * env_exp(secs(0.01), 0.002) * 0.4  # defined onset
    return pan_stereo(x * vel, np.linspace(sweep[0], sweep[1], n))


def icon(rng, vel=0.4, dur=30, pan=0.0, **_):
    """Icon draw: a little accelerating tick-train."""
    n = secs(max(0.2, dur / 30))
    out = np.zeros(n)
    at = 0
    gap = secs(0.07)
    i = 0
    while at < n - secs(0.01):
        m = secs(0.012)
        out[at : at + m] += sine(2400 * _jit(rng, 120) * (1 + i * 0.03), m) * env_exp(m, 0.003)
        at += gap
        gap = max(secs(0.03), int(gap * 0.85))
        i += 1
    return pan_stereo(out * vel, pan)


def button(rng, vel=0.8, **_):
    """Button pop: a quick pitch-up blip with a click and a soft body."""
    n = secs(0.18)
    blip = sine(np.geomspace(500, 1300, n), n) * env_exp(n, 0.04)
    click = hp(noise(n, rng), 3000) * env_exp(n, 0.002)
    body = sine(180, n) * env_exp(n, 0.05)
    return widen(pan_stereo((blip * 0.7 + click * 0.4 + body * 0.6) * vel, 0), 0.15)


def pulse(rng, vel=0.35, **_):
    """Button pulse: a soft low 'boop'."""
    n = secs(0.12)
    x = sine(note_hz(KEY_ROOT - 12) * 2, n) * env_exp(n, 0.04) + 0.3 * sine(note_hz(KEY_ROOT + 7), n) * env_exp(n, 0.03)
    return pan_stereo(x * vel, 0)


def progress(rng, vel=0.35, pitch=0, **_):
    """Upload progress tick: a tiny high blip that climbs."""
    n = secs(0.03)
    x = sine(2600 * 2 ** (pitch / 12) * _jit(rng, 20), n) * env_exp(n, 0.005)
    return pan_stereo(x * vel, 0)


def message(rng, vel=0.7, **_):
    """Message pop: an original two-note bubble (a fifth up, in the key), not modelled on any known alert."""
    n = secs(0.3)
    out = np.zeros(n)
    m = secs(0.09)
    for k, (note, at) in enumerate(((KEY_ROOT + 19, 0), (KEY_ROOT + 26, secs(0.075)))):
        f = np.geomspace(note_hz(note) * 0.8, note_hz(note), m)
        out[at : at + m] += sine(f, m) * env_exp(m, 0.05) * (0.8 if k == 0 else 1.0)
    out += hp(noise(n, rng), 2000) * env_exp(n, 0.002) * 0.2
    return widen(pan_stereo(out * vel, 0.1), 0.2)


def riser(rng, vel=0.8, dur=60, **_):
    """Riser into the call to action: noise + detuned saws rising, filter opening, swelling to the downbeat."""
    n = secs(dur / 30)
    t = np.linspace(0, 1, n)
    f = note_hz(KEY_ROOT - 12) * 2 ** (t * 12 / 12)
    tone = (saw(f, n, rng) + saw(f * 1.007, n, rng) + saw(f * 0.993, n, rng)) / 3
    tone = sweep_lp(tone, 300 + 6000 * t**2)
    nz = sweep_filter(noise(n, rng), 600 + 7000 * t**1.5, q=1.0)
    e = t**2.2
    x = (tone * 0.5 + nz * 0.8) * e
    x[: secs(0.01)] += hp(noise(secs(0.01), rng), 5000) * 0.05  # keeps a measurable onset at the event frame
    st = pan_stereo(x * vel, 0)
    return widen(st, 0.5)


def sting(rng, vel=0.85, **_):
    """Logo sting: a short motif in the key (D–F#–A–D, 16ths at 120 BPM) over a Dmaj9 swell and a low boom."""
    n = secs(2.2)
    out = np.zeros(n)
    sixteenth = secs(0.125)
    for i, step in enumerate((0, 4, 7, 12)):
        at = i * sixteenth
        m = n - at
        out[at:] += karplus(note_hz(KEY_ROOT + 12 + step), m, rng, damp=0.997, bright=0.7) * 0.45
    chord = [KEY_ROOT - 12, KEY_ROOT, KEY_ROOT + 4, KEY_ROOT + 9, KEY_ROOT + 16]
    pad = sum(saw(note_hz(m_) * _jit(rng, 6), n, rng) for m_ in chord) / len(chord)
    pad = lp(pad, 2200) * env_adsr(n, 0.25, 0.4, 0.6, 1.2)
    boom = sine(np.geomspace(70, 40, n), n) * env_exp(n, 0.35)
    click = hp(noise(n, rng), 3000) * env_exp(n, 0.003)
    st = pan_stereo(out + pad * 0.35 + boom * 0.7 + click * 0.3, 0)
    return widen(st * vel, 0.45)


def tail(rng, vel=0.5, dur=120, **_):
    """End-card tail: a soft shimmer (A and D up high) that decays to silence by the last frame."""
    n = secs(max(0.5, dur / 30))
    shimmer = sum(a * sine(note_hz(m_) * _jit(rng, 4), n) for m_, a in ((KEY_ROOT + 19, 0.5), (KEY_ROOT + 24, 0.4), (KEY_ROOT + 31, 0.2)))
    trem = 0.8 + 0.2 * np.sin(2 * np.pi * 4 * np.arange(n) / SR)
    e = env_adsr(n, 0.08, 0.3, 0.5, n / SR * 0.7)
    x = shimmer * trem * e
    x[: secs(0.01)] += hp(noise(secs(0.01), rng), 6000) * env_exp(secs(0.01), 0.002) * 0.3
    return widen(pan_stereo(x * vel * 0.35, 0), 0.6)


LIBRARY = {
    "key": key, "tick": tick, "counter": counter, "lock": lock, "slam": slam, "impact": impact, "whoosh": whoosh,
    "wipe": wipe, "swish": swish, "tilt": tilt, "pin": pin, "snap": snap, "line": line, "icon": icon, "button": button,
    "pulse": pulse, "progress": progress, "pop": button, "message": message, "riser": riser, "sting": sting, "tail": tail,
}
# Mix levels per type (dB), so the hierarchy holds: hits and the sting on top, typing and ticks underneath.
LEVEL = {
    "slam": -1.5, "impact": -2, "sting": -2, "riser": -6, "wipe": -6, "whoosh": -8, "swish": -10, "tilt": -8, "snap": -5,
    "pin": -5, "button": -5, "pop": -8, "message": -6, "key": -9, "tick": -12, "counter": -10, "lock": -9, "line": -14,
    "icon": -15, "progress": -14, "pulse": -14, "tail": -8,
}
# Types that duck the music (hits and typing bursts).
DUCKERS = {"slam", "impact", "snap", "pin", "button", "key", "sting", "lock"}
