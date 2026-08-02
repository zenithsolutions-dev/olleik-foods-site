import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  MAX_STATEMENT_ORDERS,
  type InternalOrderInput,
  type StatementOrderInput,
} from "@/lib/documents/customer-statement-model";
import type { OrderStatusName } from "@/lib/admin/dashboard-math";

// CP-7 customer-statement read (ADMIN path — service role, so costs are
// expected here and ONLY here; order_item_costs is deny-all to every customer
// session).
//
// BATCHED ON PURPOSE: two queries total, never a loop over fetchAdminOrder.
// A statement for an active customer covers dozens of orders, and per-order
// reads would turn one page into dozens of round trips.
//
// Bounded by created_at — the SUBMISSION date (approved D-S2), the same
// timestamp the dashboard and every CP-5 surface use, so a statement and the
// dashboard can never disagree about the same customer and period. Served by
// orders_created_idx (migration 0012) plus the customer_id foreign-key index;
// no new index is needed at current volume (approved D-S8).

export type CustomerStatementData<T> = {
  orders: T[];
  truncated: boolean; // more orders matched than the cap — reported ON the document
  migrationApplied: boolean;
};

// TWO ENTRY POINTS, matching the two routes (approved D-S5). The customer-copy
// page calls the first one, which NEVER issues the order_item_costs query at
// all — the customer document is cost-free because no cost was ever fetched,
// not because a renderer remembered to omit it.
export async function fetchCustomerStatementOrders(
  customerId: string,
  range?: { startISO?: string | null; endISO?: string | null },
): Promise<CustomerStatementData<StatementOrderInput>> {
  return readStatement(customerId, range, false) as Promise<
    CustomerStatementData<StatementOrderInput>
  >;
}

// The internal copy — service role, costs included.
export async function fetchCustomerStatementOrdersWithCosts(
  customerId: string,
  range?: { startISO?: string | null; endISO?: string | null },
): Promise<CustomerStatementData<InternalOrderInput>> {
  return readStatement(customerId, range, true) as Promise<
    CustomerStatementData<InternalOrderInput>
  >;
}

async function readStatement(
  customerId: string,
  range: { startISO?: string | null; endISO?: string | null } | undefined,
  includeCosts: boolean,
): Promise<CustomerStatementData<StatementOrderInput | InternalOrderInput>> {
  const admin = getAdminClient();
  if (!admin) return { orders: [], truncated: false, migrationApplied: true };

  let q = admin
    .from("orders")
    .select(
      "id, status, fulfillment, total_cents, created_at, order_items(product_id, name, sku, unit, unit_size, qty, unit_price_cents, line_total_cents, applied_offer_title)",
    )
    .eq("customer_id", customerId);
  if (range?.startISO) q = q.gte("created_at", range.startISO);
  if (range?.endISO) q = q.lt("created_at", range.endISO);

  // One over the cap: the extra row is how we KNOW we truncated.
  const { data, error } = await q
    .order("created_at", { ascending: false })
    .limit(MAX_STATEMENT_ORDERS + 1);

  if (error) {
    if (error.code !== "42P01") console.error("[admin] statement read failed:", error.message);
    return { orders: [], truncated: false, migrationApplied: error.code !== "42P01" };
  }

  type ItemRow = {
    product_id: string;
    name: string;
    sku: string;
    unit: string;
    unit_size: string;
    qty: number;
    unit_price_cents: number;
    line_total_cents: number;
    applied_offer_title: string | null;
  };
  type Row = {
    id: string;
    status: OrderStatusName;
    fulfillment: string;
    total_cents: number;
    created_at: string;
    order_items: ItemRow[] | null;
  };

  const all = (data as unknown as Row[]) ?? [];
  const truncated = all.length > MAX_STATEMENT_ORDERS;
  const rows = truncated ? all.slice(0, MAX_STATEMENT_ORDERS) : all;
  const orderIds = rows.map((r) => r.id);

  // Second query: every line cost for these orders at once — SKIPPED entirely
  // on the customer-copy path.
  const costKey = (orderId: string, productId: string) => `${orderId}:${productId}`;
  const costs = new Map<string, number | null>();
  if (includeCosts && orderIds.length > 0) {
    const { data: costRows, error: costErr } = await admin
      .from("order_item_costs")
      .select("order_id, product_id, cost_cents")
      .in("order_id", orderIds);
    if (costErr) {
      // Missing costs degrade to "no cost recorded" — the internal copy warns
      // prominently rather than printing a confident false profit.
      if (costErr.code !== "42P01")
        console.error("[admin] statement costs read failed:", costErr.message);
    } else {
      for (const c of (costRows as
        | { order_id: string; product_id: string; cost_cents: number | null }[]
        | null) ?? [])
        costs.set(costKey(c.order_id, c.product_id), c.cost_cents);
    }
  }

  const orders = rows.map((r) => ({
    orderId: r.id,
    status: r.status,
    createdAt: r.created_at,
    fulfillment: r.fulfillment,
    totalCents: r.total_cents,
    lines: (r.order_items ?? []).map((i) => {
      const line = {
        name: i.name,
        sku: i.sku,
        unit: i.unit,
        unitSize: i.unit_size,
        qty: i.qty,
        unitPriceCents: i.unit_price_cents,
        lineTotalCents: i.line_total_cents,
        appliedOfferTitle: i.applied_offer_title,
      };
      // The cost key is not merely null on the customer path — it is ABSENT.
      return includeCosts
        ? { ...line, costCents: costs.get(costKey(r.id, i.product_id)) ?? null }
        : line;
    }),
  }));

  return { orders, truncated, migrationApplied: true };
}
