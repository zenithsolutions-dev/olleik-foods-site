"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Admin sign-in. Lives at /admin-login (outside the gated /admin segment) so
// the proxy redirect target is always reachable. Authenticates against Supabase
// Auth; access is further restricted to ADMIN_EMAILS by the proxy + requireAdmin.
export default function AdminLoginPage() {
  const router = useRouter();
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setError("Invalid email or password.");
        return;
      }
      // Refresh so the server picks up the new session cookie, then enter admin.
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-xl border border-[var(--border)] bg-surface p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid h-9 w-9 place-items-center rounded-md bg-brand text-white font-display text-base font-semibold"
          >
            O
          </span>
          <div>
            <p className="font-display text-base font-semibold leading-tight text-brand-deep">
              Olleik <span className="text-accent">Foods</span>
            </p>
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
              Admin
            </p>
          </div>
        </div>

        <h1 className="font-display text-2xl font-semibold tracking-tight text-brand-deep">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-muted">
          Staff access only. Use the admin credentials provisioned in Supabase.
        </p>

        {!configured && (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Supabase isn&apos;t configured yet — set the environment variables to
            enable admin sign-in.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium uppercase tracking-wide text-muted"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium uppercase tracking-wide text-muted"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || !configured}
            className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <Link
          href="/"
          className="mt-6 inline-block text-xs text-muted hover:text-brand"
        >
          ← Back to site
        </Link>
      </div>
    </section>
  );
}
