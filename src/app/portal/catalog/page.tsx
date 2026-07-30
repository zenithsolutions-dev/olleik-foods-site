import Image from "next/image";
import Link from "next/link";
import { requireCustomer } from "@/lib/portal/require-customer";
import { fetchMyCatalogPage, PORTAL_PAGE_SIZE } from "@/lib/portal/portal-data";
import { formatMoney } from "@/lib/portal/format";

export const dynamic = "force-dynamic";

// CP-2: the catalog browses whatever the products RLS policy makes visible for
// this customer (assigned / entire catalog / selected categories, minus hidden)
// — this page never inspects the visibility mode itself. Server-side pagination
// + search + category filter via GET params, so it scales to a large catalog.

export default async function PortalCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; cat?: string }>;
}) {
  await requireCustomer(); // gate; catalog is RLS-scoped to the caller
  const params = await searchParams;
  const q = (params.q ?? "").slice(0, 80);
  const cat = params.cat ?? "";
  const { items, total, page, pageCount, categoryOptions } = await fetchMyCatalogPage({
    page: Number(params.page ?? "1"),
    search: q,
    categoryId: cat,
  });

  const filtered = q.trim() !== "" || cat !== "";
  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (p > 1) sp.set("page", String(p));
    if (q.trim()) sp.set("q", q);
    if (cat) sp.set("cat", cat);
    const s = sp.toString();
    return s ? `/portal/catalog?${s}` : "/portal/catalog";
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          My catalog
        </h1>
        <p className="mt-2 text-sm text-muted">
          {total} {total === 1 ? "product" : "products"}
          {filtered ? " match your filters." : " available to your account."} Products marked{" "}
          <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-deep">
            Your price
          </span>{" "}
          carry pricing specific to your account.
        </p>
      </div>

      {/* Search + category filter (GET form — works without JS) */}
      <form
        method="get"
        action="/portal/catalog"
        className="flex flex-wrap items-center gap-2"
      >
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name or SKU…"
          className="w-full max-w-xs rounded-full border border-[var(--border-strong)] bg-surface px-4 py-2 text-sm outline-none focus:border-brand"
        />
        {categoryOptions.length > 0 && (
          <select
            name="cat"
            defaultValue={cat}
            className="rounded-full border border-[var(--border-strong)] bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
          >
            <option value="">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep"
        >
          Search
        </button>
        {filtered && (
          <Link href="/portal/catalog" className="text-sm text-brand hover:text-accent">
            Clear
          </Link>
        )}
      </form>

      {total === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] bg-surface p-10 text-center text-sm text-muted">
          {filtered
            ? "No products match your search. Try different words or clear the filters."
            : "No products are set up for your account yet. Contact your Olleik rep to build your catalog."}
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <div
                key={p.productId}
                className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface"
              >
                <div className="relative aspect-[4/3] w-full bg-brand-mist">
                  {p.imageUrl ? (
                    <Image
                      src={p.imageUrl}
                      alt={p.name}
                      fill
                      sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden
                      className="absolute inset-0 grid place-items-center bg-gradient-to-br from-brand-mist to-accent-soft/50 text-brand-deep/35"
                    >
                      <span className="font-display text-4xl font-semibold">
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="font-medium leading-snug text-foreground">{p.name}</h3>
                  <p className="mt-1 text-xs text-muted">
                    {p.sku} · {p.unitSize} / {p.unit}
                    {p.categoryLabel ? ` · ${p.categoryLabel}` : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap items-baseline gap-2">
                    {p.discounted ? (
                      <>
                        <span className="font-mono text-lg font-semibold text-emerald-700">
                          {formatMoney(p.finalCents)}
                        </span>
                        <span className="font-mono text-sm text-muted line-through">
                          {formatMoney(p.effectiveCents)}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                          Offer
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-mono text-lg font-semibold text-brand-deep">
                          {formatMoney(p.effectiveCents)}
                        </span>
                        {/* D-V5 (owner override): the badge marks EVERY assigned
                            product — a negotiated relationship shows uniformly,
                            never appearing/disappearing on price comparison. */}
                        {p.assigned && (
                          <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-deep">
                            Your price
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  {p.discounted && p.appliedOfferTitle && (
                    <p className="mt-1 text-xs text-emerald-700">{p.appliedOfferTitle}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {pageCount > 1 && (
            <nav
              aria-label="Catalog pages"
              className="flex items-center justify-center gap-3 text-sm"
            >
              {page > 1 ? (
                <Link
                  href={pageHref(page - 1)}
                  className="rounded-full border border-[var(--border-strong)] px-4 py-2 font-medium text-foreground/80 hover:border-accent hover:text-accent-deep"
                >
                  ← Previous
                </Link>
              ) : (
                <span className="rounded-full border border-[var(--border)] px-4 py-2 text-muted-soft">
                  ← Previous
                </span>
              )}
              <span className="text-muted">
                Page {page} of {pageCount} · {PORTAL_PAGE_SIZE} per page
              </span>
              {page < pageCount ? (
                <Link
                  href={pageHref(page + 1)}
                  className="rounded-full border border-[var(--border-strong)] px-4 py-2 font-medium text-foreground/80 hover:border-accent hover:text-accent-deep"
                >
                  Next →
                </Link>
              ) : (
                <span className="rounded-full border border-[var(--border)] px-4 py-2 text-muted-soft">
                  Next →
                </span>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
