import { PricingClient } from "./pricing-client";
import { fetchPricingRules } from "@/lib/admin/pricing-data";
import { fetchAdminCategories } from "@/lib/admin/categories-data";
import { fetchAdminCustomers } from "@/lib/admin/customers-data";
import { fetchAdminProducts } from "@/lib/admin/products-data";

export const dynamic = "force-dynamic";
// D6: rule saves can sweep every computed price (global scope) — give the
// server actions invoked from this page room to finish.
export const maxDuration = 60;

export default async function PricingPage() {
  const [{ rules, live }, { categories }, { customers }, { products }] = await Promise.all([
    fetchPricingRules(),
    fetchAdminCategories(),
    fetchAdminCustomers(),
    fetchAdminProducts(),
  ]);

  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
          Pricing
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          Margin rules
        </h1>
        <p className="mt-2 text-sm text-muted">
          Profit is markup on cost: price = cost × (1 + margin%). Most specific rule wins:
          manual price → priority product → priority category → customer → product →
          category → global → list. Changes apply automatically — every save re-prices the
          affected customer prices on the spot (manual prices are never touched).
        </p>
      </header>
      <PricingClient
        rules={rules}
        categories={categories}
        customers={customers.filter((c) => c.status !== "archived")}
        products={products.filter((p) => p.isActive)}
        live={live}
      />
    </div>
  );
}
