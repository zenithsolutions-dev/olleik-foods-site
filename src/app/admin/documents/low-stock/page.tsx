import { fetchLowStock } from "@/lib/admin/inventory-data";
import { getBusinessIdentity } from "@/lib/business";
import { buildLowStockStatementModel } from "@/lib/documents/statement-models";
import { StockStatementDocument } from "@/components/documents/stock-statement-document";
import { PrintToolbar } from "@/components/documents/print-toolbar";

export const dynamic = "force-dynamic";

// CP-6 low-stock statement (ADMIN ONLY): EXACTLY the shared fetchLowStock set
// — same source as the dashboard card, oversold first, zero duplicated logic.
// An "as of now" document: timestamped, no date filter (approved D-C6).

export default async function LowStockStatementPage() {
  const { items } = await fetchLowStock();
  const model = buildLowStockStatementModel(items, new Date());
  return (
    <div>
      <PrintToolbar backHref="/admin/products?stock=low" backLabel="Back to products" />
      <StockStatementDocument business={getBusinessIdentity()} model={model} />
    </div>
  );
}
