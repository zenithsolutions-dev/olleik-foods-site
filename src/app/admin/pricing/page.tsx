import { PricingClient } from "./pricing-client";
import { fetchPricingRules } from "@/lib/admin/pricing-data";
import { fetchAdminCategories } from "@/lib/admin/categories-data";
import { fetchAdminCustomers } from "@/lib/admin/customers-data";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const [{ rules, live }, { categories }, { customers }] = await Promise.all([
    fetchPricingRules(),
    fetchAdminCategories(),
    fetchAdminCustomers(),
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
          manual price → priority category → customer → category → global → list. Prices are
          snapshots — after changing rules or costs, run Recompute on a customer page.
        </p>
      </header>
      <PricingClient
        rules={rules}
        categories={categories}
        customers={customers.filter((c) => c.status !== "archived")}
        live={live}
      />
    </div>
  );
}
