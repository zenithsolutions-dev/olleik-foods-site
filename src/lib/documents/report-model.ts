// CP-8c pure report model — no IO. The report builder's central guarantees:
//
//   1. STRUCTURAL SECTIONS: the model's `sections` array holds ONLY entries
//      for what was ticked. An unticked section is ABSENT from the model —
//      not hidden by a renderer, absent (the CP-6/CP-7 principle again).
//
//   2. DERIVED INTERNAL MARKING (approved ruling): `internal` is NOT a
//      parameter. buildReportModel computes it FROM THE SECTION CONTENT —
//      the presence of any profit-bearing section flips it. There is no code
//      path that produces a profit-bearing report without the banner and
//      watermark, because the marking is not a caller's choice.
//
//   3. ONE FAMILY OF NUMBERS: the inputs here are the 8b analytics rows and
//      the dashboard's DayAggregates — this module RANKS AND SHAPES, it never
//      re-aggregates. test:reports asserts report figures equal analytics
//      figures for the same period.
//
// Relative .ts specifiers: node --experimental-strip-types imports this
// directly — the tested module is the shipped module.
import {
  rankProducts,
  rankCustomers,
  type CustomerSales,
  type ProductSales,
  type SlowMoverRow,
} from "../admin/analytics-math.ts";
import type { DayAggregates } from "../admin/dashboard-math.ts";
import type { InvoiceBusiness } from "./invoice-model";

// ---------- section keys (the owner's exact checkbox list) ----------

export const REPORT_SECTIONS = [
  "revenue-summary",
  "best-sellers",
  "slow-movers",
  "top-customers",
  "inactive-customers",
  "orders",
  "profit", // cost/profit — INTERNAL by nature
] as const;
export type ReportSectionKey = (typeof REPORT_SECTIONS)[number];

export const SECTION_LABELS: Record<ReportSectionKey, string> = {
  "revenue-summary": "Revenue summary",
  "best-sellers": "Best sellers",
  "slow-movers": "Slow & non-movers",
  "top-customers": "Top customers",
  "inactive-customers": "Inactive customers",
  orders: "Orders in the period",
  profit: "Cost & profit (INTERNAL)",
};

// The one place that knows which sections carry money the customer must never
// see. `internal` derivation reads THIS, not a caller flag.
export const PROFIT_BEARING: readonly ReportSectionKey[] = ["profit"];

// ---------- presets (approved D-N5 — URL-borne, no preferences table) ----------

export const REPORT_PRESETS = ["daily", "weekly", "monthly", "buying"] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number];

export const PRESET_DEFS: Record<
  ReportPreset,
  { label: string; range: string; sections: ReportSectionKey[] }
> = {
  daily: {
    label: "Daily summary",
    range: "today",
    sections: ["revenue-summary", "best-sellers", "orders"],
  },
  weekly: {
    label: "Weekly review",
    range: "this-week",
    sections: ["revenue-summary", "best-sellers", "top-customers"],
  },
  monthly: {
    label: "Monthly business review",
    range: "this-month",
    sections: [
      "revenue-summary",
      "best-sellers",
      "slow-movers",
      "top-customers",
      "inactive-customers",
      "orders",
      "profit",
    ],
  },
  // Buying decisions: what to stop stocking or discount. Low-stock is served
  // by the dedicated CP-6 statement (as-of-now, not period-scoped) — the
  // reports page links to it next to this preset rather than duplicating it
  // as a section outside the approved checkbox list.
  buying: {
    label: "Buying list",
    range: "this-month",
    sections: ["slow-movers", "best-sellers"],
  },
};

// ---------- section input/output shapes ----------

export type OrdersSectionRow = {
  orderId: string;
  customerName: string;
  createdAt: string;
  status: string;
  totalCents: number;
};

export type InactiveSectionRow = {
  customerId: string;
  businessName: string;
  lastOrderAt: string | null;
  daysSilent: number;
};

// Discriminated union — the renderer switches on `key`; absence of a key in
// the array IS the unticked state.
export type ReportSection =
  | { key: "revenue-summary"; aggregates: DayAggregates }
  | {
      key: "best-sellers";
      // Customer-safe columns only: units + revenue. Profit lives EXCLUSIVELY
      // in the profit section so the internal flag derivation is airtight.
      rows: { productId: string; name: string; sku: string; units: number; revenueCents: number }[];
    }
  | { key: "slow-movers"; rows: SlowMoverRow[] }
  | {
      key: "top-customers";
      rows: { customerId: string; businessName: string; ordersCount: number; revenueCents: number }[];
    }
  | { key: "inactive-customers"; thresholdDays: number; rows: InactiveSectionRow[]; neverOrdered: string[] }
  | { key: "orders"; rows: OrdersSectionRow[]; countedTotalCents: number }
  | {
      key: "profit";
      revenueCents: number;
      costCents: number | null;
      profitCents: number | null;
      marginPct: number | null;
      linesTotal: number;
      linesWithoutCost: number;
      costWarning: string | null;
      perProduct: { name: string; sku: string; revenueCents: number; costCents: number | null; profitCents: number | null }[];
    };

