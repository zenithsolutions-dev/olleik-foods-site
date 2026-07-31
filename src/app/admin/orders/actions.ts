"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/require-admin";
import { guardAction } from "@/lib/admin/action-guard";
import { indexRules, resolveWithIndex } from "@/lib/admin/pricing-engine";
import { fetchPricingRules } from "@/lib/admin/pricing-data";

// CP-3a order lifecycle. ADMIN-ONLY, service-role. Transitions follow the
// approved map (D-O3):
//   new -> confirmed -> prepared -> completed
//   {new, confirmed, prepared} -> cancelled
// Every transition UPDATE is guarded by `.eq("status", <expected-from>)` so a
// stale button (two admins racing) affects zero rows instead of clobbering.
//
// CP-3b: confirm and cancel go through the 0010 SECURITY DEFINER functions so
// the status transition and the stock movement are ONE transaction (D-O4):
//   * confirm_order_stock: new->confirmed + conditional decrement of tracked
//     lines; insufficient stock BLOCKS by default and reports the short lines;
//     p_allow_oversell=true clamps to 0 and proceeds (D-O5); is_available
//     flips false for tracked stock hitting 0 (D-O6); stock_decremented_at is
//     stamped only when something was decremented.
//   * cancel_order_with_restock: {new,confirmed,prepared}->cancelled + exact
//     restock of what was decremented (order_stock_movements), guarded by
//     stock_decremented_at; completed is terminal.
// Pre-0010 both fall back to the plain guarded transition (no stock tracking).
//
// Confirmation also runs assignment-on-confirmation (approved D-O1): each
// was_assigned=false line becomes a customer_products row priced by the CP-1
// WATERFALL (merge-only, meta 'computed') — NOT the order's snapshot price.
// The order keeps its immortal snapshot in order_items; the assignment governs
// future pricing, and future pricing is the waterfall's job.
//
// NOTE: only declared `export type X = ...` here — never `export type { X }`.

export type OrderShortage = {
  productId: string;
  name: string;
  ordered: number;
  inStock: number;
};

export type OrderActionResult =
  | { ok: true; assigned?: number; restockedUnits?: number; oversold?: boolean }
  | { ok: false; message: string; shortages?: OrderShortage[] };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidateOrders(orderId: string, customerId?: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin"); // nav badge + dashboard
  if (customerId) revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/portal/orders");
  revalidatePath(`/portal/orders/${orderId}`);
}

// Shared guarded transition: UPDATE ... WHERE id AND status = from.
async function transition(
  orderId: string,
  from: string,
  patch: Record<string, unknown>,
): Promise<{ moved: boolean; customerId?: string; message?: string }> {
  const admin = getAdminClient();
  if (!admin) return { moved: false, message: "Supabase is not configured." };
  const { data, error } = await admin
    .from("orders")
    .update(patch)
    .eq("id", orderId)
    .eq("status", from)
    .select("id, customer_id");
  if (error) {
    console.error("[admin] order transition failed:", error.message);
    return { moved: false, message: "Could not update the order. Please try again." };
  }
  if (!data || data.length === 0) {
    return {
      moved: false,
      message: "The order is no longer in that state — refresh to see its current status.",
    };
  }
  return { moved: true, customerId: (data[0] as { customer_id: string }).customer_id };
}

