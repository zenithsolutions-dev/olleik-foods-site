// Applies one migration file to the LOCAL throwaway database (videos/devstack/stack.mjs must be running).
// The stack only applies migrations when the database is first created; this is for ones added afterwards.
//   node scripts/apply-local-migration.mjs supabase/migrations/0017_revenue_buckets_time_zone.sql
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const pg = createRequire(resolve(HERE, "..", "videos", "package.json"))("pg");
const db = new pg.Client({ host: "127.0.0.1", port: 54329, user: "postgres", password: "local-only-postgres", database: "postgres" });
await db.connect();
for (const file of process.argv.slice(2)) {
  await db.query(readFileSync(file, "utf8"));
  console.log(`applied ${file}`);
}
await db.query("notify pgrst, 'reload schema'");
await db.end();