export type ReportModel = {
  internal: boolean; // DERIVED — see buildReportModel
  title: string;
  business: InvoiceBusiness;
  periodLabel: string;
  periodNotice: string | null;
  generatedAtISO: string;
  sections: ReportSection[]; // ONLY the ticked ones, in canonical order
  isEmpty: boolean; // nothing ticked — a designed document, not a blank page
};

// ---------- inputs the page gathers (8b reads, passed through) ----------

export type ReportInputs = {
  aggregates: DayAggregates;
  productSales: ProductSales[];
  slowMovers: SlowMoverRow[];
  customerSales: (CustomerSales & { businessName: string })[];
  inactive: InactiveSectionRow[];
  neverOrdered: string[];
  inactiveThresholdDays: number;
  orders: OrdersSectionRow[];
};

const CANONICAL_ORDER: ReportSectionKey[] = [
  "revenue-summary",
  "best-sellers",
  "top-customers",
  "orders",
  "slow-movers",
  "inactive-customers",
  "profit",
];

export function buildReportModel(args: {
  ticked: ReportSectionKey[];
  inputs: ReportInputs;
  business: InvoiceBusiness;
  periodLabel: string;
  periodNotice?: string | null;
  generatedAt: Date;
}): ReportModel {
  const { inputs, business, periodLabel, generatedAt } = args;
  const ticked = new Set(args.ticked);
  const sections: ReportSection[] = [];

  for (const key of CANONICAL_ORDER) {
    if (!ticked.has(key)) continue; // structural absence — not hidden, absent
    switch (key) {
      case "revenue-summary":
        sections.push({ key, aggregates: inputs.aggregates });
        break;
      case "best-sellers":
        sections.push({
          key,
          // Field-by-field projection (the CP-7 line rule): cost figures on
          // the analytics rows physically do not survive into this section.
          rows: rankProducts(inputs.productSales, "revenue").map((r) => ({
            productId: r.productId,
            name: r.name,
            sku: r.sku,
            units: r.units,
            revenueCents: r.revenueCents,
          })),
        });
        break;
      case "slow-movers":
        sections.push({ key, rows: inputs.slowMovers });
        break;
      case "top-customers":
        sections.push({
          key,
          rows: rankCustomers(inputs.customerSales, "revenue").map((r) => ({
            customerId: r.customerId,
            businessName: r.businessName,
            ordersCount: r.ordersCount,
            revenueCents: r.revenueCents,
          })),
        });
        break;
      case "inactive-customers":
        sections.push({
          key,
          thresholdDays: inputs.inactiveThresholdDays,
          rows: inputs.inactive,
          neverOrdered: inputs.neverOrdered,
        });
        break;
      case "orders":
        sections.push({
          key,
          rows: inputs.orders,
          countedTotalCents: inputs.aggregates.revenueCents,
        });
        break;
      case "profit": {
        // Derived from the SAME analytics rows the best-sellers section uses
        // — one aggregation, two projections.
        const ranked = rankProducts(inputs.productSales, "revenue");
        const costed = ranked.filter((r) => r.costCents != null);
        const revenue = ranked.reduce((n, r) => n + r.revenueCents, 0);
        const costedRevenue = costed.reduce((n, r) => n + r.revenueCents, 0);
        const cost = costed.length > 0 ? costed.reduce((n, r) => n + (r.costCents as number), 0) : null;
        const profit = cost != null ? costedRevenue - cost : null;
        const linesTotal = ranked.reduce((n, r) => n + r.totalLines, 0);
        const linesWithoutCost = ranked.reduce((n, r) => n + (r.totalLines - r.costedLines), 0);
        sections.push({
          key,
          revenueCents: revenue,
          costCents: cost,
          profitCents: profit,
          marginPct: profit != null && costedRevenue > 0 ? (profit / costedRevenue) * 100 : null,
          linesTotal,
          linesWithoutCost,
          costWarning:
            linesWithoutCost === 0
              ? null
              : `${linesWithoutCost} of ${linesTotal} lines have NO recorded purchase cost — cost, profit and margin cover only the costed lines. Treat them as partial.`,
          perProduct: ranked.map((r) => ({
            name: r.name,
            sku: r.sku,
            revenueCents: r.revenueCents,
            costCents: r.costCents,
            profitCents: r.profitCents,
          })),
        });
        break;
      }
    }
  }

  // THE derived marking: computed from what the model CONTAINS. No caller
  // input can force it off while a profit-bearing section is present.
  const internal = sections.some((s) => (PROFIT_BEARING as readonly string[]).includes(s.key));

  return {
    internal,
    title: internal ? "Business report (internal)" : "Business report",
    business,
    periodLabel,
    periodNotice: args.periodNotice ?? null,
    generatedAtISO: generatedAt.toISOString(),
    sections,
    isEmpty: sections.length === 0,
  };
}
