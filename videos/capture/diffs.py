"""Changed regions between consecutive state captures (page CSS px), so a tap patches exactly what the app changed.
Writes public/footage/v3/diffs.json {"a>b": [{x,y,w,h}, ...]}.  usage: python capture/diffs.py"""
import json
import numpy as np
from PIL import Image
from scipy import ndimage

PAIRS = [("checkout-0", "checkout-1"), ("checkout-1", "checkout-2"), ("admin-orders", "admin-orders-new"),
         ("admin-order-new", "admin-order-confirmed"), ("admin-order-confirmed", "admin-order-prepared"),
         ("admin-order-prepared", "admin-order-completed"), ("catalog-0", "catalog-1"), ("catalog-1", "catalog-2"),
         ("catalog-2", "catalog-3"), ("p-catalog", "p-catalog-1")]
out = {}
for a, b in PAIRS:
    A = Image.open(f"public/footage/v3/{a}.png").convert("L")
    B = Image.open(f"public/footage/v3/{b}.png").convert("L")
    w, h = A.width // 3, min(A.height, B.height) // 3
    A = np.asarray(A.resize((w, A.height // 3)), float)[:h]
    B = np.asarray(B.resize((w, B.height // 3)), float)[:h]
    m = np.abs(A - B) > 18
    m = ndimage.binary_dilation(m, iterations=6)
    lab, n = ndimage.label(m)
    boxes = []
    for sl in ndimage.find_objects(lab):
        y, x = sl
        bw, bh = x.stop - x.start, y.stop - y.start
        if bw * bh < 60:
            continue
        boxes.append({"x": int(x.start), "y": int(y.start), "w": int(bw), "h": int(bh)})
    boxes.sort(key=lambda r: (r["y"], r["x"]))
    out[f"{a}>{b}"] = boxes
    print(a, ">", b, len(boxes), boxes[:6])
json.dump(out, open("public/footage/v3/diffs.json", "w"), indent=1)
