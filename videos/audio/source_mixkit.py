"""Lists Mixkit sound-effect categories (title, id, length) and downloads chosen items as WAV into
videos/audio-library/raw/mixkit/<id>.wav, recording the source URL for LICENSES.md.
Mixkit Sound Effects Free License (read 2026-10-05, evidence in audio-library/licenses/): commercial use incl.
online marketing ads, no attribution; not to be redistributed on its own (so the raw files stay out of git).

  python audio/source_mixkit.py list keyboard whoosh
  python audio/source_mixkit.py get 2531 2535 ...
"""
import html
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.join(os.path.dirname(__file__), "..", "audio-library")
RAW = os.path.join(ROOT, "raw", "mixkit")
INDEX = os.path.join(ROOT, "raw", "mixkit-index.json")
UA = {"User-Agent": "Mozilla/5.0 (promo audio sourcing; contact znthsolutions)"}


def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()


def listing(cat, pages=2):
    out = []
    for p in range(1, pages + 1):
        url = f"https://mixkit.co/free-sound-effects/{cat}/" + (f"?page={p}" if p > 1 else "")
        try:
            t = fetch(url).decode("utf8")
        except Exception:
            break
        for m in re.finditer(r'data-audio-player-preview-url-value="https://assets\.mixkit\.co/active_storage/sfx/(\d+)/\d+-preview\.mp3"', t):
            tail = t[m.end() : m.end() + 4000]
            ti = re.search(r'item-grid-card__title">\s*(.*?)\s*</h2>', tail, flags=re.S)
            ln = re.search(r">\s*(\d+:\d\d)\s*<", tail)
            if ti:
                out.append({"id": m.group(1), "title": html.unescape(ti.group(1).strip()), "len": ln.group(1) if ln else "", "category": cat, "page": url})
    return out


def main():
    cmd, args = sys.argv[1], sys.argv[2:]
    idx = json.load(open(INDEX)) if os.path.exists(INDEX) else {}
    if cmd == "list":
        for c in args:
            for it in listing(c):
                idx.setdefault(it["id"], it)
                print(f'{it["id"]:>5}  {it["len"]:>5}  {c:<12} {it["title"]}')
        os.makedirs(os.path.dirname(INDEX), exist_ok=True)
        json.dump(idx, open(INDEX, "w"), indent=1)
    elif cmd == "get":
        os.makedirs(RAW, exist_ok=True)
        for i in args:
            url = f"https://assets.mixkit.co/active_storage/sfx/{i}/{i}.wav"
            path = os.path.join(RAW, f"{i}.wav")
            if not os.path.exists(path):
                try:
                    open(path, "wb").write(fetch(url))
                except Exception as e:
                    print(i, "FAILED", e)
                    continue
            idx.setdefault(i, {"id": i})
            idx[i]["wav"] = url
            print(i, os.path.getsize(path), idx[i].get("title", ""))
        json.dump(idx, open(INDEX, "w"), indent=1)


if __name__ == "__main__":
    main()
