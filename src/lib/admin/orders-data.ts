import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import type { OrderFulfillment, OrderStatus } from "@/lib/portal/portal-data";

// CP-3a admin order reads (service role — costs and profit are expected here,
// and ONLY here: order_item_costs is deny-all to every customer session).
// Tolerant of migration 0009 not being applied yet (42P01 -> empty results),
// same pattern as the offers/visibility reads.

export type AdminOrderSummary = {
  id: string;
  customerId: string;
  customerName: string;
  status: OrderStatus;
  fulfillment: OrderFulfillment;
  totalCents: number;
  itemCount: number;
  createdAt: string;
};

export type AdminOrders = {
  orders: AdminOrderSummary[];
  countsByStatus: Record<OrderStatus, number>;
  migrationApplied: boolean;
};

const EMPTY_COUNTS: Record<OrderStatus, number> = {
  new: 0,
  confirmed: 0,
  prepared: 0,
  completed: 0,
  cancelled: 0,
};

export async function fetchAdminOrders(): Promise<AdminOrders> {
  const admin = getAdminClient();
  if (!admin) return { orders: [], countsByStatus: { ...EMPTY_COUNTS }, migrationApplied: true };

  const { data, error } = await admin
    .from("orders")
    .select(
      "id, customer_id, status, fulfillment, total_cents, created_at, customers(business_name), order_items(product_id)",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    if (error.code !== "42P01") console.error("[admin] orders read failed:", error.message);
    return {
      orders: [],
      countsByStatus: { ...EMPTY_COUNTS },
      migrationApplied: error.code !== "42P01",
    };
  }

  type Row = {
    id: string;
    customer_id: string;
    status: OrderStatus;
    fulfillment: OrderFulfillment;
    total_cents: number;
    created_at: string;
    customers: { business_name: string } | null;
    order_items: { product_id: string }[] | null;
  };
  const orders = ((data as unknown as Row[]) ?? []).map((r) => ({
    id: r.id,
    customerId: r.customer_id,
    customerName: r.customers?.business_name ?? "(removed customer)",
    status: r.status,
    fulfillment: r.fulfillment,
    totalCents: r.total_cents,
    itemCount: r.order_items?.length ?? 0,
    createdAt: r.created_at,
  }));
  const countsByStatus = { ...EMPTY_COUNTS };
  for (const o of orders) countsByStatus[o.status] = (countsByStatus[o.status] ?? 0) + 1;
  return { orders, countsByStatus, migrationApplied: true };
}

// Lightweight count for the admin nav badge.
export async function fetchNewOrderCount(): Promise<number> {
  const admin = getAdminClient();
  if (!admin) return 0;
  const { count, error } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");
  if (error) return 0; // pre-0009 or transient — badge simply hides
  return count ?? 0;
}

export type AdminOrderLine = {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  unitSize: string;
  qty: number;
  basePriceCents: number;
  unitPriceCents: number;
  appliedOfferTitle: string | null;
  wasAssigned: boolean;
  lineTotalCents: number;
  costCents: number | null; // snapshot at order time; null = no cost recorded then
  productIsActive: boolean;
  // CP-3b: live tracked stock (null = untracked or pre-0010) — feeds the
  // confirm dialog's shortage list; never shown to customers.
  stockQty: number | null;
};

export type AdminOrderDetail = {
  id: string;
  status: OrderStatus;
  fulfillment: OrderFulfillment;
  notes: string | null;
  adminNote: string | null;
  paymentTerms: string;
  totalCents: number;
  createdAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  stockDecrementedAt: string | null; // CP-3b: set while stock is held by this order
  customer: {
    id: string;
    businessName: string;
    contactName: string;
    email: string;
    phone: string;
    status: string;
  } | null;
  lines: AdminOrderLine[];
  // Derived, never stored: sum over lines with a cost of (line_total - qty*cost).
  totalCostCents: number | null; // null when NO line has a cost
  totalProfitCents: number | null;
  linesWithoutCost: number;
};

