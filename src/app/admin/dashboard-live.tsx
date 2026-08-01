"use client";

import { DegradedHint, useLiveRefresh } from "@/lib/poll/use-live-refresh";
import { pollAdminDashboardSignature } from "./live-actions";

// CP-3d: dashboard counters + low-stock/oversold card refresh in place every
// 30s (approved D-L1) — signature poll only; a full re-render happens solely
// when something actually changed.

export function DashboardLive() {
  const { degraded } = useLiveRefresh({
    intervalMs: 30_000,
    fetchSignature: async () => {
      const res = await pollAdminDashboardSignature();
      return res.ok ? res.signature : null;
    },
  });
  return (
    <div className="min-h-[14px]">
      <DegradedHint degraded={degraded} />
    </div>
  );
}
