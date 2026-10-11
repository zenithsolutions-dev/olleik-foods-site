"""Download finished product photos and log them in higgsfield/ledger.json.
usage: python higgsfield/fetch_products.py '<json {index: result_url}>'
The job id is read from the URL; the prompt is rebuilt from product_prompts.mjs (exactly what was sent)."""
import datetime, json, os, pathlib, re, subprocess, sys, urllib.request

HERE = pathlib.Path(__file__).parent
urls = json.loads(sys.argv[1])
meta = json.loads(subprocess.check_output(["node", "-e", "import('./product_prompts.mjs').then(m=>console.log(JSON.stringify(m.PRODUCTS.map((p,i)=>({sku:p[0],name:p[1],prompt:m.prompt(p[2],i>0)})))))"], cwd=HERE, shell=False))
L = HERE / "ledger.json"
led = json.loads(L.read_text(encoding="utf8")) if L.exists() else []
os.makedirs(HERE / "products" / "raw", exist_ok=True)
for idx, url in urls.items():
    i = int(idx)
    job = re.search(r"([0-9a-f]{8}-[0-9a-f-]{27})\.png", url).group(1)
    out = HERE / "products" / "raw" / f"{meta[i]['sku']}.png"
    urllib.request.urlretrieve(url, out)
    led = [e for e in led if e["job_id"] != job]
    led.append({"job_id": job, "kind": "product-photo", "sku": meta[i]["sku"], "product": meta[i]["name"],
                "model_requested": "nano_banana_pro", "model_reported": "nano_banana_2", "params": {"aspect_ratio": "4:3", "resolution": "2k"},
                "reference": None if i == 0 else "cc1b8fd0-cc9b-4137-b674-d1e69aee1c20 (style anchor, element olleik-demo-catalog-style)",
                "file": f"videos/higgsfield/products/raw/{out.name}", "date": datetime.date.today().isoformat(),
                "source_url": url, "prompt": meta[i]["prompt"]})
    print(out.name, out.stat().st_size)
L.write_text(json.dumps(led, indent=1, ensure_ascii=False), encoding="utf8")
