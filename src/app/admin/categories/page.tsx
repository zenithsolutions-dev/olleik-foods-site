import { CategoriesClient } from "./categories-client";
import { fetchAdminCategories } from "@/lib/admin/categories-data";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const { categories, counts, live } = await fetchAdminCategories();

  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
          Catalog
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          Categories
        </h1>
        <p className="mt-2 text-sm text-muted">
          High-level groupings used to organize products in the customer portal.
        </p>
      </header>
      <CategoriesClient categories={categories} counts={counts} live={live} />
    </div>
  );
}
