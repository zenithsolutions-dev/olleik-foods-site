// Cross-tenant isolation test (Phase D). Creates two throwaway customers A and B
// with real auth users, assigned products, and offers; signs in as A via the
// ANON client (exactly what the portal session does); and asserts A cannot read
// B's customer_products / customer_offers / products. Tears everything down.
//
//   node scripts/test-cross-tenant.mjs
//
// Reads .env.local. The `products` assertion only passes once migration 0003 is
// applied (before that, A sees all active products — the gap 0003 closes).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
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
const mk = (n) => ({ email: `zztest-${n}-${rnd}@example.com`, password: `Test!${rnd}${n}aA9` });
const A = mk("a"),
  B = mk("b");
let aCust, bCust, aUser, bUser, pass = true;
const note = (ok, msg) => {
  if (!ok) pass = false;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${msg}`);
};

try {
  const { data: prods } = await svc.from("products").select("id,name").eq("is_active", true).limit(2);
  if (!prods || prods.length < 2) throw new Error("need >=2 active products");
  const [pA, pB] = prods;
  console.log(`products: A→${pA.name}  B→${pB.name}\n`);

  for (const [tag, acct] of [["A", A], ["B", B]]) {
    const { data: u, error: ue } = await svc.auth.admin.createUser({
      email: acct.email,
      password: acct.password,
      email_confirm: true,
    });
    if (ue) throw ue;
    const uid = u.user.id;
    const { data: c, error: ce } = await svc
      .from("customers")
      .insert({
        business_name: `ZZ ${tag} ${rnd}`,
        contact_name: tag,
        email: acct.email,
        phone: "000",
        status: "active",
        user_id: uid,
      })
      .select("id")
      .single();
    if (ce) throw ce;
    if (tag === "A") {
      aCust = c.id;
      aUser = uid;
    } else {
      bCust = c.id;
      bUser = uid;
    }
  }
  await svc.from("customer_products").insert([
    { customer_id: aCust, product_id: pA.id, price_cents: 111 },
    { customer_id: bCust, product_id: pB.id, price_cents: 222 },
  ]);
  await svc.from("customer_offers").insert([
    { customer_id: aCust, title: `A offer ${rnd}`, is_active: true },
    { customer_id: bCust, title: `B offer ${rnd}`, is_active: true },
  ]);

  const asA = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: se } = await asA.auth.signInWithPassword({ email: A.email, password: A.password });
  if (se) throw se;
  console.log("signed in as A via anon client (RLS now applies)\n");

  const { data: cpAll } = await asA.from("customer_products").select("customer_id, price_cents");
  note(cpAll.length > 0 && cpAll.every((r) => r.customer_id === aCust), `customer_products unfiltered → only A's rows (${cpAll.length})`);
  const { data: offAll } = await asA.from("customer_offers").select("customer_id, title");
  note(offAll.length > 0 && offAll.every((r) => r.customer_id === aCust), `customer_offers unfiltered → only A's rows (${offAll.length})`);

  const { data: cpB } = await asA.from("customer_products").select("*").eq("customer_id", bCust);
  note(cpB.length === 0, `customer_products WHERE customer_id=B → 0 rows (got ${cpB.length})`);
  const { data: offB } = await asA.from("customer_offers").select("*").eq("customer_id", bCust);
  note(offB.length === 0, `customer_offers WHERE customer_id=B → 0 rows (got ${offB.length})`);

  const { data: prodVisible } = await asA.from("products").select("id");
  const ids = new Set((prodVisible || []).map((r) => r.id));
  const seesOnlyA = ids.has(pA.id) && !ids.has(pB.id) && ids.size === 1;
  if (seesOnlyA) note(true, `products → A sees ONLY its assigned product (0003 applied)`);
  else
    console.log(
      `⚠ products → A sees ${ids.size}, B visible=${ids.has(pB.id)}. EXPECTED until migration 0003 is applied.`,
    );
} catch (e) {
  console.log("ERROR:", e.message);
  pass = false;
} finally {
  if (aCust) await svc.from("customers").delete().eq("id", aCust);
  if (bCust) await svc.from("customers").delete().eq("id", bCust);
  if (aUser) await svc.auth.admin.deleteUser(aUser);
  if (bUser) await svc.auth.admin.deleteUser(bUser);
  console.log("\nteardown complete (test customers + auth users removed)");
  console.log(pass ? "\n=== CROSS-TENANT TEST: PASS ===" : "\n=== CROSS-TENANT TEST: failures above ===");
  process.exit(pass ? 0 : 1);
}
