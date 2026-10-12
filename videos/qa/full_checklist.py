"""FULL SYSTEM film: the pass/fail QA checklist, measured on the encoded MP4 (out/qa-full/FULL_SYSTEM/qa.json from
qa/qa.py) and the mix (out/v3/audio/FULL_SYSTEM/levels.json), plus the manual review notes (qa/review-full.json).
OCR lines ending with a period are split into OUR on-screen lines (captions, chapter cards, title, end card, labels:
must be 0) and the app's own UI copy (reported, not ours to change).
usage: python qa/full_checklist.py > FULL_SYSTEM_QA_CHECKLIST.md"""
import difflib
import json
import re

q = json.load(open("out/qa-full/FULL_SYSTEM/qa.json", encoding="utf8"))
lv = json.load(open("out/v3/audio/FULL_SYSTEM/levels.json", encoding="utf8"))
rv = json.load(open("qa/review-full.json", encoding="utf8"))
narr = json.load(open("narration/FULL.json", encoding="utf8"))["lines"]
ours = [l["caption"] for l in narr] + rv["our_static_lines"]
norm = lambda s: re.sub(r"[^a-z0-9 ]", "", s.lower()).strip()
ours_n = [norm(s) for s in ours]


def is_ours(text):
    t = norm(text)
    # whole-line match only: OCR splits the app's paragraphs into fragments that can be substrings of our captions
    return any(difflib.SequenceMatcher(a=t, b=o).ratio() > 0.95 for o in ours_n)  # "catalog and pricing." (app) vs "Catalog and prices" (ours) is 0.89


L, s, m, o = q["loudness"], q["sync"], q["motion"], q["ocr"]
our_periods = [p for p in o["lines_ending_with_period"] if is_ours(p["text"])]
app_periods = [p for p in o["lines_ending_with_period"] if not is_ours(p["text"])]
onset = max(1 + r["onset_ms_after_frame"] / 33.33 for r in lv["lines"])
rows = [
    ("Length (brief: 12–18 min)", f"{q['seconds'] / 60:.2f} min ({q['seconds']} s)", 12 * 60 <= q["seconds"] <= 18 * 60),
    ("Integrated loudness −16 LUFS ±0.3 (encoded MP4)", f"{L['integrated_lufs']} LUFS", abs(L["integrated_lufs"] + 16) <= 0.3),
    ("True peak ≤ −1 dBTP (encoded MP4)", f"{L['true_peak_dbtp']} dBTP", L["true_peak_dbtp"] <= -1.0),
    ("Every narration line starts within 5 frames of its step", f"max {onset:.1f} frames ({len(lv['lines'])} lines)", onset <= 5),
    ("Narration lines never overlap", f"min gap {lv['min_gap_s']} s", lv["min_gap_s"] > 0),
    ("Music bed C at least 12 dB under the voice", f"min {lv['min_voice_over_music_db']} dB", lv["min_voice_over_music_db"] >= 12),
    ("Sound effects within ±1 frame (isolated per type)", f"{s['mix_effects_within_1_frame_pct']} % of {s['mix_effects_scored']}", s["mix_effects_within_1_frame_pct"] == 100.0),
    ("Picture/sound offset after encoding", f"{s['encode_offset_ms']} ms", abs(s["encode_offset_ms"]) <= 34),
    ("No frozen moment longer than one beat (17 frames)", f"longest still {m['longest_still_run_frames']} frames", m["pass"]),
    ("No placeholder text on screen (OCR, every 0.5 s)", f"{len(o['placeholder_patterns'])} found", not o["placeholder_patterns"]),
    ("None of OUR on-screen lines ends with a period (OCR)", f"{len(our_periods)} found", not our_periods),
]
rows += [(r["check"], r["result"], r["pass"]) for r in rv["manual"]]
ok = all(r[2] for r in rows)
print(f"# FULL_SYSTEM.mp4: QA checklist ({'PASS' if ok else 'FAIL'})\n")
print("Measured on the encoded file `FULL_SYSTEM.mp4`. One frame every 0.5 s was extracted and reviewed by eye in dense review sheets.\n")
print("| Check | Result | Pass |\n|---|---|---|")
for c, r, p in rows:
    print(f"| {c} | {r} | {'PASS' if p else 'FAIL'} |")
print(f"\n**Overall: {'PASS' if ok else 'FAIL'}**\n")
print("## The app's own UI copy ending with a period (not our lines; reported for the owner)\n")
seen = {}  # OCR spacing varies frame to frame: dedupe on the letters only, keep the first time and the cleanest reading
for p in app_periods:
    k = re.sub(r"[^a-z]", "", p["text"].lower())
    if len(k) < 12:
        continue  # fragments of a wrapped line ("kitchens.")
    if k not in seen or p["text"].count(" ") > seen[k][1].count(" "):
        seen[k] = (seen.get(k, (p["t"],))[0], p["text"])
print(f"{len(seen)} distinct lines (fragments under 12 letters omitted):\n")
for t, txt in sorted(seen.values(), key=lambda v: float(v[0])):
    print(f"- {float(t):.1f} s: “{txt}”")
print("\n## Review notes\n")
for n in rv["notes"]:
    print(f"- {n}")
