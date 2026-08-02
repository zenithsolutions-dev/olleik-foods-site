import { fetchAdminProducts } from "@/lib/admin/products-data";
import { fetchAdminCategories } from "@/lib/admin/categories-data";
import { fetchProductCosts } from "@/lib/admin/pricing-data";
import { fetchProductInventory } from "@/lib/admin/inventory-data";
import { getBusinessIdentity } from "@/lib/business";
import { isoInRange, resolveDateRange, type RangeSearchParams } from "@/lib/dates";
import { DateRangeFilter } from "@/components/date-range-filter";
import { PrintToolbar } from "@/components/documents/print-toolbar";
import { ProductStatementClient } from "./product-statement-client";
import type { StatementProductInput } from "@/lib/documents/statement-models";

export const dynamic = "force-dynamic";

// CP-6 full product statement (ADMIN ONLY — admin layout gate). Respects the
// CP-5 date filter ("products added in the period", default All time, D-C6);
// the period is stated ON the document. The cost toggle lives client-side and
// resets on every load.

export default async function ProductStatementPage({
  searchParams,
}: {
  searchParams: Promise<RangeSearchParams>;
}) {
  const range = resolveDateRange(await searchParams);
  const [{ products }, { categories }, { costs }, inventory] = await Promise.all([
    fetchAdminProducts(),
    fetchAdminCategories(),
    fetchProductCosts(),
    fetchProductInventory(),
  ]);
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  const inputs: StatementProductInput[] = products
    .filter((p) => range.preset === "all" || isoInRange(p.createdAt, range))
    .map((p) => ({
      sku: p.sku,
      name: p.name,
      categoryLabel: p.categoryId ? (catName.get(p.categoryId) ?? null) : null,
      unit: p.unit,
      unitSize: p.unitSize,
      listPriceCents: p.listPriceCents,
      isActive: p.isActive,
      isAvailable: true, // availability is a portal signal; the stock column carries the detail
      stockQty: inventory.stock[p.id]?.stockQty ?? null,
      lowStockThreshold: inventory.stock[p.id]?.lowStockThreshold ?? null,
      costCents: costs[p.id] ?? null,
    }));

  return (
    <div>
      <PrintToolbar backHref="/admin/products" backLabel="Back to products" />
      <div className="doc-chrome-hidden mx-auto mt-3 max-w-3xl print:hidden">
        <DateRangeFilter basePath="/admin/documents/products" range={range} />
      </div>
      <ProductStatementClient
        business={getBusinessIdentity()}
        products={inputs}
        periodLabel={range.preset === "all" ? "All time" : range.label}
      />
    </div>
  );
}
