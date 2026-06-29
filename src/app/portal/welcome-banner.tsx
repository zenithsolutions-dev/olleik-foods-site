"use client";

import { useEffect } from "react";

// One-time welcome banner shown after a customer first sets their password and
// lands on /portal?welcome=1. Rendered unconditionally at every viewport width
// (no responsive class) so it appears on mobile AND desktop. After the first
// paint it strips ?welcome from the URL via history.replaceState, so the banner
// shows exactly once — a refresh won't re-trigger it. No reload, no nav change.
export function WelcomeBanner() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("welcome")) {
      url.searchParams.delete("welcome");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, []);

  return (
    <div className="rounded-2xl border border-brand/30 bg-brand-mist/50 px-5 py-4">
      <p className="font-display text-lg font-semibold text-brand-deep">
        Welcome to your Olleik Foods account 🎉
      </p>
      <p className="mt-1 text-sm text-muted">
        Your password is set. Below is your catalog with your contract pricing, plus any offers set
        up for you.
      </p>
    </div>
  );
}
