import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import type { OfferDiscountKind } from "@/lib/admin/types";
import type { BatchRowInput } from "@/lib/admin/bulk-offers";
import type { OverviewOffer } from "@/lib/admin/offers-overview";

// CP-8a "Running now" read (ADMIN ONLY — service role). ONE query over
// customer_offers joined to customer/product names; the table holds dozens of
// rows (offers are applied by hand, one merchant), so a full read with no new
// index is the honest sizing. Grouping/urgency is pure logic in
// offers-overview.ts — this file only fetches and flattens.

export async function fetchOffersOverviewRows(): Promise<{
  offers: OverviewOffer[];
  batches: BatchRowInput[]; // CP-8a-2: rows carrying a batch id, for the panel
  migrationApplied: boolean;
}> {
  const admin = getAdminClient();
  if (!admin) return { offers: [], batches: [], migrationApplied: true };

  const { data, error } = await admin
    .from("customer_offers")
    .select(
      "id, customer_id, title, product_id, discount_kind, discount_value, is_active, starts_at, ends_at, created_at, customers(business_name), products(name, sku)",
    )
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) {
    if (error.code !== "42P01") console.error("[admin] offers overview read failed:", error.message);
    return { offers: [], batches: [], migrationApplied: error.code !== "42P01" };
  }

  type Row = {
    id: string;
    customer_id: string;
    title: string;
    product_id: string | null;
    discount_kind: OfferDiscountKind | null;
    discount_value: number | null;
    is_active: boolean;
    starts_at: string | null;
    ends_at: string | null;
    created_at: string;
    customers: { business_name: string } | null;
    products: { name: string; sku: string } | null;
  };

  // CP-8a-2 batch identity — a SEPARATE, tolerant read (the CP-3b pattern:
  // the main select never references columns migration 0013 may not have
  // applied yet; pre-0013 this errors 42703 and batch info simply hides).
  const batchInfo = new Map<string, { batchId: string; batchSize: number | null }>();
  {
    const { data: bRows, error: bErr } = await admin
      .from("customer_offers")
      .select("id, batch_id, batch_size")
      .not("batch_id", "is", null);
    if (bErr) {
      if (bErr.code !== "42703" && bErr.code !== "42P01")
        console.error("[admin] offer batch read failed:", bErr.message);
    } else {
      for (const b of ((bRows as { id: string; batch_id: string; batch_size: number | null }[]) ?? []))
        batchInfo.set(b.id, { batchId: b.batch_id, batchSize: b.batch_size });
    }
  }

  const rows = (data as unknown as Row[]) ?? [];
  return {
    migrationApplied: true,
    batches: rows
      .filter((r) => batchInfo.has(r.id))
      .map((r) => ({
        batchId: batchInfo.get(r.id)!.batchId,
        batchSize: batchInfo.get(r.id)!.batchSize,
        templateId: null,
        title: r.title,
        customerId: r.customer_id,
        customerName: r.customers?.business_name ?? "(removed customer)",
        createdAt: r.created_at,
        endsAt: r.ends_at,
        isActive: r.is_active,
      })),
    offers: rows.map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      customerName: r.customers?.business_name ?? "(removed customer)",
      title: r.title,
      productId: r.product_id,
      productLabel: r.products ? `${r.products.name} (${r.products.sku})` : null,
      discountKind: r.discount_kind,
      discountValue: r.discount_value,
      isActive: r.is_active,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      batchId: batchInfo.get(r.id)?.batchId ?? null,
      batchSize: batchInfo.get(r.id)?.batchSize ?? null,
    })),
  };
}
