"""Typed-text extents for the FULL film's typing reveals (same method as capture/typed.py): for each (after capture,
field) pair, the typed text's box, the field's inner box and its flat background colour.
Writes public/footage/v3/typed-full.json {"<cap>.<field>": {typed, field, bg}}.
usage: python capture/typed_full.py"""
import json

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
PAIRS = {
    "c-apply1": ["businessName", "contactName", "email", "phone", "address", "notes"],
    "c-setpw1": ["pw", "pw2"],
    "c-search1": ["search"],
    "c-ck1": ["notes"],
    "a-offer1": ["title"],
    "a-recv1": ["qty"],
    "a-np1": ["sku", "name"],
    "a-hide0": ["hide"],
    "a-assign1": ["searchP", "searchC"],
    "c-reset1": ["email"],
    "a-price1": ["priceInput"],
}
# fields without a manifest box, read off the capture with qa/fgrid.py (CSS px)
MANUAL = {"a-price1": {"priceInput": {"x": 1038, "y": 1780, "w": 96, "h": 32}}}
M = json.load(open("public/footage/manifest.json"))["shots"]
out = {}
for cap, fields in PAIRS.items():
    boxes = {**M[f"v3/f-{cap}"]["boxes"], **MANUAL.get(cap, {})}
    im = np.asarray(Image.open(f"public/footage/v3/f-{cap}.png").convert("RGB")).astype(int)
    for f in fields:
        b = boxes.get(f)
        if not b:
            out[f"{cap}.{f}"] = None
            print("missing box", cap, f)
            continue
        x0, y0, x1, y1 = [int(round(v * 3)) for v in (b["x"] + 3, b["y"] + 3, b["x"] + b["w"] - 3, b["y"] + b["h"] - 3)]
        reg = im[y0:y1, x0:x1]
        vals, counts = np.unique(reg.reshape(-1, 3), axis=0, return_counts=True)
        bg = vals[np.argmax(counts)]
        dark = np.abs(reg - bg).sum(2) > 120
        ys, xs = np.nonzero(dark)
        if not len(xs):
            out[f"{cap}.{f}"] = None
            print("no typed text", cap, f)
            continue
        tx0, tx1, ty0, ty1 = (x0 + xs.min()) / 3 - 1, (x0 + xs.max()) / 3 + 2, (y0 + ys.min()) / 3 - 1, (y0 + ys.max()) / 3 + 2
        out[f"{cap}.{f}"] = {"typed": {"x": round(tx0, 1), "y": round(ty0, 1), "w": round(tx1 - tx0, 1), "h": round(ty1 - ty0, 1)},
                             "field": {"x": b["x"] + 2, "y": b["y"] + 2, "w": b["w"] - 4, "h": b["h"] - 4}, "bg": "#%02x%02x%02x" % tuple(bg)}
json.dump(out, open("public/footage/v3/typed-full.json", "w"), indent=1)
print(len([v for v in out.values() if v]), "typed boxes")
