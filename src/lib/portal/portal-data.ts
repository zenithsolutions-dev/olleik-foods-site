import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProductUnit } from "@/lib/admin/types";

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
  effectiveCents: number; // COALESCE(customer price, list price)
  isCustomPrice: boolean;
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

export async function fetchMyCatalog(): Promise<PortalCategoryGroup[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: cpRows, error }, { data: cats }] = await Promise.all([
    supabase
      .from("customer_products")
      .select(
        "price_cents, products(id, name, sku, unit, unit_size, image_url, category_id, list_price_cents, is_active)",
      ),
    supabase.from("categories").select("id, name"),
  ]);

  if (error) {
    console.error("[portal] catalog read failed:", error.message);
    return [];
  }

  const catName = new Map((cats ?? []).map((c) => [c.id as string, c.name as string]));
  const groups = new Map<string, PortalCategoryGroup>();

  for (const r of (cpRows as unknown as CpRow[]) ?? []) {
    const p = r.products;
    if (!p || !p.is_active) continue; // inactive products stay hidden
    const key = p.category_id ?? "uncategorized";
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        name: p.category_id ? (catName.get(p.category_id) ?? "Other") : "Other",
        products: [],
      });
    }
    groups.get(key)!.products.push({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      unit: p.unit,
      unitSize: p.unit_size,
      imageUrl: p.image_url,
      effectiveCents: r.price_cents ?? p.list_price_cents,
      isCustomPrice: r.price_cents != null,
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
