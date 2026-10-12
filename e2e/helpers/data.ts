import { randomUUID } from "node:crypto";
import { insert, patch, select, del } from "./db";

// Test-data helpers against the LOCAL stand-in (service key). Each mutating test builds its own rows, so the
// desktop and phone projects (and re-runs) never depend on what an earlier test left behind.

export type ProductRow = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  unit_size: string;
  list_price_cents: number;
  image_url: string | null;
};

export const CUSTOMER_KEYS = ["copperleaf", "bluestone", "juniper", "harbourline", "ember", "saffron"] as const;
export const BUSINESS: Record<string, string> = {
  copperleaf: "Copperleaf Kitchen",
  bluestone: "Bluestone Bakehouse",
  juniper: "Juniper & Rye Café",
  harbourline: "Harbourline Catering",
  ember: "Ember Lane Pizza",
  saffron: "Saffron Courtyard",
};

export async function customerByKey(key: string) {
  const rows = await select<{ id: string; business_name: string; payment_terms: string; user_id: string | null; email: string }>(
    `customers?select=id,business_name,payment_terms,user_id,email&business_name=eq.${encodeURIComponent(BUSINESS[key])}`,
  );
  return rows[0];
}

export async function productBySku(sku: string): Promise<ProductRow> {
  return (await select<ProductRow>(`products?select=id,sku,name,unit,unit_size,list_price_cents,image_url&sku=eq.${sku}`))[0];
}

export async function allProducts() {
  return select<ProductRow>("products?select=id,sku,name,unit,unit_size,list_price_cents,image_url&order=sku");
}

/** Set tracked stock for a product (the row is created when missing). */
export async function setStock(sku: string, qty: number | null, threshold = 5) {
  const p = await productBySku(sku);
  const existing = await select(`product_inventory?select=product_id&product_id=eq.${p.id}`);
  if (qty === null) {
    if (existing.length) await del("product_inventory", `product_id=eq.${p.id}`);
    return p;
  }
  if (existing.length) await patch("product_inventory", `product_id=eq.${p.id}`, { stock_qty: qty, low_stock_threshold: threshold });
  else await insert("product_inventory", { product_id: p.id, stock_qty: qty, low_stock_threshold: threshold });
  await patch("products", `id=eq.${p.id}`, { is_available: qty > 0 });
  return p;
}

export async function stockOf(sku: string): Promise<number | null> {
  const p = await productBySku(sku);
  const r = await select<{ stock_qty: number }>(`product_inventory?select=stock_qty&product_id=eq.${p.id}`);
  return r[0]?.stock_qty ?? null;
}

export type LineSpec = { sku: string; qty: number; priceCents?: number; wasAssigned?: boolean };

/** Insert a complete order (header, lines, cost snapshots) with the given status and return its id. */
export async function createOrder(
  customerKey: string,
  lines: LineSpec[],
  opts: { status?: string; fulfillment?: "pickup" | "delivery"; notes?: string; createdAt?: string } = {},
) {
  const c = await customerByKey(customerKey);
  const prods = await Promise.all(lines.map((l) => productBySku(l.sku)));
  const priced = lines.map((l, i) => ({ ...l, p: prods[i], price: l.priceCents ?? prods[i].list_price_cents }));
  const total = priced.reduce((n, l) => n + l.qty * l.price, 0);
  const [o] = await insert<{ id: string }>("orders", {
    customer_id: c.id,
    status: opts.status ?? "new",
    fulfillment: opts.fulfillment ?? "delivery",
    notes: opts.notes ?? null,
    payment_terms_snapshot: c.payment_terms,
    total_cents: total,
    client_token: randomUUID(),
    ...(opts.createdAt ? { created_at: opts.createdAt } : {}),
  });
  await insert(
    "order_items",
    priced.map((l) => ({
      order_id: o.id,
      product_id: l.p.id,
      name: l.p.name,
      sku: l.p.sku,
      unit: l.p.unit,
      unit_size: l.p.unit_size,
      qty: l.qty,
      base_price_cents: l.p.list_price_cents,
      unit_price_cents: l.price,
      was_assigned: l.wasAssigned ?? true,
      line_total_cents: l.qty * l.price,
    })),
  );
  const costs = await select<{ product_id: string; cost_cents: number }>(
    `product_costs?select=product_id,cost_cents&product_id=in.(${prods.map((p) => p.id).join(",")})`,
  );
  if (costs.length) await insert("order_item_costs", costs.map((k) => ({ order_id: o.id, product_id: k.product_id, cost_cents: k.cost_cents })));
  return { id: o.id, totalCents: total, customerId: c.id };
}

export async function orderRow(id: string) {
  return (await select<Record<string, unknown>>(`orders?select=*&id=eq.${id}`))[0];
}

/** Remove every offer on a customer, then add the given ones. */
export async function setOffers(
  customerKey: string,
  offers: { title: string; kind: "percent" | "amount_off" | "fixed_price" | null; value: number | null; sku?: string; startsAt?: string | null; endsAt?: string | null; active?: boolean }[],
) {
  const c = await customerByKey(customerKey);
  await del("customer_offers", `customer_id=eq.${c.id}`);
  for (const o of offers) {
    const productId = o.sku ? (await productBySku(o.sku)).id : null;
    await insert("customer_offers", {
      customer_id: c.id,
      title: o.title,
      description: null,
      product_id: productId,
      discount_kind: o.kind,
      discount_value: o.value,
      starts_at: o.startsAt ?? null,
      ends_at: o.endsAt ?? null,
      is_active: o.active ?? true,
    });
  }
  return c;
}
