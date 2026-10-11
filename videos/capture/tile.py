"""Split full-page V3 captures into horizontal tiles (600 CSS px = 1800 px at 3x) so the renderer never has to decode a
40-megapixel image. Writes public/footage/v3/tiles/<name>-<i>.png and public/footage/v3/tiles.json {name: {hPx, n}}.
usage: python capture/tile.py"""
import glob, json, os
from PIL import Image
SRC = "public/footage/v3"; DST = f"{SRC}/tiles"; TILE = 1800
os.makedirs(DST, exist_ok=True)
meta = {}
for f in sorted(glob.glob(f"{SRC}/*.png")):
    n = os.path.basename(f)[:-4]
    im = Image.open(f)
    k = (im.height + TILE - 1) // TILE
    for i in range(k):
        im.crop((0, i * TILE, im.width, min(im.height, (i + 1) * TILE))).save(f"{DST}/{n}-{i}.png", optimize=False, compress_level=3)
    meta[n] = {"wPx": im.width, "hPx": im.height, "n": k}
json.dump(meta, open(f"{SRC}/tiles.json", "w"), indent=1)
print(json.dumps(meta))
