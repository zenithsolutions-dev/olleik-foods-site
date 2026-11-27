import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAllowedAdmin, isOwner } from "./auth";

// Authoritative server-side admin check. Call this in admin server components /
// server actions — NOT just in proxy.ts. Per the Next.js docs, proxy is an
// optimistic gate and a matcher refactor can silently drop coverage, so the
// real authorization must live in the data layer.
//
// Returns the authenticated admin's email, or:
//   - null when Supabase isn't provisioned yet (env unset) — the app runs in
//     mock/demo mode and there's no real data to protect, matching the rest of
//     the codebase's "log until provisioned" fallback.
//   - redirects to /admin-login when Supabase IS configured but the visitor is
//     not a signed-in, allowlisted admin.
export async function requireAdmin(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAllowedAdmin(user?.email)) {
    redirect("/admin-login");
  }
  return user!.email ?? null;
}

// Cost, profit and margins are owner-only (see isOwner). Demo mode (no Supabase) has no real data: owner.
export async function getAdminAccess(): Promise<{ email: string | null; isOwner: boolean }> {
  const email = await requireAdmin();
  return { email, isOwner: email === null || isOwner(email) };
}

// For pages and actions that exist only to show or change cost, profit or margins.
export async function requireOwner(): Promise<string | null> {
  const { email, isOwner: owner } = await getAdminAccess();
  if (!owner) redirect("/admin");
  return email;
}
