import { fetchAdminProducts } from "@/lib/admin/products-data";
import { fetchProductInventory } from "@/lib/admin/inventory-data";
import { getBusinessIdentity } from "@/lib/business";
import { buildUnavailableStatementModel } from "@/lib/documents/statement-models";
import { StockStatementDocument } from "@/components/documents/stock-statement-document";
import { PrintToolbar } from "@/components/documents/print-toolbar";

export const dynamic = "force-dynamic";

// CP-6 unavailable/out-of-stock statement (ADMIN ONLY): active products whose
// tracked stock is at or below zero — what customers currently see as
// "Unavailable". As-of-now document, timestamped (approved D-C6).

export default async function OutOfStockStatementPage() {
  const [{ products }, inventory] = await Promise.all([
    fetchAdminProducts(),
    fetchProductInventory(),
  ]);
  const inputs = products.map((p) => {
    const s = inventory.stock[p.id];
    return {
      sku: p.sku,
      name: p.name,
      categoryLabel: null,
      unit: p.unit,
      unitSize: p.unitSize,
      listPriceCents: p.listPriceCents,
      isActive: p.isActive,
      // Unavailable = tracked stock at or below 0 (the is_available rule).
      isAvailable: s == null || s.stockQty > 0,
      stockQty: s?.stockQty ?? null,
      lowStockThreshold: s?.lowStockThreshold ?? null,
      costCents: null,
    };
  });
  const model = buildUnavailableStatementModel(inputs, new Date());
  return (
    <div>
      <PrintToolbar backHref="/admin/products" backLabel="Back to products" />
      <StockStatementDocument business={getBusinessIdentity()} model={model} />
    </div>
  );
}
