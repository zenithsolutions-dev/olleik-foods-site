import { DashboardClient } from "./dashboard-client";
import { fetchAdminLeads } from "@/lib/admin/leads-data";
import { fetchAdminProducts } from "@/lib/admin/products-data";
import { fetchAdminCustomers } from "@/lib/admin/customers-data";
import { fetchLowStock } from "@/lib/admin/inventory-data";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [{ leads, live }, { products }, { customers }, lowStock] = await Promise.all([
    fetchAdminLeads(),
    fetchAdminProducts(),
    fetchAdminCustomers(),
    fetchLowStock(),
  ]);

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
          Quick view of your catalog, customer base, and incoming leads.
        </p>
      </header>
      <DashboardClient
        leads={leads}
        products={products}
        customers={customers}
        live={live}
        lowStock={lowStock.items}
      />
    </div>
  );
}
