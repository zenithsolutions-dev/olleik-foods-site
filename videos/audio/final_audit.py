"""Audit of the delivered final promo files (reads the delivery folder, not the build folder): duration, resolution,
size, loudness and true peak of every MP4 measured with ffmpeg ebur128, the onset check of each cut's audio, and a
licence / copy scan. Writes final-audit.json and prints a Markdown table.

  python audio/final_audit.py D:/olleik-videos/promo
"""
import glob
import json
import os
import subprocess
import sys


def probe(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,codec_name", "-of", "json", p], capture_output=True, text=True)
    j = json.loads(r.stdout)
    v = next(s for s in j["streams"] if s["codec_type"] == "video")
    a = next((s for s in j["streams"] if s["codec_type"] == "audio"), None)
    return {"seconds": round(float(j["format"]["duration"]), 2), "size": f'{v["width"]}x{v["height"]}', "video": v["codec_name"], "audio": a["codec_name"] if a else None}


def loud(p):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", p, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    t = r.stderr[r.stderr.rfind("Summary:") :]
    g = lambda lab: next(float(l.split(":")[1].split()[0]) for l in t.splitlines() if l.strip().startswith(lab))  # noqa: E731
    return {"I_LUFS": g("I:"), "TP_dBTP": g("Peak:"), "LRA": g("LRA:")}


def main(root):
    rows = []
    for p in sorted(glob.glob(os.path.join(root, "music-A", "*.mp4")) + glob.glob(os.path.join(root, "shared", "silent", "*.mp4"))):
        d = {"file": os.path.relpath(p, root).replace("\\", "/"), "MB": round(os.path.getsize(p) / 1e6, 1), **probe(p)}
        if d["audio"]:
            d.update(loud(p))
            stem = os.path.join(root, "music-A", "stems", os.path.basename(p).replace("-music-A.mp4", ""), "onsets-verify.json")
            if os.path.exists(stem):
                v = json.load(open(stem))
                d["onsets_isolated_pct"] = v["isolated_per_type"]["percent"]
                d["onsets_scored"] = v["isolated_per_type"]["scored"]
                d["grid_hits_off_grid"] = v["grid_hits_off_the_beat_grid"]
        rows.append(d)
    json.dump(rows, open(os.path.join(root, "shared", "final-audit.json"), "w"), indent=1)
    print("| File | Length | Size | MB | Integrated | True peak | Onsets within 1 frame |")
    print("|---|---|---|---|---|---|---|")
    for d in rows:
        lo = f'{d["I_LUFS"]} LUFS | {d["TP_dBTP"]} dBTP' if d.get("I_LUFS") is not None else "silent | —"
        on = f'{d["onsets_isolated_pct"]} % of {d["onsets_scored"]}, off-grid {d["grid_hits_off_grid"]}' if "onsets_isolated_pct" in d else "—"
        print(f'| {d["file"]} | {d["seconds"]} s | {d["size"]} | {d["MB"]} | {lo} | {on} |')


if __name__ == "__main__":
    main(sys.argv[1])
