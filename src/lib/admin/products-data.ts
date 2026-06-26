import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Product, ProductUnit } from "./types";
import { SEED_DATA } from "./mock-data";

// Server-side read of the `products` table via the service-role client (mirrors
// leads-data.ts). Returns all products (active + inactive) so the admin can
// reactivate; the client filters/searches. `live` distinguishes real rows from
// the demo seed used before Supabase is configured.

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category_id: string | null;
  unit: ProductUnit;
  unit_size: string;
  list_price_cents: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type AdminProducts = { products: Product[]; live: boolean };

export async function fetchAdminProducts(): Promise<AdminProducts> {
  const admin = getAdminClient();
  if (!admin) {
    return { products: SEED_DATA.products, live: false };
  }

  const { data, error } = await admin
    .from("products")
    .select(
      "id, sku, name, description, category_id, unit, unit_size, list_price_cents, image_url, is_active, created_at",
    )
    .order("name", { ascending: true });

  if (error) {
    console.error("[admin] failed to load products:", error.message);
    return { products: [], live: true };
  }

  const products: Product[] = (data as ProductRow[]).map((r) => ({
    id: r.id,
    sku: r.sku,
    name: r.name,
    description: r.description ?? undefined,
    categoryId: r.category_id,
    unit: r.unit,
    unitSize: r.unit_size,
    listPriceCents: r.list_price_cents,
    imageUrl: r.image_url ?? undefined,
    isActive: r.is_active,
    createdAt: r.created_at,
  }));

  return { products, live: true };
}
