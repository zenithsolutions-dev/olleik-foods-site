"""Stitch vertical chunks of a tall full-page capture (Chrome garbles single screenshots taller than ~16k px).
usage: python capture/stitch.py <out.png> <part0.png> <part1.png> …   (parts are deleted after stitching)"""
import os, sys
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
out, parts = sys.argv[1], sys.argv[2:]
ims = [Image.open(p) for p in parts]
im = Image.new("RGB", (ims[0].width, sum(i.height for i in ims)))
y = 0
for i in ims:
    im.paste(i.convert("RGB"), (0, y))
    y += i.height
im.save(out, compress_level=3)
for i, p in zip(ims, parts):
    i.close()
    os.remove(p)
