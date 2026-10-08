// Local, throwaway stand-in for the app's Supabase project, for the video captures only.
//   node devstack/stack.mjs          start (first run: init the database, apply bootstrap.sql + every migration)
//   node devstack/stack.mjs --reset  delete the local database first
//
// Pieces (all on this machine, nothing leaves it):
//   Postgres 18 (embedded-postgres binaries)  127.0.0.1:54329, data in devstack/_data
//   PostgREST 14 (official Windows binary)     127.0.0.1:54330
//   gateway (this file)                         http://127.0.0.1:54321  — /rest/v1 → PostgREST, /auth/v1 → auth emulator,
//                                                                         /storage/v1 → local folder
// The JWT secret and the derived anon / service keys are local test values, written to devstack/_keys.json (git-ignored)
// and handed to the Next dev server through process env by devstack/dev.mjs. They are not secrets of any real project.
import { spawn } from "node:child_process";
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const DATA = join(HERE, "_data");
const STORE = join(HERE, "_storage");
const KEYS = join(HERE, "_keys.json");
const PG_PORT = 54329;
const REST_PORT = 54330;
const GW_PORT = 54321;
const PG_PASS = "local-only-postgres";
const PGBIN = join(HERE, "..", "node_modules", "@embedded-postgres", "windows-x64", "native", "bin");

if (process.argv.includes("--reset")) {
  rmSync(DATA, { recursive: true, force: true });
  rmSync(STORE, { recursive: true, force: true });
}
const fresh = !existsSync(join(DATA, "PG_VERSION"));

// ——— keys ———————————————————————————————————————————————————————————————————————————————————————
const b64u = (b) => Buffer.from(b).toString("base64url");
export const signJwt = (payload, secret) => {
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64u(JSON.stringify(payload));
  return `${head}.${body}.${createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url")}`;
};
const verifyJwt = (token, secret) => {
  const [h, p, s] = String(token ?? "").split(".");
  if (!s) return null;
  const want = createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
  if (want.length !== s.length || !timingSafeEqual(Buffer.from(want), Buffer.from(s))) return null;
  const claims = JSON.parse(Buffer.from(p, "base64url").toString());
  if (claims.exp && claims.exp < Date.now() / 1000) return null;
  return claims;
};
let keys = existsSync(KEYS) && !fresh ? JSON.parse(readFileSync(KEYS, "utf8")) : null;
if (!keys) {
  const secret = randomBytes(32).toString("hex");
  const far = Math.floor(Date.now() / 1000) + 10 * 365 * 86400;
  keys = {
    note: "Local test values for the throwaway video database. Not the keys of any real project.",
    url: `http://127.0.0.1:${GW_PORT}`,
    jwtSecret: secret,
    anonKey: signJwt({ iss: "supabase-local", role: "anon", exp: far }, secret),
    serviceKey: signJwt({ iss: "supabase-local", role: "service_role", exp: far }, secret),
  };
  writeFileSync(KEYS, JSON.stringify(keys, null, 2));
}

// ——— Postgres ———————————————————————————————————————————————————————————————————————————————————
const pgServer = new EmbeddedPostgres({ databaseDir: DATA, user: "postgres", password: PG_PASS, port: PG_PORT, persistent: true, initdbFlags: ["--encoding=UTF8", "--locale=C"], onLog: () => {}, onError: (e) => console.error("[pg]", String(e).trim()) });
if (fresh) await pgServer.initialise();
await pgServer.start();
const pool = new pg.Pool({ host: "127.0.0.1", port: PG_PORT, user: "postgres", password: PG_PASS, database: "postgres", max: 4 });
if (fresh) {
  await pool.query(readFileSync(join(HERE, "bootstrap.sql"), "utf8"));
  const dir = join(ROOT, "supabase", "migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    await pool.query(readFileSync(join(dir, f), "utf8"));
    console.log(`[db] applied ${f}`);
  }
  // The demo database starts empty: the seed in 0001 is replaced by devstack/seed.mjs (clearly fictional records).
  await pool.query("notify pgrst, 'reload schema'");
}

// ——— PostgREST ——————————————————————————————————————————————————————————————————————————————————
const conf = join(HERE, "_postgrest.conf");
writeFileSync(conf, [
  `db-uri = "postgres://authenticator:local-only-authenticator@127.0.0.1:${PG_PORT}/postgres"`,
  `db-schemas = "public"`,
  `db-anon-role = "anon"`,
  `jwt-secret = "${keys.jwtSecret}"`,
  `server-host = "127.0.0.1"`,
  `server-port = ${REST_PORT}`,
  `db-pool = 8`,
  `log-level = "warn"`,
].join("\n"));
const rest = spawn(join(HERE, "_bin", "postgrest.exe"), [conf], { env: { ...process.env, PATH: `${PGBIN};${process.env.PATH}` }, stdio: ["ignore", "inherit", "inherit"] });
rest.on("exit", (c) => console.log(`[rest] exited ${c}`));

