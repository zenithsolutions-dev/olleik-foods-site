"""Crops of manifest boxes from captures, side by side. usage: python qa/fcrop.py out.png name:box [name:box …]"""
import json, sys
from PIL import Image, ImageDraw
Image.MAX_IMAGE_PIXELS = None
M = json.load(open("public/footage/manifest.json"))["shots"]
out, items = sys.argv[1], sys.argv[2:]
ths = []
for it in items:
    n, b = it.split(":")
    bx = M[f"v3/f-{n}"]["boxes"][b]
    im = Image.open(f"public/footage/v3/f-{n}.png")
    c = im.crop((bx["x"] * 3 - 30, bx["y"] * 3 - 30, (bx["x"] + bx["w"]) * 3 + 30, (bx["y"] + bx["h"]) * 3 + 30))
    s = min(1, 420 / c.width, 700 / c.height)
    c = c.resize((int(c.width * s), int(c.height * s)))
    d = ImageDraw.Draw(c); d.rectangle((0, 0, c.width, 14), fill="black"); d.text((2, 1), it, fill="yellow")
    ths.append(c)
W = sum(t.width + 6 for t in ths); H = max(t.height for t in ths)
s = Image.new("RGB", (W, H), "gray"); x = 0
for t in ths: s.paste(t, (x, 0)); x += t.width + 6
s.save(out)