export async function confirmOrder(
  orderId: string,
  allowOversell = false,
): Promise<OrderActionResult> {
  await requireAdmin();
  return guardAction("confirmOrder", async () => {
    if (!UUID_RE.test(orderId)) return { ok: false, message: "Invalid order id." };
    const admin = getAdminClient();
    if (!admin) return { ok: false, message: "Supabase is not configured." };

    // CP-3b: transition + conditional stock decrement in ONE transaction.
    const { data: fnRes, error: fnErr } = await admin.rpc("confirm_order_stock", {
      p_order_id: orderId,
      p_allow_oversell: allowOversell === true,
    });
    let res: { moved: boolean; customerId?: string; message?: string };
    let oversold = false;
    if (fnErr && fnErr.message?.includes("does not exist")) {
      // Pre-0010: fall back to the CP-3a plain guarded transition (no stock).
      res = await transition(orderId, "new", {
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      });
    } else if (fnErr) {
      console.error("[admin] confirm_order_stock failed:", fnErr.message);
      return { ok: false, message: "Could not confirm the order. Please try again." };
    } else {
      const out = fnRes as {
        ok: boolean;
        code?: "stale" | "insufficient";
        shortages?: { product_id: string; name: string; ordered: number; in_stock: number }[];
        oversold?: boolean;
      };
      if (!out.ok && out.code === "insufficient") {
        // D-O5: block by default; the UI offers "Confirm anyway (oversell)".
        return {
          ok: false,
          message: "Not enough stock for some lines — confirm anyway to oversell, or cancel.",
          shortages: (out.shortages ?? []).map((s) => ({
            productId: s.product_id,
            name: s.name,
            ordered: s.ordered,
            inStock: s.in_stock,
          })),
        };
      }
      if (!out.ok) {
        return {
          ok: false,
          message: "The order is no longer in that state — refresh to see its current status.",
        };
      }
      oversold = out.oversold === true;
      // The function returns no customer_id; read it for revalidation + D-O1.
      const { data: ordRow } = await admin
        .from("orders")
        .select("customer_id")
        .eq("id", orderId)
        .maybeSingle();
      res = { moved: true, customerId: (ordRow as { customer_id: string } | null)?.customer_id };
    }
    if (!res.moved) return { ok: false, message: res.message ?? "Could not confirm." };

    // ---- assignment-on-confirmation (D-O1: waterfall, merge-only) ----
    const { data: itemRows, error: itemErr } = await admin
      .from("order_items")
      .select("product_id, was_assigned")
      .eq("order_id", orderId)
      .eq("was_assigned", false);
    if (itemErr) {
      console.error("[admin] confirm: unassigned-lines read failed:", itemErr.message);
      // The order IS confirmed; assignment can be redone via /admin/assign.
      revalidateOrders(orderId, res.customerId);
      revalidatePath("/admin/products"); // decrement changes stock + availability
      return { ok: true, assigned: 0, oversold };
    }
    const productIds = (((itemRows as { product_id: string }[]) ?? [])).map(
      (r) => r.product_id,
    );
    let assigned = 0;
    if (productIds.length > 0 && res.customerId) {
      assigned = await assignWithWaterfall(res.customerId, productIds);
    }

    revalidateOrders(orderId, res.customerId);
    revalidatePath("/admin/products"); // decrement changes stock + availability
    return { ok: true, assigned, oversold };
  });
}

// Same pricing mechanics as the bulk-assign flow: waterfall-resolve each new
// (customer, product) pair, store price (NULL for list-sourced, D4), stamp
// meta 'computed'. MERGE-ONLY: existing assignments are never touched.
async function assignWithWaterfall(customerId: string, productIds: string[]): Promise<number> {
  const admin = getAdminClient();
  if (!admin) return 0;
  const [
    { data: prodRows, error: prodErr },
    { data: catRows },
    { data: costRows },
    { rules },
    { data: existingRows },
  ] = await Promise.all([
    admin.from("products").select("id, list_price_cents, category_id").in("id", productIds),
    admin.from("categories").select("id, parent_id"),
    admin.from("product_costs").select("product_id, cost_cents").in("product_id", productIds),
    fetchPricingRules(),
    admin
      .from("customer_products")
      .select("product_id")
      .eq("customer_id", customerId)
      .in("product_id", productIds),
  ]);
  if (prodErr) {
    console.error("[admin] confirm-assign read failed:", prodErr.message);
    return 0;
  }
  const parentOf = new Map(
    (((catRows as { id: string; parent_id: string | null }[]) ?? [])).map((c) => [
      c.id,
      c.parent_id,
    ]),
  );
  const costs = new Map(
    (((costRows as { product_id: string; cost_cents: number }[]) ?? [])).map((r) => [
      r.product_id,
      r.cost_cents,
    ]),
  );
  const existing = new Set(
    (((existingRows as { product_id: string }[]) ?? [])).map((r) => r.product_id),
  );
  const idx = indexRules(rules);
  const nowIso = new Date().toISOString();

  const rows: { customer_id: string; product_id: string; price_cents: number | null }[] = [];
  const metaRows: Record<string, unknown>[] = [];
  for (const p of (prodRows as { id: string; list_price_cents: number; category_id: string | null }[]) ?? []) {
    if (existing.has(p.id)) continue;
    const resolved = resolveWithIndex({
      idx,
      customerId,
      productId: p.id,
      categoryId: p.category_id,
      parentCategoryId: p.category_id ? (parentOf.get(p.category_id) ?? null) : null,
      costCents: costs.get(p.id) ?? null,
      listPriceCents: p.list_price_cents,
      manualPriceCents: null,
    });
    rows.push({
      customer_id: customerId,
      product_id: p.id,
      price_cents: resolved.source === "list" ? null : resolved.priceCents,
    });
    metaRows.push({
      customer_id: customerId,
      product_id: p.id,
      price_source: "computed",
      margin_percent: resolved.marginPercent,
      rule_scope:
        resolved.source === "product-margin"
          ? "product"
          : resolved.source === "customer-margin"
            ? "customer"
            : resolved.source === "category-margin"
              ? "category"
              : resolved.source === "global-margin"
                ? "global"
                : null,
      is_priority: resolved.priority,
      computed_at: nowIso,
    });
  }
  if (rows.length === 0) return 0;

  const { error } = await admin.from("customer_products").upsert(rows, {
    onConflict: "customer_id,product_id",
    ignoreDuplicates: true, // merge-only backstop against races
  });
  if (error) {
    console.error("[admin] confirm-assign write failed:", error.message);
    return 0;
  }
  const { error: metaErr } = await admin.from("customer_product_pricing_meta").upsert(metaRows, {
    onConflict: "customer_id,product_id",
    ignoreDuplicates: true,
  });
  if (metaErr) console.error("[admin] confirm-assign meta write failed:", metaErr.message);
  return rows.length;
}

