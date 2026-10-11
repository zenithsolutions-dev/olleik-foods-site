"""Composite the REAL UI into a green-screen phone or monitor of a generated live-action clip (Gate F V3.1).

Owner notes V3.1 §4: UI sharp at the delivered size, a true perspective fit to the real screen rectangle, header fully
visible, no spill, no drift. Method:
  1. Soft difference key (g - max(r, b)) at 2x: an alpha matte, not a binary mask, so thumbs and bezel edges stay clean.
  2. Screen corners per frame from the screen's EDGES: points of the green region's outline are split by side (against
     the reference quad), each side is fitted with a robust line (rounded corners and any finger over an edge are
     dropped as outliers), and adjacent lines are intersected. No overscan: the UI maps onto the true screen rectangle.
  3. A frame whose fit disagrees with its neighbours (a thumb over a whole edge) falls back to the median of its
     neighbours; corners are then smoothed with a small Gaussian (generated clips have sub-pixel jitter).
  4. The UI (a real capture at 3x) is resized with area filtering to the screen's size at 2x, warped with bicubic
     filtering into the 2x frame, composited under the matte, then the whole frame is downsampled to 1x (INTER_AREA).
  5. Green spill on the bezel and fingers is pulled to the red/blue average within a few pixels of the screen; dark
     specks inside the green that do not reach the screen's edge (a generated camera hole) count as screen.
The UI keeps its own aspect: the crop height is the crop width / the screen's aspect, never stretched.

usage: python capture/composite2.py <job.json>
job: {"clip", "out", "out2x"?, "fps": 24, "quads", "ui": [{"from": frame, "file": png, "x": px, "y": px, "w": px}],
      "top_inset": 0.0 (fraction of the screen height filled with the page's top colour, e.g. a phone's status bar),
      "glow": 0.04, "trim": [first, last]?}
"""
import json
import subprocess
import sys

import cv2
import numpy as np

job = json.load(open(sys.argv[1]))
cap = cv2.VideoCapture(job["clip"])
frames = []
while True:
    ok, fr = cap.read()
    if not ok:
        break
    frames.append(fr)
if "trim" in job:
    frames = frames[job["trim"][0]: job["trim"][1]]
n = len(frames)
H1, W1 = frames[0].shape[:2]
S = 2  # composite scale


def matte(fr):
    """Soft key: 0 = keep the clip, 1 = screen. Difference key on float BGR."""
    f = fr.astype(np.float32)
    d = f[..., 1] - np.maximum(f[..., 0], f[..., 2])
    return np.clip((d - 40) / 70, 0, 1)


def hard(fr):
    return (matte(fr) > 0.5).astype(np.uint8) * 255


def order(pts):
    pts = np.array(pts, np.float32)
    s, d = pts.sum(1), np.diff(pts, axis=1).ravel()
    return np.array([pts[np.argmin(s)], pts[np.argmin(d)], pts[np.argmax(s)], pts[np.argmax(d)]], np.float32)


def outline(m):
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not cnts:
        return None
    return max(cnts, key=cv2.contourArea).reshape(-1, 2).astype(np.float32)


def quad_from_hull(c):
    hull = cv2.convexHull(c)
    peri = cv2.arcLength(hull, True)
    for eps in np.linspace(0.01, 0.1, 40):
        ap = cv2.approxPolyDP(hull, eps * peri, True)
        if len(ap) == 4:
            return order(ap.reshape(4, 2))
    return order(cv2.boxPoints(cv2.minAreaRect(hull)))


def line_fit(pts):
    """Robust line through pts: RANSAC on pairs, then least squares on inliers. Returns (point, unit direction)."""
    if len(pts) < 20:
        return None
    rng = np.random.default_rng(1)
    best, bi = None, -1
    for _ in range(200):
        a, b = pts[rng.choice(len(pts), 2, replace=False)]
        v = b - a
        L = np.hypot(*v)
        if L < 10:
            continue
        nrm = np.array([-v[1], v[0]]) / L
        inl = np.abs((pts - a) @ nrm) < 1.5
        if inl.sum() > bi:
            bi, best = inl.sum(), inl
    p = pts[best]
    vx, vy, x0, y0 = cv2.fitLine(p, cv2.DIST_L2, 0, 0.01, 0.01).ravel()
    return np.array([x0, y0]), np.array([vx, vy]), bi / len(pts)


