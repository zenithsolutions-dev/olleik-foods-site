"""Small DSP toolkit for the promo's in-house sound design and music. Everything is synthesised from oscillators and
seeded noise: no samples, no downloads, no third-party audio. 48 kHz, float32/float64, stereo arrays shaped (n, 2)."""
import numpy as np
from scipy import signal

SR = 48000
FPS = 30
SPF = SR // FPS  # 1600 samples per video frame


def secs(n):
    return int(round(n * SR))


def rng_for(*key):
    """Deterministic generator from any key (event index, sfx name, variant…)."""
    h = 2166136261
    for part in key:
        for ch in str(part):
            h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return np.random.default_rng(h)


def t_axis(n):
    return np.arange(n) / SR


def env_exp(n, decay_s, attack_s=0.0005):
    t = t_axis(n)
    a = np.clip(t / max(attack_s, 1e-6), 0, 1)
    return a * np.exp(-t / max(decay_s, 1e-6))


def env_adsr(n, a, d, s, r):
    """Linear-ish ADSR over n samples; r is taken from the end."""
    t = t_axis(n)
    dur = n / SR
    e = np.where(t < a, t / max(a, 1e-6), np.where(t < a + d, 1 - (1 - s) * (t - a) / max(d, 1e-6), s))
    rel = np.clip((dur - t) / max(r, 1e-6), 0, 1)
    return e * rel


def sine(freq, n, phase=0.0):
    """freq may be a scalar or an array (instantaneous frequency)."""
    f = np.broadcast_to(np.asarray(freq, dtype=np.float64), (n,))
    return np.sin(2 * np.pi * np.cumsum(f) / SR + phase)


def saw(freq, n, rng=None):
    f = np.broadcast_to(np.asarray(freq, dtype=np.float64), (n,))
    ph = np.cumsum(f) / SR + (rng.random() if rng is not None else 0)
    return 2 * (ph % 1.0) - 1


def tri(freq, n):
    f = np.broadcast_to(np.asarray(freq, dtype=np.float64), (n,))
    ph = np.cumsum(f) / SR
    return 2 * np.abs(2 * (ph % 1.0) - 1) - 1


