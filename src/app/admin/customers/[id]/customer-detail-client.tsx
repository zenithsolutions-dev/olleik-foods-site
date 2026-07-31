"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Pencil, Plus, X, RotateCcw, Copy, Search } from "lucide-react";
import { formatMoney } from "@/lib/admin/store";
import { formatDiscount } from "@/lib/admin/offers-format";
import { applyOffersToPrice, offerAppliesToProduct } from "@/lib/pricing";
import type {
  Category,
  Offer,
  OfferDiscountKind,
  OfferTemplate,
  PricingRule,
  Product,
} from "@/lib/admin/types";
import type { AssignedProduct, CustomerDetail, Activation } from "@/lib/admin/customers-data";
import type { PricingMeta } from "@/lib/admin/pricing-data";
import type { CustomerVisibility } from "@/lib/admin/visibility-data";
import { VisibilityCard } from "./visibility-card";
import { RecomputeModal } from "./recompute-modal";
import { upsertPricingRule, togglePricingRule } from "../../pricing/actions";
import { CustomerFormModal } from "../customers-client";
import { InviteControls } from "../invite-controls";
import { OnboardingChecklist } from "./onboarding-checklist";
import { CopyCatalogModal } from "./copy-catalog-modal";
import { ApplyTemplateModal } from "./apply-template-modal";
import {
  DiscountFields,
  parseDiscountValue,
  discountValueToText,
} from "../../offers/offers-client";
import type { CopySource } from "./page";
import {
  updateCustomer,
  archiveCustomer,
  restoreCustomer,
  assignProducts,
  setCustomerProductPrice,
  removeCustomerProduct,
  copyCatalogFromCustomer,
  bulkUpdateCustomerPrices,
  createOffer,
  updateOffer,
  deleteOffer,
  toggleOfferActive,
  type CustomerInput,
  type OfferInput,
  type BulkPriceOp,
} from "../actions";
import { applyTemplateToCustomer } from "../../offers/actions";

