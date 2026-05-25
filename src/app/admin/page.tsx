import { DashboardClient } from "./dashboard-client";

export default function AdminDashboardPage() {
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
          Quick view of your catalog, customer base, and incoming leads.
        </p>
      </header>
      <DashboardClient />
    </div>
  );
}
