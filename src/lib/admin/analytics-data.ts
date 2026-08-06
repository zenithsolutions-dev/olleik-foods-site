import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import { REVENUE_STATUSES } from "./dashboard-math";
import { bucketKeyFor, bucketOrdersFallback } from "./analytics-buckets";
import type { CustomerSales, ProductSales } from "./analytics-math";

// CP-8b analytics reads (ADMIN ONLY — service role; the RPCs themselves are
// EXECUTE-revoked from authenticated/anon, D-O0).
//
// RPC-FIRST, FALLBACK-HONEST: with migration 0014 applied the SUM/GROUP BY
// runs inside Postgres (one small result set over the wire). Before 0014 —
// or if the RPC errors 42883 — the same aggregation runs here in app code
// over the raw rows: correct, but it ships every order line of the period
// over the wire, which is exactly why 0014 exists. `source` says which path
// produced the figures so the UI can surface "migration 0014 pending".
//
// COUNTING: both paths filter by REVENUE_STATUSES imported from
// dashboard-math — never redefined. The SQL functions mirror the same three
// statuses; test:analytics asserts all paths agree with aggregateDay.

export type AnalyticsSource = "rpc" | "fallback";

export type CustomerSalesRow = CustomerSales & { businessName: string; status: string };

const FALLBACK_SCAN_LIMIT = 20000; // fallback safety valve — stated, never silent

export async function fetchProductSales(range: {
  startISO: string | null;
  endISO: string | null;
}): Promise<{ rows: ProductSales[]; source: AnalyticsSource; truncated: boolean }> {
  const admin = getAdminClient();
  if (!admin) return { rows: [], source: "fallback", truncated: false };

  const { data, error } = await admin.rpc("analytics_product_sales", {
    p_start: range.startISO,
    p_end: range.endISO,
  });
  if (!error) {
    type Row = {
      product_id: string;
      name: string;
      sku: string;
      units: number;
      revenue_cents: number;
      cost_cents: number | null;
      costed_lines: number;
      total_lines: number;
    };
    return {
      source: "rpc",
      truncated: false,
      rows: (((data as Row[]) ?? [])).map((r) => ({
        productId: r.product_id,
        name: r.name,
        sku: r.sku,
        units: Number(r.units),
        revenueCents: Number(r.revenue_cents),
        costCents: r.cost_cents == null ? null : Number(r.cost_cents),
        costedLines: Number(r.costed_lines),
        totalLines: Number(r.total_lines),
      })),
    };
  }
  if (error.code !== "42883" && error.code !== "PGRST202")
    console.error("[admin] analytics_product_sales failed:", error.message);

  // ---- fallback: aggregate in app code over raw rows ----
  let q = admin
    .from("orders")
    .select(
      "id, status, created_at, order_items(product_id, name, sku, qty, line_total_cents)",
    )
    .in("status", REVENUE_STATUSES as unknown as string[]);
  if (range.startISO) q = q.gte("created_at", range.startISO);
  if (range.endISO) q = q.lt("created_at", range.endISO);
  const { data: orders, error: oErr } = await q.limit(FALLBACK_SCAN_LIMIT);
  if (oErr) {
    if (oErr.code !== "42P01") console.error("[admin] product-sales fallback failed:", oErr.message);
    return { rows: [], source: "fallback", truncated: false };
  }
  type ORow = {
    id: string;
    order_items: { product_id: string; name: string; sku: string; qty: number; line_total_cents: number }[] | null;
  };
  const rows = (orders as unknown as ORow[]) ?? [];
  const orderIds = rows.map((r) => r.id);
  const costs = new Map<string, number | null>();
  if (orderIds.length > 0) {
    // Chunk the id list to keep each request bounded.
    for (let i = 0; i < orderIds.length; i += 200) {
      const { data: costRows } = await admin
        .from("order_item_costs")
        .select("order_id, product_id, cost_cents")
        .in("order_id", orderIds.slice(i, i + 200));
      for (const c of ((costRows as { order_id: string; product_id: string; cost_cents: number | null }[]) ?? []))
        costs.set(`${c.order_id}:${c.product_id}`, c.cost_cents);
    }
  }
  const byProduct = new Map<string, ProductSales>();
  for (const o of rows) {
    for (const i of o.order_items ?? []) {
      const cur =
        byProduct.get(i.product_id) ??
        ({
          productId: i.product_id,
          name: i.name,
          sku: i.sku,
          units: 0,
          revenueCents: 0,
          costCents: null,
          costedLines: 0,
          totalLines: 0,
        } as ProductSales);
      cur.units += i.qty;
      cur.revenueCents += i.line_total_cents;
      cur.totalLines += 1;
      const c = costs.get(`${o.id}:${i.product_id}`);
      if (c != null) {
        cur.costCents = (cur.costCents ?? 0) + i.qty * c;
        cur.costedLines += 1;
      }
      byProduct.set(i.product_id, cur);
    }
  }
  return {
    rows: [...byProduct.values()],
    source: "fallback",
    truncated: rows.length >= FALLBACK_SCAN_LIMIT,
  };
}

