import Link from "next/link";
import { OffersClient } from "./offers-client";
import { RunningNow } from "./running-now";
import { fetchAdminOfferTemplates } from "@/lib/admin/offer-templates-data";
import { fetchOffersOverviewRows } from "@/lib/admin/offers-overview-data";
import { buildOffersOverview } from "@/lib/admin/offers-overview";
import { summarizeBatches } from "@/lib/admin/bulk-offers";
import { BatchesPanel } from "./batches-panel";

export const dynamic = "force-dynamic";

// CP-8a: the offers page gains a "Running now" tab (gap F1) — the library
// manages TEMPLATES; the new tab shows the APPLIED offers actually affecting
// customer prices, grouped by urgency. URL-borne tab (GET links), consistent
// with every other filter in the app.

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ templates, live }, overviewRows, { tab }] = await Promise.all([
    fetchAdminOfferTemplates(),
    fetchOffersOverviewRows(),
    searchParams,
  ]);
  const now = new Date();
  const overview = buildOffersOverview(overviewRows.offers, now);
  const batches = summarizeBatches(overviewRows.batches, now);
  const showRunning = tab === "running";

  const tabClass = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium ${
      active ? "bg-accent text-white" : "text-muted hover:text-foreground"
    }`;

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
            Offers
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
            {showRunning ? "Running now" : "Offer library"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {showRunning
              ? "Every applied offer and where it stands — the same active-now rule the pricing engine uses."
              : "Reusable offer templates. Apply one to a customer from their detail page — it's copied as a snapshot, so editing a template later never changes already-applied offers."}
          </p>
          <div className="mt-4 inline-flex rounded-full border border-[var(--border)] bg-surface p-0.5">
            <Link href="/admin/offers" className={tabClass(!showRunning)}>
              Templates
            </Link>
            <Link href="/admin/offers?tab=running" className={tabClass(showRunning)}>
              Running now{overview.liveCount > 0 ? ` (${overview.liveCount})` : ""}
            </Link>
          </div>
        </div>
      </header>
      {showRunning ? (
        <div className="space-y-5">
          <BatchesPanel batches={batches} />
          <RunningNow overview={overview} />
        </div>
      ) : (
        <OffersClient templates={templates} live={live} />
      )}
    </div>
  );
}
