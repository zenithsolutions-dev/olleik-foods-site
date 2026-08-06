import { DashboardClient } from "./dashboard-client";
import { DashboardLive } from "./dashboard-live";
import { fetchAdminLeads } from "@/lib/admin/leads-data";
import { fetchAdminProducts } from "@/lib/admin/products-data";
import { fetchAdminCustomers, fetchActivationMap } from "@/lib/admin/customers-data";
import { fetchLowStock } from "@/lib/admin/inventory-data";
import { fetchProductCosts } from "@/lib/admin/pricing-data";
import { fetchDashboardStats, fetchPendingNow } from "@/lib/admin/dashboard-data";
import { fetchProductSales, fetchCustomerSales } from "@/lib/admin/analytics-data";
import { rankProducts, rankCustomers, splitByActivity } from "@/lib/admin/analytics-math";
import { resolveDateRange, type RangeSearchParams } from "@/lib/dates";
import { DateRangeFilter } from "@/components/date-range-filter";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<RangeSearchParams>;
}) {
  // CP-5: the dashboard's default period is TODAY (nothing changes for anyone
  // who never touches the filter); the URL can re-scope every period card.
  const sp = await searchParams;
  const hasRangeInput = Boolean(sp.range || sp.from || sp.to);
  const range = resolveDateRange(hasRangeInput ? sp : { range: "today" });

  const bounds = {
    startISO: range.startUTC?.toISOString() ?? null,
    endISO: range.endUTC?.toISOString() ?? null,
  };
  const [
    { leads, live },
    { products },
    { customers },
    lowStock,
    { costs },
    stats,
    pendingNow,
    productSales,
    customerSales,
    allTimeCustomers,
  ] = await Promise.all([
    fetchAdminLeads(),
    fetchAdminProducts(),
    fetchAdminCustomers(),
    fetchLowStock(),
    fetchProductCosts(),
    fetchDashboardStats(new Date(), range),
    fetchPendingNow(),
    fetchProductSales(bounds),
    fetchCustomerSales(bounds),
    fetchCustomerSales({ startISO: null, endISO: null }),
  ]);

  // CP-8b: the period-scoped top-3s — the SAME figures /admin/analytics ranks
  // (same reads, same pure ranking), truncated to 3. Full tables stay one
  // click away, not on the dashboard.
  const topProducts = rankProducts(productSales.rows, "revenue").slice(0, 3);
  const topCustomers = rankCustomers(
    customerSales.rows.filter((r) => r.status === "active"),
    "revenue",
  ).slice(0, 3);
  // Attention-row inactive line (30-day default; the analytics page has the
  // full 30/60/90 view). All-time facts by definition.
  const lastOrderById = new Map(
    allTimeCustomers.rows.map((r) => [r.customerId, r.lastOrderAt]),
  );
  const inactiveCount = splitByActivity(
    customers
      .filter((c) => c.status === "active")
      .map((c) => ({
        customerId: c.id,
        businessName: c.businessName,
        lastOrderAt: lastOrderById.get(c.id) ?? null,
      })),
    30,
    new Date(),
  ).inactive.length;

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
        <div className="mt-4">
          <DateRangeFilter basePath="/admin" range={range} defaultPreset="today" />
        </div>
        <DashboardLive />
      </header>
      <DashboardClient
        leads={leads}
        products={products}
        customers={customers}
        live={live}
        lowStock={lowStock.items}
        stats={stats}
        pendingNow={pendingNow}
        missingCostCount={missingCostCount}
        pendingActivationCount={pendingActivationCount}
        topProducts={topProducts}
        topCustomers={topCustomers}
        inactiveCount={inactiveCount}
      />
    </div>
  );
}
