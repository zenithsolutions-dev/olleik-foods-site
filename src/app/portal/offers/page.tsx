import { requireCustomer } from "@/lib/portal/require-customer";
import { fetchMyOffers } from "@/lib/portal/portal-data";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null;
}

export default async function PortalOffersPage() {
  await requireCustomer();
  const offers = await fetchMyOffers();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          Offers
        </h1>
        <p className="mt-2 text-sm text-muted">
          Current promotions and account perks set up for you by your Olleik rep.
        </p>
      </div>

      {offers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] bg-surface p-10 text-center text-sm text-muted">
          No active offers right now. Check back soon.
        </p>
      ) : (
        <ul className="space-y-4">
          {offers.map((o) => {
            const start = fmtDate(o.startsAt);
            const end = fmtDate(o.endsAt);
            const window =
              start && end
                ? `${start} → ${end}`
                : start
                  ? `From ${start}`
                  : end
                    ? `Until ${end}`
                    : "Ongoing";
            return (
              <li key={o.id} className="rounded-2xl border border-[var(--border)] bg-surface p-6">
                <h2 className="font-display text-lg font-semibold text-brand-deep">{o.title}</h2>
                {o.description && (
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{o.description}</p>
                )}
                <p className="mt-3 text-xs text-muted-soft">
                  {window}
                  {o.productName && <span> · {o.productName}</span>}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
