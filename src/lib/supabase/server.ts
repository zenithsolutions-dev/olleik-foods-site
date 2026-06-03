import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Auth-aware Supabase client for the (future) customer portal. Uses the public
// anon key and the signed-in user's session from cookies, so RLS applies and
// each customer sees only their own data. Not yet wired into any route — this
// is the foundation for portal login.

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component where cookies can't be set —
            // safe to ignore; session refresh happens in middleware.
          }
        },
      },
    },
  );
}
