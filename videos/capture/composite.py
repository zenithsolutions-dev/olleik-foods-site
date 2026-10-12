"""Composite the REAL UI into a green-screen phone or monitor in a generated live-action clip (V3, Gate F).

Per frame: chroma-key the screen (the key mask also keeps fingers/thumbs that pass over the screen in front of the UI),
fit the screen's 4 corners (convex hull -> 4-point polygon, temporally smoothed), perspective-warp the UI frame into
them, add a faint screen glow, and suppress green spill on the hand edges. The UI frame for each clip frame comes from a
schedule of real captures (crop of a page at a scroll offset, switching state at given frames).

usage: python capture/composite.py <job.json>
job: {"clip": "...mp4", "out": "...mp4", "ui": [{"from": 0, "file": "public/footage/v3/p-catalog.png", "crop": [x, y, w, h]}, ...],
      "quads": "out.json", "fps": 24}
Crops are in capture pixels (3x). Writes the composited MP4 (H.264, CRF 14) and the per-frame screen corners (JSON).
"""
import json
import subprocess
import sys

import cv2
import numpy as np

job = json.load(open(sys.argv[1]))
cap = cv2.VideoCapture(job["clip"])
W, H = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
frames = []
while True:
    ok, fr = cap.read()
    if not ok:
        break
    frames.append(fr)
n = len(frames)


def key_mask(fr):
    hsv = cv2.cvtColor(fr, cv2.COLOR_BGR2HSV)  # OpenCV hue 0-180: green ~ 35-90
    h, s_, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    m = ((h >= 38) & (h <= 92) & (s_ >= 85) & (v >= 40)).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    return m


def order(pts):
    pts = np.array(pts, np.float32)
    s, d = pts.sum(1), np.diff(pts, axis=1).ravel()
    return np.array([pts[np.argmin(s)], pts[np.argmin(d)], pts[np.argmax(s)], pts[np.argmax(d)]], np.float32)  # tl, tr, br, bl


def quad_of(m):
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return None
    hull = cv2.convexHull(max(cnts, key=cv2.contourArea))
    peri = cv2.arcLength(hull, True)
    for eps in np.linspace(0.01, 0.08, 30):
        ap = cv2.approxPolyDP(hull, eps * peri, True)
        if len(ap) == 4:
            return order(ap.reshape(4, 2))
    rect = cv2.boxPoints(cv2.minAreaRect(hull))
    return order(rect)


masks = [key_mask(f) for f in frames]
# Planar tracking: the screen outline from the least-occluded frame, then an ECC homography per frame on the (blurred)
# key mask, chained from the previous frame. Fingers over the screen barely move the global fit.
ref = int(np.argmax([int((m > 0).sum()) for m in masks]))
q_ref = quad_of(masks[ref])
blur = lambda m: cv2.GaussianBlur(m, (0, 0), 6).astype(np.float32) / 255.0  # noqa: E731
small = 0.5
def ecc(src, dst, init):
    a = cv2.resize(blur(src), None, fx=small, fy=small)
    b = cv2.resize(blur(dst), None, fx=small, fy=small)
    S = np.diag([small, small, 1.0]).astype(np.float32)
    w = (S @ init @ np.linalg.inv(S)).astype(np.float32)
    try:
        _, w = cv2.findTransformECC(a, b, w, cv2.MOTION_HOMOGRAPHY, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 80, 1e-5), None, 5)
    except cv2.error:
        pass
    return (np.linalg.inv(S) @ w @ S).astype(np.float32)
