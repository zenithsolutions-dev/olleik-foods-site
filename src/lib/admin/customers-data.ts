import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import type {
  Customer,
  CustomerStatus,
  Offer,
  OfferDiscountKind,
  PaymentTerms,
  ProductUnit,
} from "./types";
import { SEED_DATA } from "./mock-data";

// Server-side reads of customers / customer_products / customer_offers via the
// service-role client (mirrors leads-data.ts and products-data.ts). RLS is
// deny-by-default for the public; service-role bypasses it. `live` tells the UI
// whether it's real rows or the demo seed (Supabase not configured).

const CUSTOMER_COLUMNS =
  "id, business_name, contact_name, email, phone, address, status, payment_terms, notes, created_at";

type CustomerRow = {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  status: CustomerStatus;
  payment_terms: PaymentTerms;
  notes: string | null;
  created_at: string;
};

function toCustomer(r: CustomerRow): Customer {
  return {
    id: r.id,
    businessName: r.business_name,
    contactName: r.contact_name,
    email: r.email,
    phone: r.phone,
    address: r.address,
    status: r.status,
    paymentTerms: r.payment_terms,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  };
}

export type AdminCustomers = {
  customers: Customer[]; // ALL statuses incl. archived; consumers filter
  counts: Record<string, number>; // assigned-product count per customer id
  live: boolean;
};

export async function fetchAdminCustomers(): Promise<AdminCustomers> {
  const admin = getAdminClient();
  if (!admin) {
    const counts = tally(SEED_DATA.customerProducts.map((cp) => cp.customerId));
    return { customers: SEED_DATA.customers, counts, live: false };
  }

  const [{ data: rows, error }, { data: cpRows, error: cpErr }] = await Promise.all([
    admin.from("customers").select(CUSTOMER_COLUMNS).order("business_name", { ascending: true }),
    admin.from("customer_products").select("customer_id"),
  ]);

  if (error) {
    console.error("[admin] failed to load customers:", error.message);
    return { customers: [], counts: {}, live: true };
  }
  if (cpErr) console.error("[admin] failed to count customer_products:", cpErr.message);

  const customers = (rows as CustomerRow[]).map(toCustomer);
  const counts = tally(((cpRows as { customer_id: string }[]) ?? []).map((r) => r.customer_id));
  return { customers, counts, live: true };
}

function tally(ids: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const id of ids) map[id] = (map[id] ?? 0) + 1;
  return map;
}

// ---- Single customer detail (account + assigned products + offers) ----

export type AssignedProduct = {
  productId: string;
  priceCents: number | null; // null = inherit list price
  name: string;
  sku: string;
  unit: ProductUnit;
  unitSize: string;
  listPriceCents: number;
  categoryId: string | null;
  isActive: boolean;
};

export type CustomerDetail = {
  customer: Customer;
  assigned: AssignedProduct[];
  offers: Offer[];
};

type OfferRow = {
  id: string;
  customer_id: string;
  title: string;
  description: string | null;
  product_id: string | null;
  discount_kind: OfferDiscountKind | null;
  discount_value: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
};

function toOffer(r: OfferRow): Offer {
  return {
    id: r.id,
    customerId: r.customer_id,
    title: r.title,
    description: r.description ?? undefined,
    productId: r.product_id,
    discountKind: r.discount_kind,
    discountValue: r.discount_value,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    isActive: r.is_active,
    createdAt: r.created_at,
  };
}

export async function fetchAdminCustomer(
  id: string,
): Promise<{ detail: CustomerDetail | null; live: boolean }> {
  const admin = getAdminClient();
  if (!admin) return { detail: buildSeedDetail(id), live: false };

  const { data: row, error } = await admin
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[admin] failed to load customer:", error.message);
    return { detail: null, live: true };
  }
  if (!row) return { detail: null, live: true };

  // Assigned products joined to their product fields (admin view — prices are
  // expected here). Absent row = product hidden from the customer.
  const { data: cpRows, error: cpErr } = await admin
    .from("customer_products")
    .select(
      "product_id, price_cents, products(name, sku, unit, unit_size, list_price_cents, category_id, is_active)",
    )
    .eq("customer_id", id);
  if (cpErr) console.error("[admin] failed to load customer_products:", cpErr.message);

  const assigned: AssignedProduct[] = ((cpRows as unknown as CpJoinRow[]) ?? [])
    .filter((r) => r.products)
    .map((r) => ({
      productId: r.product_id,
      priceCents: r.price_cents,
      name: r.products!.name,
      sku: r.products!.sku,
      unit: r.products!.unit,
      unitSize: r.products!.unit_size,
      listPriceCents: r.products!.list_price_cents,
      categoryId: r.products!.category_id,
      isActive: r.products!.is_active,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Offers read is tolerant of the table not existing yet (before the Phase C
  // migration is applied), so the page still renders pricing.
  let offers: Offer[] = [];
  const { data: offerRows, error: offerErr } = await admin
    .from("customer_offers")
    .select(
      "id, customer_id, title, description, product_id, discount_kind, discount_value, starts_at, ends_at, is_active, created_at",
    )
    .eq("customer_id", id)
    .order("created_at", { ascending: false });
  if (offerErr) {
    console.error("[admin] failed to load customer_offers (run migration 0002?):", offerErr.message);
  } else {
    offers = (offerRows as OfferRow[]).map(toOffer);
  }

  return { detail: { customer: toCustomer(row as CustomerRow), assigned, offers }, live: true };
}

type CpJoinRow = {
  product_id: string;
  price_cents: number | null;
  products: {
    name: string;
    sku: string;
    unit: ProductUnit;
    unit_size: string;
    list_price_cents: number;
    category_id: string | null;
    is_active: boolean;
  } | null;
};

function buildSeedDetail(id: string): CustomerDetail | null {
  const customer = SEED_DATA.customers.find((c) => c.id === id);
  if (!customer) return null;
  const productById = Object.fromEntries(SEED_DATA.products.map((p) => [p.id, p]));
  const assigned: AssignedProduct[] = SEED_DATA.customerProducts
    .filter((cp) => cp.customerId === id)
    .map((cp) => {
      const p = productById[cp.productId];
      return p
        ? {
            productId: cp.productId,
            priceCents: cp.priceCents,
            name: p.name,
            sku: p.sku,
            unit: p.unit,
            unitSize: p.unitSize,
            listPriceCents: p.listPriceCents,
            categoryId: p.categoryId,
            isActive: p.isActive,
          }
        : null;
    })
    .filter((x): x is AssignedProduct => x !== null);
  return { customer, assigned, offers: [] };
}
