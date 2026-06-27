"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Plus, Search, ImagePlus } from "lucide-react";
import { formatMoney } from "@/lib/admin/store";
import type { Category, Product, ProductUnit } from "@/lib/admin/types";
import {
  createProduct,
  updateProduct,
  deactivateProduct,
  uploadProductImageAction,
  type ProductInput,
} from "./actions";

const UNITS: ProductUnit[] = ["case", "bag", "lb", "kg", "gal", "L", "ea", "box"];

export function ProductsClient({
  products,
  categories,
  live,
}: {
  products: Product[];
  categories: Category[];
  live: boolean;
}) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const catLookup = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCat !== "all" && p.categoryId !== activeCat) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.categoryId ? (catLookup[p.categoryId] ?? "") : "").toLowerCase().includes(q)
      );
    });
  }, [products, query, activeCat, catLookup]);

  function openCreate() {
    setFormError(null);
    setCreating(true);
  }
  function openEdit(p: Product) {
    setFormError(null);
    setEditing(p);
  }
  function closeModal() {
    setCreating(false);
    setEditing(null);
    setFormError(null);
  }

  async function handleSave(values: ProductInput) {
    setSaving(true);
    setFormError(null);
    const result = editing
      ? await updateProduct(editing.id, values)
      : await createProduct(values);
    setSaving(false);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    closeModal();
  }

  async function handleDeactivate(id: string) {
    setSaving(true);
    setFormError(null);
    const result = await deactivateProduct(id);
    setSaving(false);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    closeModal();
  }

  return (
    <div className="space-y-5">
      {!live && (
        <p className="rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          Showing demo seed data — Supabase isn&apos;t configured, so changes
          won&apos;t persist.
        </p>
      )}

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
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={openCreate}
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
                <td className="px-4 py-3 text-muted">{p.categoryId ? (catLookup[p.categoryId] ?? "—") : "—"}</td>
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
                    onClick={() => openEdit(p)}
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
          categories={categories}
          saving={saving}
          error={formError}
          onClose={closeModal}
          onSave={handleSave}
          onDeactivate={
            editing && editing.isActive
              ? () => {
                  if (window.confirm(`Deactivate "${editing.name}"? It will be hidden from customers; their pricing is kept.`)) {
                    handleDeactivate(editing.id);
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
  saving,
  error,
  onClose,
  onSave,
  onDeactivate,
}: {
  initial: Product | null;
  categories: Category[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (values: ProductInput) => void;
  onDeactivate?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState<string>(
    initial?.categoryId ?? categories[0]?.id ?? "",
  );
  const [unit, setUnit] = useState<ProductUnit>(initial?.unit ?? "case");
  const [unitSize, setUnitSize] = useState(initial?.unitSize ?? "");
  const [listPriceDollars, setListPriceDollars] = useState(
    initial ? (initial.listPriceCents / 100).toFixed(2) : "",
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file after an error
    if (!file) return;

    // Friendly client-side pre-checks; the server action re-validates both.
    if (!ACCEPTED.includes(file.type)) {
      setUploadError("Please use a JPG, PNG, or WebP file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image is too large. Maximum size is 5 MB.");
      return;
    }

    setUploadError(null);
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadProductImageAction(fd);
    setUploading(false);
    if (!result.ok) {
      setUploadError(result.message);
      return;
    }
    setImageUrl(result.url);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.max(0, Math.round(parseFloat(listPriceDollars || "0") * 100));
    onSave({
      sku: sku.trim(),
      name: name.trim(),
      description: description.trim() || undefined,
      categoryId: categoryId || null,
      unit,
      unitSize: unitSize.trim(),
      listPriceCents: cents,
      isActive,
      imageUrl,
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

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="SKU">
            <input value={sku} onChange={(e) => setSku(e.target.value)} required className={inputCls} placeholder="PRD-005" />
          </Field>
          <Field label="Category">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
              <option value="">Uncategorized</option>
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

          {/* Product photo — not wrapped in <Field> because that renders a
              <label>, and the file picker + buttons here are their own controls. */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted">
              Product photo (optional)
            </span>
            <div className="flex items-center gap-4">
              {imageUrl ? (
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-background">
                  <Image src={imageUrl} alt="Product photo" fill sizes="96px" className="object-cover" />
                </div>
              ) : (
                <div className="grid h-24 w-24 shrink-0 place-items-center rounded-lg border border-dashed border-[var(--border-strong)] bg-background text-muted-soft">
                  <ImagePlus size={20} />
                </div>
              )}
              <div className="flex flex-col items-start gap-2">
                <label
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:border-accent ${
                    uploading || saving ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFile}
                    disabled={uploading || saving}
                    className="hidden"
                  />
                  {uploading ? "Uploading…" : imageUrl ? "Replace photo" : "Upload photo"}
                </label>
                {imageUrl && !uploading && (
                  <button
                    type="button"
                    onClick={() => setImageUrl(null)}
                    className="text-xs font-medium text-red-700 hover:text-red-900"
                  >
                    Remove photo
                  </button>
                )}
                <span className="text-[11px] text-muted-soft">JPG, PNG, or WebP · up to 5 MB</span>
              </div>
            </div>
            {uploadError && <p className="text-xs text-red-700">{uploadError}</p>}
          </div>

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
          {onDeactivate ? (
            <button
              type="button"
              onClick={onDeactivate}
              disabled={saving}
              className="text-xs font-medium text-red-700 hover:text-red-900 disabled:opacity-50"
            >
              Deactivate product
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
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
              disabled={saving || uploading}
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
            >
              {saving ? "Saving…" : initial ? "Save changes" : "Create product"}
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
