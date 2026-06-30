"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Pencil, Plus, X, RotateCcw, Copy, Search } from "lucide-react";
import { formatMoney } from "@/lib/admin/store";
import type { Category, Offer, Product } from "@/lib/admin/types";
import type { AssignedProduct, CustomerDetail, Activation } from "@/lib/admin/customers-data";
import { CustomerFormModal } from "../customers-client";
import { InviteControls } from "../invite-controls";
import { OnboardingChecklist } from "./onboarding-checklist";
import { CopyCatalogModal } from "./copy-catalog-modal";
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

export function CustomerDetailClient({
  detail,
  allProducts,
  categories,
  activation,
  copySources,
  live,
}: {
  detail: CustomerDetail;
  allProducts: Product[];
  categories: Category[];
  activation: Activation;
  copySources: CopySource[];
  live: boolean;
}) {
  const { customer, assigned, offers } = detail;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [addProductPickerOpen, setAddProductPickerOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
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
              Only these products are visible to this customer in their portal. Override pricing per product as needed.
            </p>
          </div>
          <div className="flex items-center gap-2">
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
                <th className="px-6 py-3 text-right">List price</th>
                <th className="px-6 py-3 text-right">Customer price</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {assigned.map((a) => (
                <CustomerProductRow
                  key={a.productId}
                  row={a}
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
          <button
            type="button"
            onClick={() => setOfferModal({ open: true, offer: null })}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(200,122,42,0.6)] hover:bg-accent-deep"
          >
            <Plus size={14} /> Add offer
          </button>
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
          products={allProducts.filter((p) => p.isActive)}
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
    </div>
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
  categoryName,
  busy,
  selected,
  onToggleSelect,
  onSet,
  onRemove,
}: {
  row: AssignedProduct;
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
      <td className="px-6 py-3 text-right font-mono text-muted">{formatMoney(row.listPriceCents)}</td>
      <td className="px-6 py-3 text-right">
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
      <td className="px-6 py-3 text-right">
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
        <option value="clear">Clear custom price</option>
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
  busy,
  onEdit,
  onToggle,
  onDelete,
}: {
  offer: Offer;
  productName?: string;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const start = fmtDate(o.startsAt);
  const end = fmtDate(o.endsAt);
  const window =
    start && end ? `${start} → ${end}` : start ? `From ${start}` : end ? `Until ${end}` : "Always";

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-6 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-foreground">{o.title}</p>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              o.isActive ? "bg-brand/15 text-brand-deep" : "bg-zinc-200 text-zinc-600"
            }`}
          >
            {o.isActive ? "Active" : "Inactive"}
          </span>
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
  products: Product[];
  onClose: () => void;
  onSave: (values: OfferInput) => void | Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [productId, setProductId] = useState<string>(initial?.productId ?? "");
  const [startsAt, setStartsAt] = useState(fmtDate(initial?.startsAt) ?? "");
  const [endsAt, setEndsAt] = useState(fmtDate(initial?.endsAt) ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      productId: productId || null,
      startsAt: startsAt || null,
      endsAt: endsAt || null,
      isActive,
      // discountKind/discountValue intentionally omitted — informational phase.
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
          <Field label="Linked product (optional)">
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls}>
              <option value="">— None (account-wide) —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
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
