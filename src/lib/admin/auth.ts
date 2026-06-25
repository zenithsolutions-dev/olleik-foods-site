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
  // Empty allowlist => any authenticated user is admin. Safe while the customer
  // portal doesn't exist yet, but you MUST set ADMIN_EMAILS before launching it.
  if (allow.length === 0) return true;
  return allow.includes(email.toLowerCase());
}
