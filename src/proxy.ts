import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAllowedAdmin } from "@/lib/admin/auth";

// Next.js 16: `middleware` was renamed to `proxy` (see node_modules/next docs).
// This gates the /admin panel: an unauthenticated or non-allowlisted visitor is
// redirected to /admin-login before any admin route renders. It also refreshes
// the Supabase auth session cookie on each matched request.
//
// This is an OPTIMISTIC gate — the authoritative check is requireAdmin() in the
// admin layout/server code. Keep both.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase not provisioned yet — nothing to authenticate against and no real
  // data behind /admin (it serves localStorage mock data). Don't gate, matching
  // the app's "works before Supabase is wired" behavior. The gate activates the
  // moment the env vars are set.
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() revalidates the token with Supabase — do not trust getSession()
  // in server code.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAllowedAdmin(user?.email)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/admin-login";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  // /admin-login lives OUTSIDE this matcher so the redirect target is reachable.
  matcher: ["/admin", "/admin/:path*"],
};
