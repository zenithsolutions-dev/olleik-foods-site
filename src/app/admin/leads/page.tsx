import { LeadsClient } from "./leads-client";
import { fetchAdminLeads } from "@/lib/admin/leads-data";
import { isoInRange, resolveDateRange, type RangeSearchParams } from "@/lib/dates";
import { DateRangeFilter } from "@/components/date-range-filter";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<RangeSearchParams>;
}) {
  // CP-5: bound by submission date (default All time).
  const range = resolveDateRange(await searchParams);
  const { leads, live } = await fetchAdminLeads();
  const filtered =
    range.preset === "all" ? leads : leads.filter((l) => isoInRange(l.submittedAt, range));

  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
          Pipeline
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          Leads
        </h1>
        <p className="mt-2 text-sm text-muted">
          Restaurants who submitted the /apply form. Triage and convert to customers.
          {range.preset !== "all" &&
            ` Showing leads SUBMITTED ${range.label} (${filtered.length} of ${leads.length}).`}
        </p>
        <div className="mt-4">
          <DateRangeFilter basePath="/admin/leads" range={range} />
        </div>
      </header>
      <LeadsClient initialLeads={filtered} live={live} />
    </div>
  );
}
