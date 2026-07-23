import { AssignClient } from "./assign-client";
import { fetchAdminProducts } from "@/lib/admin/products-data";
import { fetchAdminCategories } from "@/lib/admin/categories-data";
import { fetchAdminCustomers } from "@/lib/admin/customers-data";
import { fetchPricingRules, fetchProductCosts } from "@/lib/admin/pricing-data";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Reverse bulk assignment: pick products (by category or individually), pick
// many customers, PREVIEW price/profit per the margin waterfall, then apply in
// one merge-only action. Admin-only; costs and rules are shown to the admin by
// design (requirement: the admin always sees cost + profit).

export default async function AssignPage() {
  const [{ products }, { categories }, { customers }, { costs }, { rules }] = await Promise.all([
    fetchAdminProducts(),
    fetchAdminCategories(),
    fetchAdminCustomers(),
    fetchProductCosts(),
    fetchPricingRules(),
  ]);

  // Existing assignments so the preview can mark skip-existing (merge-only).
  const admin = getAdminClient();
  let existingPairs: string[] = [];
  if (admin) {
    const { data } = await admin.from("customer_products").select("customer_id, product_id");
    existingPairs = ((data as { customer_id: string; product_id: string }[]) ?? []).map(
      (r) => `${r.customer_id}:${r.product_id}`,
    );
  }

  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
          Catalog
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          Assign products to customers
        </h1>
        <p className="mt-2 text-sm text-muted">
          Pick a category or specific products, choose the customers, review computed prices and
          profit, then apply. Existing assignments are never changed (merge-only).
        </p>
      </header>
      <AssignClient
        products={products.filter((p) => p.isActive)}
        categories={categories}
        customers={customers}
        costs={costs}
        rules={rules}
        existingPairs={existingPairs}
      />
    </div>
  );
}