def intersect(l1, l2):
    (p, r), (q, s) = (l1[0], l1[1]), (l2[0], l2[1])
    A = np.array([r, -s]).T
    t = np.linalg.solve(A, q - p)
    return p + t[0] * r


def fit_quad(c, ref):
    """Corners from the four edges of outline c, sides assigned by distance to the sides of quad ref."""
    sides = [(ref[i], ref[(i + 1) % 4]) for i in range(4)]
    lines = []
    for a, b in sides:
        v = b - a
        L = np.hypot(*v)
        u = v / L
        nrm = np.array([-u[1], u[0]])
        t = (c - a) @ u
        dist = np.abs((c - a) @ nrm)
        # points along the middle 76% of the side (skip the rounded corners), within 12 px of the reference side
        sel = (t > 0.12 * L) & (t < 0.88 * L) & (dist < 12)
        f = line_fit(c[sel])
        if f is None or f[2] < 0.5:
            return None
        lines.append(f)
    q = np.array([intersect(lines[(i - 1) % 4], lines[i]) for i in range(4)], np.float32)
    return q


masks = [hard(f) for f in frames]
ref_i = job.get("ref", int(np.argmax([int((m > 0).sum()) for m in masks])))
q0 = quad_from_hull(outline(masks[ref_i]))
q0 = fit_quad(outline(masks[ref_i]), q0)
Q = []
prev = q0
for i in range(n):
    c = outline(masks[i])
    q = fit_quad(c, prev) if c is not None else None
    if q is None or np.abs(q - prev).max() > 30:
        q = None
    Q.append(q)
    if q is not None:
        prev = q
# fill gaps / reject outliers against a running median, then smooth
Qa = np.array([q if q is not None else np.full((4, 2), np.nan, np.float32) for q in Q])
for i in range(n):
    lo, hi = max(0, i - 3), min(n, i + 4)
    med = np.nanmedian(Qa[lo:hi], axis=0)
    if np.isnan(Qa[i]).any() or np.abs(Qa[i] - med).max() > 3.0:
        Qa[i] = med
k = np.exp(-0.5 * (np.arange(-4, 5) / 1.6) ** 2)
k /= k.sum()
Qs = np.stack([sum(k[j] * Qa[min(n - 1, max(0, i + j - 4))] for j in range(9)) for i in range(n)])
fallbacks = sum(1 for q in Q if q is None)

# the screen's own aspect (frontal shot): mean width / mean height of the fitted quad
qw = (np.hypot(*(Qs[:, 1] - Qs[:, 0]).T) + np.hypot(*(Qs[:, 2] - Qs[:, 3]).T)).mean() / 2
qh = (np.hypot(*(Qs[:, 3] - Qs[:, 0]).T) + np.hypot(*(Qs[:, 2] - Qs[:, 1]).T)).mean() / 2
aspect = qw / qh
inset = job.get("top_inset", 0.0)

cache = {}


def ui_for(i):
    seg = [u for u in job["ui"] if u["from"] <= i][-1]
    key = (seg["file"], seg["x"], seg["y"], seg["w"])
    if key not in cache:
        img = cv2.imread(seg["file"], cv2.IMREAD_COLOR)
        w = seg["w"]
        h_ui = int(round(w / aspect * (1 - inset)))
        crop = img[seg["y"]: seg["y"] + h_ui, seg["x"]: seg["x"] + w]
        assert crop.shape[0] == h_ui and crop.shape[1] == w, f"capture too small for the screen's aspect: {crop.shape} vs {h_ui}x{w}"
        if inset > 0:  # status-bar strip in the page's own top colour
            top = np.zeros((int(round(w / aspect)) - h_ui, w, 3), np.uint8)
            top[:] = img[2, 2]
            crop = np.vstack([top, crop])
        # pre-filter with area resampling to the screen's size at 2x (the warp then only resamples locally)
        tw, th = int(round(qw * S)), int(round(qh * S))
        cache[key] = cv2.resize(crop, (tw, th), interpolation=cv2.INTER_AREA)
    return cache[key]


