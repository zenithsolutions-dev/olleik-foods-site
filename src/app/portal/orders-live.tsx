"use client";

import { DegradedHint, useLiveRefresh } from "@/lib/poll/use-live-refresh";
import { pollMyOrdersSignature } from "./live-actions";

// CP-3d: the customer's own order list/detail refreshes in place every 30s
// (approved D-L1). Session-client reads only (RLS-scoped) — catalog and
// pricing are deliberately NOT polled.

export function PortalOrdersLive() {
  const { degraded } = useLiveRefresh({
    intervalMs: 30_000,
    fetchSignature: async () => {
      const res = await pollMyOrdersSignature();
      return res.ok ? res.signature : null;
    },
  });
  return (
    <div className="min-h-[14px]">
      <DegradedHint degraded={degraded} />
    </div>
  );
}
