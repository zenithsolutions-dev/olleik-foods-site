// QA harness for the lead -> customer -> invite -> login lifecycle.
//
//   node scripts/qa-lifecycle-admin.mjs setup    # create a throwaway admin auth user
//   node scripts/qa-lifecycle-admin.mjs status   # show QA leads/customers/auth users
//   node scripts/qa-lifecycle-admin.mjs cleanup  # delete everything the QA run created
//
// The admin user is only useful on a dev server started with
// ADMIN_EMAILS=<QA_ADMIN_EMAIL>; production's allowlist is untouched.
// Reads .env.local for the Supabase keys and never prints them.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const QA_ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL || "qa-admin@olleik-foods.test";
const QA_ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD;
// Every scenario email is a plus-alias of the owner's own inbox.
const QA_EMAIL_RE = /^znthsolutions\+qa\d+@gmail\.com$/i;

const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listAuthUsers() {
  const out = [];
  for (let page = 1; page < 20; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < 200) break;
  }
  return out;
}

const isQaEmail = (e) => !!e && (QA_EMAIL_RE.test(e) || e.toLowerCase() === QA_ADMIN_EMAIL.toLowerCase());

async function setup() {
  if (!QA_ADMIN_PASSWORD || QA_ADMIN_PASSWORD.length < 12) throw new Error("set QA_ADMIN_PASSWORD (>=12 chars)");
  const existing = (await listAuthUsers()).find((u) => u.email?.toLowerCase() === QA_ADMIN_EMAIL.toLowerCase());
  if (existing) {
    const { error } = await svc.auth.admin.updateUserById(existing.id, { password: QA_ADMIN_PASSWORD });
    if (error) throw error;
    console.log("qa admin already existed; password reset:", QA_ADMIN_EMAIL);
    return;
  }
  const { error } = await svc.auth.admin.createUser({ email: QA_ADMIN_EMAIL, password: QA_ADMIN_PASSWORD, email_confirm: true });
  if (error) throw error;
  console.log("qa admin created:", QA_ADMIN_EMAIL);
}

async function status() {
  const { data: leads } = await svc.from("leads").select("id, email, status, converted_customer_id, business_name").order("submitted_at", { ascending: false }).limit(200);
  const { data: customers } = await svc.from("customers").select("id, email, status, user_id, source_lead_id, business_name").order("created_at", { ascending: false }).limit(200);
  const users = await listAuthUsers();
  const row = (x) => ({ ...x, id: x.id?.slice(0, 8), converted_customer_id: x.converted_customer_id?.slice(0, 8), user_id: x.user_id?.slice(0, 8), source_lead_id: x.source_lead_id?.slice(0, 8) });
  console.log("LEADS");
  console.table((leads ?? []).filter((l) => isQaEmail(l.email)).map(row));
  console.log("CUSTOMERS");
  console.table((customers ?? []).filter((c) => isQaEmail(c.email)).map(row));
  console.log("AUTH USERS");
  console.table(users.filter((u) => isQaEmail(u.email)).map((u) => ({ id: u.id.slice(0, 8), email: u.email, confirmed: !!u.email_confirmed_at, last_sign_in: u.last_sign_in_at })));
}

async function cleanup() {
  const { data: customers } = await svc.from("customers").select("id, email").limit(500);
  const qaCustomers = (customers ?? []).filter((c) => isQaEmail(c.email));
  for (const c of qaCustomers) {
    // child rows first (FKs without cascade)
    for (const t of ["customer_products", "customer_offers", "order_items", "orders"]) {
      await svc.from(t).delete().eq("customer_id", c.id);
    }
    const { error } = await svc.from("customers").delete().eq("id", c.id);
    console.log("customer", c.email, error ? "FAILED: " + error.message : "deleted");
  }
  const { data: leads } = await svc.from("leads").select("id, email").limit(500);
  for (const l of (leads ?? []).filter((x) => isQaEmail(x.email))) {
    const { error } = await svc.from("leads").delete().eq("id", l.id);
    console.log("lead", l.email, error ? "FAILED: " + error.message : "deleted");
  }
  for (const u of (await listAuthUsers()).filter((x) => isQaEmail(x.email))) {
    const { error } = await svc.auth.admin.deleteUser(u.id);
    console.log("auth user", u.email, error ? "FAILED: " + error.message : "deleted");
  }
}

const cmd = process.argv[2];
const run = { setup, status, cleanup }[cmd];
if (!run) {
  console.error("usage: node scripts/qa-lifecycle-admin.mjs setup|status|cleanup");
  process.exit(2);
}
run().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