# 1) SIFT features in a ring around the reference screen (bezel, edges, the holding hand), matched to each frame
#    independently (no chained drift), RANSAC homography; 2) one ECC refinement on the key mask from that start.
sift = cv2.SIFT_create(nfeatures=4000)
scr = np.zeros(masks[ref].shape, np.uint8)
cv2.fillConvexPoly(scr, q_ref.astype(np.int32), 255)
ring = cv2.subtract(cv2.dilate(scr, np.ones((121, 121), np.uint8)), cv2.erode(scr, np.ones((31, 31), np.uint8)))
gray = lambda fr: cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY)  # noqa: E731
k_ref, d_ref = sift.detectAndCompute(gray(frames[ref]), ring)
bf = cv2.BFMatcher()
Hs = [None] * n
prev = np.eye(3, dtype=np.float32)
order_idx = list(range(ref, n)) + list(range(ref - 1, -1, -1))
for i in order_idx:
    if i == ref - 1:
        prev = np.eye(3, dtype=np.float32)
    zone = cv2.dilate(cv2.warpPerspective(ring, prev, ring.shape[::-1]), np.ones((61, 61), np.uint8))
    k_i, d_i = sift.detectAndCompute(gray(frames[i]), zone)
    Hf = None
    if d_i is not None and len(k_i) > 12:
        good = [m for m, m2 in bf.knnMatch(d_ref, d_i, k=2) if m.distance < 0.75 * m2.distance]
        if len(good) >= 12:
            src = np.float32([k_ref[m.queryIdx].pt for m in good])
            dst = np.float32([k_i[m.trainIdx].pt for m in good])
            Hf, inl = cv2.findHomography(src, dst, cv2.RANSAC, 3.0)
    if Hf is None:
        Hf = prev
    Hs[i] = ecc(masks[ref], masks[i], Hf.astype(np.float32))
    # reject a refinement that jumps far from the feature estimate
    if np.abs(cv2.perspectiveTransform(q_ref[None], Hs[i])[0] - cv2.perspectiveTransform(q_ref[None], Hf.astype(np.float32))[0]).max() > 25:
        Hs[i] = Hf.astype(np.float32)
    prev = Hs[i]
# findTransformECC: warpPerspective(input, W, WARP_INVERSE_MAP) aligns the input to the template, i.e. aligned(x) =
# input(W x) = template(x), so a point p of the reference frame sits at W p in frame i
Q = np.stack([cv2.perspectiveTransform(q_ref[None], Hm)[0] for Hm in Hs])
Qs = np.stack([Q[max(0, i - 1): i + 2].mean(axis=0) for i in range(n)])

ui_cache = {}


def ui_for(i):
    seg = [u for u in job["ui"] if u["from"] <= i][-1]
    key = (seg["file"], tuple(seg["crop"]))
    if key not in ui_cache:
        img = cv2.imread(seg["file"], cv2.IMREAD_COLOR)
        x, y, w, h = seg["crop"]
        ui_cache[key] = img[y: y + h, x: x + w]
    return ui_cache[key]


ffmpeg = subprocess.Popen(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(job.get("fps", 24)), "-i", "-",
                           "-c:v", "libx264", "-crf", "14", "-preset", "slow", "-pix_fmt", "yuv420p", job["out"]], stdin=subprocess.PIPE)
for i, fr in enumerate(frames):
    ui = ui_for(i)
    h, w = ui.shape[:2]
    q = Qs[i]
    # warp slightly LARGER than the fitted screen (thumbs over the edge pull the fitted corners inwards); the key mask
    # decides which pixels are replaced, so the bezel and the fingers stay the clip's own
    c = q.mean(axis=0)
    qi = c + (q - c) * job.get("grow", 1.1)
    M = cv2.getPerspectiveTransform(np.float32([[0, 0], [w, 0], [w, h], [0, h]]), qi.astype(np.float32))
    warped = cv2.warpPerspective(ui, M, (W, H), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_CONSTANT)
    screen = np.zeros((H, W), np.uint8)
    cv2.fillConvexPoly(screen, qi.astype(np.int32), 255)
    # the UI shows where the screen is AND the key says "green" (fingers in front stay in front)
    m = cv2.bitwise_and(screen, cv2.dilate(masks[i], np.ones((5, 5), np.uint8)))
    m = cv2.GaussianBlur(m, (3, 3), 0).astype(np.float32)[..., None] / 255.0
    lit = cv2.addWeighted(warped, 0.94, np.full_like(warped, 255), 0.06, 0)  # screens glow a little
    out = (fr * (1 - m) + lit * m).astype(np.uint8)
    # green spill on hand edges near the screen
    ring = cv2.dilate(screen, np.ones((41, 41), np.uint8)) > 0
    o = out.astype(np.int16)
    g = np.minimum(o[..., 1], np.maximum(o[..., 0], o[..., 2]) + 12)
    o[..., 1] = np.where(ring & (m[..., 0] < 0.5), g, o[..., 1])
    ffmpeg.stdin.write(np.clip(o, 0, 255).astype(np.uint8).tobytes())
ffmpeg.stdin.close()
ffmpeg.wait()
json.dump({"size": [W, H], "quads": Qs.round(1).tolist(), "green_area": [int((m_ > 0).sum()) for m_ in masks]}, open(job["quads"], "w"))
print(job["out"], n, "frames")
