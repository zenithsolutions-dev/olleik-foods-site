import type { EmailOtpType } from "@supabase/supabase-js";

// Pure parser for the URL an invite / password-reset email lands on
// (/auth/confirm). Supabase can deliver the credential three ways, depending on
// how the email template is configured:
//   - token_hash in the query  (?token_hash=…&type=invite)   — custom templates
//   - PKCE code in the query   (?code=…)                     — in-browser flows
//   - implicit tokens in the HASH (#access_token=…&refresh_token=…) — the
//     DEFAULT `{{ .ConfirmationURL }}` template after /auth/v1/verify redirects.
// The hash can also carry an error (#error=access_denied&error_code=otp_expired)
// when the one-time token was already used (e.g. by a mail scanner) or expired.
//
// No browser APIs here so it is unit-testable with plain node.

export type AuthCallback =
  | { kind: "token_hash"; tokenHash: string; type: EmailOtpType; next: string }
  | { kind: "code"; code: string; next: string }
  | { kind: "implicit"; accessToken: string; refreshToken: string; next: string }
  | { kind: "error"; code: string | null; description: string | null; next: string }
  | { kind: "none"; next: string };

export const DEFAULT_NEXT = "/auth/set-password";

// Only allow same-origin relative paths for `next` so the link can never be
// turned into an open redirect.
export function safeNext(raw: string | null): string {
  if (!raw) return DEFAULT_NEXT;
  if (!raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_NEXT;
  return raw;
}

export function parseAuthCallback(href: string): AuthCallback {
  const url = new URL(href);
  const q = url.searchParams;
  const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  const next = safeNext(q.get("next") ?? hash.get("next"));

  // An error in either place wins: the token is gone, nothing else can succeed.
  const errCode = hash.get("error_code") ?? q.get("error_code");
  const errDesc = hash.get("error_description") ?? q.get("error_description");
  const err = hash.get("error") ?? q.get("error");
  if (err || errCode || errDesc) {
    return { kind: "error", code: errCode ?? err, description: errDesc, next };
  }

  const tokenHash = q.get("token_hash");
  const type = q.get("type") as EmailOtpType | null;
  if (tokenHash && type) return { kind: "token_hash", tokenHash, type, next };

  const code = q.get("code");
  if (code) return { kind: "code", code, next };

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken && refreshToken) return { kind: "implicit", accessToken, refreshToken, next };

  return { kind: "none", next };
}

// User-facing copy for a failed link. `otp_expired` is what Supabase sends when
// the one-time token was already consumed or is past its TTL.
export function describeCallbackError(code: string | null): string {
  if (code === "otp_expired") {
    return "This link has expired or was already used. Ask for a new invite or reset link.";
  }
  return "That link is invalid or has expired. Taking you back to sign in…";
}
