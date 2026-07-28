// One-off DEMO seed: give every product WITHOUT a recorded purchase cost a
// demo cost of round(list_price_cents * 0.6) (~40% gross margin on list), so
// margin rules have something to multiply during demos. Never overwrites a
// manually-set cost (e.g. fetta cheese). Costs only — no price or assignment
// changes. Same env/service-role pattern as scripts/test-pricing-rls.mjs.
//
//   node scripts/seed-demo-costs.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const DEMO_COST_FACTOR = 0.6;
const CHUNK = 100;

const { data: products, error: pErr } = await admin
  .from("products")
  .select("id, name, list_price_cents, is_active")
  .order("name");
if (pErr) throw new Error(`products fetch failed: ${pErr.message}`);

const { data: costs, error: cErr } = await admin
  .from("product_costs")
  .select("product_id, cost_cents");
if (cErr) throw new Error(`product_costs fetch failed: ${cErr.message}`);

const existing = new Map(costs.map((c) => [c.product_id, c.cost_cents]));

const toInsert = [];
const skippedExisting = [];
const skippedNoList = [];

for (const p of products) {
  if (existing.has(p.id)) {
    skippedExisting.push(p);
    continue;
  }
  if (typeof p.list_price_cents !== "number" || p.list_price_cents <= 0) {
    skippedNoList.push(p);
    continue;
  }
  toInsert.push({
    product_id: p.id,
    cost_cents: Math.round(p.list_price_cents * DEMO_COST_FACTOR),
  });
}

let inserted = 0;
for (let i = 0; i < toInsert.length; i += CHUNK) {
  const chunk = toInsert.slice(i, i + CHUNK);
  const { error } = await admin.from("product_costs").insert(chunk);
  if (error) throw new Error(`insert chunk ${i / CHUNK}: ${error.message}`);
  inserted += chunk.length;
}

const fmt = (c) => (typeof c === "number" ? `$${(c / 100).toFixed(2)}` : "—");
const byId = new Map(toInsert.map((r) => [r.product_id, r.cost_cents]));

console.log("product                              | list      | seeded cost | note");
console.log("-------------------------------------|-----------|-------------|---------------");
for (const p of products) {
  const name = p.name.slice(0, 36).padEnd(36);
  const list = fmt(p.list_price_cents).padEnd(9);
  if (existing.has(p.id)) {
    console.log(`${name} | ${list} | ${fmt(existing.get(p.id)).padEnd(11)} | kept (manual)`);
  } else if (byId.has(p.id)) {
    console.log(`${name} | ${list} | ${fmt(byId.get(p.id)).padEnd(11)} | seeded`);
  } else {
    console.log(`${name} | ${list} | ${"—".padEnd(11)} | skipped (no list price)`);
  }
}
console.log("");
console.log(
  `Summary: ${inserted} seeded, ${skippedExisting.length} kept existing cost, ${skippedNoList.length} skipped (no/zero list price), ${products.length} products total.`,
);
