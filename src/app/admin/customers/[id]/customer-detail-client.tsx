"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Pencil, Plus, X } from "lucide-react";
import { useAdmin, formatMoney } from "@/lib/admin/store";
import { CustomerFormModal } from "../customers-client";

export function CustomerDetailClient({ customerId }: { customerId: string }) {
  const { state, dispatch, hydrated } = useAdmin();
  const [editing, setEditing] = useState(false);
  const [addProductPickerOpen, setAddProductPickerOpen] = useState(false);

  const customer = state.customers.find((c) => c.id === customerId);

  const assignedRows = useMemo(
    () =>
      state.customerProducts.filter((cp) => cp.customerId === customerId),
    [state.customerProducts, customerId]
  );

  const assignedIds = useMemo(
    () => new Set(assignedRows.map((cp) => cp.productId)),
    [assignedRows]
  );

  const unassigned = useMemo(
    () => state.products.filter((p) => !assignedIds.has(p.id) && p.isActive),
    [state.products, assignedIds]
  );

  if (!hydrated) return <p className="text-sm text-muted">Loading…</p>;
  if (!customer) {
    return (
      <div>
        <Link href="/admin/customers" className="text-sm text-brand hover:text-accent">
          ← All customers
        </Link>
        <p className="mt-6 rounded-2xl border border-dashed border-[var(--border)] bg-surface p-10 text-center text-sm text-muted">
          Customer not found. May have been deleted.
        </p>
      </div>
    );
  }

  const productById = Object.fromEntries(state.products.map((p) => [p.id, p]));
  const catById = Object.fromEntries(state.categories.map((c) => [c.id, c]));

  return (
    <div className="space-y-8">
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
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-surface px-4 py-2 text-sm font-medium text-foreground/80 hover:border-accent hover:text-accent-deep"
          >
            <Pencil size={14} /> Edit account
          </button>
        </div>
      </div>

      {/* Quick info cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <InfoCard label="Status" value={customer.status} />
        <InfoCard label="Payment terms" value={customer.paymentTerms} />
        <InfoCard label="Catalog size" value={`${assignedRows.length} products`} />
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

        {assignedRows.length === 0 ? (
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
              {assignedRows.map((cp) => {
                const p = productById[cp.productId];
                if (!p) return null;
                return (
                  <CustomerProductRow
                    key={cp.productId}
                    productName={p.name}
                    sku={p.sku}
                    unitSize={p.unitSize}
                    categoryName={catById[p.categoryId]?.name ?? "—"}
                    listPriceCents={p.listPriceCents}
                    customerPriceCents={cp.priceCents}
                    onSet={(cents) =>
                      dispatch({
                        type: "customerProduct/upsert",
                        row: { customerId, productId: p.id, priceCents: cents },
                      })
                    }
                    onRemove={() =>
                      dispatch({
                        type: "customerProduct/remove",
                        customerId,
                        productId: p.id,
                      })
                    }
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Modals */}
      {editing && (
        <CustomerFormModal
          initial={customer}
          onClose={() => setEditing(false)}
          onSave={(values) => {
            dispatch({ type: "customer/update", id: customer.id, patch: values });
            setEditing(false);
          }}
          onDelete={() => {
            if (window.confirm(`Delete "${customer.businessName}"? Removes their catalog assignments too.`)) {
              dispatch({ type: "customer/delete", id: customer.id });
              window.location.href = "/admin/customers";
            }
          }}
        />
      )}

      {addProductPickerOpen && (
        <AddProductsPicker
          unassigned={unassigned}
          categoryName={(id) => catById[id]?.name ?? "—"}
          onClose={() => setAddProductPickerOpen(false)}
          onAdd={(productIds) => {
            for (const pid of productIds) {
              dispatch({
                type: "customerProduct/upsert",
                row: { customerId, productId: pid, priceCents: null },
              });
            }
            setAddProductPickerOpen(false);
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
  productName,
  sku,
  unitSize,
  categoryName,
  listPriceCents,
  customerPriceCents,
  onSet,
  onRemove,
}: {
  productName: string;
  sku: string;
  unitSize: string;
  categoryName: string;
  listPriceCents: number;
  customerPriceCents: number | null;
  onSet: (cents: number | null) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    customerPriceCents != null ? (customerPriceCents / 100).toFixed(2) : ""
  );

  const effective = customerPriceCents ?? listPriceCents;
  const delta = customerPriceCents != null ? effective - listPriceCents : 0;

  return (
    <tr className="border-b border-[var(--border)] last:border-0 hover:bg-brand-mist/30">
      <td className="px-6 py-3">
        <p className="font-medium text-foreground">{productName}</p>
        <p className="text-xs text-muted">
          {sku} · {unitSize}
        </p>
      </td>
      <td className="px-6 py-3 text-muted">{categoryName}</td>
      <td className="px-6 py-3 text-right font-mono text-muted">{formatMoney(listPriceCents)}</td>
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
              placeholder={(listPriceCents / 100).toFixed(2)}
              className="w-24 rounded-md border border-[var(--border)] bg-background px-2 py-1 text-right text-sm font-mono"
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                const cents = value.trim() === "" ? null : Math.round(parseFloat(value) * 100);
                onSet(cents);
                setEditing(false);
              }}
              className="text-xs font-medium text-brand hover:text-accent"
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
            {customerPriceCents != null && (
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
          onClick={() => {
            if (window.confirm(`Remove ${productName} from this customer's catalog?`)) {
              onRemove();
            }
          }}
          aria-label="Remove"
          className="rounded p-1.5 text-muted-soft hover:bg-red-50 hover:text-red-700"
        >
          <X size={14} />
        </button>
      </td>
    </tr>
  );
}

function AddProductsPicker({
  unassigned,
  categoryName,
  onClose,
  onAdd,
}: {
  unassigned: Array<{ id: string; sku: string; name: string; unitSize: string; categoryId: string; listPriceCents: number }>;
  categoryName: (catId: string) => string;
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
