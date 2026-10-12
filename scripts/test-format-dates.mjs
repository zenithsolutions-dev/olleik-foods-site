// Regression: dates shown in the UI must not depend on the zone of the machine that renders them.
// Unzoned toLocaleString() printed the SERVER's zone during SSR and the BROWSER's zone after hydration, which
// (a) showed non-Toronto viewers different times from the invoices (those use America/Toronto) and (b) threw a
// React hydration error on /admin/orders and /admin/orders/[id] ("Oct 8, 11:30 a.m." vs "Oct 8, 6:30 p.m.").
// Every check runs in child processes with different TZ values and must give identical, Toronto-correct output.
//
//   node --experimental-strip-types scripts/test-format-dates.mjs   (npm run test:format-dates)
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CHILD = process.argv.includes("--child");

if (CHILD) {
  const { formatBusinessTime, resolveDateRange } = await import("../src/lib/dates.ts");
  const list = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
  const out = {
    summer: formatBusinessTime("2026-10-08T15:30:00Z", list), // EDT, UTC-4
    winter: formatBusinessTime("2026-12-08T15:30:00Z", list), // EST, UTC-5
    lateUtcStillYesterday: formatBusinessTime("2026-10-09T02:30:00Z", { dateStyle: "medium" }), // 10:30 pm Oct 8 in Toronto
    dstEndsBefore: formatBusinessTime("2026-11-01T05:30:00Z", { hour: "numeric", minute: "2-digit" }), // 1:30 EDT
    dstEndsAfter: formatBusinessTime("2026-11-01T07:30:00Z", { hour: "numeric", minute: "2-digit" }), // 2:30 EST
    rangeLabel: resolveDateRange({ range: "custom", from: "2026-10-08", to: "2026-10-09" }, new Date("2026-10-12T12:00:00Z")).label,
  };
  console.log(JSON.stringify(out));
  process.exit(0);
}

const here = fileURLToPath(import.meta.url);
// UTC, Toronto itself, a zone far ahead of UTC (day could flip) and one far behind.
const ZONES = ["UTC", "America/Toronto", "Pacific/Kiritimati", "Pacific/Pago_Pago"];
const results = ZONES.map((TZ) => ({
  TZ,
  out: JSON.parse(
    execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", here, "--child"], { env: { ...process.env, TZ }, encoding: "utf8" }),
  ),
}));

let pass = true;
const note = (ok, msg) => {
  if (!ok) pass = false;
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
};
const want = {
  summer: "Oct 8, 11:30 a.m.",
  winter: "Dec 8, 10:30 a.m.",
  lateUtcStillYesterday: "Oct 8, 2026",
  dstEndsBefore: "1:30 a.m.",
  dstEndsAfter: "2:30 a.m.",
};
for (const { TZ, out } of results) {
  for (const [k, v] of Object.entries(want)) note(out[k] === v, `[TZ=${TZ}] ${k}: ${JSON.stringify(out[k])}${out[k] === v ? "" : ` (want ${JSON.stringify(v)})`}`);
  note(/Oct 8, 2026/.test(out.rangeLabel) && /Oct 9, 2026/.test(out.rangeLabel), `[TZ=${TZ}] custom range label keeps its calendar days: ${out.rangeLabel}`);
}
if (!pass) process.exit(1);
console.log("\nALL PASS");
