"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolveLandingRoute } from "./actions";

export function LoginClient() {
  const params = useSearchParams();
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const pendingStatus = params.get("status") === "pending";

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setError("Invalid email or password.");
        setPending(false);
        return;
      }
      // Session cookie is now set. Ask the server where this user should land,
      // then do a HARD navigation (not router.replace): a full page load forces
      // the browser to re-send the freshly-written auth cookie so the proxy and
      // server components render authenticated. A soft nav + router.refresh()
      // races the cookie write and can leave the user stuck on /login.
      const dest = await resolveLandingRoute();
      window.location.assign(dest);
      return; // keep the spinner up until the new page takes over
    } catch {
      setError("Something went wrong. Please try again.");
      setPending(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/confirm?next=/auth/set-password`;
      await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      // Neutral message — never reveal whether the email exists.
      setNotice("If that email has an account, we've sent a password reset link.");
    } catch {
      setNotice("If that email has an account, we've sent a password reset link.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
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
              Customer portal
            </p>
          </div>
        </div>

        <h1 className="font-display text-2xl font-semibold tracking-tight text-brand-deep">
          {mode === "signin" ? "Sign in" : "Reset password"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "signin"
            ? "Approved customers — sign in to see your catalog and pricing."
            : "Enter your email and we'll send a reset link."}
        </p>

        {!configured && (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Supabase isn&apos;t configured yet — set the environment variables to enable sign-in.
          </p>
        )}

        {pendingStatus && mode === "signin" && (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Your account isn&apos;t active yet. If you were just invited, finish setting your
            password — otherwise contact your Olleik rep.
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {notice && (
          <p className="mt-4 rounded-md bg-brand-mist/60 px-3 py-2 text-sm text-brand-deep">
            {notice}
          </p>
        )}

        {mode === "signin" ? (
          <form onSubmit={handleSignIn} className="mt-6 space-y-4">
            <Labeled label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                autoComplete="email"
              />
            </Labeled>
            <Labeled label="Password">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                autoComplete="current-password"
              />
            </Labeled>
            <button
              type="submit"
              disabled={pending || !configured}
              className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
            >
              {pending ? "Signing in…" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("reset");
                setError(null);
                setNotice(null);
              }}
              className="block w-full text-center text-xs font-medium text-brand hover:text-accent"
            >
              Forgot password?
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="mt-6 space-y-4">
            <Labeled label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                autoComplete="email"
              />
            </Labeled>
            <button
              type="submit"
              disabled={pending || !configured}
              className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send reset link"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
                setNotice(null);
              }}
              className="block w-full text-center text-xs font-medium text-brand hover:text-accent"
            >
              ← Back to sign in
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted">
          Not a customer yet?{" "}
          <Link href="/apply" className="font-semibold text-brand hover:underline">
            Apply for an account →
          </Link>
        </p>
      </div>
    </section>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
