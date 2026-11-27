"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { describeCallbackError, parseAuthCallback } from "@/lib/auth/callback-params";

// Lands here from an invite or password-reset email link. Establishes the
// session from whatever the link delivered, then forwards to `next`
// (default /auth/set-password). Handles every shape Supabase can send:
//   - token_hash (?token_hash&type) → verifyOtp
//   - PKCE (?code=…)                → exchangeCodeForSession
//   - implicit (#access_token=…)    → setSession with the tokens from the hash
//   - error (#error_code=otp_expired) → clear message, back to sign in
//
// The implicit case is handled BY HAND on purpose: the browser client from
// @supabase/ssr runs in PKCE mode, and in that mode auth-js REJECTS an implicit
// hash URL outright ("Not a valid PKCE flow url"), so the library's own
// detectSessionInUrl never establishes a session from the default Supabase
// email template. That was the "link is invalid" dead end on invite emails.
// Reads window.location directly (no useSearchParams) so no Suspense is needed.
export default function AuthConfirmPage() {
  const router = useRouter();
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const cb = parseAuthCallback(window.location.href);

    (async () => {
      try {
        if (cb.kind === "error") {
          throw Object.assign(new Error(cb.description ?? cb.code ?? "link error"), { code: cb.code });
        }
        if (cb.kind === "token_hash") {
          const { error } = await supabase.auth.verifyOtp({ type: cb.type, token_hash: cb.tokenHash });
          if (error) throw error;
        } else if (cb.kind === "code") {
          const { error } = await supabase.auth.exchangeCodeForSession(cb.code);
          if (error) throw error;
        } else if (cb.kind === "implicit") {
          const { error } = await supabase.auth.setSession({
            access_token: cb.accessToken,
            refresh_token: cb.refreshToken,
          });
          if (error) throw error;
          // Drop the tokens from the address bar / history now that they are
          // in the session cookie.
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
        // Confirm the cookie landed; on mobile the write can lag a tick, so
        // poll briefly before giving up instead of failing on the first read.
        let session = (await supabase.auth.getSession()).data.session;
        for (let i = 0; i < 5 && !session; i++) {
          await new Promise((r) => setTimeout(r, 200));
          session = (await supabase.auth.getSession()).data.session;
        }
        if (!session) throw new Error("no session established from link");
        // HARD navigation so the just-set auth cookie is sent with the request
        // for `next` (set-password). A soft router.replace can land there before
        // the cookie is readable, which on mobile bounced the user to /login.
        window.location.assign(cb.next);
      } catch (err) {
        const e = err as Error & { code?: string | null };
        console.error("[auth/confirm] could not establish session:", cb.kind, e?.code ?? "", e?.message);
        setFailure(describeCallbackError(e?.code ?? null));
        setTimeout(() => router.replace("/login?error=auth"), 2500);
      }
    })();
  }, [router]);

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-sm text-muted">{failure ?? "Confirming your link…"}</p>
    </section>
  );
}