export async function fetchCustomerSales(range: {
  startISO: string | null;
  endISO: string | null;
}): Promise<{ rows: CustomerSalesRow[]; source: AnalyticsSource; truncated: boolean }> {
  const admin = getAdminClient();
  if (!admin) return { rows: [], source: "fallback", truncated: false };

  // Names/status come from customers regardless of path (the RPC returns ids).
  const { data: custRows, error: custErr } = await admin
    .from("customers")
    .select("id, business_name, status");
  if (custErr) {
    console.error("[admin] analytics customers read failed:", custErr.message);
    return { rows: [], source: "fallback", truncated: false };
  }
  const names = new Map(
    (((custRows as { id: string; business_name: string; status: string }[]) ?? [])).map((c) => [
      c.id,
      { businessName: c.business_name, status: c.status },
    ]),
  );

  const { data, error } = await admin.rpc("analytics_customer_sales", {
    p_start: range.startISO,
    p_end: range.endISO,
  });
  if (!error) {
    type Row = { customer_id: string; orders_count: number; revenue_cents: number; last_order_at: string | null };
    return {
      source: "rpc",
      truncated: false,
      rows: (((data as Row[]) ?? []))
        .filter((r) => names.has(r.customer_id))
        .map((r) => ({
          customerId: r.customer_id,
          ordersCount: Number(r.orders_count),
          revenueCents: Number(r.revenue_cents),
          lastOrderAt: r.last_order_at,
          businessName: names.get(r.customer_id)!.businessName,
          status: names.get(r.customer_id)!.status,
        })),
    };
  }
  if (error.code !== "42883" && error.code !== "PGRST202")
    console.error("[admin] analytics_customer_sales failed:", error.message);

  let q = admin
    .from("orders")
    .select("customer_id, total_cents, created_at")
    .in("status", REVENUE_STATUSES as unknown as string[]);
  if (range.startISO) q = q.gte("created_at", range.startISO);
  if (range.endISO) q = q.lt("created_at", range.endISO);
  const { data: orders, error: oErr } = await q.limit(FALLBACK_SCAN_LIMIT);
  if (oErr) {
    if (oErr.code !== "42P01") console.error("[admin] customer-sales fallback failed:", oErr.message);
    return { rows: [], source: "fallback", truncated: false };
  }
  const byCustomer = new Map<string, CustomerSales>();
  for (const o of ((orders as { customer_id: string; total_cents: number; created_at: string }[]) ?? [])) {
    const cur =
      byCustomer.get(o.customer_id) ??
      ({ customerId: o.customer_id, ordersCount: 0, revenueCents: 0, lastOrderAt: null } as CustomerSales);
    cur.ordersCount += 1;
    cur.revenueCents += o.total_cents;
    if (cur.lastOrderAt == null || o.created_at > cur.lastOrderAt) cur.lastOrderAt = o.created_at;
    byCustomer.set(o.customer_id, cur);
  }
  return {
    source: "fallback",
    truncated: (orders?.length ?? 0) >= FALLBACK_SCAN_LIMIT,
    rows: [...byCustomer.values()]
      .filter((r) => names.has(r.customerId))
      .map((r) => ({
        ...r,
        businessName: names.get(r.customerId)!.businessName,
        status: names.get(r.customerId)!.status,
      })),
  };
}

// ---------- CP-8 charts follow-on: time-bucketed revenue ----------
//
// RPC-first (migration 0015); pre-0015 the same figures come from bucketing
// raw rows here — correct but row-shipping, so the UI names the path. The
// bucket size itself is chosen by the caller (chooseBucket) and stated on
// the chart.

export async function fetchRevenueBuckets(
  range: { startISO: string | null; endISO: string | null },
  bucket: "day" | "week" | "month",
): Promise<{
  sums: { bucketKey: string; revenueCents: number; ordersCount: number }[];
  source: AnalyticsSource;
  truncated: boolean;
}> {
  const admin = getAdminClient();
  if (!admin) return { sums: [], source: "fallback", truncated: false };

  const { data, error } = await admin.rpc("analytics_revenue_buckets", {
    p_start: range.startISO,
    p_end: range.endISO,
    p_bucket: bucket,
  });
  if (!error) {
    type Row = { bucket_start: string; revenue_cents: number; orders_count: number };
    return {
      source: "rpc",
      truncated: false,
      sums: (((data as Row[]) ?? [])).map((r) => ({
        // The SQL bucket_start is the UTC instant of the Toronto boundary —
        // re-keying through the same helper the fallback uses guarantees the
        // two paths can never disagree about which bucket a sum belongs to.
        bucketKey: bucketKeyFor(r.bucket_start, bucket),
        revenueCents: Number(r.revenue_cents),
        ordersCount: Number(r.orders_count),
      })),
    };
  }
  if (error.code !== "42883" && error.code !== "PGRST202")
    console.error("[admin] analytics_revenue_buckets failed:", error.message);

  // ---- fallback: bucket raw rows in the app (pre-0015) ----
  let q = admin
    .from("orders")
    .select("created_at, total_cents")
    .in("status", REVENUE_STATUSES as unknown as string[]);
  if (range.startISO) q = q.gte("created_at", range.startISO);
  if (range.endISO) q = q.lt("created_at", range.endISO);
  const { data: orders, error: oErr } = await q.limit(FALLBACK_SCAN_LIMIT);
  if (oErr) {
    if (oErr.code !== "42P01") console.error("[admin] revenue-buckets fallback failed:", oErr.message);
    return { sums: [], source: "fallback", truncated: false };
  }
  const rows = ((orders as { created_at: string; total_cents: number }[]) ?? []).map((o) => ({
    createdAt: o.created_at,
    totalCents: o.total_cents,
  }));
  return {
    source: "fallback",
    truncated: rows.length >= FALLBACK_SCAN_LIMIT,
    sums: bucketOrdersFallback(rows, bucket),
  };
}
