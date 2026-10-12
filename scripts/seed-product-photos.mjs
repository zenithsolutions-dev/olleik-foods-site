// Attach the product photo set in /product-photos to products, by SKU. DRY-RUN BY DEFAULT.
//
//   node scripts/seed-product-photos.mjs                  dry run: prints what it WOULD upload and change, writes nothing
//   node scripts/seed-product-photos.mjs --apply          uploads the files and sets products.image_url
//   node scripts/seed-product-photos.mjs --apply --overwrite   also replaces photos a product already has
//
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment (export them in your shell; this
// script deliberately does not read .env.local for you, so you always see which project you are pointing at: the URL is
// printed first). Dry run only needs read access and still prints the target.
//
// Mapping: product-photos/manifest.json (sku -> file). A product with no row is reported and skipped. A product that
// already has an image_url is skipped unless --overwrite.
// Idempotent: the storage path is derived from the SKU (products/<uuid-from-sku>.jpg, same scheme as videos/devstack/seed.mjs),
// so re-running uploads the same object to the same URL and changes nothing else.
//
// IMPORTANT: the photos in product-photos/ are AI-generated illustrations (see product-photos/LICENSES.md), not
// photographs of Olleik's real products. Decide whether to publish them before running with --apply.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APPLY = process.argv.includes("--apply");
const OVERWRITE = process.argv.includes("--overwrite");
const BUCKET = "product-images";
const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, "..", "product-photos");

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your shell first (nothing has been read or changed).");
  process.exit(1);
}
console.log(`Target project: ${url}`);
console.log(APPLY ? "Mode: APPLY (will upload and update)" : "Mode: DRY RUN (nothing will be written; add --apply to change anything)");

const manifest = JSON.parse(readFileSync(join(DIR, "manifest.json"), "utf8"));
const H = { apikey: key, authorization: `Bearer ${key}` };

const uuidOf = (sku) => {
  const h = createHash("sha1").update(`olleik-demo-photo:${sku}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const r = await fetch(`${url}/rest/v1/products?select=id,sku,name,image_url&order=sku`, { headers: H });
if (!r.ok) {
  console.error(`Could not read products: ${r.status} ${await r.text()}`);
  process.exit(1);
}
const products = new Map((await r.json()).map((p) => [p.sku, p]));

const tally = { upload: 0, replace: 0, skipHas: 0, noProduct: 0, unchanged: 0 };
for (const ph of manifest.photos) {
  const p = products.get(ph.sku);
  if (!p) {
    tally.noProduct++;
    console.log(`  skip     ${ph.sku}  no product with this SKU`);
    continue;
  }
  const path = `products/${uuidOf(ph.sku)}.jpg`;
  const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${path}`;
  if (p.image_url === publicUrl) {
    tally.unchanged++;
    console.log(`  same     ${ph.sku}  already points at this photo`);
    continue;
  }
  if (p.image_url && !OVERWRITE) {
    tally.skipHas++;
    console.log(`  skip     ${ph.sku}  already has a photo (use --overwrite to replace): ${p.image_url}`);
    continue;
  }
  const verb = p.image_url ? "replace" : "upload ";
  p.image_url ? tally.replace++ : tally.upload++;
  console.log(`  ${verb}  ${ph.sku}  ${ph.file} -> ${BUCKET}/${path}`);
  if (!APPLY) continue;

  const up = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { ...H, "content-type": "image/jpeg", "x-upsert": "true" },
    body: readFileSync(join(DIR, ph.file)),
  });
  if (!up.ok) {
    console.error(`    upload failed for ${ph.sku}: ${up.status} ${await up.text()}`);
    process.exitCode = 1;
    continue;
  }
  const upd = await fetch(`${url}/rest/v1/products?id=eq.${p.id}`, {
    method: "PATCH",
    headers: { ...H, "content-type": "application/json", prefer: "return=minimal" },
    body: JSON.stringify({ image_url: publicUrl }),
  });
  if (!upd.ok) {
    console.error(`    could not set image_url for ${ph.sku}: ${upd.status} ${await upd.text()}`);
    process.exitCode = 1;
  }
}

console.log(
  `\n${APPLY ? "Done" : "Dry run"}: ${tally.upload} to upload, ${tally.replace} to replace, ${tally.unchanged} already correct, ${tally.skipHas} skipped (has a photo), ${tally.noProduct} SKUs with no product.`,
);
if (!APPLY) console.log("Nothing was changed. Re-run with --apply to do it.");
