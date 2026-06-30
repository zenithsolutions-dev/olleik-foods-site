import { OffersClient } from "./offers-client";
import { fetchAdminOfferTemplates } from "@/lib/admin/offer-templates-data";

export const dynamic = "force-dynamic";

export default async function OffersPage() {
  const { templates, live } = await fetchAdminOfferTemplates();

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
            Offers
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
            Offer library
          </h1>
          <p className="mt-2 text-sm text-muted">
            Reusable offer templates. Apply one to a customer from their detail page — it&apos;s
            copied as a snapshot, so editing a template later never changes already-applied offers.
          </p>
        </div>
      </header>
      <OffersClient templates={templates} live={live} />
    </div>
  );
}
