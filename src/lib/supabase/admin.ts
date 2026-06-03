import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role Supabase client for server actions and admin server components.
// The service-role key BYPASSES Row Level Security, so this must only ever run
// on the server — never import this from a "use client" module.
//
// Returns null when the env vars aren't set yet, so the site keeps building and
// running before Supabase is provisioned. Callers fall back to logging.

let cached: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  if (cached) return cached;
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
