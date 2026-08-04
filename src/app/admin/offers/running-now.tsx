import Link from "next/link";
import type { OffersOverview, OverviewOffer } from "@/lib/admin/offers-overview";
import { formatDiscount } from "@/lib/admin/offers-format";

// CP-8a "Running now" (gap F1): the one screen that answers "what is running,
// on whom, until when?". Read-only server component — every row links to the
// customer it affects. Urgency is grouping + words, never colour alone.

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { dateStyle: "medium", timeZone: "America/Toronto" });

function OfferRow({ o, marker }: { o: OverviewOffer; marker?: string }) {
  const discount = formatDiscount(o.discountKind, o.discountValue);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-brand-deep">
          {o.title}
          {marker && (
            <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-red-700">
              {marker}
            </span>
          )}
        </p>
        <p className="text-xs text-muted">
          <Link href={`/admin/customers/${o.customerId}`} className="font-medium text-brand hover:text-accent">
            {o.customerName}
          </Link>{" "}
          · {o.productLabel ?? "all their products"} ·{" "}
          {discount ?? <span className="font-medium">no discount (announcement only)</span>}
        </p>
      </div>
      <p className="text-xs text-muted">
        {o.startsAt && new Date(o.startsAt) > new Date() ? `starts ${fmtDay(o.startsAt)} · ` : ""}
        {o.endsAt ? `ends ${fmtDay(o.endsAt)}` : "no end date"}
      </p>
    </div>
  );
}

function Group({
  heading,
  blurb,
  rows,
  marker,
}: {
  heading: string;
  blurb: string;
  rows: OverviewOffer[];
  marker?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface">
      <header className="border-b border-[var(--border)] bg-brand-mist/30 px-5 py-3">
        <h2 className="font-display text-sm font-semibold text-brand-deep">
          {heading} ({rows.length})
        </h2>
        <p className="text-xs text-muted">{blurb}</p>
      </header>
      {rows.map((o) => (
        <OfferRow key={o.id} o={o} marker={marker} />
      ))}
    </section>
  );
}

export function RunningNow({ overview }: { overview: OffersOverview }) {
  const empty =
    overview.liveCount === 0 &&
    overview.scheduled.length === 0 &&
    overview.recentlyEnded.length === 0;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        {overview.liveCount === 0
          ? "No offer is live right now."
          : `${overview.liveCount} offer${overview.liveCount === 1 ? " is" : "s are"} live right now — exactly the set the pricing engine is applying.`}
      </p>

      {empty ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] bg-surface p-10 text-center text-sm text-muted">
          Nothing running, scheduled, or recently ended. Apply a template from a customer&apos;s
          page and it will appear here.
        </p>
      ) : (
        <>
          <Group
            heading="Ending within 7 days"
            blurb="Renew or let lapse — these disappear from customer pricing the moment they end."
            rows={overview.endingSoon}
            marker="ENDING SOON"
          />
          <Group
            heading="Running"
            blurb="Live now, with an end date beyond the next 7 days."
            rows={overview.runningLater}
          />
          <Group
            heading="Open-ended"
            blurb="Live now with NO end date — they run until you deactivate them."
            rows={overview.openEnded}
          />
          <Group
            heading="Scheduled"
            blurb="Not live yet — they start automatically on their start date."
            rows={overview.scheduled}
          />
          <Group
            heading="Ended in the last 14 days"
            blurb="Already off customer pricing — listed so an expiry is seen, not silently gone."
            rows={overview.recentlyEnded}
            marker="ENDED"
          />
        </>
      )}
    </div>
  );
}
