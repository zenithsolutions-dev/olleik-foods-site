import { ProductsClient } from "./products-client";

export default function ProductsPage() {
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
      <ProductsClient />
    </div>
  );
}
