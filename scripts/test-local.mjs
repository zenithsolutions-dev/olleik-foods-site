// Runs the test scripts against the LOCAL throwaway database (videos/devstack/stack.mjs must be running),
// never the project in .env.local. Every test script reads ".env.local" from the current folder, so this
// runner gives each one a temp folder holding the local stack's keys.
//   node scripts/test-local.mjs                 run every scripts/test-*.mjs
//   node scripts/test-local.mjs orders offers   run only the named ones
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const keys = JSON.parse(readFileSync(resolve(HERE, "..", "videos", "devstack", "_keys.json"), "utf8"));
if (!keys.url.startsWith("http://127.0.0.1:")) throw new Error("refusing to run: the database URL is not the local stand-in");

const cwd = mkdtempSync(join(tmpdir(), "local-tests-"));
writeFileSync(
  join(cwd, ".env.local"),
  [
    `NEXT_PUBLIC_SUPABASE_URL=${keys.url}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${keys.anonKey}`,
    `SUPABASE_SERVICE_ROLE_KEY=${keys.serviceKey}`,
    "ADMIN_EMAILS=admin@olleik-demo.test",
  ].join("\n"),
);

const wanted = process.argv.slice(2);
const files = readdirSync(HERE)
  .filter((f) => /^test-.*\.mjs$/.test(f) && f !== "test-local.mjs")
  .filter((f) => wanted.length === 0 || wanted.some((w) => f.includes(w)))
  .sort();

const results = files.map((f) => {
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", join(HERE, f)], { cwd, encoding: "utf8" });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const failed = r.status !== 0;
  if (failed || wanted.length > 0) console.log(`\n===== ${f} =====\n${out.trim()}`);
  return { f, failed, passes: (out.match(/\bPASS\b/g) ?? []).length, fails: (out.match(/\bFAIL\b/g) ?? []).length };
});
rmSync(cwd, { recursive: true, force: true });

console.log("\nfile | exit | PASS lines | FAIL lines");
for (const r of results) console.log(`${r.f} | ${r.failed ? "FAILED" : "ok"} | ${r.passes} | ${r.fails}`);
process.exit(results.some((r) => r.failed) ? 1 : 0);
