"""Download a Higgsfield result and record it in higgsfield/ledger.json (generation id, model, prompt, date, file).
usage: python higgsfield/fetch.py <out_path> <job_id> <result_url> <model> <kind> [prompt_file_or_text]"""
import json, sys, urllib.request, datetime, os, pathlib
out, job, url, model, kind = sys.argv[1:6]
prompt = sys.argv[6] if len(sys.argv) > 6 else ""
if prompt and os.path.exists(prompt):
    prompt = pathlib.Path(prompt).read_text(encoding="utf8")
os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
urllib.request.urlretrieve(url, out)
L = pathlib.Path(__file__).with_name("ledger.json")
led = json.loads(L.read_text(encoding="utf8")) if L.exists() else []
led = [e for e in led if e["job_id"] != job]
led.append({"job_id": job, "kind": kind, "model": model, "file": out.replace("\\", "/"), "date": datetime.date.today().isoformat(), "source_url": url.split("?")[0], "prompt": prompt})
L.write_text(json.dumps(led, indent=1, ensure_ascii=False), encoding="utf8")
print(out, os.path.getsize(out))
