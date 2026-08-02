// CP-5 date-range test — proves the ONE shared range implementation is
// correct and that filters only ever NARROW what RLS already bounds:
//   1. Preset resolution matrix (Monday weeks, last-month across the year
//      boundary, this-year) at a fixed "now".
//   2. Inclusive end-day semantics: `to=D` resolves to an EXCLUSIVE bound at
//      the Toronto midnight after D.
//   3. DST edges: ranges spanning the 2026 spring-forward and fall-back days.
//   4. Reversed ranges are swapped WITH a notice; invalid input falls back to
//      All time WITH a notice (approved D-R5 amendment — never silent).
//   5. LIVE: seeded orders at exact boundary instants return exactly the
//      right rows (start inclusive, end exclusive).
//   6. PORTAL SECURITY: a customer's date filter can never expose another
//      customer's order — RLS composes with (is never widened by) the range.
//
//   node --experimental-strip-types scripts/test-dates.mjs   (npm run test:dates)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { isoInRange, resolveDateRange } from "../src/lib/dates.ts";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svc = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const rnd = Math.random().toString(36).slice(2, 8);

let pass = true;
const note = (ok, msg) => {
  if (!ok) pass = false;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${msg}`);
};
const iso = (d) => (d ? d.toISOString() : null);

// ---------- 1+2. preset matrix at a fixed now (Wed 2026-07-15, EDT) ----------
console.log("--- preset resolution (Toronto; weeks start Monday) ---");
const NOW = new Date("2026-07-15T18:00:00Z"); // Wed Jul 15, 14:00 in Toronto
const r = (params) => resolveDateRange(params, NOW);
note(iso(r({ range: "today" }).startUTC) === "2026-07-15T04:00:00.000Z"
  && iso(r({ range: "today" }).endUTC) === "2026-07-16T04:00:00.000Z", "today = [Jul 15, Jul 16)");
note(iso(r({ range: "yesterday" }).startUTC) === "2026-07-14T04:00:00.000Z"
  && iso(r({ range: "yesterday" }).endUTC) === "2026-07-15T04:00:00.000Z", "yesterday = [Jul 14, Jul 15)");
note(iso(r({ range: "this-week" }).startUTC) === "2026-07-13T04:00:00.000Z"
  && iso(r({ range: "this-week" }).endUTC) === "2026-07-16T04:00:00.000Z",
  "this-week starts MONDAY Jul 13 and includes all of today");
{
  const sun = resolveDateRange({ range: "this-week" }, new Date("2026-07-19T18:00:00Z")); // Sunday
  note(iso(sun.startUTC) === "2026-07-13T04:00:00.000Z",
    "on a SUNDAY, this-week still starts the previous Monday (Jul 13)");
}
note(iso(r({ range: "this-month" }).startUTC) === "2026-07-01T04:00:00.000Z", "this-month starts Jul 1");
note(iso(r({ range: "last-month" }).startUTC) === "2026-06-01T04:00:00.000Z"
  && iso(r({ range: "last-month" }).endUTC) === "2026-07-01T04:00:00.000Z", "last-month = [Jun 1, Jul 1)");
{
  const jan = resolveDateRange({ range: "last-month" }, new Date("2026-01-10T18:00:00Z"));
  note(iso(jan.startUTC) === "2025-12-01T05:00:00.000Z" && iso(jan.endUTC) === "2026-01-01T05:00:00.000Z",
    "last-month across the YEAR boundary = [Dec 1 2025, Jan 1 2026) in EST");
}
note(iso(r({ range: "this-year" }).startUTC) === "2026-01-01T05:00:00.000Z",
  "this-year starts Jan 1 at the EST offset (05:00Z), not the summer one");
note(r({ range: "all" }).startUTC === null && r({ range: "all" }).endUTC === null, "all = unbounded");
note(r({}).preset === "all" && r({}).notice === null, "no params = All time, no notice");

console.log("\n--- custom ranges: inclusive end day, DST spans, corrections ---");
{
  const c = r({ range: "custom", from: "2026-07-01", to: "2026-07-15" });
  note(iso(c.startUTC) === "2026-07-01T04:00:00.000Z" && iso(c.endUTC) === "2026-07-16T04:00:00.000Z",
    "to=Jul 15 → EXCLUSIVE bound at Jul 16 midnight: the end day is fully included");
  note(c.notice === null && c.label.includes("Jul 1") && c.label.includes("Jul 15"), `label "${c.label}"`);
}
{
  const spring = r({ range: "custom", from: "2026-03-07", to: "2026-03-08" });
  note(iso(spring.startUTC) === "2026-03-07T05:00:00.000Z" && iso(spring.endUTC) === "2026-03-09T04:00:00.000Z",
    "range spanning SPRING-FORWARD: starts EST (05Z), ends EDT (04Z) — the 23h day handled");
}
{
  const fall = r({ range: "custom", from: "2026-10-31", to: "2026-11-01" });
  note(iso(fall.startUTC) === "2026-10-31T04:00:00.000Z" && iso(fall.endUTC) === "2026-11-02T05:00:00.000Z",
    "range spanning FALL-BACK: starts EDT (04Z), ends EST (05Z) — the 25h day handled");
}
{
  const swapped = r({ range: "custom", from: "2026-07-15", to: "2026-07-01" });
  note(iso(swapped.startUTC) === "2026-07-01T04:00:00.000Z" && iso(swapped.endUTC) === "2026-07-16T04:00:00.000Z",
    "reversed range is swapped to the sensible order");
  note(typeof swapped.notice === "string" && swapped.notice.includes("swapped"),
    `…and SAYS so: "${swapped.notice}"`);
  const single = r({ range: "custom", from: "2026-07-10" });
  note(iso(single.startUTC) === "2026-07-10T04:00:00.000Z" && iso(single.endUTC) === "2026-07-11T04:00:00.000Z",
    "a single bound = that one full day");
}
{
  const bad = r({ range: "custom", from: "garbage" });
  note(bad.preset === "all" && bad.notice !== null && bad.notice.includes("All time"),
    `invalid input falls back WITH a notice: "${bad.notice}"`);
  const feb30 = r({ range: "custom", from: "2026-02-30", to: "2026-02-30" });
  note(feb30.preset === "all" && feb30.notice !== null, "impossible dates (Feb 30) rejected, not misparsed");
  const unknown = r({ range: "bogus" });
  note(unknown.preset === "all" && unknown.notice !== null,
    `unknown preset falls back WITH a notice: "${unknown.notice}"`);
}
{
  const c = r({ range: "custom", from: "2026-07-01", to: "2026-07-15" });
  note(isoInRange("2026-07-01T04:00:00.000Z", c) === true, "isoInRange: start instant INCLUDED");
  note(isoInRange("2026-07-16T03:59:59.000Z", c) === true, "isoInRange: last second of end day included");
  note(isoInRange("2026-07-16T04:00:00.000Z", c) === false, "isoInRange: next midnight EXCLUDED");
  note(isoInRange("2026-07-01T03:59:59.000Z", c) === false, "isoInRange: instant before start excluded");
}

// ---------- 5+6. LIVE boundary + portal-security checks ----------
console.log("\n--- live: exact boundary rows + the filter can never widen RLS ---");
let aCust, bCust, aUser, prod;
const A = { email: `zzdate-a-${rnd}@example.com`, password: `Test!${rnd}aA9` };
try {
  const { data: p } = await svc.from("products")
    .insert({ sku: `ZZDATE-${rnd}`, name: `ZZDATE ${rnd}`, unit: "ea", unit_size: "1", list_price_cents: 1000, is_active: true })
    .select("id").single();
  prod = p.id;
  const { data: u, error: ue } = await svc.auth.admin.createUser({
    email: A.email, password: A.password, email_confirm: true,
  });
  if (ue) throw ue;
  aUser = u.user.id;
  const { data: ca } = await svc.from("customers")
    .insert({ business_name: `ZZDATE A ${rnd}`, contact_name: "a", email: A.email, phone: "0", status: "active", user_id: aUser })
    .select("id").single();
  aCust = ca.id;
  const { data: cb } = await svc.from("customers")
    .insert({ business_name: `ZZDATE B ${rnd}`, contact_name: "b", email: `zzdate-b-${rnd}@example.com`, phone: "0", status: "active" })
    .select("id").single();
  bCust = cb.id;

  const mkOrder = async (cust) => {
    const { data, error } = await svc.rpc("submit_order_atomic", {
      p_customer_id: cust, p_fulfillment: "pickup", p_notes: null, p_payment_terms: "net-30",
      p_total_cents: 1000, p_client_token: randomUUID(),
      p_lines: [{ product_id: prod, name: "x", sku: "x", unit: "ea", unit_size: "1", qty: 1, base_price_cents: 1000, unit_price_cents: 1000, applied_offer_title: null, was_assigned: false, cost_cents: null }],
    });
    if (error) throw new Error(error.message);
    return data;
  };
  const setCreated = (id, when) => svc.from("orders").update({ created_at: when }).eq("id", id);

  // A window ending 4 Toronto-days ago, starting 8 days ago (all in the past
  // so "now" never interferes). Derive the from/to strings from the resolved
  // day starts themselves.
  const dayStr = (d) => d.toISOString().slice(0, 10);
  const today = resolveDateRange({ range: "today" });
  const fromStr = dayStr(new Date(today.startUTC.getTime() - 8 * 86400e3 + 6 * 3600e3));
  const toStr = dayStr(new Date(today.startUTC.getTime() - 4 * 86400e3 + 6 * 3600e3));
  const range = resolveDateRange({ range: "custom", from: fromStr, to: toStr });

  const atStart = await mkOrder(aCust); // exactly the start instant → IN
  const inside = await mkOrder(aCust); // mid-range → IN
  const lastSec = await mkOrder(aCust); // last second of the end day → IN
  const after = await mkOrder(aCust); // exactly the exclusive end → OUT
  const before = await mkOrder(aCust); // 1s before start → OUT
  await setCreated(atStart, range.startUTC.toISOString());
  await setCreated(inside, new Date(range.startUTC.getTime() + 86400e3).toISOString());
  await setCreated(lastSec, new Date(range.endUTC.getTime() - 1000).toISOString());
  await setCreated(after, range.endUTC.toISOString());
  await setCreated(before, new Date(range.startUTC.getTime() - 1000).toISOString());

  const { data: rows } = await svc.from("orders")
    .select("id")
    .eq("customer_id", aCust)
    .gte("created_at", range.startUTC.toISOString())
    .lt("created_at", range.endUTC.toISOString());
  const got = new Set(rows.map((x) => x.id));
  note(got.size === 3 && got.has(atStart) && got.has(inside) && got.has(lastSec),
    `range query returns EXACTLY the 3 in-range orders (${got.size})`);
  note(!got.has(after) && !got.has(before),
    "the exclusive-end and before-start orders are excluded");

  // Portal security: B's order sits INSIDE the range; A's session with the
  // widest possible filter still sees zero of B.
  const bOrder = await mkOrder(bCust);
  await setCreated(bOrder, new Date(range.startUTC.getTime() + 86400e3).toISOString());
  const asA = createClient(URL, ANON, { auth: { persistSession: false } });
  {
    const { error } = await asA.auth.signInWithPassword({ email: A.email, password: A.password });
    if (error) throw error;
  }
  const { data: aSees } = await asA.from("orders")
    .select("id, customer_id")
    .gte("created_at", range.startUTC.toISOString())
    .lt("created_at", range.endUTC.toISOString());
  note((aSees ?? []).every((o) => o.customer_id === aCust) && (aSees ?? []).length === 3,
    `A's ranged query returns only A's own 3 orders (${aSees?.length}) — B's in-range order invisible`);
  const { data: aAll } = await asA.from("orders").select("customer_id");
  note((aAll ?? []).every((o) => o.customer_id === aCust),
    "…and with NO range at all, still only A's rows: the filter never widens RLS");
} catch (e) {
  console.log("ERROR:", e.message);
  pass = false;
} finally {
  if (aCust) await svc.from("orders").delete().eq("customer_id", aCust);
  if (bCust) await svc.from("orders").delete().eq("customer_id", bCust);
  if (prod) await svc.from("products").delete().eq("id", prod);
  if (aCust) await svc.from("customers").delete().eq("id", aCust);
  if (bCust) await svc.from("customers").delete().eq("id", bCust);
  if (aUser) await svc.auth.admin.deleteUser(aUser);
  console.log("\nteardown complete (test orders, product, customers, auth user removed)");
  console.log(pass ? "\n=== DATE RANGE TEST: PASS ===" : "\n=== DATE RANGE TEST: failures above ===");
  process.exit(pass ? 0 : 1);
}