// ——— auth emulator ——————————————————————————————————————————————————————————————————————————————
const hash = (pw) => {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(pw, salt, 32).toString("hex")}`;
};
const check = (pw, stored) => {
  const [, salt, h] = String(stored ?? "").split("$");
  if (!salt) return false;
  const got = scryptSync(pw, salt, 32);
  return timingSafeEqual(got, Buffer.from(h, "hex"));
};
const userJson = (u) => ({
  id: u.id,
  aud: "authenticated",
  role: "authenticated",
  email: u.email,
  email_confirmed_at: u.email_confirmed_at,
  confirmed_at: u.email_confirmed_at,
  invited_at: u.invited_at,
  last_sign_in_at: u.last_sign_in_at,
  phone: "",
  app_metadata: u.raw_app_meta_data ?? { provider: "email", providers: ["email"] },
  user_metadata: u.raw_user_meta_data ?? {},
  identities: [],
  created_at: u.created_at,
  updated_at: u.updated_at,
  is_anonymous: false,
});
const refresh = new Map(); // refresh token → user id (in memory: sessions end when the stack stops)
const session = (u) => {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;
  const sid = randomUUID();
  const access = signJwt({ sub: u.id, aud: "authenticated", role: "authenticated", email: u.email, iat: now, exp, session_id: sid, aal: "aal1", amr: [{ method: "password", timestamp: now }], app_metadata: u.raw_app_meta_data, user_metadata: u.raw_user_meta_data, is_anonymous: false }, keys.jwtSecret);
  const rt = randomBytes(24).toString("hex");
  refresh.set(rt, u.id);
  return { access_token: access, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: rt, user: userJson(u) };
};
const byEmail = async (email) => (await pool.query("select * from auth.users where lower(email) = lower($1)", [email])).rows[0];
const byId = async (id) => (await pool.query("select * from auth.users where id = $1", [id])).rows[0];
const err = (status, code, msg) => ({ status, body: { code: status, error_code: code, msg } });

async function auth(req, path, q, body, claims) {
  const isService = claims?.role === "service_role";
  if (path === "/health" || path === "/settings") return { status: 200, body: { external: { email: true }, disable_signup: true, mailer_autoconfirm: false } };
  if (path === "/token" && req.method === "POST") {
    if (q.get("grant_type") === "password") {
      const u = await byEmail(body.email ?? "");
      if (!u || !check(body.password ?? "", u.encrypted_password)) return err(400, "invalid_credentials", "Invalid login credentials");
      await pool.query("update auth.users set last_sign_in_at = now() where id = $1", [u.id]);
      return { status: 200, body: session(await byId(u.id)) };
    }
    if (q.get("grant_type") === "refresh_token") {
      const id = refresh.get(body.refresh_token);
      if (!id) return err(400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
      refresh.delete(body.refresh_token);
      const u = await byId(id);
      return u ? { status: 200, body: session(u) } : err(400, "user_not_found", "User not found");
    }
    return err(400, "unsupported_grant_type", "Unsupported grant type");
  }
  if (path === "/logout") return { status: 204 };
  if (path === "/recover" || path === "/otp" || path === "/resend") return { status: 200, body: {} }; // no email is ever sent
  if (path === "/user") {
    if (!claims?.sub) return err(401, "no_authorization", "This endpoint requires a valid Bearer token");
    if (req.method === "PUT") {
      if (body.password) await pool.query("update auth.users set encrypted_password = $2, updated_at = now() where id = $1", [claims.sub, hash(body.password)]);
      if (body.data) await pool.query("update auth.users set raw_user_meta_data = raw_user_meta_data || $2, updated_at = now() where id = $1", [claims.sub, body.data]);
    }
    const u = await byId(claims.sub);
    return u ? { status: 200, body: userJson(u) } : err(403, "user_not_found", "User from sub claim in JWT does not exist");
  }
  if (path === "/verify") return err(403, "otp_expired", "Email link is invalid or has expired");
  // ——— admin (service role only) ———
  if (!isService) return err(403, "not_admin", "User not allowed");
  if (path === "/invite" && req.method === "POST") {
    if (await byEmail(body.email)) return err(422, "email_exists", "A user with this email address has already been registered");
    const u = (await pool.query("insert into auth.users (email, invited_at, raw_user_meta_data) values ($1, now(), $2) returning *", [body.email, body.data ?? {}])).rows[0];
    return { status: 200, body: userJson(u) };
  }
  if (path === "/admin/generate_link" && req.method === "POST") {
    let u = await byEmail(body.email);
    if (!u) u = (await pool.query("insert into auth.users (email, invited_at, raw_user_meta_data) values ($1, now(), $2) returning *", [body.email, body.data ?? {}])).rows[0];
    const tok = randomBytes(16).toString("hex");
    return { status: 200, body: { ...userJson(u), action_link: `http://127.0.0.1:${GW_PORT}/auth/v1/verify?token=${tok}&type=${body.type}`, email_otp: "000000", hashed_token: tok, redirect_to: body.redirect_to ?? "", verification_type: body.type } };
  }
  if (path === "/admin/users" && req.method === "GET") {
    const per = Number(q.get("per_page") ?? 50);
    const page = Number(q.get("page") ?? 1);
    const rows = (await pool.query("select * from auth.users order by created_at limit $1 offset $2", [per, (page - 1) * per])).rows;
    const total = (await pool.query("select count(*)::int n from auth.users")).rows[0].n;
    return { status: 200, body: { users: rows.map(userJson), aud: "authenticated" }, headers: { "x-total-count": String(total) } };
  }
  if (path === "/admin/users" && req.method === "POST") {
    if (await byEmail(body.email)) return err(422, "email_exists", "A user with this email address has already been registered");
    const u = (await pool.query("insert into auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data) values ($1, $2, case when $3 then now() end, $4) returning *", [body.email, body.password ? hash(body.password) : null, !!body.email_confirm, body.user_metadata ?? {}])).rows[0];
    return { status: 200, body: userJson(u) };
  }
  const m = path.match(/^\/admin\/users\/([0-9a-f-]{36})$/);
  if (m) {
    if (req.method === "DELETE") {
      await pool.query("delete from auth.users where id = $1", [m[1]]);
      return { status: 200, body: {} };
    }
    if (req.method === "PUT") {
      if (body.password) await pool.query("update auth.users set encrypted_password = $2 where id = $1", [m[1], hash(body.password)]);
      if (body.email_confirm) await pool.query("update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = $1", [m[1]]);
    }
    const u = await byId(m[1]);
    return u ? { status: 200, body: userJson(u) } : err(404, "user_not_found", "User not found");
  }
  return err(404, "not_found", `No local emulation for ${req.method} ${path}`);
}

