"""Dense review sheets: every 0.5 s QA frame of an encoded file, 30 per page (5 x 6 at 480 x 270), labelled.
usage: python qa/review_sheets.py <qa_dir> [cols] [w] [h]   → <qa_dir>/review-NN.jpg"""
import glob
import os
import sys

from PIL import Image, ImageDraw

d = sys.argv[1]
C = int(sys.argv[2]) if len(sys.argv) > 2 else 5
W = int(sys.argv[3]) if len(sys.argv) > 3 else 480
H = int(sys.argv[4]) if len(sys.argv) > 4 else 270
R = 6
fs = sorted(glob.glob(f"{d}/frames/*.jpg"))
for p in range(0, len(fs), C * R):
    page = fs[p:p + C * R]
    sh = Image.new("RGB", (C * W, R * (H + 16)), "white")
    dr = ImageDraw.Draw(sh)
    for i, f in enumerate(page):
        x, y = (i % C) * W, (i // C) * (H + 16)
        sh.paste(Image.open(f).resize((W, H)), (x, y + 16))
        dr.text((x + 4, y + 2), os.path.basename(f), fill="black")
    sh.save(f"{d}/review-{p // (C * R) + 1:02d}.jpg", quality=85)
print(d, len(fs), "frames")
