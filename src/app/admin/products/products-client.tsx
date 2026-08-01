"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Plus, Search, ImagePlus, AlertTriangle } from "lucide-react";
import { formatMoney } from "@/lib/admin/store";
import type { Category, Product, ProductUnit } from "@/lib/admin/types";
import {
  createProduct,
  updateProduct,
  deactivateProduct,
  uploadProductImageAction,
  setProductInventory,
  receiveStock,
  type ProductInput,
} from "./actions";
import { setProductCost } from "../pricing/actions";
import { profitOnCost, saleFromCostAndMargin } from "@/lib/admin/pricing-engine";
import type { ProductStock } from "@/lib/admin/inventory-data";

const UNITS: ProductUnit[] = ["case", "bag", "lb", "kg", "gal", "L", "ea", "box"];

// CP-3b: a tracked product is "low" when stock has fallen to (or under) its
// alert level. Untracked products (no inventory row) never alert.
function isLowStock(s: ProductStock | undefined): boolean {
  return s != null && s.stockQty <= s.lowStockThreshold;
}

// CP-3e: stock edits are TWO explicit operations — receiving a shipment ADDS
// (and settles a deficit); a physical recount REPLACES. The modal returns one
// of these (or null when stock is untouched).
export type StockOp =
  | { kind: "receive"; qty: number; lowStockThreshold: number }
  | { kind: "set"; stockQty: number | null; lowStockThreshold: number }
  | null;

