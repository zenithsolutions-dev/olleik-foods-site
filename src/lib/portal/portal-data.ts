import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OfferDiscountKind, ProductUnit } from "@/lib/admin/types";
import {
  effectivePriceCents,
  applyOffersToPrice,
  offerAppliesToProduct,
} from "@/lib/pricing";

// Customer portal reads. EVERY query here uses the SESSION-BOUND anon client so
// Postgres RLS enforces tenant isolation (a customer sees only their own
// customer_products / customer_offers, and — after migration 0003 — only their
// assigned products). This file must NEVER import @/lib/supabase/admin; the
// ESLint zone + CI guard enforce that. Scoping is RLS-first: we do not rely on
// a manual customer_id filter as the only defense.

export type PortalProduct = {
  productId: string;
  name: string;
  sku: string;
  unit: ProductUnit;
  unitSize: string;
  imageUrl: string | null;
  effectiveCents: number; // pre-offer price = COALESCE(customer price, list price)
  isCustomPrice: boolean;
  finalCents: number; // after the best applicable active offer (== effectiveCents if none)
  discounted: boolean; // finalCents < effectiveCents
  appliedOfferTitle: string | null; // the winning offer's title (for a label), else null
};

export type PortalCategoryGroup = {
  id: string;
  name: string;
  products: PortalProduct[];
};

type CpRow = {
  price_cents: number | null;
  products: {
    id: string;
    name: string;
    sku: string;
    unit: ProductUnit;
    unit_size: string;
    image_url: string | null;
    category_id: string | null;
    list_price_cents: number;
    is_active: boolean;
  } | null;
};

// Offer fields needed to price a product. Read via the SESSION client, so RLS
// returns only THIS customer's own offer rows (same "customer reads own offers"
// policy as fetchMyOffers — no isolation change, just more columns of owned rows).
type PricingOfferRow = {
  title: string;
  product_id: string | null;
  discount_kind: OfferDiscountKind | null;
  discount_value: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

type PricingOffer = {
  title: string;
  productId: string | null;
  discountKind: OfferDiscountKind | null;
  discountValue: number | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

export async function fetchMyCatalog(): Promise<PortalCategoryGroup[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: cpRows, error }, { data: cats }, { data: offerRows, error: offerErr }] =
    await Promise.all([
      supabase
        .from("customer_products")
        .select(
          "price_cents, products(id, name, sku, unit, unit_size, image_url, category_id, list_price_cents, is_active)",
        ),
      // parent_id is taxonomy only (0006) — used to label subcategory groups as
      // "Parent · Child". No pricing data lives on categories.
      supabase.from("categories").select("id, name, parent_id"),
      supabase
        .from("customer_offers")
        .select("title, product_id, discount_kind, discount_value, starts_at, ends_at, is_active")
        .eq("is_active", true),
    ]);

  if (error) {
    console.error("[portal] catalog read failed:", error.message);
    return [];
  }
  // Offers are non-fatal: if the read fails, prices simply fall back to effective.
  if (offerErr) console.error("[portal] offers read failed:", offerErr.message);

  const offers: PricingOffer[] = ((offerRows as PricingOfferRow[]) ?? []).map((o) => ({
    title: o.title,
    productId: o.product_id,
    discountKind: o.discount_kind,
    discountValue: o.discount_value,
    isActive: o.is_active,
    startsAt: o.starts_at,
    endsAt: o.ends_at,
  }));
  const now = new Date();

  type CatMeta = { id: string; name: string; parent_id: string | null };
  const catMeta = new Map(((cats as CatMeta[] | null) ?? []).map((c) => [c.id, c]));
  // Subcategory groups display as "Parent · Child".
  const groupLabel = (categoryId: string): string => {
    const c = catMeta.get(categoryId);
    if (!c) return "Other";
    const parent = c.parent_id ? catMeta.get(c.parent_id) : null;
    return parent ? `${parent.name} · ${c.name}` : c.name;
  };
  const groups = new Map<string, PortalCategoryGroup>();

  for (const r of (cpRows as unknown as CpRow[]) ?? []) {
    const p = r.products;
    if (!p || !p.is_active) continue; // inactive products stay hidden
    const key = p.category_id ?? "uncategorized";
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        name: p.category_id ? groupLabel(p.category_id) : "Other",
        products: [],
      });
    }

    const effectiveCents = effectivePriceCents(r.price_cents, p.list_price_cents);
    const applicable = offers
      .filter((o) => offerAppliesToProduct(o, p.id, now))
      .map((o) => ({
        title: o.title,
        discountKind: o.discountKind as OfferDiscountKind,
        discountValue: o.discountValue as number,
      }));
    const priced = applyOffersToPrice(effectiveCents, applicable);

    groups.get(key)!.products.push({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      unit: p.unit,
      unitSize: p.unit_size,
      imageUrl: p.image_url,
      effectiveCents,
      isCustomPrice: r.price_cents != null,
      finalCents: priced.finalCents,
      discounted: priced.discounted,
      appliedOfferTitle: priced.appliedOffer?.title ?? null,
    });
  }

  return [...groups.values()]
    .map((g) => ({ ...g, products: g.products.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type PortalOffer = {
  id: string;
  title: string;
  description: string | null;
  productName: string | null; // null if no link, or RLS-hidden (unassigned product)
  startsAt: string | null;
  endsAt: string | null;
};

type OfferRow = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  products: { name: string } | null;
};

export async function fetchMyOffers(): Promise<PortalOffer[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customer_offers")
    .select("id, title, description, starts_at, ends_at, products(name)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[portal] offers read failed:", error.message);
    return [];
  }

  return ((data as unknown as OfferRow[]) ?? []).map((o) => ({
    id: o.id,
    title: o.title,
    description: o.description,
    productName: o.products?.name ?? null,
    startsAt: o.starts_at,
    endsAt: o.ends_at,
  }));
}