export async function fetchAdminOrder(id: string): Promise<AdminOrderDetail | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  const [{ data: row, error }, { data: costRows, error: costErr }] = await Promise.all([
    admin
      .from("orders")
      .select(
        "id, status, fulfillment, notes, admin_note, payment_terms_snapshot, total_cents, created_at, confirmed_at, completed_at, cancelled_at, customers(id, business_name, contact_name, email, phone, status), order_items(product_id, name, sku, unit, unit_size, qty, base_price_cents, unit_price_cents, applied_offer_title, was_assigned, line_total_cents, products(is_active))",
      )
      .eq("id", id)
      .maybeSingle(),
    admin.from("order_item_costs").select("product_id, cost_cents").eq("order_id", id),
  ]);
  if (error || !row) {
    if (error && error.code !== "42P01")
      console.error("[admin] order read failed:", error.message);
    return null;
  }
  if (costErr) console.error("[admin] order costs read failed:", costErr.message);

  const costs = new Map(
    (((costRows as { product_id: string; cost_cents: number | null }[]) ?? [])).map((r) => [
      r.product_id,
      r.cost_cents,
    ]),
  );

  type ItemRow = {
    product_id: string;
    name: string;
    sku: string;
    unit: string;
    unit_size: string;
    qty: number;
    base_price_cents: number;
    unit_price_cents: number;
    applied_offer_title: string | null;
    was_assigned: boolean;
    line_total_cents: number;
    products: { is_active: boolean } | null;
  };
  const r = row as unknown as {
    id: string;
    status: OrderStatus;
    fulfillment: OrderFulfillment;
    notes: string | null;
    admin_note: string | null;
    payment_terms_snapshot: string;
    total_cents: number;
    created_at: string;
    confirmed_at: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    customers: {
      id: string;
      business_name: string;
      contact_name: string;
      email: string;
      phone: string;
      status: string;
    } | null;
    order_items: ItemRow[] | null;
  };

  // CP-3b extras, each tolerant of 0010 not being applied yet (separate reads
  // so the main select above never references a column that may not exist):
  //   * tracked stock per line (confirm-dialog shortage list)
  //   * orders.stock_decremented_at (restock guard indicator)
  const lineIds = (r.order_items ?? []).map((i) => i.product_id);
  const stockMap = new Map<string, number>();
  let stockDecrementedAt: string | null = null;
  if (lineIds.length > 0) {
    const { data: invRows, error: invErr } = await admin
      .from("product_inventory")
      .select("product_id, stock_qty")
      .in("product_id", lineIds);
    if (invErr) {
      if (invErr.code !== "42P01")
        console.error("[admin] order stock read failed:", invErr.message);
    } else {
      for (const s of (invRows as { product_id: string; stock_qty: number }[]) ?? [])
        stockMap.set(s.product_id, s.stock_qty);
    }
  }
  {
    const { data: sdRow, error: sdErr } = await admin
      .from("orders")
      .select("stock_decremented_at")
      .eq("id", id)
      .maybeSingle();
    if (!sdErr)
      stockDecrementedAt =
        (sdRow as { stock_decremented_at: string | null } | null)?.stock_decremented_at ?? null;
  }

  const lines: AdminOrderLine[] = (r.order_items ?? [])
    .map((i) => ({
      productId: i.product_id,
      name: i.name,
      sku: i.sku,
      unit: i.unit,
      unitSize: i.unit_size,
      qty: i.qty,
      basePriceCents: i.base_price_cents,
      unitPriceCents: i.unit_price_cents,
      appliedOfferTitle: i.applied_offer_title,
      wasAssigned: i.was_assigned,
      lineTotalCents: i.line_total_cents,
      costCents: costs.get(i.product_id) ?? null,
      productIsActive: i.products?.is_active ?? false,
      stockQty: stockMap.get(i.product_id) ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const costed = lines.filter((l) => l.costCents != null);
  const totalCostCents =
    costed.length > 0 ? costed.reduce((n, l) => n + l.qty * (l.costCents as number), 0) : null;
  const totalProfitCents =
    totalCostCents != null
      ? costed.reduce((n, l) => n + (l.lineTotalCents - l.qty * (l.costCents as number)), 0)
      : null;

  return {
    id: r.id,
    status: r.status,
    fulfillment: r.fulfillment,
    notes: r.notes,
    adminNote: r.admin_note,
    paymentTerms: r.payment_terms_snapshot,
    totalCents: r.total_cents,
    createdAt: r.created_at,
    confirmedAt: r.confirmed_at,
    completedAt: r.completed_at,
    cancelledAt: r.cancelled_at,
    stockDecrementedAt,
    customer: r.customers
      ? {
          id: r.customers.id,
          businessName: r.customers.business_name,
          contactName: r.customers.contact_name,
          email: r.customers.email,
          phone: r.customers.phone,
          status: r.customers.status,
        }
      : null,
    lines,
    totalCostCents,
    totalProfitCents,
    linesWithoutCost: lines.length - costed.length,
  };
}
