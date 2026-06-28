"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Lands here from an invite or password-reset email link. Establishes the
// session from whatever the link delivered, then forwards to `next`
// (default /auth/set-password). Handles all three flows:
//   - implicit (#access_token=…)  → createBrowserClient auto-detects on load
//   - PKCE (?code=…)              → exchangeCodeForSession
//   - token_hash (?token_hash&type) → verifyOtp (if templates are customized)
// Reads window.location directly (no useSearchParams) so no Suspense is needed.
export default function AuthConfirmPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const tokenHash = url.searchParams.get("token_hash");
    const type = url.searchParams.get("type") as EmailOtpType | null;
    const next = url.searchParams.get("next") || "/auth/set-password";

    (async () => {
      try {
        // Prefer the token_hash flow (our invite/reset links use it): verifyOtp
        // needs no PKCE code verifier and no URL hash, so it's reliable on every
        // device. exchangeCodeForSession is only for genuine in-browser PKCE
        // flows; the implicit-hash fallback covers default email templates.
        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("no session established from link");
        router.replace(next);
      } catch (err) {
        console.error("[auth/confirm] could not establish session:", (err as Error)?.message);
        setFailed(true);
        setTimeout(() => router.replace("/login?error=auth"), 1800);
      }
    })();
  }, [router]);

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-sm text-muted">
        {failed ? "That link is invalid or has expired. Taking you back to sign in…" : "Confirming your link…"}
      </p>
    </section>
  );
}
