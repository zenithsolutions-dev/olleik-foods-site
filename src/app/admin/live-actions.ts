"use server";

import { getAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/require-admin";
import { guardAction } from "@/lib/admin/action-guard";
import { zonedDayStartUTC } from "@/lib/dates";

// CP-3d admin change-signature polls (approved spec). These return a few
// bytes, never page data: the client compares signatures and triggers ONE
// router.refresh() on change. Same requireAdmin gate as every admin action —
// polling adds zero new authorization surface.
//
// D-L4 (approved): the orders signature is a scan of id+status over the same
// 500-row window the inbox itself displays — orders has no updated_at and we
// are NOT adding one now. KNOWN FUTURE CONSIDERATION: revisit at CP-4 only if
// order volume makes this scan expensive.
//
// NOTE: only declared `export type X = ...` here — never `export type { X }`.

export type OrdersSignatureResult =
  | { ok: true; signature: string; newIds: string[] }
  | { ok: false };

export type DashboardSignatureResult = { ok: true; signature: string } | { ok: false };

// Tiny stable hash (djb2) so the wire payload stays small no matter how many
// orders are in the window.
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export async function pollAdminOrdersSignature(): Promise<OrdersSignatureResult> {
  await requireAdmin();
  return guardAction("pollAdminOrdersSignature", async () => {
    const admin = getAdminClient();
    if (!admin) return { ok: false };
    const { data, error } = await admin
      .from("orders")
      .select("id, status")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      if (error.code !== "42P01") console.error("[admin] orders poll failed:", error.message);
      return { ok: false };
    }
    const rows = (data as { id: string; status: string }[]) ?? [];
    return {
      ok: true,
      signature: hash(rows.map((r) => `${r.id}:${r.status}`).join("|")),
      // The chime rings ONLY for ids in this list the client hasn't seen —
      // new orders are created exclusively by customers, so an admin's own
      // actions can never ring it (by construction, not by condition).
      newIds: rows.filter((r) => r.status === "new").map((r) => r.id),
    };
  });
}

export async function pollAdminDashboardSignature(): Promise<DashboardSignatureResult> {
  await requireAdmin();
  return guardAction("pollAdminDashboardSignature", async () => {
    const admin = getAdminClient();
    if (!admin) return { ok: false };
    // CP-4: the fingerprint EXTENDS the CP-3d one (no second mechanism) with
    // today's order rows (bounded by one Toronto business day — the same
    // window the dashboard renders), the currently-expiring-soon offer ids,
    // and the products/costs pair behind the no-cost count. Still a few
    // bytes on the wire: everything is hashed server-side.
    const todayStart = zonedDayStartUTC(new Date()).toISOString();
    const soonCutoff = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();
    const [ordersRes, invRes, leadsRes, todayRes, offersRes, prodRes, costRes] =
      await Promise.all([
        admin.from("orders").select("id", { count: "exact", head: true }).eq("status", "new"),
        admin.from("product_inventory").select("product_id, stock_qty, low_stock_threshold"),
        admin.from("leads").select("id", { count: "exact", head: true }).eq("status", "new"),
        admin
          .from("orders")
          .select("id, status, total_cents")
          .gte("created_at", todayStart),
        admin
          .from("customer_offers")
          .select("id")
          .eq("is_active", true)
          .gt("ends_at", nowIso)
          .lte("ends_at", soonCutoff),
        admin.from("products").select("id").eq("is_active", true),
        admin.from("product_costs").select("product_id"),
      ]);
    if (ordersRes.error && ordersRes.error.code !== "42P01") {
      console.error("[admin] dashboard poll failed:", ordersRes.error.message);
      return { ok: false };
    }
    const low = ((invRes.data as {
      product_id: string;
      stock_qty: number;
      low_stock_threshold: number;
    }[]) ?? [])
      .filter((r) => r.stock_qty <= r.low_stock_threshold)
      .map((r) => `${r.product_id}:${r.stock_qty}`)
      .sort()
      .join("|");
    const today = (((todayRes.data as { id: string; status: string; total_cents: number }[]) ?? []))
      .map((r) => `${r.id}:${r.status}:${r.total_cents}`)
      .sort()
      .join("|");
    const soon = (((offersRes.data as { id: string }[]) ?? [])).map((o) => o.id).sort().join(",");
    const costed = new Set(
      (((costRes.data as { product_id: string }[]) ?? [])).map((r) => r.product_id),
    );
    const missingCost = (((prodRes.data as { id: string }[]) ?? [])).filter(
      (p) => !costed.has(p.id),
    ).length;

    // CP-8b: the fingerprint EXTENDS again (still ONE mechanism) with the
    // 30-day gone-quiet count — the one new dashboard figure that can change
    // WITHOUT any row changing (a customer silently crossing the threshold).
    // The top-3 cards need nothing extra: they only move when today's orders
    // move, which the today-rows hash already captures. Pre-0014 the RPC is
    // absent → the component is a constant and the rest of the signature
    // still drives refreshes.
    let quiet = "i-";
    {
      const { data: act, error: actErr } = await admin.rpc("analytics_customer_sales", {
        p_start: null,
        p_end: null,
      });
      if (!actErr) {
        const cutoff = Date.now() - 30 * 24 * 3600_000;
        quiet = `i${(((act as { last_order_at: string | null }[]) ?? [])).filter(
          (r) => r.last_order_at != null && new Date(r.last_order_at).getTime() < cutoff,
        ).length}`;
      }
    }
    return {
      ok: true,
      signature: hash(
        `o${ordersRes.count ?? 0}|l${leadsRes.count ?? 0}|${low}|t${hash(today)}|s${soon}|m${missingCost}|${quiet}`,
      ),
    };
  });
}
