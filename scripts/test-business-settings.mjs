// Business settings (0016): the business's public identity lives in ONE database row, editable by the admin,
// readable by anyone (it is what the site prints on documents), writable only through the service role.
//   node scripts/test-local.mjs business-settings
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { identityFromRow, parseBusinessSettings } from "../src/lib/business.ts";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const opts = { auth: { persistSession: false } };
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, opts);
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opts);

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : ` — ${detail}`}`);
};

// ---------- pure mapping ----------
const empty = identityFromRow(null, {});
check("no row, no env: every field is an obvious placeholder", [empty.displayName, empty.legalName, empty.address, empty.phone, empty.email].every((v) => v.startsWith("[")), JSON.stringify(empty));
check("no row: WhatsApp number is absent, not a placeholder", empty.whatsappNumber === null);
const fromEnv = identityFromRow(null, { BUSINESS_LEGAL_NAME: "Env Legal Ltd." });
check("no row: env value is used", fromEnv.legalName === "Env Legal Ltd.");
const row = { display_name: "Acme Wholesale", legal_name: "Acme Wholesale Inc.", address: "1 Test Rd", phone: "555-0100", email: "hi@acme.test", whatsapp_number: "+1 (555) 010-0199" };
const full = identityFromRow(row, { BUSINESS_LEGAL_NAME: "Env Legal Ltd." });
check("row beats env", full.legalName === "Acme Wholesale Inc." && full.displayName === "Acme Wholesale");
check("WhatsApp number is kept as digits only (wa.me format)", full.whatsappNumber === "15550100199", String(full.whatsappNumber));
const blank = identityFromRow({ ...row, phone: "   " }, { BUSINESS_PHONE: "555-0111" });
check("blank row field falls back to env", blank.phone === "555-0111", blank.phone);
check("no business name is baked into the code", !JSON.stringify(empty).toLowerCase().includes("olleik"));

// ---------- what the Settings form accepts ----------
const good = parseBusinessSettings({ display_name: "  Acme Wholesale ", legal_name: "", address: "1 Test Rd", phone: "555-0100", email: "Hi@Acme.test", whatsapp_number: "+1 555 010 0199" });
check("valid form: trimmed, blanks stored as null, email lower-cased", good.ok && good.row.display_name === "Acme Wholesale" && good.row.legal_name === null && good.row.email === "hi@acme.test", JSON.stringify(good));
check("business name is required", parseBusinessSettings({ display_name: " " }).ok === false);
check("a malformed email is rejected", parseBusinessSettings({ display_name: "A", email: "not-an-email" }).ok === false);
check("a WhatsApp number without a country code length is rejected", parseBusinessSettings({ display_name: "A", whatsapp_number: "12345" }).ok === false);
check("an ordinary email containing the letter s is accepted", parseBusinessSettings({ display_name: "A", email: "sales@business.com" }).ok === true);
check("an email with no dot in the domain is rejected", parseBusinessSettings({ display_name: "A", email: "a@bXc" }).ok === false);
check("a WhatsApp number written with brackets and dashes is accepted", parseBusinessSettings({ display_name: "A", whatsapp_number: "+1 (613) 555-0142" }).ok === true);
check("a short number padded with spaces is rejected", parseBusinessSettings({ display_name: "A", whatsapp_number: "+1 234 5" }).ok === false);
check("an over-long value is rejected", parseBusinessSettings({ display_name: "A".repeat(81) }).ok === false);

// ---------- database ----------
const before = await svc.from("business_settings").select("*").maybeSingle();
check("service role reads the single settings row", !before.error && before.data != null, before.error?.message);
const pub = await anon.from("business_settings").select("display_name, phone").maybeSingle();
check("a visitor (anon) can read the identity", !pub.error && pub.data != null, pub.error?.message);
const hack = await anon.from("business_settings").update({ display_name: "HACKED" }).eq("id", true).select();
const after = await svc.from("business_settings").select("display_name").maybeSingle();
check("a visitor cannot change it", (hack.data ?? []).length === 0 && after.data?.display_name === before.data?.display_name);
const second = await svc.from("business_settings").insert({ id: false }).select();
check("a second settings row is rejected", second.error != null);

// ---------- time zone is a setting, not Toronto baked into SQL (0017) ----------
for (const tz of ["America/Toronto", "Asia/Tokyo"]) {
  const r = await svc.rpc("analytics_revenue_buckets", { p_start: null, p_end: null, p_bucket: "day", p_time_zone: tz });
  const hours = new Set((r.data ?? []).map((b) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(new Date(b.bucket_start))));
  check(`revenue day buckets start at local midnight in ${tz}`, !r.error && (r.data ?? []).length > 0 && hours.size === 1 && hours.has("00"), r.error?.message ?? [...hours].join(","));
}

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exitCode = failed ? 1 : 0; // not process.exit(): on Windows it aborts while fetch sockets are closing
