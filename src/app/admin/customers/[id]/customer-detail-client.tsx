"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Pencil, Plus, X, RotateCcw, Mail, Check } from "lucide-react";
import { formatMoney } from "@/lib/admin/store";
import type { Category, Offer, Product } from "@/lib/admin/types";
import type { AssignedProduct, CustomerDetail } from "@/lib/admin/customers-data";
import { CustomerFormModal } from "../customers-client";
import {
  updateCustomer,
  archiveCustomer,
  restoreCustomer,
  assignProducts,
  setCustomerProductPrice,
  removeCustomerProduct,
  createOffer,
  updateOffer,
  deleteOffer,
  toggleOfferActive,
  inviteCustomerToPortal,
  type CustomerInput,
  type OfferInput,
} from "../actions";

export function CustomerDetailClient({
  detail,
  allProducts,
  categories,
  live,
}: {
  detail: CustomerDetail;
  allProducts: Product[];
  categories: Category[];
  live: boolean;
}) {
  const { customer, assigned, offers } = detail;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [addProductPickerOpen, setAddProductPickerOpen] = useState(false);
  const [offerModal, setOfferModal] = useState<{ open: boolean; offer: Offer | null }>({
    open: false,
    offer: null,
  });
  const [busy, setBusy] = useState(false);
  const [inviting, setInviting] = useState(false);

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

  async function handleInvite() {
    setInviting(true);
    const result = await inviteCustomerToPortal(customer.id);
    setInviting(false);
    window.alert(result.message);
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
            <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
              {customer.businessName}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {customer.contactName} · {customer.email} · {customer.phone}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInvite}
              disabled={inviting || isArchived}
              title={
                customer.userId
                  ? "Re-send the set-password email"
                  : "Create a portal login and email a set-password link"
              }
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-surface px-4 py-2 text-sm font-medium text-foreground/80 hover:border-accent hover:text-accent-deep disabled:opacity-50"
            >
              {customer.userId ? <Check size={14} /> : <Mail size={14} />}
              {inviting
                ? "Sending…"
                : customer.userId
                  ? "Invited · Resend"
                  : "Invite to portal"}
            </button>
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
          <button
            type="button"
            onClick={() => setAddProductPickerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(200,122,42,0.6)] hover:bg-accent-deep"
          >
            <Plus size={14} /> Add product
          </button>
        </header>

        {assigned.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted">
            No products assigned yet. This customer can&apos;t see anything in their portal.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-brand-mist/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
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
          categoryName={(id) => (id ? catById[id] : undefined) ?? "—"}
          onClose={() => setAddProductPickerOpen(false)}
          onAdd={async (productIds) => {
            const ok = await run(() => assignProducts(customer.id, productIds));
            if (ok) setAddProductPickerOpen(false);
          }}
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
  onSet,
  onRemove,
}: {
  row: AssignedProduct;
  categoryName: string;
  busy: boolean;
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
    <tr className="border-b border-[var(--border)] last:border-0 hover:bg-brand-mist/30">
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
  categoryName,
  onClose,
  onAdd,
}: {
  unassigned: Product[];
  categoryName: (catId: string | null) => string;
  onClose: () => void;
  onAdd: (productIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
          Pick products to make visible to this customer. They&apos;ll start at the list price — set a customer-specific price after.
        </p>

        <div className="mt-5 max-h-[400px] overflow-y-auto rounded-xl border border-[var(--border)]">
          {unassigned.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">
              All active products are already assigned.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {unassigned.map((p) => (
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
