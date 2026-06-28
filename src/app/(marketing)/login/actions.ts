"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAllowedAdmin } from "@/lib/admin/auth";

// Resolve where a just-signed-in user should land, server-side. Uses the
// session-bound client (RLS-scoped). Returns a path the client redirects to:
//   - allowlisted admin            -> /admin
//   - active customer (own row)    -> /portal
//   - signed in but not active     -> /login?status=pending
//   - not signed in / unconfigured -> /login
export async function resolveLandingRoute(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return "/login";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "/login";

  if (isAllowedAdmin(user.email)) return "/admin";

  // Own customers row only (RLS: user_id = auth.uid()).
  const { data: rows } = await supabase
    .from("customers")
    .select("status")
    .eq("user_id", user.id)
    .limit(1);

  const status = rows?.[0]?.status;
  if (status === "active") return "/portal";
  return "/login?status=pending";
}
