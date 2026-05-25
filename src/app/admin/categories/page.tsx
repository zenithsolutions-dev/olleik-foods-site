import { CategoriesClient } from "./categories-client";

export default function CategoriesPage() {
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
      <CategoriesClient />
    </div>
  );
}
