"use server";

import { getAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/require-admin";
import { guardAction } from "@/lib/admin/action-guard";

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
    const [ordersRes, invRes, leadsRes] = await Promise.all([
      admin.from("orders").select("id", { count: "exact", head: true }).eq("status", "new"),
      admin
        .from("product_inventory")
        .select("product_id, stock_qty, low_stock_threshold"),
      admin.from("leads").select("id", { count: "exact", head: true }).eq("status", "new"),
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
    return {
      ok: true,
      signature: hash(`o${ordersRes.count ?? 0}|l${leadsRes.count ?? 0}|${low}`),
    };
  });
}
