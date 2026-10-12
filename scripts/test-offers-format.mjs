// Regression: Admin > Offer library > "Running now" crashed server-side for amount-off and fixed-price offers.
// running-now.tsx is a server component and formatDiscount() pulled formatMoney from lib/admin/store.tsx, a
// "use client" module, so calling it on the server threw. formatMoney is the only call that runs for cents-based
// discounts (percent never touched it), which is why only those two kinds failed.
//   1. formatDiscount() runs in plain Node (no React client runtime) for every discount kind.
//   2. offers-format.ts never imports a "use client" module (static guard, so the next helper cannot reintroduce it).
//
//   node --experimental-strip-types scripts/test-offers-format.mjs   (npm run test:offers-format)
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatDiscount } from "../src/lib/admin/offers-format.ts";

let pass = true;
const note = (ok, msg) => {
  if (!ok) pass = false;
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
};
const eq = (got, want, msg) => note(got === want, `${msg} -> ${JSON.stringify(got)}${got === want ? "" : ` (want ${JSON.stringify(want)})`}`);

eq(formatDiscount("percent", 10), "10% off", "percent");
eq(formatDiscount("amount_off", 300), "$3.00 off", "amount off (cents)");
eq(formatDiscount("fixed_price", 1250), "$12.50 fixed price", "fixed price (cents)");
eq(formatDiscount("amount_off", 5), "$0.05 off", "amount off under a dollar");
eq(formatDiscount(null, null), null, "no kind");
eq(formatDiscount("percent", null), null, "no value");

const here = dirname(fileURLToPath(import.meta.url));
const file = resolve(here, "../src/lib/admin/offers-format.ts");
const imports = [...readFileSync(file, "utf8").matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
for (const spec of imports) {
  if (!spec.startsWith(".")) continue;
  let src = "";
  for (const ext of ["", ".ts", ".tsx"]) {
    try {
      src = readFileSync(resolve(dirname(file), spec + ext), "utf8");
      break;
    } catch {}
  }
  note(!/^\s*["']use client["']/.test(src), `offers-format.ts import ${spec} is not a "use client" module`);
}

if (!pass) process.exit(1);
console.log("\nALL PASS");
