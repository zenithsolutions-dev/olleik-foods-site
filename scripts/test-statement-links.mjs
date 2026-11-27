// Statement delivery: the secure link, the messages, and the table behind them.
//   node scripts/test-local.mjs statement-links
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { buildStatementEmail } from "../src/lib/email/templates.ts";
import {
  LINK_LIFETIME_DAYS,
  expiryFor,
  hashToken,
  linkState,
  newToken,
  statementMessage,
  whatsappStatementUrl,
} from "../src/lib/statement-links.ts";

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : ` — ${detail}`}`);
};

// ---------- the token ----------
const a = newToken();
const b = newToken();
check("a token is long, URL-safe and different every time", /^[A-Za-z0-9_-]{43,}$/.test(a) && a !== b, a);
check("only a hash of the token is stored: 64 hex characters, not the token", /^[0-9a-f]{64}$/.test(hashToken(a)) && hashToken(a) !== a);
check("the same token always gives the same hash; another token gives another", hashToken(a) === hashToken(a) && hashToken(a) !== hashToken(b));

// ---------- expiry ----------
const NOW = new Date("2026-11-27T12:00:00Z");
check("links last 7 days", LINK_LIFETIME_DAYS === 7 && expiryFor(NOW).toISOString() === "2026-12-04T12:00:00.000Z");
const row = { expires_at: "2026-12-04T12:00:00.000Z", revoked_at: null };
check("valid before it expires", linkState(row, new Date("2026-12-04T11:59:59Z")) === "valid");
check("expired at the expiry moment and after", linkState(row, new Date("2026-12-04T12:00:00Z")) === "expired" && linkState(row, new Date("2027-01-01T00:00:00Z")) === "expired");
check("a revoked link is revoked even before it expires", linkState({ ...row, revoked_at: "2026-11-28T00:00:00Z" }, NOW) === "revoked");
check("an unknown link is 'missing'", linkState(null, NOW) === "missing");

// ---------- the WhatsApp button ----------
const msgArgs = { businessName: "Acme & Sons", periodLabel: "November 2026", url: "https://shop.example.test/statement/tok", expiresLabel: "Dec 4, 2026" };
const message = statementMessage(msgArgs);
check("the message names the business, the period, the link and when it stops working", ["Acme & Sons", "November 2026", "https://shop.example.test/statement/tok", "Dec 4, 2026"].every((s) => message.includes(s)), message);
check("the message has no cost, profit or margin wording", !/cost|profit|margin/i.test(message));
const withCode = whatsappStatementUrl("+1 (613) 555-0141", message);
check("a number with its country code opens a chat with that customer", withCode.hasRecipient && withCode.url.startsWith("https://wa.me/16135550141?text=") && decodeURIComponent(withCode.url.split("?text=")[1]) === message, withCode.url);
const local = whatsappStatementUrl("(613) 555-0141", message);
check("a number without a country code is not guessed: WhatsApp opens and the admin picks the contact", !local.hasRecipient && local.url.startsWith("https://wa.me/?text="));
check("no number at all: same", !whatsappStatementUrl("", message).hasRecipient && !whatsappStatementUrl(null, message).hasRecipient);
check("a local number with a leading 0 is not mistaken for an international one", !whatsappStatementUrl("07700 900123", message).hasRecipient);
check("an international number written without + still works", whatsappStatementUrl("1-613-555-0141", message).url.startsWith("https://wa.me/16135550141?"));
check("a junk number is not used", !whatsappStatementUrl("call the office", message).hasRecipient);

// ---------- the email ----------
const email = buildStatementEmail({ customerName: "Bistro <b>& Co</b>", businessName: "Acme & Sons", periodLabel: "November 2026", url: msgArgs.url, expiresLabel: "Dec 4, 2026" });
check("email: subject names the business and the period", email.subject.includes("Acme & Sons") && email.subject.includes("November 2026"), email.subject);
check("email: the button and the text both carry the link", email.html.includes(`href="${msgArgs.url}"`) && email.text.includes(msgArgs.url));
check("email: says when the link stops working", email.text.includes("Dec 4, 2026") && email.html.includes("Dec 4, 2026"));
check("email: customer text cannot become live HTML", !email.html.includes("<b>&") && email.html.includes("&lt;b&gt;"));
const words = email.text + email.html.replace(/style="[^"]*"/g, "").replace(/<[^>]+>/g, " ");
check("email: no cost, profit or margin wording", !/cost|profit|margin/i.test(words));

// ---------- database (0020) ----------
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }),
);
const opts = { auth: { persistSession: false } };
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, opts);
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opts);
const hashes = [];
try {
  const { data: customer } = await svc.from("customers").select("id").limit(1).single();
  const token = newToken();
  hashes.push(hashToken(token));
  const insert = (hash) => svc.from("statement_links").insert({ token_hash: hash, customer_id: customer.id, period_label: "QA", expires_at: expiryFor(new Date()).toISOString(), created_by: "qa@example.test" }).select("id").single();
  const first = await insert(hashes[0]);
  check("a link can be stored", !first.error, first.error?.message);
  check("the same token hash cannot be stored twice", (await insert(hashes[0])).error != null);
  check("a visitor (anon key) cannot list or read links", ((await anon.from("statement_links").select("id")).data ?? []).length === 0);
  check("a visitor cannot create a link", (await anon.from("statement_links").insert({ token_hash: "x".repeat(64), customer_id: customer.id, period_label: "x", expires_at: new Date().toISOString() }).select()).error != null);
  const found = await svc.from("statement_links").select("customer_id, expires_at, revoked_at").eq("token_hash", hashToken(token)).maybeSingle();
  check("the server finds the link by the token's hash", found.data?.customer_id === customer.id && linkState(found.data, new Date()) === "valid");
  check("a wrong token finds nothing", (await svc.from("statement_links").select("id").eq("token_hash", hashToken(newToken())).maybeSingle()).data === null);
} catch (e) {
  check("database checks ran", false, e.message);
} finally {
  for (const h of hashes) await svc.from("statement_links").delete().eq("token_hash", h);
}

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exitCode = failed ? 1 : 0;
