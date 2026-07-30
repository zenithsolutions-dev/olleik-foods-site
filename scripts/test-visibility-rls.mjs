// CP-2 visibility RLS test. Proves the 0008 products policy yields EXACTLY the
// right visible set for every mode, with real customer sessions against the
// live DB (same conventions as test-cross-tenant.mjs: throwaway rows, ANON
// session client, full teardown).
//
//   node scripts/test-visibility-rls.mjs
//
// Matrix (customer A is the subject, B proves isolation):
//   cats:     PZ (parent) ← CZ (child) ; OZ (standalone)
//   products: p1 CZ (assigned→A), p2 CZ, p3 OZ (assigned→B ONLY),
//             p4 OZ (assigned→A), p5 CZ (assigned→A, later HIDDEN for A)
//   1. assigned (default)      → A sees exactly {p1,p4,p5}; p3 probe → 0
//   2. hide p5                 → A sees exactly {p1,p4}   (hidden beats assigned)
//   3. mode 'all'              → p1..p4 visible, p5 not; count = active − 1;
//                                own-rows-only on cp/hidden tables; costs deny-all
//   4. mode 'categories' {PZ}  → A sees exactly {p1,p2,p4} (parent→child
//                                expansion + assigned arm + hidden exclusion);
//                                empty selection → exactly {p1,p4}
//   5. anon                    → zero products, zero visibility-config rows
//
// Requires migration 0008; exits with an explicit message if it isn't applied.
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
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;

const svc = createClient(URL, SVC, { auth: { persistSession: false } });
const rnd = Math.random().toString(36).slice(2, 8);
const mk = (n) => ({ email: `zzvis-${n}-${rnd}@example.com`, password: `Test!${rnd}${n}aA9` });
const A = mk("a"), B = mk("b");

