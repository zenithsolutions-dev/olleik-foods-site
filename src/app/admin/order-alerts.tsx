"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { Bell, BellOff } from "lucide-react";
import { DegradedHint, useLiveRefresh } from "@/lib/poll/use-live-refresh";
import { pollAdminOrdersSignature } from "./live-actions";

// CP-3d order alerts (approved D-L2/D-L3/D-L5). One 15-second poller serves
// every admin surface:
//   * live "N new" badge (via context — AdminNav consumes it);
//   * a distinct-but-pleasant WebAudio chime for orders the admin hasn't seen
//     (structurally never self-triggered: only customers create new orders);
//   * tab-title flash "(N new) Olleik Admin" until the inbox is viewed;
//   * in-place refresh of the inbox / order-detail pages on change (deferred
//     by the RefreshLock while the admin is mid-action);
//   * a quiet degraded hint while polling is backing off.
// Enable + mute persist PER DEVICE in localStorage (D-L3: the counter machine
// rings, the personal laptop stays muted).

const STORAGE_KEY = "olleik-admin-alerts-v1";
const POLL_MS = 15_000;

type AlertPrefs = { enabled: boolean; muted: boolean };

function loadPrefs(): AlertPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { enabled: false, muted: false };
    const p = JSON.parse(raw) as AlertPrefs;
    return { enabled: p.enabled === true, muted: p.muted === true };
  } catch {
    return { enabled: false, muted: false };
  }
}

// Two quick ascending sine notes (A5 → E6), soft attack, exponential decay —
// noticeable across a room, nothing like an alarm, ~0.4 s total (D-L2).
function playChime(ctx: AudioContext) {
  const note = (freq: number, at: number, dur: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + at);
    osc.stop(ctx.currentTime + at + dur + 0.05);
  };
  note(880, 0, 0.22); // A5
  note(1318.5, 0.14, 0.28); // E6
}

type OrderAlertsValue = {
  newCount: number | null; // null until the first successful poll
  degraded: boolean;
  prefs: AlertPrefs;
  enableAlerts: () => void;
  toggleMute: () => void;
};

const OrderAlertsContext = createContext<OrderAlertsValue | null>(null);

export function useOrderAlerts(): OrderAlertsValue | null {
  return useContext(OrderAlertsContext);
}

