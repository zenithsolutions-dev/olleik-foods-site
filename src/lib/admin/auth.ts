// Admin allowlist. The /admin panel and the (future) customer portal both
// authenticate against the SAME Supabase project, so "is signed in" is NOT
// enough to be an admin — otherwise any customer account could reach /admin.
// ADMIN_EMAILS is a comma-separated list of the emails allowed in.
//
// Pure + dependency-free on purpose: imported by both `proxy.ts` (the edge/
// node gate) and server components. No "server-only" guard here so the proxy
// can use it; it reads nothing secret.

export function adminEmailAllowlist(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = adminEmailAllowlist();
  // FAIL CLOSED: an empty allowlist grants NO ONE admin. Now that customers can
  // sign in to the same Supabase project (the portal), an open default would
  // make every customer an admin. ADMIN_EMAILS is therefore REQUIRED in any
  // environment where Supabase is configured (Vercel prod + preview, local).
  // The safe failure if it's ever unset is admin lockout, never escalation.
  if (allow.length === 0) return false;
  return allow.includes(email.toLowerCase());
}