out1 = subprocess.Popen(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W1}x{H1}", "-r", str(job.get("fps", 24)), "-i", "-",
                         "-c:v", "libx264", "-crf", "12", "-preset", "slow", "-pix_fmt", "yuv420p", job["out"]], stdin=subprocess.PIPE)
out2 = None
if job.get("out2x"):
    out2 = subprocess.Popen(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W1 * S}x{H1 * S}", "-r", str(job.get("fps", 24)), "-i", "-",
                             "-c:v", "libx264", "-crf", "14", "-preset", "medium", "-pix_fmt", "yuv420p", job["out2x"]], stdin=subprocess.PIPE)
glow = job.get("glow", 0.04)
for i, fr in enumerate(frames):
    big = cv2.resize(fr, (W1 * S, H1 * S), interpolation=cv2.INTER_LANCZOS4)
    a = matte(big)
    # only inside the fitted screen (plus 2 px): green elsewhere in the shot is never replaced
    scr = np.zeros(a.shape, np.uint8)
    cv2.fillConvexPoly(scr, (Qs[i] * S).round().astype(np.int32), 255)
    scr = cv2.dilate(scr, np.ones((5, 5), np.uint8))
    a = a * (scr > 0)
    # dark specks the generator left INSIDE the green (a camera hole, a stray glyph) are screen, not foreground: only
    # non-green regions that reach the screen's edge (fingers, thumbs, the bezel's rounded corners) stay in front
    if job.get("fill_islands", True):
        ring = cv2.subtract(scr, cv2.erode(scr, np.ones((7, 7), np.uint8)))
        fg = ((a < 0.97) & (scr > 0)).astype(np.uint8)  # the speck's soft edge too, or a faint ring stays
        nl, lab = cv2.connectedComponents(fg, connectivity=8)
        if nl > 1:
            touch = np.unique(lab[(ring > 0) & (fg > 0)])
            island = (lab > 0) & ~np.isin(lab, touch)
            a = np.where(island, 1.0, a)
    a = cv2.GaussianBlur(a, (3, 3), 0)[..., None]
    ui = ui_for(i)
    h, w = ui.shape[:2]
    M = cv2.getPerspectiveTransform(np.float32([[0, 0], [w, 0], [w, h], [0, h]]), (Qs[i] * S).astype(np.float32))
    warped = cv2.warpPerspective(ui, M, (W1 * S, H1 * S), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE).astype(np.float32)
    lit = warped * (1 - glow) + 255 * glow
    comp = big.astype(np.float32) * (1 - a) + lit * a
    # spill: within a few pixels of the screen (thumb and bezel edges), pull green down to the red/blue average
    # (skin keeps its tone: its green is already below that average; a green-tinted fringe is not)
    zone = (cv2.dilate((a[..., 0] > 0.02).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0) & (a[..., 0] < 0.98)
    g = np.minimum(comp[..., 1], (comp[..., 0] + comp[..., 2]) / 2 + 3)
    comp[..., 1] = np.where(zone, g, comp[..., 1])
    comp = np.clip(comp, 0, 255).astype(np.uint8)
    if out2:
        out2.stdin.write(comp.tobytes())
    out1.stdin.write(cv2.resize(comp, (W1, H1), interpolation=cv2.INTER_AREA).tobytes())
for p in (out1, out2):
    if p:
        p.stdin.close()
        p.wait()
json.dump({"size": [W1, H1], "aspect": round(float(aspect), 4), "fallbacks": fallbacks, "quads": Qs.round(2).tolist()}, open(job["quads"], "w"))
print(job["out"], n, "frames; aspect", round(float(aspect), 4), "; fallback frames", fallbacks)
