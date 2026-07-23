import { ProductsClient } from "./products-client";
import { fetchAdminProducts } from "@/lib/admin/products-data";
import { fetchAdminCategories } from "@/lib/admin/categories-data";
import { fetchProductCosts } from "@/lib/admin/pricing-data";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const [{ products, live }, { categories }, { costs }] = await Promise.all([
    fetchAdminProducts(),
    fetchAdminCategories(),
    fetchProductCosts(),
  ]);

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
          </p>
        </div>
      </header>
      <ProductsClient products={products} categories={categories} costs={costs} live={live} />
    </div>
  );
}
