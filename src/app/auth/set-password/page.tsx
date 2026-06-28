"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolveLandingRoute } from "@/app/(marketing)/login/actions";

// Sets a new password for the current session — serves BOTH first-time invite
// and password reset (both arrive here via /auth/confirm with a live session).
// Lives outside the /portal gate so a just-invited (not-yet-active) customer can
// still complete it. After saving, asks the server where to land.
export default function SetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      // The session is set by /auth/confirm just before redirecting here. On some
      // mobile browsers the cookie can lag a tick — retry once before bouncing.
      let session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        await new Promise((r) => setTimeout(r, 400));
        session = (await supabase.auth.getSession()).data.session;
      }
      if (!session) {
        router.replace("/login?error=auth");
        return;
      }
      // Greet by business name (own row only, via RLS).
      const { data } = await supabase.from("customers").select("business_name").maybeSingle();
      if (data?.business_name) setBusinessName(data.business_name);
      setReady(true);
    })();
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        // "New password should be different from the old password" means this
        // exact password is ALREADY set (e.g. they retried after a stalled
        // redirect). The account is ready — don't show a scary error, just take
        // them in. Any other error is surfaced verbatim.
        const alreadySet = /should be different/i.test(error.message);
        if (alreadySet) {
          await goToDestination();
          return;
        }
        console.error("[auth/set-password] updateUser failed:", error.status, error.message);
        setError(
          error.message
            ? `Couldn't set your password: ${error.message}`
            : "Could not set your password. Request a new link from the login page.",
        );
        setPending(false);
        return;
      }
      await goToDestination();
    } catch {
      setError("Something went wrong. Please try again.");
      setPending(false);
    }
  }

  // HARD navigation (not router.replace): a full page load sends the freshly
  // written auth cookie so the portal renders authenticated. A soft nav +
  // router.refresh() races the cookie and can stall on this page.
  async function goToDestination() {
    const dest = await resolveLandingRoute();
    window.location.assign(dest === "/portal" ? "/portal?welcome=1" : dest);
  }

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-xl border border-[var(--border)] bg-surface p-8 shadow-sm">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-brand-deep">
          {businessName ? `Welcome, ${businessName}` : "Set your password"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {businessName
            ? "You've been approved — choose a password to access your account."
            : "Choose a password to finish setting up your account."}
        </p>

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {ready ? (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                New password
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                autoComplete="new-password"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Confirm password
              </span>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputCls}
                autoComplete="new-password"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save password"}
            </button>
          </form>
        ) : (
          <p className="mt-6 text-sm text-muted">Loading…</p>
        )}
      </div>
    </section>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";
