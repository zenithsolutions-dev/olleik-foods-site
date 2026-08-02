import { CustomersClient } from "./customers-client";
import { fetchAdminCustomers } from "@/lib/admin/customers-data";
import { isoInRange, resolveDateRange, type RangeSearchParams } from "@/lib/dates";
import { DateRangeFilter } from "@/components/date-range-filter";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<RangeSearchParams>;
}) {
  // CP-5: bound by created date (default All time). Small table — the shared
  // predicate applies the same boundaries the SQL surfaces use.
  const range = resolveDateRange(await searchParams);
  const { customers, counts, live } = await fetchAdminCustomers();
  const filtered =
    range.preset === "all" ? customers : customers.filter((c) => isoInRange(c.createdAt, range));

  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
          Accounts
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          Customers
        </h1>
        <p className="mt-2 text-sm text-muted">
          Each customer sees their own assigned product list with negotiated pricing.
          {range.preset !== "all" &&
            ` Showing customers ADDED ${range.label} (${filtered.length} of ${customers.length}).`}
        </p>
        <div className="mt-4">
          <DateRangeFilter basePath="/admin/customers" range={range} />
        </div>
      </header>
      <CustomersClient customers={filtered} counts={counts} live={live} />
    </div>
  );
}