export function OrderAlertsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [newCount, setNewCount] = useState<number | null>(null);
  const [prefs, setPrefs] = useState<AlertPrefs>({ enabled: false, muted: false });
  const [unseenCount, setUnseenCount] = useState(0);

  const seenRef = useRef<Set<string> | null>(null); // null until baseline poll
  const audioRef = useRef<AudioContext | null>(null);
  const onOrdersPage = pathname === "/admin/orders" || pathname.startsWith("/admin/orders/");
  // Mirror the latest prefs/pathname into refs INSIDE effects (never during
  // render) so the long-lived poll callback always sees current values.
  const prefsRef = useRef(prefs);
  const onInboxRef = useRef(false);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);
  useEffect(() => {
    onInboxRef.current = onOrdersPage;
  }, [onOrdersPage]);

  // Hydrate prefs after mount (setState inside the microtask callback).
  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => {
      if (alive) setPrefs(loadPrefs());
    });
    return () => {
      alive = false;
    };
  }, []);

  // Once enabled, (re)arm audio on the first user gesture of any session —
  // the "Enable order alerts" button is one-time; afterwards any click arms
  // the AudioContext silently (browsers require a gesture per page load).
  useEffect(() => {
    if (!prefs.enabled || audioRef.current) return;
    const arm = () => {
      if (!audioRef.current) {
        try {
          audioRef.current = new AudioContext();
        } catch {
          // no WebAudio — alerts stay visual-only
        }
      }
      void audioRef.current?.resume();
    };
    window.addEventListener("pointerdown", arm, { once: true });
    return () => window.removeEventListener("pointerdown", arm);
  }, [prefs.enabled]);

  const savePrefs = useCallback((next: AlertPrefs) => {
    setPrefs(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage blocked — prefs last for this page's lifetime
    }
  }, []);

  const enableAlerts = useCallback(() => {
    // The click IS the user gesture: create + resume the context now and play
    // a soft confirmation chime so the admin knows what to listen for.
    try {
      audioRef.current = audioRef.current ?? new AudioContext();
      void audioRef.current.resume();
      playChime(audioRef.current);
    } catch {
      // no WebAudio — alerts stay visual-only
    }
    savePrefs({ enabled: true, muted: false });
  }, [savePrefs]);

  const toggleMute = useCallback(() => {
    savePrefs({ ...prefsRef.current, muted: !prefsRef.current.muted });
  }, [savePrefs]);

  // The single 15s admin orders poller. Refresh-on-change applies only while
  // an orders page is open (other admin pages don't render order data); the
  // chime / badge / title react on EVERY poll and are never deferred.
  const { degraded } = useLiveRefresh({
    intervalMs: POLL_MS,
    refreshOnChange: onOrdersPage,
    fetchSignature: async () => {
      const res = await pollAdminOrdersSignature();
      if (!res.ok) return null;
      const seen = seenRef.current;
      if (seen === null) {
        // Baseline: never ring for orders that predate this session.
        seenRef.current = new Set(res.newIds);
      } else {
        const unseen = res.newIds.filter((id) => !seen.has(id));
        if (unseen.length > 0) {
          for (const id of unseen) seen.add(id);
          // The chime always plays on arrival (even while viewing the inbox —
          // it should be heard from across the room); the title flash only
          // starts when the inbox ISN'T being viewed (D-L5).
          const p = prefsRef.current;
          if (p.enabled && !p.muted && audioRef.current) {
            void audioRef.current.resume();
            playChime(audioRef.current);
          }
          if (!onInboxRef.current) setUnseenCount((n) => n + unseen.length);
        }
      }
      setNewCount(res.newIds.length);
      return res.signature;
    },
  });

  // D-L5: flash the tab title while unseen orders exist; clear the moment the
  // inbox is viewed.
  useEffect(() => {
    if (onInboxRef.current && unseenCount > 0) setUnseenCount(0);
  }, [pathname, unseenCount]);
  useEffect(() => {
    if (unseenCount === 0) return;
    const original = document.title;
    let flip = false;
    const t = setInterval(() => {
      flip = !flip;
      document.title = flip ? `(${unseenCount} new) Olleik Admin` : original;
    }, 1200);
    return () => {
      clearInterval(t);
      document.title = original;
    };
  }, [unseenCount]);

  return (
    <OrderAlertsContext.Provider
      value={{ newCount, degraded, prefs, enableAlerts, toggleMute }}
    >
      {children}
    </OrderAlertsContext.Provider>
  );
}

// The at-a-glance controls block in the admin sidebar: enable / mute /
// degraded state. Never buried in a menu (owner requirement).
export function OrderAlertsWidget() {
  const alerts = useOrderAlerts();
  if (!alerts) return null;
  return (
    <div className="mx-3 mb-2 rounded-xl border border-[var(--border)] bg-background px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
          Order alerts
        </span>
        {alerts.prefs.enabled ? (
          <button
            type="button"
            onClick={alerts.toggleMute}
            aria-pressed={alerts.prefs.muted}
            title={alerts.prefs.muted ? "Unmute the new-order chime" : "Mute the new-order chime"}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
              alerts.prefs.muted
                ? "border-zinc-300 bg-zinc-100 text-zinc-500"
                : "border-brand/40 bg-brand-mist/50 text-brand-deep hover:border-brand"
            }`}
          >
            {alerts.prefs.muted ? <BellOff size={12} /> : <Bell size={12} />}
            {alerts.prefs.muted ? "Muted" : "Sound on"}
          </button>
        ) : (
          <button
            type="button"
            onClick={alerts.enableAlerts}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-accent-deep"
          >
            <Bell size={12} /> Enable order alerts
          </button>
        )}
      </div>
      <div className="mt-1.5 min-h-[14px]">
        <DegradedHint degraded={alerts.degraded} />
      </div>
    </div>
  );
}
