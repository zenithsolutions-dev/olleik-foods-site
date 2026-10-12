"""Per-frame motion probe: mean and 99.8th-percentile |Δ| of blurred luma (σ 3 at 480×270). usage: motion_probe.py mp4 f0 f1"""
import sys
import cv2
import numpy as np
cap = cv2.VideoCapture(sys.argv[1]); a, b = int(sys.argv[2]), int(sys.argv[3])
prev = None
for i in range(b + 1):
    ok, fr = cap.read()
    if not ok: break
    g = cv2.GaussianBlur(cv2.cvtColor(cv2.resize(fr, (480, 270), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY), (0, 0), 3).astype(np.float32)
    if prev is not None and i >= a:
        d = np.abs(g - prev)
        print(i, round(float(d.mean()), 3), round(float(np.percentile(d, 99.8)), 2), round(float(d.max()), 2))
    prev = g
