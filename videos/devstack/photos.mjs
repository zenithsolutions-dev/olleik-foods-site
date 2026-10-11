// VIDEO DEMO STACK ONLY: puts the generated product photos (videos/higgsfield/products/web/<SKU>.jpg, Higgsfield,
// see audio-library/LICENSES.md) into the LOCAL storage stand-in and sets products.image_url in the LOCAL database.
// Same bucket and path shape the app's own upload uses (product-images/products/<uuid>.jpg), so the real UI renders
// the real image field. No app code changes; nothing here touches the hosted project.
//   node devstack/photos.mjs           load all photos
//   node devstack/photos.mjs --clear   remove them again (image_url back to null)
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
const keys = JSON.parse(readFileSync(join(HERE, "_keys.json"), "utf8"));
if (!keys.url.startsWith("http://127.0.0.1:")) throw new Error("refusing: not the local stand-in");
const SRC = join(HERE, "..", "higgsfield", "products", "web");
const DIR = join(HERE, "_storage", "product-images", "products");
const db = new pg.Client({ host: "127.0.0.1", port: 54329, user: "postgres", password: "local-only-postgres", database: "postgres" });
await db.connect();

// Stable per-SKU uuid-shaped name, so re-runs give the same URLs (and the same captures).
const uuidOf = (sku) => {
  const h = createHash("sha1").update(`olleik-demo-photo:${sku}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

if (process.argv.includes("--clear")) {
  await db.query("update products set image_url = null where image_url like $1", [`${keys.url}/storage/v1/object/public/product-images/%`]);
  rmSync(DIR, { recursive: true, force: true });
  console.log("cleared");
} else {
  mkdirSync(DIR, { recursive: true });
  let n = 0;
  for (const f of readdirSync(SRC).filter((x) => x.endsWith(".jpg"))) {
    const sku = f.slice(0, -4);
    const name = `${uuidOf(sku)}.jpg`;
    copyFileSync(join(SRC, f), join(DIR, name));
    const url = `${keys.url}/storage/v1/object/public/product-images/products/${name}`;
    const r = await db.query("update products set image_url = $1 where sku = $2", [url, sku]);
    if (r.rowCount !== 1) console.warn(`no product with sku ${sku}`);
    else n++;
  }
  const missing = (await db.query("select sku from products where image_url is null order by sku")).rows.map((r) => r.sku);
  console.log(`${n} photos loaded; products without a photo: ${missing.length ? missing.join(", ") : "none"}`);
  if (!existsSync(DIR)) throw new Error("storage folder missing");
}
await db.end();
