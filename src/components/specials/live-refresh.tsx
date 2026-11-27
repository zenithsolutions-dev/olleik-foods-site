"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Keeps "N left" current while a specials page is open: re-renders the server page on a timer, only while
// the tab is visible. Renders nothing.
const DEFAULT_INTERVAL_MS = 60_000; // each refresh is a few database reads per open tab: once a minute is live enough

export function LiveRefresh({ intervalMs = DEFAULT_INTERVAL_MS }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
