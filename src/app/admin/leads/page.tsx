import { LeadsClient } from "./leads-client";
import { fetchAdminLeads } from "@/lib/admin/leads-data";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const { leads, live } = await fetchAdminLeads();

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
        </p>
      </header>
      <LeadsClient initialLeads={leads} live={live} />
    </div>
  );
}