// ——— gateway ————————————————————————————————————————————————————————————————————————————————————
const readBody = (req) => new Promise((ok) => {
  const parts = [];
  req.on("data", (c) => parts.push(c));
  req.on("end", () => ok(Buffer.concat(parts)));
});
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "access-control-expose-headers": "*" };
const gw = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${GW_PORT}`);
  const raw = await readBody(req);
  const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "") || req.headers.apikey;
  console.log(`[gw] ${req.method} ${url.pathname}`);
  try {
    if (req.method === "OPTIONS") return res.writeHead(204, cors).end();
    if (url.pathname.startsWith("/rest/v1")) {
      const headers = { ...req.headers, host: `127.0.0.1:${REST_PORT}` };
      if (bearer) headers.authorization = `Bearer ${bearer}`;
      delete headers.apikey;
      const up = http.request({ host: "127.0.0.1", port: REST_PORT, method: req.method, path: url.pathname.slice(8) + url.search, headers }, (r) => {
        res.writeHead(r.statusCode, { ...r.headers, ...cors });
        r.pipe(res);
      });
      up.on("error", (e) => res.writeHead(502).end(String(e)));
      return up.end(raw);
    }
    if (url.pathname.startsWith("/auth/v1")) {
      const claims = verifyJwt(bearer, keys.jwtSecret);
      let body = {};
      try { body = raw.length ? JSON.parse(raw.toString()) : {}; } catch {}
      const out = await auth(req, url.pathname.slice(8), url.searchParams, body, claims);
      res.writeHead(out.status, { "content-type": "application/json", ...cors, ...(out.headers ?? {}) });
      return res.end(out.body === undefined ? "" : JSON.stringify(out.body));
    }
    if (url.pathname.startsWith("/storage/v1/object")) {
      const rel = decodeURIComponent(url.pathname.replace(/^\/storage\/v1\/object\/(public\/)?/, ""));
      const file = join(STORE, rel);
      if (!file.startsWith(STORE)) return res.writeHead(400).end();
      if (req.method === "GET") return existsSync(file) ? res.writeHead(200, cors).end(readFileSync(file)) : res.writeHead(404, cors).end();
      if (req.method === "POST" || req.method === "PUT") {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, raw);
        res.writeHead(200, { "content-type": "application/json", ...cors });
        return res.end(JSON.stringify({ Key: rel, Id: randomUUID() }));
      }
      if (req.method === "DELETE") {
        const names = JSON.parse(raw.toString() || "{}").prefixes ?? [];
        for (const n of names) rmSync(join(STORE, rel, n), { force: true });
        res.writeHead(200, { "content-type": "application/json", ...cors });
        return res.end("[]");
      }
    }
    res.writeHead(404, { "content-type": "application/json", ...cors }).end(JSON.stringify({ message: "not emulated" }));
  } catch (e) {
    console.error("[gw] error", e);
    res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ message: String(e?.message ?? e) }));
  }
});
gw.listen(GW_PORT, "127.0.0.1", () => console.log(`[gw] local Supabase stand-in at http://127.0.0.1:${GW_PORT} (db ${fresh ? "created" : "reused"})`));

const stop = async () => {
  rest.kill();
  gw.close();
  await pool.end().catch(() => {});
  await pgServer.stop().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
