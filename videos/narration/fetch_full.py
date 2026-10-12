"""Download FULL-film narration takes and log each one in higgsfield/ledger.json (via higgsfield/fetch.py).
usage: python narration/fetch_full.py <index>=<job_id>=<result_url> …   (index = position in FULL.json lines)"""
import json
import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
os.chdir(ROOT)
lines = json.load(open("narration/FULL.json", encoding="utf8"))["lines"]
jobs_file = pathlib.Path("narration/full_jobs.json")
jobs = json.loads(jobs_file.read_text(encoding="utf8")) if jobs_file.exists() else {}
for arg in sys.argv[1:]:
    i, job, url = arg.split("=", 2)
    ln = lines[int(i)]
    out = f"narration/audio/{ln['id']}.wav"
    subprocess.run([sys.executable, "higgsfield/fetch.py", out, job, url, "seed_audio", "narration", f"[voice Holden 3c9d6053, seed_audio, take 1] {ln.get('speak', ln['text'])}"], check=True, capture_output=True)
    jobs[ln["id"]] = [job, url.rsplit("/", 1)[-1]]
    print(ln["id"], out)
jobs_file.write_text(json.dumps(dict(sorted(jobs.items())), indent=1), encoding="utf8")
