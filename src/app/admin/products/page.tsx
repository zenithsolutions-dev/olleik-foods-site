import { ProductsClient } from "./products-client";
import { fetchAdminProducts } from "@/lib/admin/products-data";
import { fetchAdminCategories } from "@/lib/admin/categories-data";
import { fetchProductCosts } from "@/lib/admin/pricing-data";
import { fetchProductInventory } from "@/lib/admin/inventory-data";
import { isoInRange, resolveDateRange, type RangeSearchParams } from "@/lib/dates";
import { DateRangeFilter } from "@/components/date-range-filter";

export const dynamic = "force-dynamic";
// D6: cost/rule saves from this page trigger autopilot price sweeps.
export const maxDuration = 60;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ stock?: string } & RangeSearchParams>;
}) {
  const [{ products: allProducts, live }, { categories }, { costs }, inventory, params] =
    await Promise.all([
      fetchAdminProducts(),
      fetchAdminCategories(),
      fetchProductCosts(),
      fetchProductInventory(),
      searchParams,
    ]);

  // CP-5: bound by created date (default All time). Composes with the
  // client-side search/category/stock filters (AND).
  const range = resolveDateRange(params);
  const products =
    range.preset === "all"
      ? allProducts
      : allProducts.filter((p) => isoInRange(p.createdAt, range));

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
            Catalog
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
            Products
          </h1>
          <p className="mt-2 text-sm text-muted">
            Add, edit, and toggle products. Per-customer pricing is set on each customer page.
            {range.preset !== "all" &&
              ` Showing products ADDED ${range.label} (${products.length} of ${allProducts.length}).`}
          </p>
          <div className="mt-4">
            <DateRangeFilter
              basePath="/admin/products"
              range={range}
              keepParams={{ stock: params.stock }}
            />
          </div>
        </div>
      </header>
      <ProductsClient
        products={products}
        categories={categories}
        costs={costs}
        live={live}
        stock={inventory.stock}
        inventoryEnabled={inventory.migrationApplied}
        initialLowStockOnly={params.stock === "low"}
      />
    </div>
  );
}
