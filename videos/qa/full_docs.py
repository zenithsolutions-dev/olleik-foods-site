"""FULL SYSTEM film: the feature coverage table (feature → steps → timestamps) and the chapter list, in markdown.
Inputs: <docs_dir>/FULL_SYSTEM.steps.json (node full.mjs docs …), narration/FULL.coverage.json, narration/FULL.json,
docs/qa/2026-10-12-videos/FEATURE_INVENTORY.md (for the feature order).
usage: python qa/full_docs.py <docs_dir>   → prints markdown"""
import json
import sys

d = sys.argv[1]
steps = {s["id"]: s for s in json.load(open(f"{d}/FULL_SYSTEM.steps.json", encoding="utf8"))}
cov = json.load(open("narration/FULL.coverage.json", encoding="utf8"))["features"]
lines = {l["id"]: l for l in json.load(open("narration/FULL.json", encoding="utf8"))["lines"]}
chap = open(f"{d}/FULL_SYSTEM.chapters.txt", encoding="utf8").read().split("\n\nSteps:")[0]

used = set()
out = ["## Feature coverage", "", "Timestamps are the start of each step in `FULL_SYSTEM.mp4` (m:ss); the step number is the badge shown in the film's caption band.", "", "| ID | Feature | Shown at (step) | Covered |", "|---|---|---|---|"]
for fid, f in cov.items():
    shown = [steps[s] for s in f["steps"] if s in steps]
    used.update(s["id"] for s in shown)
    missing = [s for s in f["steps"] if s not in steps]
    if missing:
        raise SystemExit(f"{fid}: steps not in the film: {missing}")
    at = ", ".join(f"{s['t']} ({s['n']})" for s in sorted(shown, key=lambda s: s["from"]))
    out.append(f"| {fid} | {f['name']} | {at or '—'} | {'yes' if shown else 'no: ' + f.get('not_shown', '')} |")
unused = [s for s in steps if s not in used]
out += ["", f"{sum(1 for f in cov.values() if f['steps'])} of {len(cov)} features shown; every step shows at least one feature" + ("" if not unused else f" except {', '.join(unused)}") + ".", "", "## Chapters", "", "```", chap.strip(), "```"]
print("\n".join(out))
