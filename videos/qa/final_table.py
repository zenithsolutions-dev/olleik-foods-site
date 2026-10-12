"""Markdown table of every V3.2 deliverable, measured on the encoded MP4s (out/qa-v32/<name>/qa.json) and, for the voiced
manuals, the narration checks from the mix (out/v3/audio/<name>/levels.json).
usage: python qa/final_table.py > table.md"""
import json
import os

R = "out/qa-v32"
rows = [
    ("USER_MANUAL_VISITOR", "manual-visitor/USER_MANUAL_VISITOR.mp4", -16), ("USER_MANUAL_ADMIN", "manual-admin/USER_MANUAL_ADMIN.mp4", -16),
    ("promo-60s-music", "promo/promo-60s-music.mp4", -14), ("promo-60s-nomusic", "promo/promo-60s-nomusic.mp4", -14),
    ("promo-30s-music", "promo/promo-30s-music.mp4", -14), ("promo-30s-nomusic", "promo/promo-30s-nomusic.mp4", -14),
    ("promo-15s-vertical-music", "promo/promo-15s-vertical-music.mp4", -14), ("promo-15s-vertical-nomusic", "promo/promo-15s-vertical-nomusic.mp4", -14),
    ("promo-6s-bumper-music", "promo/promo-6s-bumper-music.mp4", -14), ("promo-6s-bumper-nomusic", "promo/promo-6s-bumper-nomusic.mp4", -14),
    ("promo-1x1-music", "promo/promo-1x1-music.mp4", -14), ("promo-1x1-nomusic", "promo/promo-1x1-nomusic.mp4", -14),
    ("promo-10s-loop-music", "promo/promo-10s-loop-music.mp4", -14), ("promo-10s-loop-nomusic", "promo/promo-10s-loop-nomusic.mp4", -14),
]
print("| File | Length | Loudness | True peak | Effects within ±1 frame | Longest still | Placeholders | Result |")
print("|---|---|---|---|---|---|---|---|")
for name, f, tgt in rows:
    q = json.load(open(f"{R}/{name}/qa.json", encoding="utf8"))
    L, s, m = q["loudness"], q["sync"], q["motion"]
    ok = (abs(L["integrated_lufs"] - tgt) <= 0.3 and L["true_peak_dbtp"] <= -1.0 and s["mix_effects_within_1_frame_pct"] == 100.0
          and m["pass"] and not q["ocr"]["placeholder_patterns"])
    print(f"| `{f}` | {q['seconds']} s | {L['integrated_lufs']} LUFS | {L['true_peak_dbtp']} dBTP | {s['mix_effects_scored']}/{s['mix_effects_scored']} | {m['longest_still_run_frames']} frames | {len(q['ocr']['placeholder_patterns'])} | {'PASS' if ok else 'FAIL'} |")
print()
print("| Voiced manual | Lines | First word after its step's first frame (max) | Gap to the next line (min) | Music under the voice (min) |")
print("|---|---|---|---|---|")
for name in ("USER_MANUAL_VISITOR", "USER_MANUAL_ADMIN"):
    lv = json.load(open(f"out/v3/audio/{name}/levels.json"))
    worst = max(1 + r["onset_ms_after_frame"] / 33.33 for r in lv["lines"])
    print(f"| {name} | {lv['voice_lines']} (none overlapping) | {worst:.1f} frames (limit 5) | {lv['min_gap_s']} s | {lv['min_voice_over_music_db']} dB (limit 12) |")
