"use client";

import { useMemo, useState } from "react";
import { Eye, Search, X, AlertTriangle } from "lucide-react";
import type { Category, Product, VisibilityMode } from "@/lib/admin/types";
import type { CustomerVisibility } from "@/lib/admin/visibility-data";
import { setCustomerVisibility, setHiddenProducts } from "../visibility-actions";

// CP-2: what this customer may BROWSE. The card edits configuration only —
// enforcement is the products RLS policy (0008). Mode + category selection
// save together via "Save visibility"; the hidden list saves immediately on
// every add/remove (each call sends the complete new list).

const MODE_COPY: { mode: VisibilityMode; title: string; blurb: string }[] = [
  {
    mode: "assigned",
    title: "Assigned only",
    blurb: "They see just the products you've assigned — exactly how it worked before.",
  },
  {
    mode: "all",
    title: "Entire catalog",
    blurb: "They can browse every active product. Assigned products keep their special price.",
  },
  {
    mode: "categories",
    title: "Selected categories",
    blurb:
      "They browse the categories you pick. Picking a parent includes all its subcategories — current and future.",
  },
];

export function VisibilityCard({
  customerId,
  visibility,
  categories,
  allProducts,
  assignedIds,
}: {
  customerId: string;
  visibility: CustomerVisibility;
  categories: Category[];
  allProducts: Product[];
  assignedIds: string[];
}) {
  const [mode, setMode] = useState<VisibilityMode>(visibility.mode);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(
    new Set(visibility.categoryIds),
  );
  // Last-saved snapshot (drives the dirty check; refreshed on save success).
  const [baseline, setBaseline] = useState<{ mode: VisibilityMode; cats: Set<string> }>({
    mode: visibility.mode,
    cats: new Set(visibility.categoryIds),
  });
  const [hidden, setHidden] = useState<Set<string>>(new Set(visibility.hiddenProductIds));
  const [count, setCount] = useState(visibility.visibleCount);
  const [hideSearch, setHideSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const assignedSet = useMemo(() => new Set(assignedIds), [assignedIds]);
  const productById = useMemo(
    () => new Map(allProducts.map((p) => [p.id, p])),
    [allProducts],
  );

  // Per-category product tallies for the picker labels ("Dry Goods (1 active
  // of 3)") — inactive products are hidden from customers by the RLS policy,
  // so the ACTIVE count is what a customer will actually browse.
  const catTally = useMemo(() => {
    const t = new Map<string, { active: number; total: number }>();
    for (const p of allProducts) {
      if (!p.categoryId) continue;
      const cur = t.get(p.categoryId) ?? { active: 0, total: 0 };
      cur.total++;
      if (p.isActive) cur.active++;
      t.set(p.categoryId, cur);
    }
    return t;
  }, [allProducts]);

  const tallyLabel = (categoryId: string): string => {
    const t = catTally.get(categoryId);
    if (!t || t.total === 0) return "no products";
    return `${t.active} active of ${t.total}`;
  };

  // One-level tree: parents (parentId null) with their children beneath.
  const tree = useMemo(() => {
    const tops = categories.filter((c) => !c.parentId);
    const childrenOf = new Map<string, Category[]>();
    for (const c of categories) {
      if (c.parentId) {
        childrenOf.set(c.parentId, [...(childrenOf.get(c.parentId) ?? []), c]);
      }
    }
    return tops
      .map((t) => ({ cat: t, children: (childrenOf.get(t.id) ?? []).sort(byName) }))
      .sort((a, b) => byName(a.cat, b.cat));
  }, [categories]);

  const hideMatches = useMemo(() => {
    const q = hideSearch.trim().toLowerCase();
    if (!q) return [];
    return allProducts
      .filter(
        (p) =>
          p.isActive &&
          !hidden.has(p.id) &&
          (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [hideSearch, allProducts, hidden]);

  // Category picks only count as changes in 'categories' mode — they're
  // preserved (inert) server-side under the other modes.
  const dirty =
    mode !== baseline.mode ||
    (mode === "categories" && !sameSet(selectedCats, baseline.cats));

  async function saveVisibility() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await setCustomerVisibility({
      customerId,
      mode,
      categoryIds: mode === "categories" ? [...selectedCats] : [],
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setCount(res.visibleCount);
    setSaved(true);
    // Selections persist across mode flips (only replaced when saving
    // 'categories'), so keep them locally too.
    setBaseline((b) => ({
      mode,
      cats: mode === "categories" ? new Set(selectedCats) : b.cats,
    }));
  }

  async function saveHidden(next: Set<string>) {
    const prev = hidden;
    setHidden(next);
    setBusy(true);
    setError(null);
    const res = await setHiddenProducts({ customerId, productIds: [...next] });
    setBusy(false);
    if (!res.ok) {
      setHidden(prev); // roll the optimistic update back
      setError(res.message);
      return;
    }
    setCount(res.visibleCount);
  }

  if (!visibility.migrationApplied) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-surface p-5">
        <h2 className="font-display text-base font-semibold text-brand-deep">
          Catalog visibility
        </h2>
        <p className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Run migration <code className="font-mono">0008_catalog_visibility.sql</code> to
          enable visibility controls. Until then this customer sees their assigned products
          only (the pre-CP-2 behavior).
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-brand-deep">
            Catalog visibility
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            What this customer can browse in their portal. Assigned products are always
            visible (at their special price); hidden products are never visible.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-mist/60 px-3 py-1 text-xs font-semibold text-brand-deep">
          <Eye size={13} /> Can browse {count} {count === 1 ? "product" : "products"}
        </span>
      </div>

      {/* Mode selector */}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {MODE_COPY.map((m) => (
          <label
            key={m.mode}
            className={`cursor-pointer rounded-xl border p-3 transition ${
              mode === m.mode
                ? "border-brand bg-brand-mist/40"
                : "border-[var(--border)] hover:border-[var(--border-strong)]"
            }`}
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name="visibility-mode"
                checked={mode === m.mode}
                onChange={() => {
                  setMode(m.mode);
                  setSaved(false);
                }}
                className="accent-[var(--brand)]"
              />
              <span className="text-sm font-semibold text-foreground">{m.title}</span>
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-muted">{m.blurb}</span>
          </label>
        ))}
      </div>

      {/* Category tree (only meaningful in 'categories' mode) */}
      {mode === "categories" && (
        <div className="mt-4 rounded-xl border border-[var(--border)] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Visible categories
          </p>
          {selectedCats.size === 0 && (
            <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No categories selected — this customer will only see their assigned products
              until you pick at least one.
            </p>
          )}
          <div className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {tree.map(({ cat, children }) => {
              const parentOn = selectedCats.has(cat.id);
              return (
                <div key={cat.id}>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={parentOn}
                      onChange={(e) => {
                        const next = new Set(selectedCats);
                        if (e.target.checked) {
                          next.add(cat.id);
                          // Parent covers the children at read time; drop
                          // redundant explicit child selections.
                          for (const ch of children) next.delete(ch.id);
                        } else {
                          next.delete(cat.id);
                        }
                        setSelectedCats(next);
                        setSaved(false);
                      }}
                      className="accent-[var(--brand)]"
                    />
                    <span className="font-medium">{cat.name}</span>
                    <span className="text-[10px] text-muted-soft">({tallyLabel(cat.id)})</span>
                    {parentOn && children.length > 0 && (
                      <span className="text-[10px] uppercase tracking-wider text-muted">
                        incl. {children.length} sub
                      </span>
                    )}
                  </label>
                  {children.map((ch) => (
                    <label
                      key={ch.id}
                      className={`ml-6 mt-1 flex items-center gap-2 text-sm ${
                        parentOn ? "text-muted" : "text-foreground"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={parentOn || selectedCats.has(ch.id)}
                        disabled={parentOn}
                        onChange={(e) => {
                          const next = new Set(selectedCats);
                          if (e.target.checked) next.add(ch.id);
                          else next.delete(ch.id);
                          setSelectedCats(next);
                          setSaved(false);
                        }}
                        className="accent-[var(--brand)]"
                      />
                      {ch.name}
                      <span className="text-[10px] text-muted-soft">({tallyLabel(ch.id)})</span>
                      {parentOn && (
                        <span className="text-[10px] text-muted-soft">via {cat.name}</span>
                      )}
                    </label>
                  ))}
                </div>
              );
            })}
            {tree.length === 0 && (
              <p className="text-sm text-muted">No categories yet — create some first.</p>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={saveVisibility}
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save visibility"}
        </button>
        {saved && !dirty && (
          <span className="text-xs font-medium text-emerald-700">Saved.</span>
        )}
        {error && <span className="text-xs font-medium text-red-600">{error}</span>}
      </div>

      {/* Hidden products (applies in every mode; hidden beats assigned) */}
      <div className="mt-5 border-t border-[var(--border)] pt-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">
          Hidden from this customer
        </p>
        <p className="mt-0.5 text-xs text-muted-soft">
          Hidden products are invisible in every mode — even if assigned.
        </p>
        <div className="relative mt-2 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={hideSearch}
            onChange={(e) => setHideSearch(e.target.value)}
            placeholder="Search a product to hide…"
            className="w-full rounded-full border border-[var(--border-strong)] bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-brand"
          />
          {hideMatches.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-[var(--border)] bg-surface shadow-lg">
              {hideMatches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setHideSearch("");
                    void saveHidden(new Set(hidden).add(p.id));
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand-mist/40 disabled:opacity-50"
                >
                  <span>{p.name}</span>
                  <span className="text-xs text-muted">{p.sku}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {hidden.size > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {[...hidden].map((id) => {
              const p = productById.get(id);
              const isAssigned = assignedSet.has(id);
              return (
                <span
                  key={id}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
                    isAssigned
                      ? "border-amber-300 bg-amber-50 text-amber-800"
                      : "border-[var(--border)] bg-brand-mist/30 text-foreground"
                  }`}
                >
                  {isAssigned && <AlertTriangle size={12} />}
                  {p?.name ?? "Removed product"}
                  {isAssigned && <span className="font-semibold">assigned</span>}
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Unhide ${p?.name ?? id}`}
                    onClick={() => {
                      const next = new Set(hidden);
                      next.delete(id);
                      void saveHidden(next);
                    }}
                    className="rounded p-0.5 hover:text-red-600 disabled:opacity-50"
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        {hidden.size === 0 && (
          <p className="mt-2 text-xs text-muted-soft">Nothing hidden.</p>
        )}
      </div>
    </section>
  );
}

function byName(a: Category, b: Category): number {
  return a.name.localeCompare(b.name);
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}
