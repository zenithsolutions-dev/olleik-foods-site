// Unit test for the /auth/confirm link parser (src/lib/auth/callback-params.ts).
// Run: node --experimental-strip-types scripts/test-auth-callback.mjs
import assert from "node:assert/strict";
import { parseAuthCallback, safeNext, describeCallbackError } from "../src/lib/auth/callback-params.ts";

const O = "https://example.test";
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("default Supabase template → implicit tokens in the hash", () => {
  const r = parseAuthCallback(`${O}/auth/confirm?next=/auth/set-password#access_token=AT&refresh_token=RT&type=invite&expires_in=3600`);
  assert.deepEqual(r, { kind: "implicit", accessToken: "AT", refreshToken: "RT", next: "/auth/set-password" });
});

t("custom template / WhatsApp link → token_hash", () => {
  const r = parseAuthCallback(`${O}/auth/confirm?token_hash=TH&type=invite&next=%2Fauth%2Fset-password`);
  assert.deepEqual(r, { kind: "token_hash", tokenHash: "TH", type: "invite", next: "/auth/set-password" });
});

t("PKCE code", () => {
  const r = parseAuthCallback(`${O}/auth/confirm?code=abc`);
  assert.deepEqual(r, { kind: "code", code: "abc", next: "/auth/set-password" });
});

t("consumed / expired link → error wins over anything else", () => {
  const r = parseAuthCallback(`${O}/auth/confirm?next=/auth/set-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`);
  assert.equal(r.kind, "error");
  assert.equal(r.code, "otp_expired");
  assert.match(describeCallbackError(r.code), /already used/);
});

t("nothing usable → none", () => {
  assert.deepEqual(parseAuthCallback(`${O}/auth/confirm`), { kind: "none", next: "/auth/set-password" });
});

t("access_token without refresh_token is not an implicit session", () => {
  assert.equal(parseAuthCallback(`${O}/auth/confirm#access_token=AT`).kind, "none");
});

t("next is restricted to same-origin paths", () => {
  assert.equal(safeNext("https://evil.test"), "/auth/set-password");
  assert.equal(safeNext("//evil.test"), "/auth/set-password");
  assert.equal(safeNext("/portal"), "/portal");
  assert.equal(parseAuthCallback(`${O}/auth/confirm?next=https://evil.test`).next, "/auth/set-password");
});

console.log(`\n${n} tests passed`);
