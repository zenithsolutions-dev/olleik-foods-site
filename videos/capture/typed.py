"""Typed-text extents for the typing reveal (World.tsx wipes): for each field box of the AFTER capture, the bounding box
of the typed text (dark pixels inside the field, border excluded), the field's inner box and its flat background colour.
usage: python capture/typed.py <after-capture> <field> [<field> …]   (fields from the manifest)"""
import json, sys
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
name, fields = sys.argv[1], sys.argv[2:]
boxes = json.load(open("public/footage/manifest.json"))["shots"][f"v3/{name}"]["boxes"]
im = np.asarray(Image.open(f"public/footage/v3/{name}.png").convert("RGB")).astype(int)
out = {}
for f in fields:
    b = boxes[f]
    x0, y0, x1, y1 = [int(round(v * 3)) for v in (b["x"] + 3, b["y"] + 3, b["x"] + b["w"] - 3, b["y"] + b["h"] - 3)]
    reg = im[y0:y1, x0:x1]
    vals, counts = np.unique(reg.reshape(-1, 3), axis=0, return_counts=True)
    bg = vals[np.argmax(counts)]
    dark = np.abs(reg - bg).sum(2) > 120
    ys, xs = np.nonzero(dark)
    if not len(xs):
        out[f] = None
        continue
    tx0, tx1, ty0, ty1 = (x0 + xs.min()) / 3 - 1, (x0 + xs.max()) / 3 + 2, (y0 + ys.min()) / 3 - 1, (y0 + ys.max()) / 3 + 2
    out[f] = {"typed": {"x": round(tx0, 1), "y": round(ty0, 1), "w": round(tx1 - tx0, 1), "h": round(ty1 - ty0, 1)},
              "field": {"x": b["x"] + 2, "y": b["y"] + 2, "w": b["w"] - 4, "h": b["h"] - 4}, "bg": "#%02x%02x%02x" % tuple(bg)}
print(json.dumps(out))
