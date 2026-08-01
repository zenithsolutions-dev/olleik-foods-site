import { DashboardClient } from "./dashboard-client";
import { DashboardLive } from "./dashboard-live";
import { fetchAdminLeads } from "@/lib/admin/leads-data";
import { fetchAdminProducts } from "@/lib/admin/products-data";
import { fetchAdminCustomers, fetchActivationMap } from "@/lib/admin/customers-data";
import { fetchLowStock } from "@/lib/admin/inventory-data";
import { fetchProductCosts } from "@/lib/admin/pricing-data";
import { fetchDashboardStats } from "@/lib/admin/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [{ leads, live }, { products }, { customers }, lowStock, { costs }, stats] =
    await Promise.all([
      fetchAdminLeads(),
      fetchAdminProducts(),
      fetchAdminCustomers(),
      fetchLowStock(),
      fetchProductCosts(),
      fetchDashboardStats(),
    ]);

  // Same definition as the products-page warning: ACTIVE products with no
  // purchase cost (margin rules can't price them).
  const missingCostCount = products.filter((p) => p.isActive && costs[p.id] == null).length;

  // Invited-but-never-signed-in, via ONE listUsers call (shared derivation
  // with the per-customer badge — extracted, not copied).
  const linkedIds = customers
    .filter((c) => c.status !== "archived" && c.userId)
    .map((c) => c.userId as string);
  const activation = await fetchActivationMap(linkedIds);
  const pendingActivationCount = [...activation.values()].filter((a) => a === "invited").length;

  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
          Overview
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          Dashboard
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your whole day at a glance — orders, money, stock, and anything that needs attention.
        </p>
        <DashboardLive />
      </header>
      <DashboardClient
        leads={leads}
        products={products}
        customers={customers}
        live={live}
        lowStock={lowStock.items}
        stats={stats}
        missingCostCount={missingCostCount}
        pendingActivationCount={pendingActivationCount}
      />
    </div>
  );
}
