"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useAdmin, formatMoney } from "@/lib/admin/store";
import type { Product, ProductUnit } from "@/lib/admin/types";

const UNITS: ProductUnit[] = ["case", "bag", "lb", "kg", "gal", "L", "ea", "box"];

export function ProductsClient() {
  const { state, dispatch, hydrated } = useAdmin();
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  const catLookup = useMemo(
    () => Object.fromEntries(state.categories.map((c) => [c.id, c.name])),
    [state.categories]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.products.filter((p) => {
      if (activeCat !== "all" && p.categoryId !== activeCat) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (catLookup[p.categoryId] ?? "").toLowerCase().includes(q)
      );
    });
  }, [state.products, query, activeCat, catLookup]);

  if (!hydrated) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-soft" />
          <input
            type="text"
            placeholder="Search products, SKUs…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-full border border-[var(--border)] bg-surface py-2 pl-9 pr-4 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <select
          value={activeCat}
          onChange={(e) => setActiveCat(e.target.value)}
          className="rounded-full border border-[var(--border)] bg-surface px-4 py-2 text-sm"
        >
          <option value="all">All categories</option>
          {state.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(200,122,42,0.6)] hover:bg-accent-deep"
        >
          <Plus size={14} /> Add product
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-brand-mist/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3 text-right">List price</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
                  No products match.
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-[var(--border)] last:border-0 hover:bg-brand-mist/30">
                <td className="px-4 py-3 font-mono text-xs text-muted">{p.sku}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{p.name}</p>
                  {p.description && (
                    <p className="text-xs text-muted">{p.description}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{catLookup[p.categoryId] ?? "—"}</td>
                <td className="px-4 py-3 text-muted">
                  {p.unitSize} <span className="text-muted-soft">/ {p.unit}</span>
                </td>
                <td className="px-4 py-3 text-right font-mono">{formatMoney(p.listPriceCents)}</td>
                <td className="px-4 py-3">
                  {p.isActive ? (
                    <span className="inline-flex rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-deep">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setEditing(p)}
                    className="text-xs font-medium text-brand hover:text-accent"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {(creating || editing) && (
        <ProductFormModal
          initial={editing}
          categories={state.categories}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={(values) => {
            if (editing) {
              dispatch({ type: "product/update", id: editing.id, patch: values });
            } else {
              dispatch({
                type: "product/add",
                input: { ...values, isActive: values.isActive ?? true },
              });
            }
            setCreating(false);
            setEditing(null);
          }}
          onDelete={
            editing
              ? () => {
                  if (window.confirm(`Delete "${editing.name}"? Removes from all customer catalogs.`)) {
                    dispatch({ type: "product/delete", id: editing.id });
                    setEditing(null);
                  }
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function ProductFormModal({
  initial,
  categories,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Product | null;
  categories: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSave: (values: Omit<Product, "id" | "createdAt">) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? "");
  const [unit, setUnit] = useState<ProductUnit>(initial?.unit ?? "case");
  const [unitSize, setUnitSize] = useState(initial?.unitSize ?? "");
  const [listPriceDollars, setListPriceDollars] = useState(
    initial ? (initial.listPriceCents / 100).toFixed(2) : ""
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.max(0, Math.round(parseFloat(listPriceDollars || "0") * 100));
    onSave({
      sku: sku.trim(),
      name: name.trim(),
      description: description.trim() || undefined,
      categoryId,
      unit,
      unitSize: unitSize.trim(),
      listPriceCents: cents,
      isActive,
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-deep/40 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="my-10 w-full max-w-xl rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-2xl"
      >
        <h3 className="font-display text-xl font-semibold text-brand-deep">
          {initial ? "Edit product" : "New product"}
        </h3>
        <p className="mt-1 text-xs text-muted">All fields except description are required.</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="SKU">
            <input value={sku} onChange={(e) => setSku(e.target.value)} required className={inputCls} placeholder="PRD-005" />
          </Field>
          <Field label="Category">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Name" full>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} placeholder="Vine-Ripe Tomatoes" />
          </Field>
          <Field label="Description (optional)" full>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls} />
          </Field>
          <Field label="Unit">
            <select value={unit} onChange={(e) => setUnit(e.target.value as ProductUnit)} className={inputCls}>
              {UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </Field>
          <Field label="Size">
            <input value={unitSize} onChange={(e) => setUnitSize(e.target.value)} required className={inputCls} placeholder="25 lb" />
          </Field>
          <Field label="List price ($)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={listPriceDollars}
              onChange={(e) => setListPriceDollars(e.target.value)}
              required
              className={inputCls}
            />
          </Field>
          <Field label="Status">
            <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Active (visible to assigned customers)
            </label>
          </Field>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="text-xs font-medium text-red-700 hover:text-red-900"
            >
              Delete product
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium text-foreground/80 hover:border-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep"
            >
              {initial ? "Save changes" : "Create product"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1.5 text-xs font-medium text-muted ${full ? "sm:col-span-2" : ""}`}>
      <span className="uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}
