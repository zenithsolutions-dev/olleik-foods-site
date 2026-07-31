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
// customer_products / customer_offers, and — after migration 0008 — exactly the
// products their visibility mode allows). This file must NEVER import
// @/lib/supabase/admin; the ESLint zone + CI guard enforce that. Scoping is
// RLS-first: we do not rely on a manual customer_id filter as the only defense.
//
// CP-2: the catalog reads `products` DIRECTLY — the RLS policy is the single
// source of truth for what's visible (this code never inspects visibility_mode).
// The customer's own customer_products rows are layered on top for the
// "Your price" badge (any assigned product, decision D-V5) and the
// materialized price; visible-but-unassigned products show list price plainly.

export type PortalProduct = {
  productId: string;
  name: string;
  sku: string;
  unit: ProductUnit;
  unitSize: string;
  imageUrl: string | null;
  categoryLabel: string | null; // "Parent · Child" (null = uncategorized)
  assigned: boolean; // has a customer_products row -> "Your price" badge (D-V5)
  // CP-3b (D-O6): the ONLY stock signal the portal ever sees — a boolean.
  // Quantities live in a deny-all admin table and never reach this layer.
  // Unavailable products stay visible with a chip; add-to-cart is disabled
  // and the submit action rejects them server-side too.
  available: boolean;
  effectiveCents: number; // assigned: COALESCE(customer price, list); else list
  finalCents: number; // after the best applicable active offer (== effectiveCents if none)
  discounted: boolean; // finalCents < effectiveCents
  appliedOfferTitle: string | null; // the winning offer's title (for a label), else null
};

export type PortalCategoryOption = { id: string; label: string };

export type PortalCatalogPage = {
  items: PortalProduct[];
  total: number; // visible products matching the current search/filter
  page: number; // 1-based, clamped to range
  pageCount: number;
  categoryOptions: PortalCategoryOption[]; // categories with >=1 visible product
};

export const PORTAL_PAGE_SIZE = 48;

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  unit: ProductUnit;
  unit_size: string;
  image_url: string | null;
  category_id: string | null;
  list_price_cents: number;
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

// How many products this customer can browse — RLS does the filtering; the
// is_active filter is belt-and-suspenders (the policy already requires it).
export async function fetchMyVisibleProductCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  if (error) {
    console.error("[portal] visible-count read failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

// PostgREST .or() treats , ( ) as syntax; % is the ilike wildcard. Strip them
// so a search term can never break out of the name/sku ilike pair.
function sanitizeSearch(term: string): string {
  return term.replace(/[,()%\\]/g, " ").trim();
}

export async function fetchMyCatalogPage(opts: {
  page: number;
  search?: string;
  categoryId?: string;
}): Promise<PortalCatalogPage> {
  const supabase = await createSupabaseServerClient();
  const search = sanitizeSearch(opts.search ?? "");
  const categoryId = opts.categoryId?.trim() || null;

  const buildQuery = (from: number, to: number) => {
    let q = supabase
      .from("products")
      .select("id, name, sku, unit, unit_size, image_url, category_id, list_price_cents", {
        count: "exact",
      })
      .eq("is_active", true);
    if (search) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    if (categoryId) q = q.eq("category_id", categoryId);
    return q.order("name", { ascending: true }).range(from, to);
  };

  // First pass with the requested page; the count comes back with it, so an
  // out-of-range page can be clamped and re-fetched once.
  const requested = Math.max(1, Math.floor(opts.page) || 1);
  let from = (requested - 1) * PORTAL_PAGE_SIZE;
  const first = await buildQuery(from, from + PORTAL_PAGE_SIZE - 1);
  if (first.error) {
    console.error("[portal] catalog read failed:", first.error.message);
    return { items: [], total: 0, page: 1, pageCount: 1, categoryOptions: [] };
  }
  let rows = first.data;
  const total = first.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PORTAL_PAGE_SIZE));
  let page = requested;
  if (requested > pageCount) {
    page = pageCount;
    from = (page - 1) * PORTAL_PAGE_SIZE;
    const retry = await buildQuery(from, from + PORTAL_PAGE_SIZE - 1);
    rows = retry.data ?? [];
  }

  // Everything else the page needs, in parallel:
  //  - the caller's own assignments (RLS: own rows only) for badge + price
  //  - category taxonomy for labels + the filter dropdown
  //  - visible category ids (single-column scan of the RLS-visible set)
  //  - the caller's own active offers
  const [
    { data: cpRows, error: cpErr },
    { data: cats },
    { data: visCatRows },
    { data: offerRows, error: offerErr },
  ] = await Promise.all([
    supabase.from("customer_products").select("product_id, price_cents"),
    supabase.from("categories").select("id, name, parent_id"),
    supabase.from("products").select("category_id").eq("is_active", true),
    supabase
      .from("customer_offers")
      .select("title, product_id, discount_kind, discount_value, starts_at, ends_at, is_active")
      .eq("is_active", true),
  ]);
  if (cpErr) console.error("[portal] assignments read failed:", cpErr.message);
  // Offers are non-fatal: if the read fails, prices simply fall back to effective.
  if (offerErr) console.error("[portal] offers read failed:", offerErr.message);

  // CP-3b availability — a SEPARATE query so the main select never references
  // a column that may not exist yet (pre-0010 the 42703 here just means
  // everything is available). Session client: RLS-visible rows only.
  const unavailable = new Set<string>();
  {
    const pageIds = (((rows as ProductRow[] | null) ?? [])).map((p) => p.id);
    if (pageIds.length > 0) {
      const { data: availRows, error: availErr } = await supabase
        .from("products")
        .select("id, is_available")
        .in("id", pageIds);
      if (availErr) {
        if (availErr.code !== "42703")
          console.error("[portal] availability read failed:", availErr.message);
      } else {
        for (const r of (availRows as { id: string; is_available: boolean }[]) ?? [])
          if (!r.is_available) unavailable.add(r.id);
      }
    }
  }

  const myPrices = new Map(
    (((cpRows as { product_id: string; price_cents: number | null }[]) ?? [])).map((r) => [
      r.product_id,
      r.price_cents,
    ]),
  );

  type CatMeta = { id: string; name: string; parent_id: string | null };
  const catMeta = new Map(((cats as CatMeta[] | null) ?? []).map((c) => [c.id, c]));
  // Subcategories display as "Parent · Child".
  const catLabel = (id: string): string => {
    const c = catMeta.get(id);
    if (!c) return "Other";
    const parent = c.parent_id ? catMeta.get(c.parent_id) : null;
    return parent ? `${parent.name} · ${c.name}` : c.name;
  };

  const visibleCatIds = new Set(
    (((visCatRows as { category_id: string | null }[]) ?? []))
      .map((r) => r.category_id)
      .filter((x): x is string => x != null),
  );
  const categoryOptions: PortalCategoryOption[] = [...visibleCatIds]
    .map((id) => ({ id, label: catLabel(id) }))
    .sort((a, b) => a.label.localeCompare(b.label));

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

  const items: PortalProduct[] = (((rows as ProductRow[] | null) ?? [])).map((p) => {
    const assigned = myPrices.has(p.id);
    // Assigned: the materialized customer price (NULL = inherit list, D4).
    // Unassigned-but-visible: plain list price.
    const effectiveCents = assigned
      ? effectivePriceCents(myPrices.get(p.id) ?? null, p.list_price_cents)
      : p.list_price_cents;
    // Offers keep their pre-CP-2 reach: assigned products only (extending them
    // to visible-unassigned products is deferred to CP-3, decision D-V6).
    const applicable = assigned
      ? offers
          .filter((o) => offerAppliesToProduct(o, p.id, now))
          .map((o) => ({
            title: o.title,
            discountKind: o.discountKind as OfferDiscountKind,
            discountValue: o.discountValue as number,
          }))
      : [];
    const priced = applyOffersToPrice(effectiveCents, applicable);
    return {
      productId: p.id,
      name: p.name,
      sku: p.sku,
      unit: p.unit,
      unitSize: p.unit_size,
      imageUrl: p.image_url,
      categoryLabel: p.category_id ? catLabel(p.category_id) : null,
      assigned,
      available: !unavailable.has(p.id),
      effectiveCents,
      finalCents: priced.finalCents,
      discounted: priced.discounted,
      appliedOfferTitle: priced.appliedOffer?.title ?? null,
    };
  });

  return { items, total, page, pageCount, categoryOptions };
}

