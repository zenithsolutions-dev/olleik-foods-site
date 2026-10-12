"""Contact sheet of capture tops for a visual check. usage: python qa/fsheet.py out.png name [name …] (names without f-; '@y' = crop from CSS y)"""
import sys
from PIL import Image, ImageDraw
Image.MAX_IMAGE_PIXELS = None
out, names = sys.argv[1], sys.argv[2:]
th = []
for n in names:
    n, _, y = n.partition("@")
    im = Image.open(f"public/footage/v3/f-{n}.png")
    y = int(y or 0) * 3
    ph = im.width < 2000
    c = im.crop((0, y, im.width, min(im.height, y + (2700 if ph else 2700))))
    w = 260 if ph else 600
    c = c.resize((w, int(c.height * w / c.width)))
    d = ImageDraw.Draw(c); d.rectangle((0, 0, w, 16), fill="black"); d.text((3, 2), n, fill="yellow")
    th.append(c)
W = 1900
rows, row, x = [], [], 0
for t in th:
    if x + t.width > W: rows.append(row); row, x = [], 0
    row.append(t); x += t.width + 6
rows.append(row)
H = sum(max(t.height for t in r) + 6 for r in rows)
s = Image.new("RGB", (W, H), "gray")
y = 0
for r in rows:
    x = 0
    for t in r: s.paste(t, (x, y)); x += t.width + 6
    y += max(t.height for t in r) + 6
s.save(out)