export async function markOrderPrepared(orderId: string): Promise<OrderActionResult> {
  await requireAdmin();
  return guardAction("markOrderPrepared", async () => {
    if (!UUID_RE.test(orderId)) return { ok: false, message: "Invalid order id." };
    const res = await transition(orderId, "confirmed", { status: "prepared" });
    if (!res.moved) return { ok: false, message: res.message ?? "Could not update." };
    revalidateOrders(orderId, res.customerId);
    return { ok: true };
  });
}

export async function completeOrder(orderId: string): Promise<OrderActionResult> {
  await requireAdmin();
  return guardAction("completeOrder", async () => {
    if (!UUID_RE.test(orderId)) return { ok: false, message: "Invalid order id." };
    const res = await transition(orderId, "prepared", {
      status: "completed",
      completed_at: new Date().toISOString(),
    });
    if (!res.moved) return { ok: false, message: res.message ?? "Could not update." };
    revalidateOrders(orderId, res.customerId);
    return { ok: true };
  });
}

export async function cancelOrder(
  orderId: string,
  adminNote?: string,
): Promise<OrderActionResult> {
  await requireAdmin();
  return guardAction("cancelOrder", async () => {
    if (!UUID_RE.test(orderId)) return { ok: false, message: "Invalid order id." };
    const admin = getAdminClient();
    if (!admin) return { ok: false, message: "Supabase is not configured." };
    const note = adminNote?.trim().slice(0, 1000) || null;

    // CP-3b: cancel + guarded restock in ONE transaction (D-O4). The function
    // restocks EXACTLY what was decremented (order_stock_movements), only when
    // stock_decremented_at is set, then clears both so it can never run twice.
    const { data: fnRes, error: fnErr } = await admin.rpc("cancel_order_with_restock", {
      p_order_id: orderId,
      p_admin_note: note,
    });
    if (fnErr && fnErr.message?.includes("does not exist")) {
      // Pre-0010: fall back to the CP-3a plain guarded transitions (no stock).
      for (const from of ["new", "confirmed", "prepared"]) {
        const res = await transition(orderId, from, {
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          admin_note: note,
        });
        if (res.moved) {
          revalidateOrders(orderId, res.customerId);
          return { ok: true };
        }
      }
      return {
        ok: false,
        message:
          "The order can't be cancelled from its current state (completed or already cancelled).",
      };
    }
    if (fnErr) {
      console.error("[admin] cancel_order_with_restock failed:", fnErr.message);
      return { ok: false, message: "Could not cancel the order. Please try again." };
    }
    const out = fnRes as { ok: boolean; restocked_units?: number };
    if (!out.ok) {
      return {
        ok: false,
        message:
          "The order can't be cancelled from its current state (completed or already cancelled).",
      };
    }
    const { data: ordRow } = await admin
      .from("orders")
      .select("customer_id")
      .eq("id", orderId)
      .maybeSingle();
    revalidateOrders(orderId, (ordRow as { customer_id: string } | null)?.customer_id);
    revalidatePath("/admin/products"); // restock changes stock + availability
    return { ok: true, restockedUnits: out.restocked_units ?? 0 };
  });
}
