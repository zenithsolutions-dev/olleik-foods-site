// Verify the cost/margin tables are unreadable by (1) the ANON key and (2) a
// SIGNED-IN CUSTOMER session. Run AFTER migration 0006. Before the migration it
// reports "table missing" (also unreadable, but re-run post-migration for the
// real deny-all proof). Also proves the deny-all pattern itself against
// offer_templates (0005), which uses the identical RLS shape.
// Provisions a throwaway customer, signs in, probes, tears down.
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
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const TABLES = ["product_costs", "pricing_rules", "customer_product_pricing_meta", "offer_templates"];
const EMAIL = "qa-rls-pricing@olleik-foods.test";
const PASSWORD = "Test1234!pass";

// A read is SAFE when it yields zero rows (RLS deny-all) or a
// missing-table/permission error. It FAILS only if actual rows come back.
async function probe(client, label) {
  let allSafe = true;
  for (const t of TABLES) {
    const { data, error } = await client.from(t).select("*").limit(5);
    const rows = data?.length ?? 0;
    const safe = rows === 0;
    if (!safe) allSafe = false;
    console.log(
      `  ${safe ? "PASS" : "FAIL"}  ${label} -> ${t}: ${
        error ? `error (${error.code ?? error.message.slice(0, 40)})` : `${rows} rows`
      }`,
    );
  }
  return allSafe;
}

// ---- throwaway customer (linked + active, so it's a realistic session) ----
const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const prior = list.users.find((u) => (u.email ?? "").toLowerCase() === EMAIL);
if (prior) {
  await admin.from("customers").delete().eq("user_id", prior.id);
  await admin.auth.admin.deleteUser(prior.id);
}
const { data: created, error: cErr } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
});
if (cErr) throw cErr;
await admin.from("customers").insert({
  business_name: "QA RLS Pricing Co.",
  contact_name: "QA",
  email: EMAIL,
  phone: "0",
  address: "1 Test St",
  status: "active",
  payment_terms: "cod",
  user_id: created.user.id,
});

console.log("\nANON key (public browser key, no session):");
const anonClient = createClient(URL, ANON, { auth: { persistSession: false } });
const anonSafe = await probe(anonClient, "anon");

console.log("\nSIGNED-IN CUSTOMER session:");
const custClient = createClient(URL, ANON, { auth: { persistSession: false } });
const { error: siErr } = await custClient.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (siErr) throw siErr;
const custSafe = await probe(custClient, "customer");

// ---- teardown ----
await admin.from("customers").delete().eq("user_id", created.user.id);
await admin.auth.admin.deleteUser(created.user.id);
console.log("\nteardown complete.");
console.log(anonSafe && custSafe ? "\n=== PRICING RLS TEST: PASS ===" : "\n=== PRICING RLS TEST: FAIL ===");
process.exit(anonSafe && custSafe ? 0 : 1);
