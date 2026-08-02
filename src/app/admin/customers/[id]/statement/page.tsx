import Link from "next/link";
import { fetchAdminCustomer } from "@/lib/admin/customers-data";
import { fetchCustomerStatementOrders } from "@/lib/admin/statement-data";
import { getBusinessIdentity } from "@/lib/business";
import { buildCustomerStatement } from "@/lib/documents/customer-statement-model";
import { CustomerStatementDocument } from "@/components/documents/customer-statement-document";
import { PrintToolbar } from "@/components/documents/print-toolbar";
import { DateRangeFilter } from "@/components/date-range-filter";
import { rangeQueryString, resolveDateRange, type RangeSearchParams } from "@/lib/dates";

export const dynamic = "force-dynamic";

// CP-7 CUSTOMER COPY — the statement handed to the customer (approved D-S5:
// a separate route, not a toggle). This page calls the cost-free reader, so
// order_item_costs is never even queried on this path: the document carries no
// cost because no cost was ever fetched. requireAdmin runs in the admin layout.

export default async function CustomerStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<RangeSearchParams>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);

  // Approved D-S1: This month is the default billing rhythm. An empty result
  // early in the month is handled by the model's explicit empty notice, which
  // names the computed period and offers to widen it.
  const hasRangeInput = Boolean(sp.range || sp.from || sp.to);
  const range = resolveDateRange(hasRangeInput ? sp : { range: "this-month" });

  const [{ detail }, data] = await Promise.all([
    fetchAdminCustomer(id),
    fetchCustomerStatementOrders(id, {
      startISO: range.startUTC?.toISOString() ?? null,
      endISO: range.endUTC?.toISOString() ?? null,
    }),
  ]);

  if (!detail) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link href="/admin/customers" className="text-sm text-brand hover:text-accent">
          ← All customers
        </Link>
        <p className="mt-6 rounded-2xl border border-dashed border-[var(--border)] bg-surface p-10 text-center text-sm text-muted">
          Customer not found.
        </p>
      </div>
    );
  }

  const c = detail.customer;
  const model = buildCustomerStatement({
    orders: data.orders,
    business: getBusinessIdentity(),
    statementFor: {
      businessName: c.businessName,
      contactName: c.contactName,
      email: c.email,
      phone: c.phone,
      address: c.address,
    },
    periodLabel: range.label,
    periodNotice: range.notice,
    generatedAt: new Date(),
    truncated: data.truncated,
    canWiden: range.preset !== "all",
  });

  return (
    <div>
      <PrintToolbar backHref={`/admin/customers/${id}`} backLabel="Back to customer" />
      <div className="doc-chrome-hidden mx-auto mt-3 max-w-3xl space-y-2 print:hidden">
        <DateRangeFilter
          basePath={`/admin/customers/${id}/statement`}
          range={range}
          defaultPreset="this-month"
        />
        <p className="text-xs text-muted">
          This is the <strong>customer copy</strong> — no cost or profit anywhere.{" "}
          <Link
            href={`/admin/customers/${id}/statement/internal${rangeQueryString(sp)}`}
            className="font-medium text-brand hover:text-accent"
          >
            Open my copy (internal) →
          </Link>
        </p>
      </div>
      <CustomerStatementDocument model={model} />
    </div>
  );
}
