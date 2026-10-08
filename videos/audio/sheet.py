"""Contact sheet of every PNG in a folder (sorted), with frame labels.  python audio/sheet.py <dir> <out.png> <cols>"""
import glob
import os
import sys

from PIL import Image, ImageDraw

d, out, cols = sys.argv[1], sys.argv[2], int(sys.argv[3])
fs = sorted(glob.glob(os.path.join(d, "*.png")))
ims = [Image.open(f).convert("RGB") for f in fs]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (w + 6), rows * (h + 28)), "white")
dr = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(zip(fs, ims)):
    x, y = (i % cols) * (w + 6), (i // cols) * (h + 28)
    sheet.paste(im, (x, y + 24))
    dr.text((x + 4, y + 6), os.path.basename(f)[:-4], fill=(0, 0, 0))
sheet.save(out)
