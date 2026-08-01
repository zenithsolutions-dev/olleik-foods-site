"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

// CP-3d live updates (approved spec, D-L1..D-L5). Polling, not Realtime:
// each surface fetches a tiny CHANGE SIGNATURE through the same
// requireAdmin/requireCustomer server actions (same RLS, no new authz). When
// the signature differs from the last one, ONE router.refresh() re-renders
// the server components in place.
//
// Guarantees implemented here:
//   * pause completely while the tab is hidden; poll immediately on return;
//   * exponential backoff on errors (interval × 2^n, ceiling 5 min), reset on
//     the first success — `degraded` is exposed so surfaces can show a quiet
//     "live updates are catching up" hint instead of silently going stale;
//   * refreshes are DEFERRED while the admin is mid-action (dialog open /
//     action in flight) via the RefreshLock context, then applied the moment
//     the lock clears. Signature callbacks (chime/badge/title) are NEVER
//     deferred — they don't touch the DOM the admin is working in.

const BACKOFF_CEILING_MS = 5 * 60 * 1000;

// ---------- refresh lock ----------

type RefreshLockValue = {
  // Hold the lock while a dialog is open or an action is in flight.
  // Returns a release function; safe to call more than once.
  acquire: () => () => void;
  isLocked: () => boolean;
  onFree: (cb: () => void) => () => void;
};

const RefreshLockContext = createContext<RefreshLockValue | null>(null);

export function RefreshLockProvider({ children }: { children: React.ReactNode }) {
  const countRef = useRef(0);
  const listenersRef = useRef(new Set<() => void>());

  const value = useMemo<RefreshLockValue>(() => {
    return {
      acquire: () => {
        countRef.current += 1;
        let released = false;
        return () => {
          if (released) return;
          released = true;
          countRef.current -= 1;
          if (countRef.current <= 0) {
            countRef.current = 0;
            for (const cb of listenersRef.current) cb();
          }
        };
      },
      isLocked: () => countRef.current > 0,
      onFree: (cb) => {
        listenersRef.current.add(cb);
        return () => listenersRef.current.delete(cb);
      },
    };
  }, []);

  return <RefreshLockContext.Provider value={value}>{children}</RefreshLockContext.Provider>;
}

// Declaratively hold the refresh lock while `active` is true (e.g. a dialog
// is open or a server action is in flight). No-op outside a provider.
export function useRefreshLockWhile(active: boolean) {
  const ctx = useContext(RefreshLockContext);
  useEffect(() => {
    if (!active || !ctx) return;
    const release = ctx.acquire();
    return release;
  }, [active, ctx]);
}

// ---------- the poller ----------

export type LiveRefreshOptions = {
  intervalMs: number;
  // Return the current signature, or null on error (triggers backoff).
  fetchSignature: () => Promise<string | null>;
  // Fired IMMEDIATELY on every successful poll (even the first) — badge /
  // chime / title logic lives here and is never deferred by the lock.
  onSignature?: (signature: string, previous: string | null) => void;
  // Refresh the page data on change (default: router.refresh()).
  refreshOnChange?: boolean;
};

export function useLiveRefresh({
  intervalMs,
  fetchSignature,
  onSignature,
  refreshOnChange = true,
}: LiveRefreshOptions): { degraded: boolean } {
  const router = useRouter();
  const lock = useContext(RefreshLockContext);
  const [degraded, setDegraded] = useState(false);

  const sigRef = useRef<string | null>(null);
  const failuresRef = useRef(0);
  const pendingRefreshRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);

  // Keep the latest callbacks without re-arming the loop (updated in an
  // effect — refs must not be written during render).
  const fetchRef = useRef(fetchSignature);
  const onSigRef = useRef(onSignature);
  useEffect(() => {
    fetchRef.current = fetchSignature;
    onSigRef.current = onSignature;
  }, [fetchSignature, onSignature]);

  const applyRefresh = useCallback(() => {
    pendingRefreshRef.current = false;
    router.refresh();
  }, [router]);

  useEffect(() => {
    aliveRef.current = true;

    const schedule = (ms: number) => {
      if (!aliveRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(tick, ms);
    };

    const tick = async () => {
      if (!aliveRef.current) return;
      if (document.visibilityState === "hidden") return; // resumed by listener
      let sig: string | null = null;
      try {
        sig = await fetchRef.current();
      } catch {
        sig = null; // treat throws (network, auth hiccup) as an errored poll
      }
      if (!aliveRef.current) return;
      if (sig === null) {
        failuresRef.current += 1;
        setDegraded(true);
        schedule(Math.min(intervalMs * 2 ** failuresRef.current, BACKOFF_CEILING_MS));
        return;
      }
      failuresRef.current = 0;
      setDegraded(false);
      const prev = sigRef.current;
      sigRef.current = sig;
      onSigRef.current?.(sig, prev);
      if (prev !== null && prev !== sig && refreshOnChange) {
        if (lock?.isLocked()) {
          pendingRefreshRef.current = true; // applied the moment the lock frees
        } else {
          applyRefresh();
        }
      }
      schedule(intervalMs);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") tick(); // immediate poll on return
      else if (timerRef.current) clearTimeout(timerRef.current); // full pause
    };
    document.addEventListener("visibilitychange", onVisibility);
    const offFree = lock?.onFree(() => {
      if (pendingRefreshRef.current && aliveRef.current) applyRefresh();
    });

    tick(); // first poll now (establishes the baseline signature)

    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      offFree?.();
    };
  }, [intervalMs, refreshOnChange, lock, applyRefresh]);

  return { degraded };
}

// Quiet, non-alarming hint that polling is backing off — so a stale screen is
// never silently trusted (owner requirement).
export function DegradedHint({ degraded }: { degraded: boolean }) {
  if (!degraded) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-soft"
      title="Reconnecting — the data on screen may be a little behind."
    >
      <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
      Live updates catching up…
    </span>
  );
}
