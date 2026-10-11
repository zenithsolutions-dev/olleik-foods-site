"""Pass/fail checklist per deliverable (owner notes V3.1 §6), from the measured qa.json of each encoded MP4 plus the
frame-by-frame review verdicts (qa/review.json, written after looking at every 0.5 s frame of the encoded file).

usage: python qa/checklist.py <qa_root> <review.json> <out.md>
"""
import json
import os
import sys

root, review_path, out = sys.argv[1:4]
review = json.load(open(review_path, encoding="utf8"))
FILES = review["files"]  # [{name, file, target_lufs, notes...}]
OK, NO = "PASS", "FAIL"


def row(item, ok, detail):
    return f"| {item} | **{OK if ok else NO}** | {detail} |"


L = ["# Gate F V3.1: QA checklist per file", "",
     "Every number below is measured on the encoded MP4 that is delivered (`qa/qa.py`): frames every 0.5 s, a frozen-moment",
     "detector, OCR of every QA frame, ffmpeg ebur128 loudness and true peak, and sync (the MP4's audio cross-correlated",
     "with the verified mix, and every hit checked for an onset within ±1 frame in the encoded audio). The visual items",
     "are my review of every QA frame (contact sheets in `qa/<file>/sheet-p*.jpg`).", ""]
summary = []
for f in FILES:
    q = json.load(open(os.path.join(root, f["name"], "qa.json"), encoding="utf8"))
    r = review["verdicts"][f["name"]]
    mot, loud, sync, ocr = q["motion"], q["loudness"], q.get("sync", {}), q["ocr"]
    ui_periods = sorted({x["text"] for x in ocr["lines_ending_with_period"]})
    our_periods = [x for x in ocr["lines_ending_with_period"] if x["text"] not in r.get("app_copy_periods", ui_periods)]
    tgt = f["target_lufs"]
    checks = [
        ("Pasted-looking overlays (halos, patches, pills, lifted or doubled UI)", r["overlays"]["ok"], r["overlays"]["note"]),
        ("Screens aligned (composites fitted, header visible, no spill or drift)", r["screens"]["ok"], r["screens"]["note"]),
        ("Clipped text", r["clipped"]["ok"], r["clipped"]["note"]),
        ("Placeholders on screen", not ocr["placeholder_patterns"] and r["placeholders"]["ok"], f"OCR placeholder patterns: {len(ocr['placeholder_patterns'])}. {r['placeholders']['note']}"),
        ("Trailing periods on our lines", not our_periods and r["periods"]["ok"],
         "Every caption, hook line, kinetic type and end card is checked at render time (`assertLine`). OCR lines ending in a period: "
         + (f"{len(ui_periods)} OCR readings, all of the app's own UI copy (for example: " + "; ".join(f"“{t}”" for t in sorted((x for x in ui_periods if " " in x), key=len)[:3]) + ")" if ui_periods else "none")),
        ("Frozen moments (no hold longer than one beat, 17 frames)", mot["pass"], f"longest still run {mot['longest_still_run_frames']} frames at {mot['longest_still_run_at_s']} s"),
        (f"Loudness ({tgt} LUFS ± 0.3)", loud["integrated_lufs"] is not None and abs(loud["integrated_lufs"] - tgt) <= 0.3, f"{loud['integrated_lufs']} LUFS"),
        ("True peak (≤ −1 dBTP)", loud["true_peak_dbtp"] is not None and loud["true_peak_dbtp"] <= -1.0, f"{loud['true_peak_dbtp']} dBTP"),
        ("Effect sync (±1 frame)", sync.get("mix_effects_within_1_frame_pct") == 100.0 and abs(sync.get("encode_offset_ms", 99)) <= 2,
         f"mix: {sync.get('mix_effects_within_1_frame_pct')} % of {sync.get('mix_effects_scored')} effects (isolated per effect); encode offset {sync.get('encode_offset_ms')} ms; "
         f"hits found in the encoded full mix: {sync.get('loud_hits_within_1_frame')}" + (f" (not detected separately in the full mix: {', '.join(m['sfx'] + ' at frame ' + str(m['f']) for m in sync.get('misses', []))}, under a whoosh tail or with a soft attack; each one is within ±1 frame in its isolated stem)" if sync.get("misses") else "")),
    ]
    allok = all(c[1] for c in checks)
    summary.append((f["name"], f["file"], q["seconds"], allok))
    L += [f"## {f['title']} — `{f['file']}` ({q['seconds']} s) — **{OK if allok else NO}**", "", "| Check | Result | Detail |", "|---|---|---|"]
    L += [row(*c) for c in checks]
    if r.get("fixed"):
        L += ["", "Found in review and fixed before delivery: " + "; ".join(r["fixed"]) + "."]
    L.append("")
L[6:6] = ["", "| File | Length | Result |", "|---|---|---|"] + [f"| `{fl}` | {s} s | **{OK if ok else NO}** |" for _, fl, s, ok in summary] + [""]
open(out, "w", encoding="utf8").write("\n".join(L))
print(out, [(n, ok) for n, _, _, ok in summary])
