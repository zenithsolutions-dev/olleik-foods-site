// End-to-end HTTP proof of the login gate using @supabase/ssr's OWN cookie
// format. We sign in through a server client backed by an in-memory cookie jar
// (so the cookies are byte-identical to what the browser writes), then replay
// those cookies against the running dev server:
//   GET /portal  -> expect 200 (authenticated customer admitted)
//   with no cookies -> expect redirect to /login (gate still closed)
// This validates the destination the hard-navigation fix sends users to.
import { createServerClient } from "@supabase/ssr";
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

const BASE = process.env.BASE || "http://localhost:3001";
const EMAIL = "qa-login-test@olleik-foods.test";
const PASSWORD = "Test1234!pass";

// In-memory cookie jar that @supabase/ssr will populate on sign-in.
const jar = new Map();
const supabase = createServerClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (toSet) => toSet.forEach(({ name, value }) => jar.set(name, value)),
    },
  },
);

const { error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (error) {
  console.error("signInWithPassword FAILED:", error.message);
  process.exit(1);
}
const cookieHeader = [...jar.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
console.log("signed in; auth cookies set:", [...jar.keys()].join(", "));

async function check(path, cookie) {
  const res = await fetch(BASE + path, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  const loc = res.headers.get("location");
  return { status: res.status, location: loc };
}

console.log("\n--- WITH valid auth cookies ---");
const portal = await check("/portal", cookieHeader);
console.log("GET /portal ->", portal.status, portal.location ? `redirect ${portal.location}` : "(rendered)");

console.log("\n--- WITHOUT cookies (gate must still close) ---");
const anon = await check("/portal", "");
console.log("GET /portal ->", anon.status, anon.location ? `redirect ${anon.location}` : "(rendered)");

console.log("\n>>> RESULT:");
const portalOk = portal.status === 200 && !portal.location;
const gateOk = anon.status >= 300 && anon.status < 400 && /\/login/.test(anon.location || "");
console.log("   authenticated customer admitted to /portal:", portalOk);
console.log("   anonymous visitor redirected to /login:     ", gateOk);
console.log(portalOk && gateOk ? "\nPASS" : "\nFAIL");
