// CI guard backing the ESLint zone: fail if any customer-portal file references
// the service-role admin client. Belt-and-suspenders for the governing security
// rule — portal code reads ONLY via the session-bound anon client so RLS
// enforces tenant isolation. Run in CI: `node scripts/guard-portal.mjs`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src/app/portal", "src/lib/portal"];
// Match imports/usages of the service-role client, not incidental words.
const FORBIDDEN = [
  /from\s+["'][^"']*lib\/supabase\/admin["']/,
  /getAdminClient/,
  /service_role/,
  /SUPABASE_SERVICE_ROLE_KEY/,
];

function walk(dir) {
  let files = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files; // root may not exist in a given checkout
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) files = files.concat(walk(p));
    else if (/\.(ts|tsx)$/.test(p)) files.push(p);
  }
  return files;
}

const violations = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const text = readFileSync(file, "utf8");
    for (const re of FORBIDDEN) {
      if (re.test(text)) violations.push(`${file}: matches ${re}`);
    }
  }
}

if (violations.length) {
  console.error("✖ Portal security guard FAILED — service-role usage in portal code:");
  for (const v of violations) console.error("  " + v);
  console.error("\nPortal code must use the session-bound anon client (@/lib/supabase/server).");
  process.exit(1);
}
console.log("✓ Portal security guard passed — no service-role usage under " + ROOTS.join(", "));
