"use client";

import { useMemo, useState } from "react";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import { formatMoney } from "@/lib/admin/store";
import { indexRules, resolveWithIndex, marginSourceLabel } from "@/lib/admin/pricing-engine";
import type { Category, Customer, PricingRule, Product } from "@/lib/admin/types";
import { bulkAssignToCustomers } from "./actions";

// The preview is computed with the SAME pure engine the server uses to apply,
// so what the admin approves is what gets written (the server re-resolves at
// apply time as the authority).

export function AssignClient({
  products,
  categories,
  customers,
  costs,
  rules,
  existingPairs,
}: {
  products: Product[];
  categories: Category[];
  customers: Customer[];
  costs: Record<string, number>;
  rules: PricingRule[];
  existingPairs: string[];
}) {
  const [categoryId, setCategoryId] = useState<string>("all");
  const [productQuery, setProductQuery] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [customerQuery, setCustomerQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  // Preview-row unticks: `${customerId}:${productId}` excluded from the apply.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const existing = useMemo(() => new Set(existingPairs), [existingPairs]);
  const idx = useMemo(() => indexRules(rules), [rules]);
  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const parentOf = (id: string | null) => (id ? (catById[id]?.parentId ?? null) : null);
  const catLabel = (c: Category) =>
    c.parentId ? `${catById[c.parentId]?.name ?? "?"} · ${c.name}` : c.name;

  // Category filter includes the category's children (assign a whole tree).
  const categoryProductIds = useMemo(() => {
    if (categoryId === "all") return null;
    const ids = new Set([categoryId, ...categories.filter((c) => c.parentId === categoryId).map((c) => c.id)]);
    return new Set(products.filter((p) => p.categoryId && ids.has(p.categoryId)).map((p) => p.id));
  }, [categoryId, categories, products]);

  const visibleProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryProductIds && !categoryProductIds.has(p.id)) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    });
  }, [products, categoryProductIds, productQuery]);

  const visibleCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    return customers.filter((c) => {
      if (!includeArchived && c.status === "archived") return false;
      if (!q) return true;
      return c.businessName.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
    });
  }, [customers, customerQuery, includeArchived]);

  const productById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const customerById = useMemo(
    () => Object.fromEntries(customers.map((c) => [c.id, c])),
    [customers],
  );

  // ---- The preview: every (customer, product) pair with price + profit ----
  type PreviewRow = {
    key: string;
    customerId: string;
    productId: string;
    priceCents: number;
    storedCents: number | null; // what apply would store (null = list)
    costCents: number | null;
    profitCents: number | null;
    sourceLabel: string;
    alreadyAssigned: boolean;
    excluded: boolean;
  };

  const preview = useMemo(() => {
    const byCustomer = new Map<string, PreviewRow[]>();
    let saleTotal = 0,
      costTotal = 0,
      profitTotal = 0,
      willAssign = 0,
      skipExisting = 0,
      // Rows with no recorded cost: counted in saleTotal but NOT in costTotal /
      // profitTotal. Surfaced so the four figures reconcile on screen
      // (sale - cost - noCostSale = profit) instead of looking like bad math.
      noCostRows = 0,
      noCostSaleTotal = 0;

    for (const customerId of selectedCustomers) {
      const rows: PreviewRow[] = [];
      for (const productId of selectedProducts) {
        const p = productById[productId];
        if (!p) continue;
        const key = `${customerId}:${productId}`;
        const alreadyAssigned = existing.has(key);
        const costCents = costs[productId] ?? null;
        const resolved = resolveWithIndex({
          idx,
          customerId,
          productId,
          categoryId: p.categoryId,
          parentCategoryId: parentOf(p.categoryId),
          costCents,
          listPriceCents: p.listPriceCents,
          manualPriceCents: null,
        });
        const isExcluded = excluded.has(key);
        const row: PreviewRow = {
          key,
          customerId,
          productId,
          priceCents: resolved.priceCents,
          storedCents: resolved.source === "list" ? null : resolved.priceCents,
          costCents,
          profitCents: costCents != null ? resolved.priceCents - costCents : null,
          sourceLabel: marginSourceLabel(resolved),
          alreadyAssigned,
          excluded: isExcluded,
        };
        rows.push(row);
        if (alreadyAssigned) skipExisting++;
        else if (!isExcluded) {
          willAssign++;
          saleTotal += row.priceCents;
          if (costCents != null) {
            costTotal += costCents;
            profitTotal += row.priceCents - costCents;
          } else {
            noCostRows++;
            noCostSaleTotal += row.priceCents;
          }
        }
      }
      byCustomer.set(customerId, rows);
    }
    return {
      byCustomer,
      saleTotal,
      costTotal,
      profitTotal,
      willAssign,
      skipExisting,
      noCostRows,
      noCostSaleTotal,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomers, selectedProducts, excluded, idx, costs, existing, productById]);

  function toggleSet(set: Set<string>, id: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  async function apply() {
    const customerIds = Array.from(selectedCustomers);
    const productIds = Array.from(selectedProducts);
    const perCustomerExclusions: Record<string, string[]> = {};
    for (const key of excluded) {
      const [cId, pId] = key.split(":");
      if (selectedCustomers.has(cId) && selectedProducts.has(pId)) {
        (perCustomerExclusions[cId] ??= []).push(pId);
      }
    }
    setBusy(true);
    setNotice(null);
    const res = await bulkAssignToCustomers({ customerIds, productIds, perCustomerExclusions });
    setBusy(false);
    if (!res.ok) {
      window.alert(res.message);
      return;
    }
    setNotice(
      `Assigned ${res.assigned} product-customer pair${res.assigned === 1 ? "" : "s"}` +
        (res.skippedExisting > 0 ? ` (${res.skippedExisting} already assigned — skipped)` : "") +
        ".",
    );
    setSelectedProducts(new Set());
    setSelectedCustomers(new Set());
    setExcluded(new Set());
  }

  const step3Ready = selectedProducts.size > 0 && selectedCustomers.size > 0;

  return (
    <div className="space-y-6">
      {notice && (
        <p className="rounded-xl border border-brand/30 bg-brand-mist/50 px-4 py-2.5 text-sm text-brand-deep">
          {notice}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Step 1 — products */}
        <section className="rounded-2xl border border-[var(--border)] bg-surface">
          <header className="border-b border-[var(--border)] px-5 py-3">
            <h2 className="font-display text-base font-semibold text-brand-deep">
              1 · Pick products{" "}
              <span className="text-xs font-normal text-muted">({selectedProducts.size} selected)</span>
            </h2>
          </header>
          <div className="flex flex-wrap items-center gap-2 px-5 py-3">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-background px-2.5 py-1.5 text-sm"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {catLabel(c)}
                </option>
              ))}
            </select>
            <div className="relative min-w-[140px] flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-soft" />
              <input
                type="search"
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Search name or SKU"
                className="w-full rounded-lg border border-[var(--border)] bg-background py-1.5 pl-8 pr-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const next = new Set(selectedProducts);
                const allIn = visibleProducts.every((p) => next.has(p.id));
                visibleProducts.forEach((p) => (allIn ? next.delete(p.id) : next.add(p.id)));
                setSelectedProducts(next);
              }}
              className="text-xs font-medium text-brand hover:text-accent"
            >
              {visibleProducts.length > 0 && visibleProducts.every((p) => selectedProducts.has(p.id))
                ? "Unselect shown"
                : `Select shown (${visibleProducts.length})`}
            </button>
          </div>
          <ul className="max-h-[320px] divide-y divide-[var(--border)] overflow-y-auto border-t border-[var(--border)]">
            {visibleProducts.length === 0 && (
              <li className="p-6 text-center text-sm text-muted">No products match.</li>
            )}
            {visibleProducts.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 px-5 py-2.5 hover:bg-brand-mist/30">
                  <input
                    type="checkbox"
                    checked={selectedProducts.has(p.id)}
                    onChange={() => toggleSet(selectedProducts, p.id, setSelectedProducts)}
                    className="accent-accent"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted">
                      {p.sku} · list {formatMoney(p.listPriceCents)} · cost{" "}
                      {costs[p.id] != null ? formatMoney(costs[p.id]) : "—"}
                    </p>
                  </div>
                </label>
              </li>
            ))}
          </ul>
        </section>

        {/* Step 2 — customers */}
        <section className="rounded-2xl border border-[var(--border)] bg-surface">
          <header className="border-b border-[var(--border)] px-5 py-3">
            <h2 className="font-display text-base font-semibold text-brand-deep">
              2 · Pick customers{" "}
              <span className="text-xs font-normal text-muted">({selectedCustomers.size} selected)</span>
            </h2>
          </header>
          <div className="flex flex-wrap items-center gap-2 px-5 py-3">
            <div className="relative min-w-[140px] flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-soft" />
              <input
                type="search"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Search business or email"
                className="w-full rounded-lg border border-[var(--border)] bg-background py-1.5 pl-8 pr-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-1 text-xs text-muted">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                className="accent-accent"
              />
              Include archived
            </label>
            <button
              type="button"
              onClick={() => {
                const next = new Set(selectedCustomers);
                const allIn = visibleCustomers.every((c) => next.has(c.id));
                visibleCustomers.forEach((c) => (allIn ? next.delete(c.id) : next.add(c.id)));
                setSelectedCustomers(next);
              }}
              className="text-xs font-medium text-brand hover:text-accent"
            >
              {visibleCustomers.length > 0 && visibleCustomers.every((c) => selectedCustomers.has(c.id))
                ? "Unselect shown"
                : `Select shown (${visibleCustomers.length})`}
            </button>
          </div>
          <ul className="max-h-[320px] divide-y divide-[var(--border)] overflow-y-auto border-t border-[var(--border)]">
            {visibleCustomers.length === 0 && (
              <li className="p-6 text-center text-sm text-muted">No customers match.</li>
            )}
            {visibleCustomers.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-3 px-5 py-2.5 hover:bg-brand-mist/30">
                  <input
                    type="checkbox"
                    checked={selectedCustomers.has(c.id)}
                    onChange={() => toggleSet(selectedCustomers, c.id, setSelectedCustomers)}
                    className="accent-accent"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {c.businessName}
                      {c.status === "archived" && (
                        <span className="ml-2 text-[10px] font-semibold uppercase text-zinc-500">
                          archived
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted">{c.email}</p>
                  </div>
                </label>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Step 3 — preview + apply */}
      {step3Ready && (
        <section className="rounded-2xl border border-[var(--border)] bg-surface">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
            <div>
              <h2 className="font-display text-base font-semibold text-brand-deep">3 · Preview &amp; apply</h2>
              <p className="text-xs text-muted">
                Prices via the margin waterfall. Untick any row to skip it for that customer.
                Greyed rows are already assigned and will be skipped.
              </p>
            </div>
            <button
              type="button"
              disabled={busy || preview.willAssign === 0}
              onClick={apply}
              className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
            >
              {busy ? "Applying…" : `Assign ${preview.willAssign} pair${preview.willAssign === 1 ? "" : "s"}`}
            </button>
          </header>

          {/* Grand totals. The "no cost" figure is shown so the numbers
              reconcile on screen: sale − cost − noCost = profit. Without it the
              three headline figures look like broken arithmetic. */}
          <div
            className={`grid gap-3 border-b border-[var(--border)] px-5 py-4 ${
              preview.noCostRows > 0 ? "sm:grid-cols-5" : "sm:grid-cols-4"
            }`}
          >
            <Total label="Will assign" value={String(preview.willAssign)} />
            <Total label="Total sale value" value={formatMoney(preview.saleTotal)} />
            <Total label="Total cost" value={formatMoney(preview.costTotal)} />
            {preview.noCostRows > 0 && (
              <Total
                label="No cost recorded"
                value={formatMoney(preview.noCostSaleTotal)}
                accent="muted"
              />
            )}
            <Total
              label="Total profit"
              value={formatMoney(preview.profitTotal)}
              accent={preview.profitTotal >= 0 ? "green" : "red"}
            />
          </div>
          {preview.noCostRows > 0 && (
            <p className="border-b border-[var(--border)] bg-brand-mist/20 px-5 py-2 text-xs text-muted">
              sale value − cost − no-cost = profit ·{" "}
              <span className="font-medium text-foreground">
                {preview.noCostRows} row{preview.noCostRows === 1 ? "" : "s"}
              </span>{" "}
              have no cost recorded, so they are excluded from the cost and profit figures. Add
              their cost on the Products page to see the real profit.
            </p>
          )}
          {preview.skipExisting > 0 && (
            <p className="border-b border-[var(--border)] px-5 py-2 text-xs text-muted">
              {preview.skipExisting} pair{preview.skipExisting === 1 ? " is" : "s are"} already
              assigned and will be skipped (existing prices are never changed).
            </p>
          )}

          {Array.from(preview.byCustomer.entries()).map(([customerId, rows]) => {
            const cust = customerById[customerId];
            const isCollapsed = collapsed.has(customerId);
            const subtotal = rows
              .filter((r) => !r.alreadyAssigned && !r.excluded)
              .reduce(
                (acc, r) => ({
                  sale: acc.sale + r.priceCents,
                  profit: acc.profit + (r.profitCents ?? 0),
                }),
                { sale: 0, profit: 0 },
              );
            return (
              <div key={customerId} className="border-b border-[var(--border)] last:border-0">
                <button
                  type="button"
                  onClick={() => toggleSet(collapsed, customerId, setCollapsed)}
                  className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-brand-mist/30"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-brand-deep">
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    {cust?.businessName ?? "?"}
                  </span>
                  <span className="text-xs text-muted">
                    subtotal {formatMoney(subtotal.sale)} · profit{" "}
                    <span className={subtotal.profit >= 0 ? "text-emerald-700" : "text-red-700"}>
                      {formatMoney(subtotal.profit)}
                    </span>
                  </span>
                </button>
                {!isCollapsed && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-brand-mist/30 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">
                        <th className="w-10 px-5 py-2" />
                        <th className="px-2 py-2">Product</th>
                        <th className="px-2 py-2 text-right">Cost</th>
                        <th className="px-2 py-2 text-right">Price</th>
                        <th className="px-2 py-2">Rule</th>
                        <th className="px-2 py-2 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const p = productById[r.productId];
                        const inactive = r.alreadyAssigned;
                        return (
                          <tr
                            key={r.key}
                            className={`border-t border-[var(--border)] ${
                              inactive || r.excluded ? "opacity-45" : ""
                            }`}
                          >
                            <td className="px-5 py-2">
                              <input
                                type="checkbox"
                                disabled={inactive}
                                checked={!inactive && !r.excluded}
                                onChange={() => toggleSet(excluded, r.key, setExcluded)}
                                className="accent-accent"
                                aria-label={`Include ${p?.name}`}
                              />
                            </td>
                            <td className="px-2 py-2">
                              {p?.name}
                              {inactive && (
                                <span className="ml-2 text-[10px] uppercase text-muted-soft">
                                  already assigned
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-muted">
                              {r.costCents != null ? formatMoney(r.costCents) : "—"}
                            </td>
                            <td className="px-2 py-2 text-right font-mono font-semibold">
                              {formatMoney(r.priceCents)}
                            </td>
                            <td className="px-2 py-2 text-xs text-muted">{r.sourceLabel}</td>
                            <td
                              className={`px-2 py-2 text-right font-mono ${
                                r.profitCents == null
                                  ? "text-muted-soft"
                                  : r.profitCents >= 0
                                    ? "text-emerald-700"
                                    : "text-red-700"
                              }`}
                            >
                              {r.profitCents != null ? (
                                formatMoney(r.profitCents)
                              ) : (
                                <span
                                  className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800"
                                  title="No purchase cost recorded — rules can't compute a margin; list price is used"
                                >
                                  No cost
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

function Total({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "green" | "red" | "muted";
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p
        className={`mt-0.5 font-mono text-lg font-semibold ${
          accent === "green"
            ? "text-emerald-700"
            : accent === "red"
              ? "text-red-700"
              : accent === "muted"
                ? "text-muted"
                : "text-brand-deep"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
