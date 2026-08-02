import Link from "next/link";
import { fetchAdminCustomer } from "@/lib/admin/customers-data";
import { fetchCustomerStatementOrdersWithCosts } from "@/lib/admin/statement-data";
import { getBusinessIdentity } from "@/lib/business";
import { buildInternalStatement } from "@/lib/documents/customer-statement-model";
import { CustomerStatementDocument } from "@/components/documents/customer-statement-document";
import { PrintToolbar } from "@/components/documents/print-toolbar";
import { DateRangeFilter } from "@/components/date-range-filter";
import { rangeQueryString, resolveDateRange, type RangeSearchParams } from "@/lib/dates";

export const dynamic = "force-dynamic";

// CP-7 INTERNAL COPY — "my copy": the same statement plus cost and profit per
// line, per order and for the period. ADMIN-ONLY by route (requireAdmin in the
// admin layout) and by data path (service role). Its figures are not a second
// calculation: buildInternalStatement builds the customer copy first and
// extends it, so the two documents cannot disagree.

export default async function InternalCustomerStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<RangeSearchParams>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const hasRangeInput = Boolean(sp.range || sp.from || sp.to);
  const range = resolveDateRange(hasRangeInput ? sp : { range: "this-month" });

  const [{ detail }, data] = await Promise.all([
    fetchAdminCustomer(id),
    fetchCustomerStatementOrdersWithCosts(id, {
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
  const model = buildInternalStatement({
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
          basePath={`/admin/customers/${id}/statement/internal`}
          range={range}
          defaultPreset="this-month"
        />
        <p className="text-xs text-muted">
          This is <strong>your internal copy</strong> — it shows cost and profit and must not be
          handed to the customer.{" "}
          <Link
            href={`/admin/customers/${id}/statement${rangeQueryString(sp)}`}
            className="font-medium text-brand hover:text-accent"
          >
            Open the customer copy →
          </Link>
        </p>
      </div>
      <CustomerStatementDocument model={model} />
    </div>
  );
}
