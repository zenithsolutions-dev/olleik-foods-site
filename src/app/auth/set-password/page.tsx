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
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login?error=auth");
        return;
      }
      setReady(true);
    });
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
        setError("Could not set your password. The link may have expired — request a new one from the login page.");
        return;
      }
      const dest = await resolveLandingRoute();
      router.replace(dest);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-xl border border-[var(--border)] bg-surface p-8 shadow-sm">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-brand-deep">
          Set your password
        </h1>
        <p className="mt-1 text-sm text-muted">
          Choose a password to finish setting up your account.
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