export function CustomerDetailClient({
  detail,
  allProducts,
  categories,
  activation,
  copySources,
  offerTemplates,
  costs,
  pricingRules,
  pricingMeta,
  visibility,
  live,
}: {
  detail: CustomerDetail;
  allProducts: Product[];
  categories: Category[];
  activation: Activation;
  copySources: CopySource[];
  offerTemplates: OfferTemplate[];
  costs: Record<string, number>; // productId -> cost_cents (admin-only)
  pricingRules: PricingRule[];
  pricingMeta: Record<string, PricingMeta>; // productId -> provenance
  visibility: CustomerVisibility;
  live: boolean;
}) {
  const { customer, assigned, offers } = detail;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [addProductPickerOpen, setAddProductPickerOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false);
  const [recomputeOpen, setRecomputeOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [offerModal, setOfferModal] = useState<{ open: boolean; offer: Offer | null }>({
    open: false,
    offer: null,
  });
  const [busy, setBusy] = useState(false);

  const catById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories],
  );
  const productById = useMemo(
    () => Object.fromEntries(allProducts.map((p) => [p.id, p])),
    [allProducts],
  );
  const assignedIds = useMemo(() => new Set(assigned.map((a) => a.productId)), [assigned]);
  const unassigned = useMemo(
    () => allProducts.filter((p) => p.isActive && !assignedIds.has(p.id)),
    [allProducts, assignedIds],
  );
  // Offers may link only to a product this customer can see (decision #3).
  const assignedProductOptions = useMemo(
    () => assigned.map((a) => ({ id: a.productId, name: a.name })),
    [assigned],
  );
  const templateNameById = useMemo(
    () => Object.fromEntries(offerTemplates.map((t) => [t.id, t.name])),
    [offerTemplates],
  );
  const appliedTemplateIds = useMemo(
    () => offers.map((o) => o.templateId).filter((x): x is string => !!x),
    [offers],
  );

  // Per-product offer pricing, using the SAME pure functions as the portal so the
  // admin sees exactly what the customer pays. Recomputed from the loaded offers;
  // `now` is captured per render for the active/date-window check.
  const offerPriceByProduct = useMemo(() => {
    const now = new Date();
    const map: Record<
      string,
      { finalCents: number; discounted: boolean; originalCents: number; appliedTitle: string | null }
    > = {};
    for (const a of assigned) {
      const base = a.priceCents ?? a.listPriceCents;
      const applicable = offers
        .filter((o) =>
          offerAppliesToProduct(
            {
              isActive: o.isActive,
              startsAt: o.startsAt ?? null,
              endsAt: o.endsAt ?? null,
              productId: o.productId ?? null,
              discountKind: o.discountKind ?? null,
              discountValue: o.discountValue ?? null,
            },
            a.productId,
            now,
          ),
        )
        .map((o) => ({
          title: o.title,
          discountKind: o.discountKind as OfferDiscountKind,
          discountValue: o.discountValue as number,
        }));
      const priced = applyOffersToPrice(base, applicable);
      map[a.productId] = {
        finalCents: priced.finalCents,
        discounted: priced.discounted,
        originalCents: priced.originalCents,
        appliedTitle: priced.appliedOffer?.title ?? null,
      };
    }
    return map;
  }, [assigned, offers]);

  // ---- Cost/profit per assigned row (admin-only data; 0006) ----
  // Source chip: meta provenance when present; otherwise the rollout default
  // (non-null stored price = Manual, null = List).
  const rowPricing = useMemo(() => {
    const map: Record<
      string,
      { costCents: number | null; profitCents: number | null; sourceChip: string }
    > = {};
    for (const a of assigned) {
      const effective = a.priceCents ?? a.listPriceCents;
      const costCents = costs[a.productId] ?? null;
      const meta = pricingMeta[a.productId];
      let sourceChip: string;
      if (meta) {
        if (meta.priceSource === "manual") sourceChip = "Manual";
        else {
          const pct = meta.marginPercent != null ? ` ${meta.marginPercent}%` : "";
          const prio = meta.isPriority ? " (priority)" : "";
          sourceChip =
            meta.ruleScope === "product"
              ? `Prod${pct}${prio}`
              : meta.ruleScope === "customer"
                ? `Cust${pct}`
                : meta.ruleScope === "category"
                  ? `Cat${pct}${prio}`
                  : meta.ruleScope === "global"
                    ? `Global${pct}`
                    : "List";
        }
      } else {
        sourceChip = a.priceCents != null ? "Manual" : "List";
      }
      map[a.productId] = {
        costCents,
        profitCents: costCents != null ? effective - costCents : null,
        sourceChip,
      };
    }
    return map;
  }, [assigned, costs, pricingMeta]);

  const totals = useMemo(() => {
    let sale = 0,
      cost = 0,
      profit = 0,
      withCost = 0,
      // Sale value of rows with no recorded cost — in `sale` but excluded from
      // `cost`/`profit`. Surfaced in the footer so the row reconciles.
      noCostSale = 0;
    for (const a of assigned) {
      const effective = a.priceCents ?? a.listPriceCents;
      sale += effective;
      const c = costs[a.productId];
      if (c != null) {
        cost += c;
        profit += effective - c;
        withCost++;
      } else {
        noCostSale += effective;
      }
    }
    return { sale, cost, profit, withCost, noCostSale };
  }, [assigned, costs]);

  const customerMarginRule = useMemo(
    () => pricingRules.find((r) => r.scope === "customer" && r.customerId === customer.id) ?? null,
    [pricingRules, customer.id],
  );

  // CSV of exactly what the admin sees in the assigned-products table.
  function exportCsv() {
    const esc = (v: string | number | null | undefined) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      "Product",
      "SKU",
      "Category",
      "Cost",
      "List price",
      "Customer price",
      "Price source",
      "Profit",
      "After offer",
    ];
    const lines = assigned.map((a) => {
      const rp = rowPricing[a.productId];
      const op = offerPriceByProduct[a.productId];
      const effective = a.priceCents ?? a.listPriceCents;
      return [
        esc(a.name),
        esc(a.sku),
        esc((a.categoryId ? catById[a.categoryId] : undefined) ?? ""),
        esc(rp?.costCents != null ? (rp.costCents / 100).toFixed(2) : ""),
        esc((a.listPriceCents / 100).toFixed(2)),
        esc((effective / 100).toFixed(2)),
        esc(rp?.sourceChip ?? ""),
        esc(rp?.profitCents != null ? (rp.profitCents / 100).toFixed(2) : ""),
        esc(op?.discounted ? (op.finalCents / 100).toFixed(2) : ""),
      ].join(",");
    });
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${customer.businessName.replace(/[^\w-]+/g, "-")}-pricing.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const isArchived = customer.status === "archived";

  async function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) window.alert(result.message ?? "Something went wrong.");
    return result.ok;
  }

  async function handleEditSave(values: CustomerInput) {
    setSaving(true);
    setEditError(null);
    const result = await updateCustomer(customer.id, values);
    setSaving(false);
    if (!result.ok) {
      setEditError(result.message);
      return;
    }
    setEditing(false);
  }

  // ---- bulk selection + pricing ----
  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === assigned.length ? new Set() : new Set(assigned.map((a) => a.productId)),
    );
  }

  async function runBulk(op: BulkPriceOp) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBusy(true);
    const res = await bulkUpdateCustomerPrices(customer.id, ids, op);
    setBusy(false);
    if (!res.ok) {
      window.alert(res.message);
      return;
    }
    setSelected(new Set());
    setNotice(`Updated ${res.updated} product${res.updated === 1 ? "" : "s"}.`);
  }

  // Mode-specific window.confirm for Overwrite is enforced inside CopyCatalogModal
  // before this runs, so nothing is deleted without an explicit confirmation.
  async function handleCopy(
    sourceId: string,
    mode: "merge" | "overwrite",
    prices: "copy" | "list",
  ) {
    setBusy(true);
    const res = await copyCatalogFromCustomer(customer.id, sourceId, { mode, prices });
    setBusy(false);
    if (!res.ok) {
      window.alert(res.message);
      return;
    }
    setCopyOpen(false);
    setSelected(new Set());
    setNotice(
      `Copied ${res.copied} product${res.copied === 1 ? "" : "s"}` +
        (res.skipped > 0 ? ` (${res.skipped} skipped — inactive/removed)` : "") +
        ".",
    );
  }

  async function handleApplyTemplate(
    templateId: string,
    overrides: { title?: string; productId: string | null; startsAt: string | null; endsAt: string | null },
  ) {
    setBusy(true);
    const res = await applyTemplateToCustomer(customer.id, templateId, overrides);
    setBusy(false);
    if (!res.ok) {
      window.alert(res.message);
      return;
    }
    setApplyTemplateOpen(false);
    setNotice(`Applied template "${templateNameById[templateId] ?? "offer"}" to this customer.`);
  }

  return (
    <div className="space-y-8">
      {!live && (
        <p className="rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          Showing demo seed data — Supabase isn&apos;t configured, so changes won&apos;t persist.
        </p>
      )}

      <div>
        <Link href="/admin/customers" className="inline-flex items-center gap-1 text-sm text-brand hover:text-accent">
          <ArrowLeft size={14} /> All customers
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
              Account
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
                {customer.businessName}
              </h1>
              <ActivationBadge activation={activation} />
            </div>
            <p className="mt-1 text-sm text-muted">
              {customer.contactName} · {customer.email} · {customer.phone}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditError(null);
                setEditing(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-surface px-4 py-2 text-sm font-medium text-foreground/80 hover:border-accent hover:text-accent-deep"
            >
              <Pencil size={14} /> Edit account
            </button>
          </div>
        </div>
      </div>

      {/* Portal invite */}
      {!isArchived && (
        <section className="rounded-2xl border border-[var(--border)] bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-brand-deep">Portal access</h2>
              <p className="mt-0.5 text-xs text-muted">
                {activation === "active"
                  ? "This customer has signed in. Send a fresh link only if they need to reset."
                  : activation === "invited"
                    ? "Invited — waiting for them to set a password. Resend or copy a fresh link."
                    : "Invite this customer to the portal. They set their own password — you never see it."}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <InviteControls customerId={customer.id} invited={!!customer.userId} compact />
          </div>
        </section>
      )}

      {isArchived && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-zinc-50 px-5 py-4">
          <p className="text-sm text-muted">
            This customer is <span className="font-semibold text-foreground">archived</span>.
            Their catalog and offers are preserved but hidden from the active list.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => restoreCustomer(customer.id))}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-50"
          >
            <RotateCcw size={14} /> Restore customer
          </button>
        </div>
      )}

      {/* Onboarding checklist — fully derived from data already loaded */}
      <OnboardingChecklist
        activation={activation}
        assigned={assigned}
        onAssignClick={() => setAddProductPickerOpen(true)}
      />

      {/* Pricing & visibility — the two levers that shape this customer's portal:
          what they PAY (margin, D7: also editable centrally on /admin/pricing)
          and what they can BROWSE (CP-2 visibility). */}
      <div>
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-muted">
          Pricing &amp; visibility
        </h2>
        <div className="mt-2 space-y-4">
          <MarginCard
            customerName={customer.businessName}
            rule={customerMarginRule}
            busy={busy}
            onSave={(pct) =>
              run(() =>
                upsertPricingRule({ scope: "customer", customerId: customer.id, marginPercent: pct }),
              )
            }
            onToggle={(rule) => run(() => togglePricingRule(rule.id, !rule.isActive))}
          />
          {!isArchived && (
            <VisibilityCard
              customerId={customer.id}
              visibility={visibility}
              categories={categories}
              allProducts={allProducts}
              assignedIds={assigned.map((a) => a.productId)}
            />
          )}
        </div>
      </div>

      {/* Quick info cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <InfoCard label="Status" value={customer.status} />
        <InfoCard label="Payment terms" value={customer.paymentTerms} />
        <InfoCard label="Catalog size" value={`${assigned.length} products`} />
        <InfoCard label="Address" value={customer.address || "—"} />
      </div>

      {customer.notes && (
        <p className="rounded-xl border border-[var(--border)] bg-brand-mist/40 p-4 text-sm italic text-brand-deep">
          “{customer.notes}”
        </p>
      )}

      {/* Transient success notice (copy / bulk results) */}
      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand-mist/50 px-4 py-2.5 text-sm text-brand-deep">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            className="rounded p-1 text-muted hover:text-foreground"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Assigned catalog */}
      <section className="rounded-2xl border border-[var(--border)] bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-brand-deep">
              Assigned products
            </h2>
            <p className="text-xs text-muted">
              {visibility.mode === "all"
                ? "This customer browses the ENTIRE catalog; assigning a product gives it their special price. Override pricing per product as needed."
                : visibility.mode === "categories"
                  ? "This customer browses their selected categories; assigning a product gives it their special price (and shows it outside those categories). Override pricing per product as needed."
                  : "Only these products are visible to this customer in their portal. Override pricing per product as needed."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-full border border-[var(--border-strong)] bg-surface px-3 py-2 text-xs font-medium text-foreground/80 hover:border-accent hover:text-accent-deep"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => setRecomputeOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-surface px-4 py-2 text-sm font-medium text-foreground/80 hover:border-accent hover:text-accent-deep"
            >
              <RotateCcw size={14} /> Recompute prices
            </button>
            <button
              type="button"
              onClick={() => setCopyOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-surface px-4 py-2 text-sm font-medium text-foreground/80 hover:border-accent hover:text-accent-deep"
            >
              <Copy size={14} /> Copy from customer
            </button>
            <button
              type="button"
              onClick={() => setAddProductPickerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(200,122,42,0.6)] hover:bg-accent-deep"
            >
              <Plus size={14} /> Add product
            </button>
          </div>
        </header>

        {/* Bulk price toolbar — appears when ≥1 product is selected */}
        {selected.size > 0 && (
          <BulkPriceBar
            count={selected.size}
            busy={busy}
            onApply={runBulk}
            onClear={() => setSelected(new Set())}
          />
        )}

        {assigned.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted">
            No products assigned yet. This customer can&apos;t see anything in their portal.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-brand-mist/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                <th className="w-10 px-6 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    className="accent-accent"
                    checked={selected.size > 0 && selected.size === assigned.length}
                    ref={(el) => {
                      if (el) el.indeterminate = selected.size > 0 && selected.size < assigned.length;
                    }}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-3">Product</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3 text-right">List</th>
                <th className="px-4 py-3 text-right">Customer price</th>
                <th className="px-4 py-3 text-right">Profit</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {assigned.map((a) => (
                <CustomerProductRow
                  key={a.productId}
                  row={a}
                  priced={offerPriceByProduct[a.productId]}
                  pricing={rowPricing[a.productId]}
                  categoryName={(a.categoryId ? catById[a.categoryId] : undefined) ?? "—"}
                  busy={busy}
                  selected={selected.has(a.productId)}
                  onToggleSelect={() => toggleSelected(a.productId)}
                  onSet={(cents) =>
                    run(() => setCustomerProductPrice(customer.id, a.productId, cents))
                  }
                  onRemove={() =>
                    run(() => removeCustomerProduct(customer.id, a.productId))
                  }
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--border-strong)] bg-brand-mist/30 font-semibold">
                <td className="px-6 py-3" colSpan={3}>
                  Totals ({assigned.length} products
                  {totals.withCost < assigned.length
                    ? `, ${assigned.length - totals.withCost} without cost`
                    : ""}
                  )
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatMoney(totals.cost)}
                  {totals.withCost < assigned.length && (
                    <span className="block text-[10px] font-normal text-muted-soft">
                      on {totals.withCost} of {assigned.length}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right font-mono">{formatMoney(totals.sale)}</td>
                <td
                  className={`px-4 py-3 text-right font-mono ${totals.profit >= 0 ? "text-emerald-700" : "text-red-700"}`}
                >
                  {formatMoney(totals.profit)}
                  {/* Reconciles the row: sale − cost − excluded = profit. */}
                  {totals.noCostSale > 0 && (
                    <span className="block text-[10px] font-normal text-muted-soft">
                      excl. {formatMoney(totals.noCostSale)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      {/* Offers */}
      <section className="rounded-2xl border border-[var(--border)] bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-brand-deep">Offers</h2>
            <p className="text-xs text-muted">
              Informational notes shown to this customer in their portal (promos, seasonal pricing, account perks).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setApplyTemplateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-surface px-4 py-2 text-sm font-medium text-foreground/80 hover:border-accent hover:text-accent-deep"
            >
              <Plus size={14} /> Apply template
            </button>
            <button
              type="button"
              onClick={() => setOfferModal({ open: true, offer: null })}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(200,122,42,0.6)] hover:bg-accent-deep"
            >
              <Plus size={14} /> Add offer
            </button>
          </div>
        </header>

        {offers.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted">No offers for this customer yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {offers.map((o) => (
              <OfferRow
                key={o.id}
                offer={o}
                productName={o.productId ? productById[o.productId]?.name : undefined}
                templateName={o.templateId ? templateNameById[o.templateId] : undefined}
                busy={busy}
                onEdit={() => setOfferModal({ open: true, offer: o })}
                onToggle={() => run(() => toggleOfferActive(customer.id, o.id, !o.isActive))}
                onDelete={() => {
                  if (window.confirm(`Delete offer “${o.title}”?`)) {
                    run(() => deleteOffer(customer.id, o.id));
                  }
                }}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Modals */}
      {editing && (
        <CustomerFormModal
          initial={customer}
          saving={saving}
          error={editError}
          onClose={() => setEditing(false)}
          onSave={handleEditSave}
          onArchive={
            isArchived
              ? undefined
              : () => {
                  if (
                    window.confirm(
                      `Archive "${customer.businessName}"? They'll be hidden from the active list; their catalog and offers are kept and can be restored.`,
                    )
                  ) {
                    archiveCustomer(customer.id).then((r) => {
                      if (r.ok) window.location.href = "/admin/customers";
                      else window.alert(r.message);
                    });
                  }
                }
          }
        />
      )}

      {addProductPickerOpen && (
        <AddProductsPicker
          unassigned={unassigned}
          categories={categories}
          categoryName={(id) => (id ? catById[id] : undefined) ?? "—"}
          onClose={() => setAddProductPickerOpen(false)}
          onAdd={async (productIds) => {
            const ok = await run(() => assignProducts(customer.id, productIds));
            if (ok) setAddProductPickerOpen(false);
          }}
        />
      )}

      {copyOpen && (
        <CopyCatalogModal
          targetName={customer.businessName}
          targetAssignedCount={assigned.length}
          sources={copySources}
          busy={busy}
          onClose={() => setCopyOpen(false)}
          onCopy={handleCopy}
        />
      )}

      {offerModal.open && (
        <OfferModal
          initial={offerModal.offer}
          products={assignedProductOptions}
          onClose={() => setOfferModal({ open: false, offer: null })}
          onSave={async (values) => {
            const result = offerModal.offer
              ? await updateOffer(customer.id, offerModal.offer.id, values)
              : await createOffer(customer.id, values);
            if (!result.ok) {
              window.alert(result.message);
              return;
            }
            setOfferModal({ open: false, offer: null });
          }}
        />
      )}

      {applyTemplateOpen && (
        <ApplyTemplateModal
          templates={offerTemplates}
          assignedProducts={assignedProductOptions}
          appliedTemplateIds={appliedTemplateIds}
          busy={busy}
          onClose={() => setApplyTemplateOpen(false)}
          onApply={handleApplyTemplate}
        />
      )}

      {recomputeOpen && (
        <RecomputeModal
          customerId={customer.id}
          customerName={customer.businessName}
          onClose={() => setRecomputeOpen(false)}
          onApplied={(updated) => {
            setRecomputeOpen(false);
            setNotice(`Recomputed ${updated} price${updated === 1 ? "" : "s"} from the current rules.`);
          }}
        />
      )}
    </div>
  );
}

// Per-customer margin (markup on cost). Beaten only by manual prices and
// priority category rules; 0% = sell at cost. Also manageable on /admin/pricing.
function MarginCard({
  customerName,
  rule,
  busy,
  onSave,
  onToggle,
}: {
  customerName: string;
  rule: PricingRule | null;
  busy: boolean;
  onSave: (pct: number) => Promise<boolean>;
  onToggle: (rule: PricingRule) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(rule ? String(rule.marginPercent) : "");

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-brand-deep">Customer margin</h2>
          <p className="mt-0.5 text-xs text-muted">
            {customerName}&apos;s markup on cost. Manual prices and priority product/category
            rules still win. Changes re-price this customer&apos;s computed prices automatically.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {rule && !editing && (
            <>
              <span
                className={`font-mono text-lg font-semibold ${rule.isActive ? "text-brand-deep" : "text-muted line-through"}`}
              >
                cost + {rule.marginPercent}%
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => onToggle(rule)}
                className="text-xs font-medium text-muted hover:text-foreground disabled:opacity-50"
              >
                {rule.isActive ? "Turn off" : "Turn on"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setValue(String(rule.marginPercent));
                  setEditing(true);
                }}
                className="text-xs font-medium text-brand hover:text-accent"
              >
                Edit
              </button>
            </>
          )}
          {!rule && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-full border border-[var(--border-strong)] px-4 py-1.5 text-xs font-semibold text-foreground/80 hover:border-accent"
            >
              Set a margin
            </button>
          )}
          {editing && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="500"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="15"
                className="w-24 rounded-lg border border-[var(--border)] bg-background px-2 py-1.5 text-right font-mono text-sm"
                autoFocus
              />
              <span className="text-sm text-muted">%</span>
              <button
                type="button"
                disabled={busy || value.trim() === ""}
                onClick={async () => {
                  const ok = await onSave(parseFloat(value));
                  if (ok) setEditing(false);
                }}
                className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
              >
                Save
              </button>
              <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ActivationBadge({ activation }: { activation: Activation }) {
  const map = {
    none: { label: "Not invited", cls: "bg-zinc-100 text-zinc-500" },
    invited: { label: "Invited", cls: "bg-accent-soft text-accent-deep" },
    active: { label: "Active", cls: "bg-brand text-white" },
  } as const;
  const { label, cls } = map[activation];
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-surface p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1.5 text-sm font-medium text-foreground capitalize">{value}</p>
    </div>
  );
}

function CustomerProductRow({
  row,
  priced,
  pricing,
  categoryName,
  busy,
  selected,
  onToggleSelect,
  onSet,
  onRemove,
}: {
  row: AssignedProduct;
  priced?: { finalCents: number; discounted: boolean; originalCents: number; appliedTitle: string | null };
  pricing?: { costCents: number | null; profitCents: number | null; sourceChip: string };
  categoryName: string;
  busy: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onSet: (cents: number | null) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    row.priceCents != null ? (row.priceCents / 100).toFixed(2) : "",
  );

  const effective = row.priceCents ?? row.listPriceCents;
  const delta = row.priceCents != null ? effective - row.listPriceCents : 0;

  return (
    <tr
      className={`border-b border-[var(--border)] last:border-0 hover:bg-brand-mist/30 ${
        selected ? "bg-brand-mist/40" : ""
      }`}
    >
      <td className="px-6 py-3">
        <input
          type="checkbox"
          aria-label={`Select ${row.name}`}
          className="accent-accent"
          checked={selected}
          onChange={onToggleSelect}
        />
      </td>
      <td className="px-6 py-3">
        <p className="font-medium text-foreground">{row.name}</p>
        <p className="text-xs text-muted">
          {row.sku} · {row.unitSize}
          {!row.isActive && <span className="ml-2 text-red-700">(inactive)</span>}
        </p>
      </td>
      <td className="px-6 py-3 text-muted">{categoryName}</td>
      <td className="px-4 py-3 text-right font-mono text-muted">
        {pricing?.costCents != null ? formatMoney(pricing.costCents) : "—"}
      </td>
      <td className="px-4 py-3 text-right font-mono text-muted">{formatMoney(row.listPriceCents)}</td>
      <td className="px-4 py-3 text-right">
        {editing ? (
          <div className="inline-flex items-center gap-1">
            <span className="text-xs text-muted">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={(row.listPriceCents / 100).toFixed(2)}
              className="w-24 rounded-md border border-[var(--border)] bg-background px-2 py-1 text-right text-sm font-mono"
              autoFocus
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const cents = value.trim() === "" ? null : Math.round(parseFloat(value) * 100);
                onSet(cents);
                setEditing(false);
              }}
              className="text-xs font-medium text-brand hover:text-accent disabled:opacity-50"
            >
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted">
              Cancel
            </button>
          </div>
        ) : priced?.discounted ? (
          // An active in-window offer applies: show the discounted price the
          // customer actually pays (green) with the pre-offer price struck. Still
          // click-to-edit the underlying custom price.
          <button
            type="button"
            onClick={() => setEditing(true)}
            title={priced.appliedTitle ? `Offer: ${priced.appliedTitle}` : "Offer applied"}
            className="font-mono font-semibold hover:opacity-80"
          >
            <span className="text-emerald-700">{formatMoney(priced.finalCents)}</span>
            <span className="ml-2 text-xs font-normal text-muted line-through">
              {formatMoney(effective)}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="font-mono font-semibold text-foreground hover:text-accent"
          >
            {formatMoney(effective)}
            {row.priceCents != null && (
              <span
                className={`ml-2 text-[10px] font-medium uppercase tracking-wider ${
                  delta < 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {delta < 0 ? "↓" : "↑"} {formatMoney(Math.abs(delta))}
              </span>
            )}
          </button>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {pricing?.profitCents == null ? (
          <span
            className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800"
            title="No purchase cost recorded — rules can't compute a margin; list price is used"
          >
            No cost
          </span>
        ) : (
          <div>
            <p
              className={`font-mono font-semibold ${
                pricing.profitCents >= 0 ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {formatMoney(pricing.profitCents)}
            </p>
            {/* Which waterfall tier priced this row */}
            <p className="text-[10px] uppercase tracking-wider text-muted-soft">{pricing.sourceChip}</p>
            {/* Realized profit when an active offer discounts the price */}
            {priced?.discounted && pricing.costCents != null && (
              <p
                className={`text-[10px] ${
                  priced.finalCents - pricing.costCents < 0 ? "font-semibold text-red-700" : "text-amber-700"
                }`}
              >
                after offer: {formatMoney(priced.finalCents - pricing.costCents)}
                {priced.finalCents - pricing.costCents < 0 && " (below cost!)"}
              </p>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm(`Remove ${row.name} from this customer's catalog?`)) onRemove();
          }}
          aria-label="Remove"
          className="rounded p-1.5 text-muted-soft hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
        >
          <X size={14} />
        </button>
      </td>
    </tr>
  );
}

// Bulk pricing toolbar shown when ≥1 assigned product is selected. Builds a
// BulkPriceOp and hands it up; the effective price stays COALESCE(custom, list).
function BulkPriceBar({
  count,
  busy,
  onApply,
  onClear,
}: {
  count: number;
  busy: boolean;
  onApply: (op: BulkPriceOp) => void;
  onClear: () => void;
}) {
  const [kind, setKind] = useState<"set" | "percentOff" | "clear">("set");
  const [value, setValue] = useState("");

  function apply() {
    if (kind === "set") {
      const cents = Math.round(parseFloat(value) * 100);
      if (!Number.isFinite(cents) || cents < 0) {
        window.alert("Enter a valid price (0 or more).");
        return;
      }
      onApply({ kind: "set", priceCents: cents });
    } else if (kind === "percentOff") {
      const pct = parseFloat(value);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        window.alert("Enter a percent between 0 and 100.");
        return;
      }
      onApply({ kind: "percentOff", percent: pct });
    } else {
      onApply({ kind: "clear" });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-accent-soft/40 px-6 py-3">
      <span className="text-sm font-medium text-brand-deep">{count} selected</span>
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as typeof kind)}
        className="rounded-lg border border-[var(--border)] bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
      >
        <option value="set">Set flat price</option>
        <option value="percentOff">% off list</option>
        <option value="clear">Reprice by rules</option>
      </select>
      {kind !== "clear" && (
        <div className="inline-flex items-center gap-1">
          {kind === "set" && <span className="text-xs text-muted">$</span>}
          <input
            type="number"
            step={kind === "set" ? "0.01" : "1"}
            min="0"
            max={kind === "percentOff" ? "100" : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={kind === "set" ? "0.00" : "0"}
            className="w-24 rounded-md border border-[var(--border)] bg-background px-2 py-1 text-right text-sm font-mono"
          />
          {kind === "percentOff" && <span className="text-xs text-muted">%</span>}
        </div>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={apply}
        className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
      >
        Apply
      </button>
      <button
        type="button"
        onClick={onClear}
        className="text-sm font-medium text-muted hover:text-foreground"
      >
        Clear selection
      </button>
    </div>
  );
}

function fmtDate(iso: string | null | undefined): string | null {
  return iso ? iso.slice(0, 10) : null;
}

function OfferRow({
  offer: o,
  productName,
  templateName,
  busy,
  onEdit,
  onToggle,
  onDelete,
}: {
  offer: Offer;
  productName?: string;
  templateName?: string;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const start = fmtDate(o.startsAt);
  const end = fmtDate(o.endsAt);
  const window =
    start && end ? `${start} → ${end}` : start ? `From ${start}` : end ? `Until ${end}` : "Always";
  const discount = formatDiscount(o.discountKind, o.discountValue);

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-6 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">{o.title}</p>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              o.isActive ? "bg-brand/15 text-brand-deep" : "bg-zinc-200 text-zinc-600"
            }`}
          >
            {o.isActive ? "Active" : "Inactive"}
          </span>
          {discount && (
            <span className="inline-flex rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-deep">
              {discount}
            </span>
          )}
          {templateName && (
            <span className="inline-flex rounded-full bg-brand-mist px-2 py-0.5 text-[10px] font-medium text-brand-deep">
              From template: {templateName}
            </span>
          )}
        </div>
        {o.description && <p className="mt-1 text-sm text-muted">{o.description}</p>}
        <p className="mt-1.5 text-xs text-muted-soft">
          {window}
          {productName && <span> · {productName}</span>}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs font-medium">
        <button type="button" disabled={busy} onClick={onToggle} className="text-muted hover:text-foreground disabled:opacity-50">
          {o.isActive ? "Deactivate" : "Activate"}
        </button>
        <button type="button" onClick={onEdit} className="text-brand hover:text-accent">
          Edit
        </button>
        <button type="button" disabled={busy} onClick={onDelete} className="text-red-700 hover:text-red-900 disabled:opacity-50">
          Delete
        </button>
      </div>
    </li>
  );
}

function OfferModal({
  initial,
  products,
  onClose,
  onSave,
}: {
  initial: Offer | null;
  products: { id: string; name: string }[]; // the customer's ASSIGNED products
  onClose: () => void;
  onSave: (values: OfferInput) => void | Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [productId, setProductId] = useState<string>(initial?.productId ?? "");
  const [startsAt, setStartsAt] = useState(fmtDate(initial?.startsAt) ?? "");
  const [endsAt, setEndsAt] = useState(fmtDate(initial?.endsAt) ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [discountKind, setDiscountKind] = useState<OfferDiscountKind | null>(
    initial?.discountKind ?? null,
  );
  const [discountText, setDiscountText] = useState(
    discountValueToText(initial?.discountKind ?? null, initial?.discountValue),
  );
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const discountValue = parseDiscountValue(discountKind, discountText);
    if (discountKind && (discountValue == null || Number.isNaN(discountValue) || discountValue < 0)) {
      window.alert("Enter a valid discount amount, or set the discount type to None.");
      return;
    }
    if (discountKind === "percent" && discountValue != null && discountValue > 100) {
      window.alert("Percent off must be between 0 and 100.");
      return;
    }
    setSaving(true);
    await onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      productId: productId || null,
      startsAt: startsAt || null,
      endsAt: endsAt || null,
      isActive,
      discountKind,
      discountValue: discountKind ? discountValue : null,
    });
    setSaving(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-deep/40 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="my-10 w-full max-w-lg rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-2xl"
      >
        <h3 className="font-display text-xl font-semibold text-brand-deep">
          {initial ? "Edit offer" : "New offer"}
        </h3>
        <p className="mt-1 text-xs text-muted">
          Shown to this customer as an informational note. Leave dates blank for an always-on offer.
        </p>

        <div className="mt-5 space-y-4">
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputCls} placeholder="10% off seasonal produce" />
          </Field>
          <Field label="Description (optional)">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} />
          </Field>
          <Field label="Linked product (optional — this customer's assigned products)">
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls}>
              <option value="">— None (account-wide) —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
          <DiscountFields
            kind={discountKind}
            setKind={(k) => setDiscountKind(k)}
            valueText={discountText}
            setValueText={setDiscountText}
            allowNone
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts (optional)">
              <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Ends (optional)">
              <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active (visible to the customer)
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium text-foreground/80 hover:border-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
          >
            {saving ? "Saving…" : initial ? "Save changes" : "Create offer"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AddProductsPicker({
  unassigned,
  categories,
  categoryName,
  onClose,
  onAdd,
}: {
  unassigned: Product[];
  categories: Category[];
  categoryName: (catId: string | null) => string;
  onClose: () => void;
  onAdd: (productIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all"); // "all" | "none" | <id>

  // Only categories that actually have unassigned products are worth offering.
  const hasUncategorized = useMemo(
    () => unassigned.some((p) => !p.categoryId),
    [unassigned],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return unassigned.filter((p) => {
      const matchesQuery =
        q === "" ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q);
      const matchesCategory =
        categoryId === "all" ||
        (categoryId === "none" ? !p.categoryId : p.categoryId === categoryId);
      return matchesQuery && matchesCategory;
    });
  }, [unassigned, query, categoryId]);

  // Selection persists across search/filter changes (it's a Set of ids), so you
  // can search, select, search again, select more, then Add everything at once.
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((p) => next.delete(p.id));
      else filtered.forEach((p) => next.add(p.id));
      return next;
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-deep/40 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="my-10 w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-2xl"
      >
        <h3 className="font-display text-xl font-semibold text-brand-deep">
          Add products to catalog
        </h3>
        <p className="mt-1 text-xs text-muted">
          Search and filter, then select many at once. They&apos;ll start at the list price — set customer-specific prices after.
        </p>

        {unassigned.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-muted">
            All active products are already assigned.
          </p>
        ) : (
          <>
            {/* Search + category filter */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[180px] flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-soft" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or SKU"
                  className="w-full rounded-lg border border-[var(--border)] bg-background py-2 pl-9 pr-3 text-sm focus:border-accent focus:outline-none"
                />
              </div>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-background px-2.5 py-2 text-sm focus:border-accent focus:outline-none"
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                {hasUncategorized && <option value="none">Uncategorized</option>}
              </select>
            </div>

            {/* Select-all-filtered row */}
            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={allFilteredSelected}
                  onChange={toggleSelectFiltered}
                  disabled={filtered.length === 0}
                />
                Select all {filtered.length > 0 ? `(${filtered.length})` : ""}
              </label>
              <span>{selected.size} selected</span>
            </div>

            <div className="mt-2 max-h-[360px] overflow-y-auto rounded-xl border border-[var(--border)]">
              {filtered.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted">
                  No products match your search or filter.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {filtered.map((p) => (
                    <li key={p.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-brand-mist/30">
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggle(p.id)}
                          className="accent-accent"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{p.name}</p>
                          <p className="text-xs text-muted">
                            {p.sku} · {p.unitSize} · {categoryName(p.categoryId)}
                          </p>
                        </div>
                        <span className="font-mono text-sm text-muted">{formatMoney(p.listPriceCents)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium text-foreground/80 hover:border-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={() => onAdd(Array.from(selected))}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
          >
            Add {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
      <span className="uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}
