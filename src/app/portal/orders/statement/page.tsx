import { requireCustomer } from "@/lib/portal/require-customer";
import { fetchMyStatement } from "@/lib/portal/portal-data";
import { getBusinessIdentity } from "@/lib/business";
import { buildCustomerStatement } from "@/lib/documents/customer-statement-model";
import { CustomerStatementDocument } from "@/components/documents/customer-statement-document";
import { PrintToolbar } from "@/components/documents/print-toolbar";
import { DateRangeFilter } from "@/components/date-range-filter";
import { resolveDateRange, type RangeSearchParams } from "@/lib/dates";

export const dynamic = "force-dynamic";

// CP-7 portal statement (approved D-S6): the customer prints their OWN
// statement for a period they choose. SESSION CLIENT ONLY — fetchMyStatement
// is RLS-scoped exactly like every other portal read, so a customer cannot
// produce anyone else's statement and there is no id to tamper with.
//
// Nothing new is exposed: the same orders /portal/orders already lists and the
// same frozen lines the customer can already print one invoice at a time.
// It renders the SAME cost-free model the admin's customer copy renders, so
// owner and customer look at the identical document.

export default async function PortalStatementPage({
  searchParams,
}: {
  searchParams: Promise<RangeSearchParams>;
}) {
  const customer = await requireCustomer();
  const sp = await searchParams;
  const hasRangeInput = Boolean(sp.range || sp.from || sp.to);
  const range = resolveDateRange(hasRangeInput ? sp : { range: "this-month" });

  const data = await fetchMyStatement({
    startISO: range.startUTC?.toISOString() ?? null,
    endISO: range.endUTC?.toISOString() ?? null,
  });

  const model = buildCustomerStatement({
    orders: data.orders,
    business: getBusinessIdentity(),
    statementFor: {
      businessName: customer.businessName,
      contactName: customer.contactName,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
    },
    periodLabel: range.label,
    periodNotice: range.notice,
    generatedAt: new Date(),
    truncated: data.truncated,
    canWiden: range.preset !== "all",
  });

  return (
    <div>
      <PrintToolbar backHref="/portal/orders" backLabel="Back to my orders" />
      <div className="doc-chrome-hidden mx-auto mt-3 max-w-3xl print:hidden">
        <DateRangeFilter
          basePath="/portal/orders/statement"
          range={range}
          defaultPreset="this-month"
        />
      </div>
      <CustomerStatementDocument model={model} />
    </div>
  );
}