def noise(n, rng):
    return rng.standard_normal(n)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [max(lo, 20), min(hi, SR / 2 - 100)], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def lp(x, fc, order=2):
    sos = signal.butter(order, min(fc, SR / 2 - 100), btype="low", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def hp(x, fc, order=2):
    sos = signal.butter(order, max(fc, 20), btype="high", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def sweep_filter(x, centres, q=1.2, block=256):
    """Band-pass with a moving centre frequency (array of len(x)), processed in blocks with state carried over."""
    out = np.zeros_like(x)
    zi = None
    for i in range(0, len(x), block):
        c = float(np.clip(centres[min(i + block // 2, len(x) - 1)], 60, SR / 2 - 2000))
        bw = c / q
        sos = signal.butter(2, [max(c - bw / 2, 30), c + bw / 2], btype="band", fs=SR, output="sos")
        if zi is None or zi.shape[0] != sos.shape[0]:
            zi = np.zeros((sos.shape[0], 2))
        out[i : i + block], zi = signal.sosfilt(sos, x[i : i + block], zi=zi)
    return out


def sweep_lp(x, cutoffs, block=256):
    out = np.zeros_like(x)
    zi = None
    for i in range(0, len(x), block):
        c = float(np.clip(cutoffs[min(i + block // 2, len(x) - 1)], 40, SR / 2 - 1000))
        sos = signal.butter(2, c, btype="low", fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        out[i : i + block], zi = signal.sosfilt(sos, x[i : i + block], zi=zi)
    return out


def pan_stereo(x, pan):
    """Equal-power pan; pan is a scalar or an array in −1…1."""
    p = np.broadcast_to(np.asarray(pan, dtype=np.float64), x.shape)
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)


def widen(st, amount, delay_ms=9, seed=0):
    """Subtle width: a short decorrelated side signal (mono-compatible: the side cancels in a mono sum)."""
    d = int(SR * delay_ms / 1000)
    mid = st.mean(axis=1)
    side = np.zeros_like(mid)
    side[d:] = mid[:-d] if d else mid
    side = hp(side, 300)
    out = st.copy()
    out[:, 0] += amount * side
    out[:, 1] -= amount * side
    return out


def karplus(freq, n, rng, damp=0.996, bright=0.5):
    """A short plucked string (Karplus–Strong)."""
    period = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, period)
    buf = lp(buf, 2000 + 8000 * bright)
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = damp * 0.5 * (buf[i % period] + buf[(i + 1) % period])
    return out


def note_hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def place(dst, src, at):
    """Adds src (n, 2) into dst at sample `at` (clipped to dst)."""
    if at >= len(dst):
        return
    if at < 0:
        src = src[-at:]
        at = 0
    n = min(len(src), len(dst) - at)
    dst[at : at + n] += src[:n]


def db(x):
    return 20 * np.log10(np.maximum(np.abs(x), 1e-12))


def from_db(d):
    return 10 ** (d / 20)


# ——— Loudness (ITU-R BS.1770-4) and true peak ————————————————————————————————————————————————————


def k_weight(x):
    # Pre-filter (high shelf) and RLB high-pass, coefficients for 48 kHz.
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)


def lufs(st):
    """Integrated loudness (gated), LUFS."""
    y = k_weight(st)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    if len(y) < blk:
        return -70.0
    ms = []
    for i in range(0, len(y) - blk + 1, hop):
        seg = y[i : i + blk]
        ms.append(np.sum(np.mean(seg**2, axis=0)))
    ms = np.array(ms)
    l = -0.691 + 10 * np.log10(np.maximum(ms, 1e-12))
    g = ms[l > -70]
    if not len(g):
        return -70.0
    rel = -0.691 + 10 * np.log10(np.mean(g)) - 10
    g2 = ms[(l > -70) & (l > rel)]
    return float(-0.691 + 10 * np.log10(np.mean(g2)))


def true_peak_db(st):
    up = signal.resample_poly(st, 4, 1, axis=0)
    return float(db(np.max(np.abs(up))))


def limiter(st, ceiling_db=-1.2, lookahead_ms=5, release_ms=80):
    """Look-ahead peak limiter driven by a 4x-oversampled peak estimate (keeps true peak under the ceiling)."""
    ceil = from_db(ceiling_db)
    # Inter-sample peaks: interpolate the signal itself (4x), then take |x| per original sample.
    up = np.abs(signal.resample_poly(st, 4, 1, axis=0)).max(axis=1)
    peak = up[: (len(up) // 4) * 4].reshape(-1, 4).max(axis=1)[: len(st)]
    if len(peak) < len(st):
        peak = np.pad(peak, (0, len(st) - len(peak)))
    need = np.minimum(1.0, ceil / np.maximum(peak, 1e-9))
    la = int(SR * lookahead_ms / 1000)
    # Minimum over the look-ahead window so gain is down before the peak arrives.
    from scipy.ndimage import minimum_filter1d

    g = minimum_filter1d(need, size=2 * la + 1, origin=0)
    g = np.concatenate([g[la:], np.full(la, g[-1])])
    # Smooth: instant attack, exponential release.
    rel = np.exp(-1 / (SR * release_ms / 1000))
    out = np.empty_like(g)
    cur = 1.0
    for i in range(len(g)):
        cur = g[i] if g[i] < cur else g[i] + (cur - g[i]) * rel
        out[i] = cur
    return st * out[:, None]


def write_wav(path, st):
    import soundfile as sf

    sf.write(path, np.clip(st, -1, 1).astype(np.float32), SR, subtype="PCM_24")


def low_shelf(st, fc, gain_db, q=0.707):
    """RBJ low-shelf biquad (stereo)."""
    A = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * fc / SR
    alpha = np.sin(w0) / (2 * q)
    cw = np.cos(w0)
    b = [A * ((A + 1) - (A - 1) * cw + 2 * np.sqrt(A) * alpha), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - 2 * np.sqrt(A) * alpha)]
    a = [(A + 1) + (A - 1) * cw + 2 * np.sqrt(A) * alpha, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - 2 * np.sqrt(A) * alpha]
    return signal.lfilter(np.array(b) / a[0], np.array(a) / a[0], st, axis=0)


def peaking(st, fc, gain_db, q=1.0):
    A = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * fc / SR
    al = np.sin(w0) / (2 * q)
    cw = np.cos(w0)
    b = [1 + al * A, -2 * cw, 1 - al * A]
    a = [1 + al / A, -2 * cw, 1 - al / A]
    return signal.lfilter(np.array(b) / a[0], np.array(a) / a[0], st, axis=0)


def high_shelf(st, fc, gain_db, q=0.707):
    A = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * fc / SR
    al = np.sin(w0) / (2 * q)
    cw = np.cos(w0)
    b = [A * ((A + 1) + (A - 1) * cw + 2 * np.sqrt(A) * al), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - 2 * np.sqrt(A) * al)]
    a = [(A + 1) - (A - 1) * cw + 2 * np.sqrt(A) * al, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - 2 * np.sqrt(A) * al]
    return signal.lfilter(np.array(b) / a[0], np.array(a) / a[0], st, axis=0)


def haas_widen(st, ms=12, amount=0.6):
    d = int(SR * ms / 1000)
    m = st.mean(axis=1)
    side = np.zeros_like(m)
    side[d:] = m[:-d]
    side = side - m * 0.0
    out = st.copy()
    out[:, 0] += amount * side * 0.5
    out[:, 1] -= amount * side * 0.5
    return out