// ---- CP-3a: my orders (SELECT-own RLS; customers have no write policies) ----

export type OrderStatus = "new" | "confirmed" | "prepared" | "completed" | "cancelled";
export type OrderFulfillment = "pickup" | "delivery";

export type PortalOrderSummary = {
  id: string;
  status: OrderStatus;
  fulfillment: OrderFulfillment;
  totalCents: number;
  itemCount: number;
  createdAt: string;
};

export type PortalOrderLine = {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  unitSize: string;
  qty: number;
  basePriceCents: number;
  unitPriceCents: number;
  appliedOfferTitle: string | null;
  lineTotalCents: number;
};

export type PortalOrderDetail = {
  id: string;
  status: OrderStatus;
  fulfillment: OrderFulfillment;
  notes: string | null;
  paymentTerms: string;
  totalCents: number;
  createdAt: string;
  lines: PortalOrderLine[];
};

export async function fetchMyOrders(): Promise<PortalOrderSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, fulfillment, total_cents, created_at, order_items(product_id)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    // 42P01 before migration 0009 — orders simply aren't enabled yet.
    if (error.code !== "42P01") console.error("[portal] orders read failed:", error.message);
    return [];
  }
  type Row = {
    id: string;
    status: OrderStatus;
    fulfillment: OrderFulfillment;
    total_cents: number;
    created_at: string;
    order_items: { product_id: string }[] | null;
  };
  return ((data as unknown as Row[]) ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    fulfillment: r.fulfillment,
    totalCents: r.total_cents,
    itemCount: r.order_items?.length ?? 0,
    createdAt: r.created_at,
  }));
}

export async function fetchMyOrder(id: string): Promise<PortalOrderDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, status, fulfillment, notes, payment_terms_snapshot, total_cents, created_at, order_items(product_id, name, sku, unit, unit_size, qty, base_price_cents, unit_price_cents, applied_offer_title, line_total_cents)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    if (error && error.code !== "42P01")
      console.error("[portal] order read failed:", error.message);
    return null;
  }
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
    line_total_cents: number;
  };
  const row = data as unknown as {
    id: string;
    status: OrderStatus;
    fulfillment: OrderFulfillment;
    notes: string | null;
    payment_terms_snapshot: string;
    total_cents: number;
    created_at: string;
    order_items: ItemRow[] | null;
  };
  return {
    id: row.id,
    status: row.status,
    fulfillment: row.fulfillment,
    notes: row.notes,
    paymentTerms: row.payment_terms_snapshot,
    totalCents: row.total_cents,
    createdAt: row.created_at,
    lines: (row.order_items ?? [])
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
        lineTotalCents: i.line_total_cents,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
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
