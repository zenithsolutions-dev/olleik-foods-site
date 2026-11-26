import Link from "next/link";
import type { ReactNode } from "react";
import type { PublicSpecial } from "@/lib/specials";

// One special, as the public sees it. Server component: everything it shows was already decided on the
// server (a guest's `priceCents` is null when the special hides its price). `children` is the action area,
// which differs for a guest (contact / sign in) and a customer (add to cart).

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function SpecialCard({
  special,
  href,
  timeZone,
  children,
}: {
  special: PublicSpecial;
  href?: string; // link the title to the special's own page (omit on that page)
  timeZone: string;
  children?: ReactNode;
}) {
  const soldShare = Math.min(100, Math.round(((special.total - special.remaining) / special.total) * 100));
  const isLow = !special.isSoldOut && special.remaining <= Math.max(1, Math.ceil(special.total * 0.2));
  const title = <span className={special.isSoldOut ? "text-muted" : "text-brand-deep"}>{special.title}</span>;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-surface shadow-sm">
      {/* No picture, no picture area: an empty block would only push the offer down the screen. */}
      {special.imageUrl && (
        <div className="aspect-[16/10] bg-brand-mist">
          {/* Arbitrary admin-supplied address: next/image only allows configured hosts. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={special.imageUrl}
            alt=""
            loading="lazy"
            className={`h-full w-full object-cover ${special.isSoldOut ? "opacity-50 grayscale" : ""}`}
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {special.isSoldOut && (
          <p className="mb-3 self-start rounded-full bg-brand-deep px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-white">
            Sold out
          </p>
        )}
        <h2 className="font-display text-2xl font-semibold leading-tight tracking-tight">
          {href ? (
            <Link href={href} className="hover:underline">
              {title}
            </Link>
          ) : (
            title
          )}
        </h2>
        {special.description && <p className="mt-2 text-[15px] leading-relaxed text-muted">{special.description}</p>}

        <div className="mt-4 flex flex-wrap items-baseline gap-x-2">
          {special.priceCents !== null ? (
            <>
              <span className="font-display text-3xl font-semibold tabular-nums text-brand-deep">{money(special.priceCents)}</span>
              {special.unitLabel && <span className="text-sm text-muted">per {special.unitLabel}</span>}
            </>
          ) : (
            <span className="text-sm font-medium text-muted">
              Special price for account holders{special.unitLabel ? ` · ${special.unitLabel}` : ""}
            </span>
          )}
        </div>

        {/* How much is left: the number first, the bar as a second reading of the same fact. */}
        <div className="mt-4">
          <p className={`text-sm font-semibold tabular-nums ${special.isSoldOut ? "text-muted" : isLow ? "text-accent-deep" : "text-foreground"}`}>
            {special.isSoldOut ? (
              `All ${special.total.toLocaleString("en-CA")} sold`
            ) : (
              <>
                {isLow ? "Only " : ""}
                {special.remaining.toLocaleString("en-CA")} left
                <span className="font-normal text-muted"> of {special.total.toLocaleString("en-CA")}</span>
              </>
            )}
          </p>
          <div
            role="img"
            aria-label={`${soldShare}% sold`}
            className="mt-2 h-2 overflow-hidden rounded-full bg-brand-mist"
          >
            <div className={`h-full rounded-full ${special.isSoldOut ? "bg-muted-soft" : "bg-accent"}`} style={{ width: `${soldShare}%` }} />
          </div>
          {special.endsAt && !special.isSoldOut && (
            <p className="mt-2 text-xs text-muted">
              Ends{" "}
              {new Date(new Date(special.endsAt).getTime() - 1).toLocaleDateString("en-CA", { dateStyle: "medium", timeZone })}
            </p>
          )}
        </div>

        {children && <div className="mt-auto pt-5">{children}</div>}
      </div>
    </article>
  );
}
