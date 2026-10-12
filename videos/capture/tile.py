"""Split full-page V3 captures into horizontal tiles (600 CSS px = 1800 px at 3x) so the renderer never has to decode a
40-megapixel image. Writes public/footage/v3/tiles/<name>-<i>.png and public/footage/v3/tiles.json {name: {hPx, n}}.
usage: python capture/tile.py"""
import glob, json, os
from PIL import Image
SRC = "public/footage/v3"; DST = f"{SRC}/tiles"; TILE = 1800
# Overscroll margin for the manuals (CSS px): the page's own last pixel row repeated below the page, so the camera can
# frame bottom controls above the caption band. No UI is added or changed; box positions are unchanged.
PAD = {n: 160 for n in ["cart", "checkout-0", "checkout-1", "checkout-2", "order-placed", "orders", "admin-dashboard",
                        "admin-orders", "admin-orders-new", "admin-order-new", "admin-order-confirmed", "admin-order-prepared", "admin-order-completed",
                        # Part B (full manual and episodes 2-5)
                        "portal", "search-1", "search-2", "leads-0", "leads-1", "cust-new-0", "cust-new-1", "customers", "categories",
                        "assign", "pricing", "cust-detail-0", "cust-detail-2", "admin-login", "low-stock", "offers", "account",
                        # V3.2 voiced manuals (documents with demo business details, the order page)
                        "order-detail", "doc-invoice", "doc-admin-invoice", "doc-low-stock", "doc-out-of-stock", "doc-reports",
                        "products-0", "analytics", "cust-prices", "cust-detail-1", "home", "apply-2", "login-0", "login-1", "apply-0", "apply-1",
                        "doc-statement", "doc-admin-statement", "doc-products"]}
os.makedirs(DST, exist_ok=True)
meta = {}
for f in sorted(glob.glob(f"{SRC}/*.png")):
    n = os.path.basename(f)[:-4]
    im = Image.open(f)
    pad = PAD.get(n, 0) * 3
    if pad:
        ext = Image.new(im.mode, (im.width, im.height + pad))
        ext.paste(im, (0, 0))
        ext.paste(im.crop((0, im.height - 1, im.width, im.height)).resize((im.width, pad)), (0, im.height))
        im = ext
    k = (im.height + TILE - 1) // TILE
    for i in range(k):
        im.crop((0, i * TILE, im.width, min(im.height, (i + 1) * TILE))).save(f"{DST}/{n}-{i}.png", optimize=False, compress_level=3)
    meta[n] = {"wPx": im.width, "hPx": im.height, "n": k, "padCss": PAD.get(n, 0)}
json.dump(meta, open(f"{SRC}/tiles.json", "w"), indent=1)
print(json.dumps(meta))
