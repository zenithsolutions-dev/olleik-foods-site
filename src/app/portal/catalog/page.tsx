import Image from "next/image";
import { requireCustomer } from "@/lib/portal/require-customer";
import { fetchMyCatalog } from "@/lib/portal/portal-data";
import { formatMoney } from "@/lib/portal/format";

export const dynamic = "force-dynamic";

export default async function PortalCatalogPage() {
  await requireCustomer(); // gate; catalog is RLS-scoped to the caller
  const groups = await fetchMyCatalog();
  const total = groups.reduce((n, g) => n + g.products.length, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          My catalog
        </h1>
        <p className="mt-2 text-sm text-muted">
          {total} {total === 1 ? "product" : "products"} at your contract pricing. Prices are
          specific to your account.
        </p>
      </div>

      {total === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] bg-surface p-10 text-center text-sm text-muted">
          No products are set up for your account yet. Contact your Olleik rep to build your
          catalog.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.id}>
            <h2 className="font-display text-lg font-semibold text-brand-deep">{g.name}</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.products.map((p) => (
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
                    </p>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="font-mono text-lg font-semibold text-brand-deep">
                        {formatMoney(p.effectiveCents)}
                      </span>
                      {p.isCustomPrice && (
                        <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-deep">
                          Your price
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