let pass = true;
const note = (ok, msg) => {
  if (!ok) pass = false;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${msg}`);
};
const ids = {}; // name -> uuid for categories/products
let aCust, bCust, aUser, bUser;

// A's currently-visible product ids, restricted to OUR test products for exact-set
// checks (in assigned/categories modes the global set IS the test set, but
// restricting keeps the assertion stable if the live DB changes mid-run).
const TEST_PRODUCTS = ["p1", "p2", "p3", "p4", "p5"];
async function visibleTestSet(client) {
  const { data, error } = await client.from("products").select("id");
  if (error) throw new Error(`products read as A failed: ${error.message}`);
  const got = new Set((data ?? []).map((r) => r.id));
  return new Set(TEST_PRODUCTS.filter((n) => got.has(ids[n])));
}
const setEq = (s, names) => s.size === names.length && names.every((n) => s.has(n));
const show = (s) => `{${[...s].sort().join(",")}}`;

try {
  // ---- migration guard ----
  const probe = await svc.from("customers").select("visibility_mode").limit(1);
  if (probe.error) {
    console.log("MIGRATION 0008 NOT APPLIED — customers.visibility_mode is missing.");
    console.log("Run supabase/migrations/0008_catalog_visibility.sql, then re-run this script.");
    process.exit(1);
  }
  for (const t of ["customer_visible_categories", "customer_hidden_products"]) {
    const { error } = await svc.from(t).select("customer_id").limit(1);
    if (error) {
      console.log(`MIGRATION 0008 PARTIALLY APPLIED — ${t} is missing (${error.code}).`);
      console.log("Re-run 0008 (it is idempotent), then re-run this script.");
      process.exit(1);
    }
  }

  // ---- setup ----
  const cat = async (name, parent_id = null) => {
    const { data, error } = await svc
      .from("categories")
      .insert({ name: `ZZVIS ${name} ${rnd}`, parent_id })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  };
  ids.PZ = await cat("Parent");
  ids.CZ = await cat("Child", ids.PZ);
  ids.OZ = await cat("Other");

  const prod = async (name, category_id) => {
    const { data, error } = await svc
      .from("products")
      .insert({
        sku: `ZZVIS-${name}-${rnd}`,
        name: `ZZVIS ${name} ${rnd}`,
        unit: "ea",
        unit_size: "1",
        list_price_cents: 1000,
        is_active: true,
        category_id,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  };
  ids.p1 = await prod("p1", ids.CZ);
  ids.p2 = await prod("p2", ids.CZ);
  ids.p3 = await prod("p3", ids.OZ);
  ids.p4 = await prod("p4", ids.OZ);
  ids.p5 = await prod("p5", ids.CZ);

  for (const [tag, acct] of [["A", A], ["B", B]]) {
    const { data: u, error: ue } = await svc.auth.admin.createUser({
      email: acct.email,
      password: acct.password,
      email_confirm: true,
    });
    if (ue) throw ue;
    const { data: c, error: ce } = await svc
      .from("customers")
      .insert({
        business_name: `ZZVIS ${tag} ${rnd}`,
        contact_name: tag,
        email: acct.email,
        phone: "000",
        status: "active",
        user_id: u.user.id,
      })
      .select("id")
      .single();
    if (ce) throw ce;
    if (tag === "A") { aCust = c.id; aUser = u.user.id; }
    else { bCust = c.id; bUser = u.user.id; }
  }
  {
    const { error } = await svc.from("customer_products").insert([
      { customer_id: aCust, product_id: ids.p1, price_cents: 111 },
      { customer_id: aCust, product_id: ids.p4, price_cents: 444 },
      { customer_id: aCust, product_id: ids.p5, price_cents: 555 },
      { customer_id: bCust, product_id: ids.p3, price_cents: 222 },
    ]);
    if (error) throw error;
  }
  // B hides p1 — proves A can't read B's hidden rows AND B's hide never leaks
  // into A's visibility.
  {
    const { error } = await svc
      .from("customer_hidden_products")
      .insert({ customer_id: bCust, product_id: ids.p1 });
    if (error) throw error;
  }

  const asA = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: se } = await asA.auth.signInWithPassword({ email: A.email, password: A.password });
  if (se) throw se;
  console.log("signed in as A via anon client (RLS now applies)\n");

  // ---- 1. mode 'assigned' (the default written by 0008's backfill) ----
  {
    const { data: row } = await svc.from("customers").select("visibility_mode").eq("id", aCust).single();
    note(row.visibility_mode === "assigned", `new customer defaults to visibility_mode='assigned' (got '${row.visibility_mode}')`);
    const s = await visibleTestSet(asA);
    note(setEq(s, ["p1", "p4", "p5"]), `assigned mode → exactly {p1,p4,p5} (got ${show(s)})`);
    const { data: pb } = await asA.from("products").select("id").eq("id", ids.p3);
    note((pb ?? []).length === 0, "direct probe ?id=eq.<B's product> → 0 rows (no UUID-guessing leak)");
    note(s.has("p1"), "B's hide of p1 does NOT affect A (p1 still visible to A)");
  }

  // ---- 2. hidden beats assigned ----
  {
    const { error } = await svc
      .from("customer_hidden_products")
      .insert({ customer_id: aCust, product_id: ids.p5 });
    if (error) throw error;
    const s = await visibleTestSet(asA);
    note(setEq(s, ["p1", "p4"]), `hide assigned p5 → exactly {p1,p4} — hidden beats assigned (got ${show(s)})`);
  }

  // ---- 3. mode 'all' ----
  {
    const { error } = await svc.from("customers").update({ visibility_mode: "all" }).eq("id", aCust);
    if (error) throw error;
    const s = await visibleTestSet(asA);
    note(setEq(s, ["p1", "p2", "p3", "p4"]), `mode 'all' → p1..p4 visible, hidden p5 still excluded (got ${show(s)})`);

    const { count: svcActive } = await svc
      .from("products").select("id", { count: "exact", head: true }).eq("is_active", true);
    const { count: aCount } = await asA
      .from("products").select("id", { count: "exact", head: true });
    note(aCount === svcActive - 1, `mode 'all' count = all active minus A's 1 hidden (${aCount} vs ${svcActive}-1)`);

    const { data: cpAll } = await asA.from("customer_products").select("customer_id");
    note((cpAll ?? []).length === 3 && cpAll.every((r) => r.customer_id === aCust), `customer_products still own-rows-only in 'all' mode (${(cpAll ?? []).length} rows, all A's)`);
    const { data: hidAll } = await asA.from("customer_hidden_products").select("customer_id, product_id");
    note((hidAll ?? []).length === 1 && hidAll[0].customer_id === aCust && hidAll[0].product_id === ids.p5, "customer_hidden_products → only A's own row (B's hide invisible)");
    const { data: costs, error: costErr } = await asA.from("product_costs").select("product_id");
    note(!!costErr || (costs ?? []).length === 0, "product_costs still deny-all for a customer session");
  }

  // ---- 4. mode 'categories' with parent-only selection ----
  {
    let r = await svc.from("customers").update({ visibility_mode: "categories" }).eq("id", aCust);
    if (r.error) throw r.error;
    r = await svc.from("customer_visible_categories").insert({ customer_id: aCust, category_id: ids.PZ });
    if (r.error) throw r.error;

    const s = await visibleTestSet(asA);
    note(
      setEq(s, ["p1", "p2", "p4"]),
      `categories {PZ parent} → exactly {p1,p2,p4}: child CZ auto-included, assigned p4 outside, hidden p5 out (got ${show(s)})`,
    );
    const { data: vcRows } = await asA.from("customer_visible_categories").select("customer_id");
    note((vcRows ?? []).length === 1 && vcRows[0].customer_id === aCust, "customer_visible_categories → only A's own row");

    // empty selection → assigned-only fallback
    r = await svc.from("customer_visible_categories").delete().eq("customer_id", aCust);
    if (r.error) throw r.error;
    const s2 = await visibleTestSet(asA);
    note(setEq(s2, ["p1", "p4"]), `categories with EMPTY selection → assigned-only {p1,p4} (got ${show(s2)})`);
  }

  // ---- 5. anon reads nothing ----
  {
    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data: ap } = await anon.from("products").select("id").limit(5);
    note((ap ?? []).length === 0, "anon → 0 products (no new anon access)");
    const { data: av } = await anon.from("customer_visible_categories").select("customer_id").limit(5);
    note((av ?? []).length === 0, "anon → 0 customer_visible_categories rows");
    const { data: ah } = await anon.from("customer_hidden_products").select("customer_id").limit(5);
    note((ah ?? []).length === 0, "anon → 0 customer_hidden_products rows");
  }
} catch (e) {
  console.log("ERROR:", e.message);
  pass = false;
} finally {
  // products cascade customer_products + hidden rows; customers cascade the rest
  for (const n of TEST_PRODUCTS) if (ids[n]) await svc.from("products").delete().eq("id", ids[n]);
  for (const c of ["CZ", "OZ", "PZ"]) if (ids[c]) await svc.from("categories").delete().eq("id", ids[c]);
  if (aCust) await svc.from("customers").delete().eq("id", aCust);
  if (bCust) await svc.from("customers").delete().eq("id", bCust);
  if (aUser) await svc.auth.admin.deleteUser(aUser);
  if (bUser) await svc.auth.admin.deleteUser(bUser);
  console.log("\nteardown complete (test categories, products, customers, auth users removed)");
  console.log(pass ? "\n=== VISIBILITY RLS TEST: PASS ===" : "\n=== VISIBILITY RLS TEST: failures above ===");
  process.exit(pass ? 0 : 1);
}
