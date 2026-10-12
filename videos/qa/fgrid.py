"""A capture region with a CSS-px grid (every 100 px, labelled) for reading camera targets.
usage: python qa/fgrid.py out.png name y0 y1 [width_px]"""
import sys
from PIL import Image, ImageDraw
Image.MAX_IMAGE_PIXELS = None
out, name, y0, y1 = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
W = int(sys.argv[5]) if len(sys.argv) > 5 else 900
im = Image.open(f"public/footage/v3/f-{name}.png").convert("RGB")
css_w = im.width / 3
c = im.crop((0, y0 * 3, im.width, min(im.height, y1 * 3)))
k = W / c.width
c = c.resize((W, int(c.height * k)))
d = ImageDraw.Draw(c)
s = 3 * k  # output px per CSS px
for x in range(0, int(css_w) + 1, 100):
    d.line([(x * s, 0), (x * s, c.height)], fill=(255, 0, 0), width=1)
    d.text((x * s + 2, 2), str(x), fill=(255, 0, 0))
for y in range((y0 // 100 + 1) * 100, y1, 100):
    d.line([(0, (y - y0) * s), (c.width, (y - y0) * s)], fill=(0, 0, 255), width=1)
    d.text((2, (y - y0) * s + 2), str(y), fill=(0, 0, 255))
c.save(out)
