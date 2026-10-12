"""Swap in a narration retake: the current take moves to audio/rejected/<id>-t<n>.wav (its ledger entry is marked
rejected with the reason) and the new take is downloaded and logged through higgsfield/fetch.py.
usage: python narration/retake.py "<reason>" <id>=<job_id>=<result_url> …"""
import json
import os
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
os.chdir(ROOT)
reason = sys.argv[1]
lines = {l["id"]: l for f in ("VISITOR", "ADMIN") for l in json.load(open(f"narration/{f}.json", encoding="utf8"))["lines"]}
L = pathlib.Path("higgsfield/ledger.json")
for arg in sys.argv[2:]:
    i, job, url = arg.split("=", 2)
    cur = pathlib.Path(f"narration/audio/{i}.wav")
    os.makedirs("narration/audio/rejected", exist_ok=True)
    n = 1
    while pathlib.Path(f"narration/audio/rejected/{i}-t{n}.wav").exists():
        n += 1
    dst = f"narration/audio/rejected/{i}-t{n}.wav"
    shutil.move(cur, dst)
    led = json.loads(L.read_text(encoding="utf8"))
    for e in led:
        if e.get("kind") == "narration" and e["file"] == f"narration/audio/{i}.wav":
            e["file"], e["status"] = dst, f"rejected: {reason}"
    L.write_text(json.dumps(led, indent=1, ensure_ascii=False), encoding="utf8")
    ln = lines[i]
    subprocess.run([sys.executable, "higgsfield/fetch.py", str(cur), job, url, "seed_audio", "narration", f"[voice Holden 3c9d6053, seed_audio, take {n + 1}] {ln.get('speak', ln['text'])}"], check=True, capture_output=True)
    print(i, "-> take", n + 1, "(old take:", dst + ")")
