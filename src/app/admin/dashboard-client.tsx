"use client";

import Link from "next/link";
import { useAdmin, formatMoney } from "@/lib/admin/store";
import type { Lead, Product } from "@/lib/admin/types";

export function DashboardClient({
  leads,
  products,
  live,
}: {
  leads: Lead[];
  products: Product[];
  live: boolean;
}) {
  const { state, hydrated, reset } = useAdmin();

  if (!hydrated) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  // Leads + products come from the DB (real rows) via props; customers are
  // still the local demo store (Phase C).
  const activeProducts = products.filter((p) => p.isActive).length;
  const activeCustomers = state.customers.filter(
    (c) => c.status === "active"
  ).length;
  const newLeads = leads.filter((l) => l.status === "new").length;
  const avgPrice =
    products.length === 0
      ? 0
      : Math.round(
          products.reduce((s, p) => s + p.listPriceCents, 0) / products.length
        );

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Products in catalog" value={`${products.length}`} sub={`${activeProducts} active`} href="/admin/products" />
        <Stat label="Customers" value={`${state.customers.length}`} sub={`${activeCustomers} active`} href="/admin/customers" />
        <Stat label="New leads" value={`${newLeads}`} sub={`${leads.length} total`} href="/admin/leads" highlight={newLeads > 0} />
        <Stat label="Avg. list price" value={formatMoney(avgPrice)} sub="per unit" />
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-surface p-6">
        <h2 className="font-display text-lg font-semibold text-brand-deep">
          Recent leads
        </h2>
        <p className="mt-1 text-xs text-muted">From the public /apply form.</p>
        {leads.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No leads yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--border)]">
            {leads.slice(0, 5).map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{l.businessName}</p>
                  <p className="truncate text-xs text-muted">
                    {l.contactName} · {l.email}
                  </p>
                </div>
                <LeadStatusBadge status={l.status} />
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/admin/leads"
          className="mt-4 inline-block text-sm font-medium text-brand hover:text-accent"
        >
          View all →
        </Link>
      </section>

      {!live && (
        <section className="rounded-2xl border border-[var(--border)] bg-surface p-6">
          <h2 className="font-display text-lg font-semibold text-brand-deep">
            Demo controls
          </h2>
          <p className="mt-1 text-xs text-muted">
            Supabase isn&apos;t configured, so catalog, customers, and leads are
            local demo data. Use the reset button to restore the seed sample
            after experimenting.
          </p>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Reset all admin data to the seed sample? This wipes any changes.")) {
                reset();
              }
            }}
            className="mt-4 rounded-full border border-[var(--border-strong)] bg-background px-4 py-2 text-xs font-medium text-foreground/80 hover:border-accent hover:text-accent-deep"
          >
            Reset demo data
          </button>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  href,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  href?: string;
  highlight?: boolean;
}) {
  const inner = (
    <div
      className={`rounded-2xl border bg-surface p-5 transition ${
        highlight
          ? "border-accent shadow-[0_8px_30px_-12px_rgba(200,122,42,0.4)]"
          : "border-[var(--border)] hover:border-[var(--border-strong)]"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="font-display mt-2 text-3xl font-semibold tracking-tight text-brand-deep">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-soft">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function LeadStatusBadge({ status }: { status: "new" | "contacted" | "approved" | "rejected" }) {
  const cls =
    status === "new"
      ? "bg-accent-soft text-accent-deep"
      : status === "contacted"
        ? "bg-brand-mist text-brand-deep"
        : status === "approved"
          ? "bg-brand text-white"
          : "bg-zinc-200 text-zinc-600";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {status}
    </span>
  );
}
