"""Contact-sheet pages for QA: 12 frames per page (4 x 3 at 640 x 360), each labelled with its file name.
usage: python qa/sheet.py <out_prefix> <png/jpg files...>   → <out_prefix>-p1.jpg, -p2.jpg, …"""
import sys

from PIL import Image, ImageDraw

out, files = sys.argv[1], sys.argv[2:]
W, H, COLS, ROWS = 640, 360, 4, 3
for p in range(0, len(files), COLS * ROWS):
    page = files[p: p + COLS * ROWS]
    sheet = Image.new("RGB", (COLS * (W + 4), ROWS * (H + 22)), "white")
    dr = ImageDraw.Draw(sheet)
    for i, f in enumerate(page):
        im = Image.open(f).convert("RGB").resize((W, H), Image.LANCZOS)
        x, y = (i % COLS) * (W + 4), (i // COLS) * (H + 22)
        sheet.paste(im, (x, y + 20))
        dr.text((x + 4, y + 4), f.replace("\\", "/").split("/")[-1], fill=(0, 0, 0))
    sheet.save(f"{out}-p{p // (COLS * ROWS) + 1}.jpg", quality=88)
    print(f"{out}-p{p // (COLS * ROWS) + 1}.jpg")
