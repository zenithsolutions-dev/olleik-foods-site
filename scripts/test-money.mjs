// Regression: negative money (a loss-making line, a negative profit) used to print as "$-2.00".
// formatMoney is now one shared pure function (src/lib/money.ts); the admin, portal and every document use it.
//
//   node --experimental-strip-types scripts/test-money.mjs   (npm run test:money)
import { formatMoney } from "../src/lib/money.ts";
import { formatMoney as portalFormat } from "../src/lib/portal/format.ts";

let pass = true;
const eq = (got, want, msg) => {
  const ok = got === want;
  if (!ok) pass = false;
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}: ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};

eq(formatMoney(0), "$0.00", "zero");
eq(formatMoney(1), "$0.01", "one cent");
eq(formatMoney(1250), "$12.50", "ordinary");
eq(formatMoney(100000), "$1000.00", "thousand dollars (no grouping, same as every document)");
eq(formatMoney(-200), "-$2.00", "negative profit");
eq(formatMoney(-5), "-$0.05", "negative under a dollar");
eq(formatMoney(-0), "$0.00", "negative zero");
eq(formatMoney(1005), "$10.05", "10.05 does not drift");
eq(formatMoney(3 * 10), "$0.30", "3 x 10 cents is exactly 30 cents (integer arithmetic, no 0.30000000000000004)");
eq(formatMoney(285), "$2.85", "2.85");
eq(portalFormat(-200), "-$2.00", "the portal re-export is the same function");
if (!pass) process.exit(1);
console.log("\nALL PASS");
