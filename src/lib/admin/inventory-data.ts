import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";

// CP-3b admin inventory reads (service role — product_inventory is deny-all to
// every customer session; stock quantities exist ONLY on admin screens).
// Tolerant of migration 0010 not being applied yet (42P01 -> empty results),
// same pattern as the orders/visibility reads.

export type ProductStock = {
  stockQty: number;
  lowStockThreshold: number;
};

export type AdminInventory = {
  // productId -> stock; a product with no entry is UNTRACKED (never blocks
  // orders, never alerts).
  stock: Record<string, ProductStock>;
  migrationApplied: boolean;
};

export async function fetchProductInventory(): Promise<AdminInventory> {
  const admin = getAdminClient();
  if (!admin) return { stock: {}, migrationApplied: true };

  const { data, error } = await admin
    .from("product_inventory")
    .select("product_id, stock_qty, low_stock_threshold");
  if (error) {
    if (error.code !== "42P01")
      console.error("[admin] inventory read failed:", error.message);
    return { stock: {}, migrationApplied: error.code !== "42P01" };
  }

  const stock: Record<string, ProductStock> = {};
  for (const r of (data as {
    product_id: string;
    stock_qty: number;
    low_stock_threshold: number;
  }[]) ?? []) {
    stock[r.product_id] = { stockQty: r.stock_qty, lowStockThreshold: r.low_stock_threshold };
  }
  return { stock, migrationApplied: true };
}

export type LowStockItem = {
  productId: string;
  name: string;
  sku: string;
  stockQty: number;
  lowStockThreshold: number;
};

// Tracked products at or below their threshold (stock_qty <= threshold) — the
// dashboard card. Untracked products never appear here by construction.
export async function fetchLowStock(): Promise<{
  items: LowStockItem[];
  migrationApplied: boolean;
}> {
  const admin = getAdminClient();
  if (!admin) return { items: [], migrationApplied: true };

  const { data, error } = await admin
    .from("product_inventory")
    .select("product_id, stock_qty, low_stock_threshold, products(name, sku, is_active)")
    .order("stock_qty", { ascending: true });
  if (error) {
    if (error.code !== "42P01")
      console.error("[admin] low-stock read failed:", error.message);
    return { items: [], migrationApplied: error.code !== "42P01" };
  }

  type Row = {
    product_id: string;
    stock_qty: number;
    low_stock_threshold: number;
    products: { name: string; sku: string; is_active: boolean } | null;
  };
  const items = ((data as unknown as Row[]) ?? [])
    .filter((r) => r.stock_qty <= r.low_stock_threshold && r.products?.is_active)
    .map((r) => ({
      productId: r.product_id,
      name: r.products?.name ?? "(removed product)",
      sku: r.products?.sku ?? "",
      stockQty: r.stock_qty,
      lowStockThreshold: r.low_stock_threshold,
    }));
  return { items, migrationApplied: true };
}