export function ProductsClient({
  products,
  categories,
  costs,
  live,
  stock,
  inventoryEnabled,
  initialLowStockOnly,
}: {
  products: Product[];
  categories: Category[];
  costs: Record<string, number>; // productId -> cost_cents (admin-only data)
  live: boolean;
  stock: Record<string, ProductStock>; // productId -> tracked stock (admin-only data)
  inventoryEnabled: boolean; // false until migration 0010 runs
  initialLowStockOnly: boolean; // deep link from the dashboard low-stock card
}) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  // "missing" narrows the list to ACTIVE products with no cost recorded — the
  // one thing that silently blocks margins and profit from working.
  const [costFilter, setCostFilter] = useState<"all" | "missing">("all");
  // CP-3b: narrows to ACTIVE tracked products at/below their alert level.
  const [lowStockOnly, setLowStockOnly] = useState(initialLowStockOnly);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const catLookup = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  // Inactive products are ignored: they're hidden from customers anyway.
  const missingCostCount = useMemo(
    () => products.filter((p) => p.isActive && costs[p.id] == null).length,
    [products, costs],
  );
  const lowStockCount = useMemo(
    () => products.filter((p) => p.isActive && isLowStock(stock[p.id])).length,
    [products, stock],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCat !== "all" && p.categoryId !== activeCat) return false;
      if (costFilter === "missing" && !(p.isActive && costs[p.id] == null)) return false;
      if (lowStockOnly && !(p.isActive && isLowStock(stock[p.id]))) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.categoryId ? (catLookup[p.categoryId] ?? "") : "").toLowerCase().includes(q)
      );
    });
  }, [products, query, activeCat, costFilter, costs, lowStockOnly, stock, catLookup]);

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

  async function handleSave(
    values: ProductInput,
    costCents: number | null,
    stockOp: StockOp, // null = stock untouched
  ) {
    setSaving(true);
    setFormError(null);
    let productId = editing?.id ?? null;
    let swept = 0; // CP-1 autopilot: prices auto-updated by this save
    let warning: string | undefined;
    if (editing) {
      const result = await updateProduct(editing.id, values);
      if (!result.ok) {
        setSaving(false);
        setFormError(result.message);
        return;
      }
      swept += result.updated ?? 0;
      warning = result.warning;
    } else {
      const result = await createProduct(values);
      if (!result.ok) {
        setSaving(false);
        setFormError(result.message);
        return;
      }
      productId = result.id;
    }
    // Cost lives in the admin-only product_costs table (never on products).
    if (productId && costCents !== (editing ? (costs[editing.id] ?? null) : null)) {
      const costResult = await setProductCost(productId, costCents);
      if (!costResult.ok) {
        setSaving(false);
        setFormError(`Product saved, but the cost was not: ${costResult.message}`);
        return;
      }
      swept += costResult.updated ?? 0;
      warning = warning ?? costResult.warning;
    }
    // CP-3b/3e: tracked stock lives in the admin-only product_inventory table
    // (never on products; the portal only ever sees is_available). Receive
    // ADDS and settles deficits; set-count REPLACES (recount only).
    let stockNotice: string | null = null;
    if (productId && stockOp) {
      if (stockOp.kind === "receive") {
        const r = await receiveStock(productId, stockOp.qty, stockOp.lowStockThreshold);
        if (!r.ok) {
          setSaving(false);
          setFormError(`Product saved, but the stock was not: ${r.message}`);
          return;
        }
        if (r.settledUnits > 0) {
          const who = r.oversold.reliable
            ? r.oversold.orders
                .map(
                  (o) =>
                    `#${o.orderId.slice(0, 8)} ${o.businessName} (${o.shortUnits} unit${o.shortUnits === 1 ? "" : "s"}${o.partiallyCovered ? ", partial" : ""})`,
                )
                .join(", ")
            : null;
          stockNotice =
            `Received ${stockOp.qty}: ${r.settledUnits} settled the deficit, ${r.availableNow} now genuinely available (stock ${r.oldStock} → ${r.newStock}).` +
            (who
              ? ` Goods arrived for oversold order${r.oversold.orders.length === 1 ? "" : "s"}: ${who} — call them.`
              : " The deficit couldn't be attributed to specific open orders (it includes manual edits or completed orders) — unit totals only.");
        } else {
          stockNotice = `Received ${stockOp.qty} — stock ${r.oldStock} → ${r.newStock}.`;
        }
      } else {
        const stockResult = await setProductInventory(
          productId,
          stockOp.stockQty,
          stockOp.lowStockThreshold,
        );
        if (!stockResult.ok) {
          setSaving(false);
          setFormError(`Product saved, but the stock was not: ${stockResult.message}`);
          return;
        }
      }
    }
    setSaving(false);
    const base =
      warning ??
      (swept > 0
        ? `Saved — ${swept} customer price${swept === 1 ? "" : "s"} updated automatically.`
        : "Saved.");
    setNotice(stockNotice ? `${base} ${stockNotice}` : base);
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

      {notice && (
        <p
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 font-semibold hover:underline"
          >
            Dismiss
          </button>
        </p>
      )}

      {/* Missing-cost banner: without a cost, margin rules can't price a product
          and its profit can't be calculated. Disappears once every active
          product has a cost. */}
      {missingCostCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          <span>
            <span className="font-semibold">
              {missingCostCount} active product{missingCostCount === 1 ? "" : "s"}
            </span>{" "}
            {missingCostCount === 1 ? "has" : "have"} no purchase cost — margin rules can&apos;t
            price {missingCostCount === 1 ? "it" : "them"} and {missingCostCount === 1 ? "its" : "their"}{" "}
            profit shows as &quot;—&quot;.
          </span>
          <button
            type="button"
            onClick={() => setCostFilter(costFilter === "missing" ? "all" : "missing")}
            className="shrink-0 rounded-full border border-amber-300 bg-white/70 px-3 py-1 font-semibold text-amber-900 hover:border-amber-500"
          >
            {costFilter === "missing" ? "Show all products" : "Show only these"}
          </button>
        </div>
      )}

      {/* CP-3b low-stock banner (tracked, active products at/below their alert
          level). Mirrors the missing-cost banner; also honours the dashboard's
          ?stock=low deep link. */}
      {(lowStockCount > 0 || lowStockOnly) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          <span>
            <span className="font-semibold">
              {lowStockCount} tracked product{lowStockCount === 1 ? "" : "s"}
            </span>{" "}
            {lowStockCount === 1 ? "is" : "are"} at or below the low-stock alert level.
          </span>
          <button
            type="button"
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className="shrink-0 rounded-full border border-amber-300 bg-white/70 px-3 py-1 font-semibold text-amber-900 hover:border-amber-500"
          >
            {lowStockOnly ? "Show all products" : "Show only these"}
          </button>
        </div>
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
              <th className="px-4 py-3 text-right">Cost</th>
              <th className="px-4 py-3 text-right">List price</th>
              <th className="px-4 py-3 text-right">Profit @ list</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted">
                  No products match.
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const cost = costs[p.id] ?? null;
              const profitAtList = cost != null ? p.listPriceCents - cost : null;
              const s = stock[p.id];
              return (
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
                <td className="px-4 py-3 text-right font-mono text-muted" title={cost == null ? "No cost set — edit the product to add one" : undefined}>
                  {cost != null ? formatMoney(cost) : "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono">{formatMoney(p.listPriceCents)}</td>
                <td
                  className={`px-4 py-3 text-right font-mono ${
                    profitAtList == null
                      ? "text-muted-soft"
                      : profitAtList >= 0
                        ? "text-emerald-700"
                        : "text-red-700"
                  }`}
                >
                  {profitAtList != null ? formatMoney(profitAtList) : "—"}
                </td>
                {/* CP-3b: tracked stock (admin-only; customers only ever see
                    the is_available boolean). "—" = not tracked. CP-3c: stock
                    is SIGNED — negative renders as "Oversold by N" (units
                    owed), the most severe state. */}
                <td
                  className="px-4 py-3 text-right font-mono"
                  title={s == null ? "Not tracked — edit the product to track stock" : `Alert at ${s.lowStockThreshold}`}
                >
                  {s == null ? (
                    <span className="text-muted-soft">—</span>
                  ) : s.stockQty < 0 ? (
                    <span className="font-semibold text-red-700">
                      {s.stockQty}
                      <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-wider text-red-800">
                        Oversold by {-s.stockQty}
                      </span>
                    </span>
                  ) : (
                    <span
                      className={
                        s.stockQty === 0
                          ? "font-semibold text-red-700"
                          : isLowStock(s)
                            ? "font-semibold text-amber-700"
                            : "text-foreground"
                      }
                    >
                      {s.stockQty}
                      {isLowStock(s) && (
                        <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-wider text-amber-800">
                          {s.stockQty === 0 ? "out" : "low"}
                        </span>
                      )}
                    </span>
                  )}
                </td>
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
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {(creating || editing) && (
        <ProductFormModal
          initial={editing}
          initialCostCents={editing ? (costs[editing.id] ?? null) : null}
          initialStock={editing ? (stock[editing.id] ?? null) : null}
          inventoryEnabled={inventoryEnabled}
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
  initialCostCents,
  initialStock,
  inventoryEnabled,
  categories,
  saving,
  error,
  onClose,
  onSave,
  onDeactivate,
}: {
  initial: Product | null;
  initialCostCents: number | null;
  initialStock: ProductStock | null;
  inventoryEnabled: boolean;
  categories: Category[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (values: ProductInput, costCents: number | null, stockOp: StockOp) => void;
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
  const [costDollars, setCostDollars] = useState(
    initialCostCents != null ? (initialCostCents / 100).toFixed(2) : "",
  );
  const [marginPct, setMarginPct] = useState("");
  // CP-3e: stock edits are TWO explicit operations. Tracked products default
  // to RECEIVE (a shipment arrived → ADD; the 90% case, settles deficits);
  // SET COUNT (physical recount → REPLACE) is the deliberate secondary path.
  // Untracked products only have "set" (nothing to add to yet); blank = stay
  // untracked.
  const tracked = initialStock != null;
  const [stockMode, setStockMode] = useState<"receive" | "set">(tracked ? "receive" : "set");
  const [receiveQtyStr, setReceiveQtyStr] = useState("");
  const [stockQtyStr, setStockQtyStr] = useState(
    initialStock != null ? String(initialStock.stockQty) : "",
  );
  const [thresholdStr, setThresholdStr] = useState(
    initialStock != null ? String(initialStock.lowStockThreshold) : "",
  );

  // CP-1 margin helper — all display math via the domain helpers, cents only.
  const costCentsLive =
    costDollars.trim() === "" || Number.isNaN(parseFloat(costDollars))
      ? null
      : Math.max(0, Math.round(parseFloat(costDollars) * 100));
  const saleCentsLive =
    listPriceDollars.trim() === "" || Number.isNaN(parseFloat(listPriceDollars))
      ? null
      : Math.max(0, Math.round(parseFloat(listPriceDollars) * 100));
  const profitLive =
    costCentsLive != null && saleCentsLive != null
      ? profitOnCost(costCentsLive, saleCentsLive)
      : { profitCents: 0, percentOnCost: null };

  // Typing a margin auto-fills the sale price (cost required). Typing the sale
  // price directly just updates the live profit readout — no loops.
  function applyMargin(raw: string) {
    setMarginPct(raw);
    const pct = parseFloat(raw);
    if (costCentsLive == null || raw.trim() === "" || Number.isNaN(pct) || pct < 0 || pct > 500) return;
    setListPriceDollars((saleFromCostAndMargin(costCentsLive, pct) / 100).toFixed(2));
  }
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
    const costCents =
      costDollars.trim() === ""
        ? null
        : Math.max(0, Math.round(parseFloat(costDollars) * 100));
    // CP-3e: build the explicit stock operation (null = stock untouched).
    // Set-count parses UNclamped so an untouched negative ("-4") compares
    // equal and produces no op; a deliberate change to a negative is rejected
    // by the action (physical counts are never negative).
    const threshold =
      thresholdStr.trim() === "" ? 0 : Math.max(0, Math.floor(Number(thresholdStr) || 0));
    let stockOp: StockOp = null;
    if (inventoryEnabled) {
      if (tracked && stockMode === "receive") {
        const q = receiveQtyStr.trim() === "" ? 0 : Math.floor(Number(receiveQtyStr) || 0);
        if (q > 0) {
          stockOp = { kind: "receive", qty: q, lowStockThreshold: threshold };
        } else if (threshold !== (initialStock?.lowStockThreshold ?? 0)) {
          // Threshold-only change: re-set the SAME count with the new alert.
          stockOp = {
            kind: "set",
            stockQty: initialStock?.stockQty ?? null,
            lowStockThreshold: threshold,
          };
        }
      } else {
        const sq = stockQtyStr.trim() === "" ? null : Math.floor(Number(stockQtyStr));
        const changed =
          sq !== (initialStock?.stockQty ?? null) ||
          threshold !== (initialStock?.lowStockThreshold ?? 0);
        if (changed) stockOp = { kind: "set", stockQty: sq, lowStockThreshold: threshold };
      }
    }
    onSave(
      {
        sku: sku.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        categoryId: categoryId || null,
        unit,
        unitSize: unitSize.trim(),
        listPriceCents: cents,
        isActive,
        imageUrl,
      },
      costCents,
      stockOp,
    );
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
          {/* CP-1: cost & sale side by side, margin helper in between. All
              percentages are MARKUP ON COST (matches the pricing engine). */}
          <Field label="Purchase cost ($ — admin only)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={costDollars}
              onChange={(e) => setCostDollars(e.target.value)}
              placeholder="Leave blank if unknown"
              className={inputCls}
            />
          </Field>
          <Field label="Sale price ($ — shown to customers)">
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
          <div className="sm:col-span-2 rounded-lg border border-[var(--border)] bg-background px-3 py-2.5">
            {costCentsLive != null ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-muted">
                  Margin % on cost
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="500"
                    value={marginPct}
                    onChange={(e) => applyMargin(e.target.value)}
                    placeholder="40"
                    className="w-24 rounded-md border border-[var(--border)] bg-surface px-2 py-1 text-sm"
                  />
                  <span aria-hidden className="text-muted-soft">→ sale price auto-fills</span>
                </label>
                {saleCentsLive != null && (
                  <span className={`text-xs font-semibold ${profitLive.profitCents < 0 ? "text-red-700" : "text-emerald-700"}`}>
                    Profit: {formatMoney(profitLive.profitCents)}
                    {profitLive.percentOnCost != null ? ` (${profitLive.percentOnCost}% on cost)` : ""}
                  </span>
                )}
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <AlertTriangle size={13} aria-hidden />
                No cost — margins can&apos;t apply. Enter the purchase cost to use margin rules.
              </p>
            )}
          </div>
          {/* CP-3e stock: TWO explicit operations. Receiving a shipment ADDS
              (settling any deficit); a physical recount REPLACES. The admin
              never has to guess which one they're doing — each shows a live
              preview of the result before saving. Admin-only data throughout;
              the portal only ever sees the is_available boolean. */}
          {!inventoryEnabled ? (
            <p className="sm:col-span-2 text-xs text-amber-700">
              Stock tracking needs migration 0010 — run it to enable these fields.
            </p>
          ) : !tracked ? (
            <>
              <Field label="Initial stock count (blank = not tracked)">
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={stockQtyStr}
                  onChange={(e) => setStockQtyStr(e.target.value)}
                  placeholder="Leave blank to skip tracking"
                  className={inputCls}
                />
              </Field>
              <Field label="Low-stock alert at">
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={thresholdStr}
                  onChange={(e) => setThresholdStr(e.target.value)}
                  placeholder="0"
                  disabled={stockQtyStr.trim() === ""}
                  className={inputCls}
                />
              </Field>
              <p className="sm:col-span-2 -mt-2 text-xs text-muted">
                This product isn&apos;t tracked yet, so the first number simply SETS the starting
                count — there&apos;s nothing to add to. After that, use “Receive stock” for
                arriving shipments.
              </p>
            </>
          ) : (
            <div className="sm:col-span-2 rounded-lg border border-[var(--border)] bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted">
                  Stock — currently{" "}
                  <span
                    className={`font-mono text-sm ${(initialStock?.stockQty ?? 0) < 0 ? "font-bold text-red-700" : "font-semibold text-foreground"}`}
                  >
                    {initialStock?.stockQty}
                  </span>
                  {(initialStock?.stockQty ?? 0) < 0 && (
                    <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-800">
                      Oversold by {-(initialStock?.stockQty ?? 0)}
                    </span>
                  )}
                </span>
                <div className="flex gap-1 rounded-full border border-[var(--border-strong)] p-0.5">
                  <button
                    type="button"
                    onClick={() => setStockMode("receive")}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      stockMode === "receive"
                        ? "bg-brand text-white"
                        : "text-foreground/70 hover:text-foreground"
                    }`}
                  >
                    Receive stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockMode("set")}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      stockMode === "set"
                        ? "bg-zinc-700 text-white"
                        : "text-foreground/70 hover:text-foreground"
                    }`}
                  >
                    Set count
                  </button>
                </div>
              </div>

              {stockMode === "receive" ? (
                <div className="mt-3">
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
                    <span className="uppercase tracking-wider">
                      Quantity that ARRIVED (adds to current stock)
                    </span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={receiveQtyStr}
                      onChange={(e) => setReceiveQtyStr(e.target.value)}
                      placeholder="e.g. 10"
                      className={inputCls}
                    />
                  </label>
                  {(() => {
                    const old = initialStock?.stockQty ?? 0;
                    const q = Math.floor(Number(receiveQtyStr) || 0);
                    if (receiveQtyStr.trim() === "" || q < 1) return null;
                    const settled = old < 0 ? Math.min(-old, q) : 0;
                    return (
                      <p className="mt-2 text-xs font-semibold text-emerald-800">
                        {old} + {q} = {old + q}
                        {settled > 0 &&
                          ` — ${settled} unit${settled === 1 ? "" : "s"} settle the deficit, ${Math.max(old + q, 0)} genuinely available`}
                      </p>
                    );
                  })()}
                </div>
              ) : (
                <div className="mt-3">
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
                    <span className="uppercase tracking-wider">
                      REAL physical count (replaces current stock — recount only)
                    </span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={stockQtyStr}
                      onChange={(e) => setStockQtyStr(e.target.value)}
                      placeholder="Count from your stocktake"
                      className={inputCls}
                    />
                  </label>
                  {(() => {
                    const old = initialStock?.stockQty ?? 0;
                    if (stockQtyStr.trim() === "")
                      return (
                        <p className="mt-2 text-xs font-semibold text-red-700">
                          {old} → not tracked (stock tracking stops
                          {old < 0 ? ` and the deficit of ${-old} is erased` : ""})
                        </p>
                      );
                    const sq = Math.floor(Number(stockQtyStr));
                    if (Number.isNaN(sq) || sq === old) return null;
                    return (
                      <p
                        className={`mt-2 text-xs font-semibold ${old < 0 ? "text-red-700" : "text-foreground/80"}`}
                      >
                        {old} → {sq}
                        {old < 0 &&
                          ` (deficit of ${-old} ERASED — only do this after a physical recount; use Receive for arriving shipments)`}
                      </p>
                    );
                  })()}
                </div>
              )}

              <label className="mt-3 flex flex-col gap-1.5 text-xs font-medium text-muted">
                <span className="uppercase tracking-wider">Low-stock alert at</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={thresholdStr}
                  onChange={(e) => setThresholdStr(e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
              </label>
            </div>
          )}
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
