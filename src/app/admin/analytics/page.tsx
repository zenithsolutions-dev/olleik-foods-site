import { fetchProductSales, fetchCustomerSales } from "@/lib/admin/analytics-data";
import { fetchAdminProducts } from "@/lib/admin/products-data";
import { fetchAdminCustomers } from "@/lib/admin/customers-data";
import {
  buildSlowMovers,
  splitByActivity,
  INACTIVE_THRESHOLDS,
  type InactiveThreshold,
} from "@/lib/admin/analytics-math";
import { resolveDateRange, type RangeSearchParams } from "@/lib/dates";
import { DateRangeFilter } from "@/components/date-range-filter";
import { AnalyticsClient } from "./analytics-client";

export const dynamic = "force-dynamic";

// CP-8b analytics (ADMIN ONLY — admin layout gate; the aggregate RPCs are
// additionally EXECUTE-revoked from customer sessions, D-O0). Default period:
// This month. EVERY figure states its period on screen (CP-5 rule) so a
// screenshot is never ambiguous.
//
// Two period-scoped reads (products, customers) + one ALL-TIME customer read:
// "silent for 30 days" is a fact about all history, not about the selected
// period. The inactive/never-ordered split walks the FULL active customer
// list — a customer with no sales row at all is exactly the never-ordered
// case (approved D-N3: those need onboarding, not win-back).

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<RangeSearchParams & { quiet?: string }>;
}) {
  const sp = await searchParams;
  const hasRangeInput = Boolean(sp.range || sp.from || sp.to);
  const range = resolveDateRange(hasRangeInput ? sp : { range: "this-month" });
  const quiet: InactiveThreshold = (INACTIVE_THRESHOLDS as readonly number[]).includes(
    Number(sp.quiet),
  )
    ? (Number(sp.quiet) as InactiveThreshold)
    : 30;

  const bounds = {
    startISO: range.startUTC?.toISOString() ?? null,
    endISO: range.endUTC?.toISOString() ?? null,
  };
  const [productSales, customerSales, allTimeCustomers, { products }, { customers }] =
    await Promise.all([
      fetchProductSales(bounds),
      fetchCustomerSales(bounds),
      fetchCustomerSales({ startISO: null, endISO: null }),
      fetchAdminProducts(),
      fetchAdminCustomers(),
    ]);

  const now = new Date();
  const slowMovers = buildSlowMovers(
    products.map((p) => ({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      isActive: p.isActive,
      createdAt: p.createdAt,
    })),
    productSales.rows,
    { periodStartUTC: range.startUTC, now },
  );

  // FULL active customer list ⋈ all-time last order: no sales row = never
  // ordered (separate list), old sales row = inactive candidate.
  const lastOrderById = new Map(allTimeCustomers.rows.map((r) => [r.customerId, r.lastOrderAt]));
  const activity = splitByActivity(
    customers
      .filter((c) => c.status === "active")
      .map((c) => ({
        customerId: c.id,
        businessName: c.businessName,
        lastOrderAt: lastOrderById.get(c.id) ?? null,
      })),
    quiet,
    now,
  );

  return (
    <AnalyticsClient
      periodLabel={range.label}
      periodNotice={range.notice}
      quiet={quiet}
      quietQuery={{ range: sp.range, from: sp.from, to: sp.to }}
      productSales={productSales.rows}
      analyticsSource={productSales.source}
      truncated={productSales.truncated || customerSales.truncated}
      customerSales={customerSales.rows.filter((r) => r.status === "active")}
      slowMovers={slowMovers}
      inactive={activity.inactive}
      neverOrdered={activity.neverOrdered}
      activeRecently={activity.activeRecently}
      rangeFilter={
        <DateRangeFilter
          basePath="/admin/analytics"
          range={range}
          defaultPreset="this-month"
          keepParams={{ quiet: sp.quiet }}
        />
      }
    />
  );
}
