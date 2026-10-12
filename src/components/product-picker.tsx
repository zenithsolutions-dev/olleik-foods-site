"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { ProductThumb } from "./product-thumb";

// A product chooser that shows each product's picture, replacing a native <select> where recognising the
// product matters (a native <option> cannot hold an image). Behaves like a select: one value, "" = nothing /
// the optional "none" row. Keyboard: Enter/Space/ArrowDown opens, Up/Down moves, Enter picks, Esc closes.
// The trigger and every row reserve a fixed thumbnail box, so opening the list never shifts the layout.

export type PickerProduct = { id: string; name: string; sku?: string; imageUrl?: string | null };

export function ProductPicker({
  products,
  value,
  onChange,
  placeholder = "Choose a product…",
  noneLabel,
  ariaLabel,
  disabled = false,
  className = "",
}: {
  products: PickerProduct[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** When set, the list starts with a row that selects "" (e.g. "None (account-wide)"). */
  noneLabel?: string;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = products.find((p) => p.id === value) ?? null;
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hits = q
      ? products.filter((p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q))
      : products;
    return noneLabel && !q ? [{ id: "", name: noneLabel } as PickerProduct, ...hits] : hits;
  }, [products, query, noneLabel]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  function openList() {
    if (disabled) return;
    setQuery("");
    setActive(Math.max(0, rows.findIndex((r) => r.id === value)));
    setOpen(true);
    queueMicrotask(() => search.current?.focus());
  }

  function pick(id: string) {
    onChange(id);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(rows.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (rows[active]) pick(rows[active].id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openList();
          }
        }}
        className="flex w-full min-w-[14rem] items-center gap-2 rounded-lg border border-[var(--border)] bg-background px-2 py-1.5 text-left text-sm disabled:opacity-50"
      >
        {selected ? (
          <>
            <ProductThumb src={selected.imageUrl} name={selected.name} size="sm" />
            <span className="min-w-0 flex-1 truncate">{selected.name}</span>
          </>
        ) : (
          <>
            <span aria-hidden className="inline-block h-8 w-0 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-muted">{noneLabel && value === "" ? noneLabel : placeholder}</span>
          </>
        )}
        <ChevronDown size={14} className="shrink-0 text-muted" aria-hidden />
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-full min-w-[18rem] rounded-xl border border-[var(--border-strong)] bg-surface shadow-lg">
          <input
            ref={search}
            type="search"
            aria-label="Search products"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
            placeholder="Search by name or SKU…"
            className="w-full rounded-t-xl border-b border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none"
          />
          <ul id={listId} role="listbox" aria-label={ariaLabel} className="max-h-72 overflow-y-auto py-1">
            {rows.length === 0 && <li className="px-3 py-3 text-sm text-muted">No products match.</li>}
            {rows.map((p, i) => (
              <li
                key={p.id || "none"}
                role="option"
                aria-selected={p.id === value}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p.id);
                }}
                className={`flex cursor-pointer items-center gap-2.5 px-2.5 py-1.5 text-sm ${i === active ? "bg-brand-mist/60" : ""}`}
              >
                {p.id ? (
                  <ProductThumb src={p.imageUrl} name={p.name} size="sm" />
                ) : (
                  <span aria-hidden className="inline-block h-8 w-8 shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{p.name}</span>
                  {p.sku && <span className="block truncate font-mono text-[11px] text-muted">{p.sku}</span>}
                </span>
                {p.id === value && <Check size={14} className="shrink-0 text-brand" aria-hidden />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
