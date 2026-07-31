// CI guard backing the ESLint zone: fail if any customer-portal file references
// the service-role admin client. Belt-and-suspenders for the governing security
// rule — portal code reads ONLY via the session-bound anon client so RLS
// enforces tenant isolation. Run in CI: `node scripts/guard-portal.mjs`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src/app/portal", "src/lib/portal"];
// Match imports/usages of the service-role client, not incidental words —
// plus the ADMIN-ONLY cost/margin modules (0006): cost prices and margin rules
// must never be reachable from portal code, even via a pure import.
// CP-3a adds the admin-only order/inventory tables to the ban list.
const FORBIDDEN = [
  /from\s+["'][^"']*lib\/supabase\/admin["']/,
  /getAdminClient/,
  /service_role/,
  /SUPABASE_SERVICE_ROLE_KEY/,
  /from\s+["'][^"']*lib\/admin\/pricing-engine["']/,
  /from\s+["'][^"']*lib\/admin\/pricing-data["']/,
  /product_costs/,
  /pricing_rules/,
  /customer_product_pricing_meta/,
  /order_item_costs/,
  /product_inventory/,
  // CP-3a single-entrypoint rule (approved D-O0): portal code may import ONLY
  // @/lib/orders/submit from the privileged orders zone — any other lib/orders
  // path (or the bare directory) is a violation.
  /from\s+["'][^"']*lib\/orders\/(?!submit["'])[^"']*["']/,
  /from\s+["'][^"']*lib\/orders["']/,
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

// CP-3a: the privileged orders zone itself gets its own posture check — every
// module in src/lib/orders must be server-only (it may hold the service-role
// client, so it must be impossible to pull into a client bundle).
for (const file of walk("src/lib/orders")) {
  const text = readFileSync(file, "utf8");
  if (!/import\s+["']server-only["']/.test(text)) {
    violations.push(`${file}: privileged orders module missing \`import "server-only"\``);
  }
  if (/^\s*["']use client["']/m.test(text)) {
    violations.push(`${file}: privileged orders module must never be a client module`);
  }
}

if (violations.length) {
  console.error("✖ Portal security guard FAILED — service-role usage in portal code:");
  for (const v of violations) console.error("  " + v);
  console.error("\nPortal code must use the session-bound anon client (@/lib/supabase/server).");
  console.error("The ONLY allowed privileged import from portal code is @/lib/orders/submit.");
  process.exit(1);
}
console.log(
  "✓ Portal security guard passed — no service-role usage under " +
    ROOTS.join(", ") +
    "; orders zone server-only; single entrypoint @/lib/orders/submit enforced",
);
