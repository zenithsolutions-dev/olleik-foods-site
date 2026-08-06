import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import type { OfferDiscountKind } from "@/lib/admin/types";
import type { BulkCustomerInput } from "@/lib/admin/bulk-offers";

// CP-8a-2 bulk-apply reads (ADMIN ONLY — service role). BATCHED: four queries
// total regardless of customer count — never a per-customer loop.
//   1. customers (all, so pending/archived can be REPORTED as skipped, not
//      silently missing from the picker)
//   2. orders in the last 90 days (the activity signal for ordered-within —
//      the same 30/60/90 thresholds as the D-N3 inactive definition)
//   3. customer_products ⋈ products (today's effective prices)
//   4. customer_offers (stacking math + duplicate skip)

export async function fetchBulkTargets(): Promise<{
  customers: BulkCustomerInput[];
  live: boolean;
}> {
  const admin = getAdminClient();
  if (!admin) return { customers: [], live: false };

  const cutoff90 = new Date(Date.now() - 90 * 24 * 3600_000).toISOString();
  const [custRes, ordersRes, cpRes, offersRes] = await Promise.all([
    admin.from("customers").select("id, business_name, status").order("business_name"),
    admin.from("orders").select("customer_id, created_at").gte("created_at", cutoff90),
    admin
      .from("customer_products")
      .select("customer_id, product_id, price_cents, products(name, list_price_cents, is_active)"),
    admin
      .from("customer_offers")
      .select(
        "customer_id, template_id, is_active, starts_at, ends_at, product_id, discount_kind, discount_value",
      ),
  ]);

  if (custRes.error) {
    console.error("[admin] bulk targets read failed:", custRes.error.message);
    return { customers: [], live: true };
  }

  // Last order per customer within the 90-day window (older ⇒ null: every
  // targeting threshold is ≤ 90 days, so nothing further back matters).
  const lastOrder = new Map<string, string>();
  for (const o of ((ordersRes.data as { customer_id: string; created_at: string }[]) ?? [])) {
    const cur = lastOrder.get(o.customer_id);
    if (!cur || o.created_at > cur) lastOrder.set(o.customer_id, o.created_at);
  }

  type CpRow = {
    customer_id: string;
    product_id: string;
    price_cents: number | null;
    products: { name: string; list_price_cents: number; is_active: boolean } | null;
  };
  const productsByCustomer = new Map<string, BulkCustomerInput["products"]>();
  for (const r of ((cpRes.data as unknown as CpRow[]) ?? [])) {
    if (!r.products || !r.products.is_active) continue; // inactive products can't be bought
    const list = productsByCustomer.get(r.customer_id) ?? [];
    list.push({
      productId: r.product_id,
      name: r.products.name,
      priceCents: r.price_cents,
      listPriceCents: r.products.list_price_cents,
    });
    productsByCustomer.set(r.customer_id, list);
  }

  type OfferRow = {
    customer_id: string;
    template_id: string | null;
    is_active: boolean;
    starts_at: string | null;
    ends_at: string | null;
    product_id: string | null;
    discount_kind: OfferDiscountKind | null;
    discount_value: number | null;
  };
  const offersByCustomer = new Map<string, BulkCustomerInput["offers"]>();
  for (const r of ((offersRes.data as OfferRow[]) ?? [])) {
    const list = offersByCustomer.get(r.customer_id) ?? [];
    list.push({
      templateId: r.template_id,
      isActive: r.is_active,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      productId: r.product_id,
      discountKind: r.discount_kind,
      discountValue: r.discount_value,
    });
    offersByCustomer.set(r.customer_id, list);
  }

  return {
    live: true,
    customers: (((custRes.data as { id: string; business_name: string; status: string }[]) ?? [])).map(
      (c) => ({
        id: c.id,
        businessName: c.business_name,
        status: c.status,
        lastOrderAt: lastOrder.get(c.id) ?? null,
        products: productsByCustomer.get(c.id) ?? [],
        offers: offersByCustomer.get(c.id) ?? [],
      }),
    ),
  };
}
