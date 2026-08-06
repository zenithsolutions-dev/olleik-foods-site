import { fetchProductSales, fetchCustomerSales } from "@/lib/admin/analytics-data";
import { fetchAdminOrders } from "@/lib/admin/orders-data";
import { fetchAdminProducts } from "@/lib/admin/products-data";
import { fetchAdminCustomers } from "@/lib/admin/customers-data";
import { buildSlowMovers, splitByActivity } from "@/lib/admin/analytics-math";
import { aggregateDay } from "@/lib/admin/dashboard-math";
import { getBusinessIdentity } from "@/lib/business";
import { resolveDateRange, type RangeSearchParams } from "@/lib/dates";
import { DateRangeFilter } from "@/components/date-range-filter";
import {
  PRESET_DEFS,
  REPORT_PRESETS,
  REPORT_SECTIONS,
  type ReportInputs,
  type ReportPreset,
  type ReportSectionKey,
} from "@/lib/documents/report-model";
import { ReportsClient } from "./reports-client";

export const dynamic = "force-dynamic";

// CP-8c report builder (ADMIN ONLY — admin layout gate). NO migration: this
// page consumes the 8b analytics reads and the existing order read — it never
// aggregates a second way. Preset + ticked sections + range all live in the
// URL (approved D-N5), so a configured report is a bookmark.
//
// The server gathers EVERY section's data for the selected range; ticking is
// client-side selection over prefetched inputs, so the preview is live. The
// pure builder then produces a model containing ONLY the ticked sections —
// and derives the INTERNAL flag from the content itself.

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<RangeSearchParams & { preset?: string; sections?: string }>;
}) {
  const sp = await searchParams;

  // Preset resolution (URL-borne): the preset supplies range + tick defaults;
  // explicit ?sections= / ?range= override it (adjust-before-printing).
  const preset: ReportPreset | null = (REPORT_PRESETS as readonly string[]).includes(sp.preset ?? "")
    ? (sp.preset as ReportPreset)
    : null;
  const hasRangeInput = Boolean(sp.range || sp.from || sp.to);
  const range = resolveDateRange(
    hasRangeInput ? sp : { range: preset ? PRESET_DEFS[preset].range : "this-month" },
  );
  const ticked: ReportSectionKey[] = sp.sections
    ? (sp.sections
        .split(",")
        .filter((s): s is ReportSectionKey =>
          (REPORT_SECTIONS as readonly string[]).includes(s),
        ))
    : preset
      ? PRESET_DEFS[preset].sections
      : ["revenue-summary", "best-sellers"];

  const bounds = {
    startISO: range.startUTC?.toISOString() ?? null,
    endISO: range.endUTC?.toISOString() ?? null,
  };
  const [productSales, customerSales, allTime, { products }, { customers }, orders] =
    await Promise.all([
      fetchProductSales(bounds),
      fetchCustomerSales(bounds),
      fetchCustomerSales({ startISO: null, endISO: null }),
      fetchAdminProducts(),
      fetchAdminCustomers(),
      fetchAdminOrders(bounds),
    ]);

  const now = new Date();
  const lastOrderById = new Map(allTime.rows.map((r) => [r.customerId, r.lastOrderAt]));
  const activity = splitByActivity(
    customers
      .filter((c) => c.status === "active")
      .map((c) => ({
        customerId: c.id,
        businessName: c.businessName,
        lastOrderAt: lastOrderById.get(c.id) ?? null,
      })),
    30,
    now,
  );

  const inputs: ReportInputs = {
    aggregates: aggregateDay(
      orders.orders.map((o) => ({
        status: o.status,
        fulfillment: o.fulfillment,
        totalCents: o.totalCents,
      })),
    ),
    productSales: productSales.rows,
    slowMovers: buildSlowMovers(
      products.map((p) => ({
        productId: p.id,
        name: p.name,
        sku: p.sku,
        isActive: p.isActive,
        createdAt: p.createdAt,
      })),
      productSales.rows,
      { periodStartUTC: range.startUTC, now },
    ),
    customerSales: customerSales.rows.filter((r) => r.status === "active"),
    inactive: activity.inactive,
    neverOrdered: activity.neverOrdered.map((c) => c.businessName),
    inactiveThresholdDays: 30,
    orders: orders.orders.map((o) => ({
      orderId: o.id,
      customerName: o.customerName,
      createdAt: o.createdAt,
      status: o.status,
      totalCents: o.totalCents,
    })),
  };

  return (
    <ReportsClient
      business={getBusinessIdentity()}
      inputs={inputs}
      initialTicked={ticked}
      activePreset={preset}
      periodLabel={range.label}
      periodNotice={range.notice}
      analyticsSource={productSales.source}
      rangeFilter={
        <DateRangeFilter
          basePath="/admin/reports"
          range={range}
          defaultPreset={preset ? (PRESET_DEFS[preset].range as never) : "this-month"}
          keepParams={{ preset: sp.preset, sections: sp.sections }}
        />
      }
    />
  );
}
