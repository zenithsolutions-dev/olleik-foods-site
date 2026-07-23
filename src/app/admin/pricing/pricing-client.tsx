"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { Category, Customer, PricingRule } from "@/lib/admin/types";
import {
  upsertPricingRule,
  togglePricingRule,
  deletePricingRule,
} from "./actions";

// Margin-rule management: one global default, per-category rules (with the
// "Overrides customer margins" priority toggle), and per-customer margins.
// All values are markup-on-cost percentages (0–500, up to 2 decimals).

export function PricingClient({
  rules,
  categories,
  customers,
  live,
}: {
  rules: PricingRule[];
  categories: Category[];
  customers: Customer[];
  live: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const globalRule = rules.find((r) => r.scope === "global") ?? null;
  const categoryRules = rules.filter((r) => r.scope === "category");
  const customerRules = rules.filter((r) => r.scope === "customer");

  const catById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );
  const custById = useMemo(
    () => Object.fromEntries(customers.map((c) => [c.id, c.businessName])),
    [customers],
  );
  const catLabel = (id: string | null) => {
    if (!id) return "?";
    const c = catById[id];
    if (!c) return "?";
    return c.parentId ? `${catById[c.parentId]?.name ?? "?"} · ${c.name}` : c.name;
  };

  async function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(true);
    setError(null);
    const r = await action();
    setBusy(false);
    if (!r.ok) setError(r.message ?? "Something went wrong.");
    return r.ok;
  }

  return (
    <div className="space-y-6">
      {!live && (
        <p className="rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          Supabase isn&apos;t configured — rules won&apos;t persist.
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

      <GlobalRuleCard rule={globalRule} busy={busy} onRun={run} />
      <CategoryRulesCard
        rules={categoryRules}
        categories={categories}
        catLabel={catLabel}
        busy={busy}
        onRun={run}
      />
      <CustomerRulesCard
        rules={customerRules}
        customers={customers}
        custName={(id) => custById[id ?? ""] ?? "?"}
        busy={busy}
        onRun={run}
      />
    </div>
  );
}

type Run = (a: () => Promise<{ ok: boolean; message?: string }>) => Promise<boolean>;

function GlobalRuleCard({
  rule,
  busy,
  onRun,
}: {
  rule: PricingRule | null;
  busy: boolean;
  onRun: Run;
}) {
  const [value, setValue] = useState(rule ? String(rule.marginPercent) : "");
  const [editing, setEditing] = useState(false);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-brand-deep">Global default margin</h2>
          <p className="text-xs text-muted">
            Applies to every product with a cost, for every customer, unless a more specific rule wins.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {rule && !editing && (
            <>
              <span
                className={`font-mono text-lg font-semibold ${rule.isActive ? "text-brand-deep" : "text-muted line-through"}`}
              >
                {rule.marginPercent}%
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => onRun(() => togglePricingRule(rule.id, !rule.isActive))}
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
          {(!rule || editing) && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="500"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="20"
                className="w-24 rounded-lg border border-[var(--border)] bg-background px-2 py-1.5 text-right font-mono text-sm"
              />
              <span className="text-sm text-muted">%</span>
              <button
                type="button"
                disabled={busy || value.trim() === ""}
                onClick={async () => {
                  const ok = await onRun(() =>
                    upsertPricingRule({ scope: "global", marginPercent: parseFloat(value) }),
                  );
                  if (ok) setEditing(false);
                }}
                className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
              >
                Save
              </button>
              {editing && (
                <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted">
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {!rule && (
        <p className="mt-2 text-xs text-muted-soft">
          No global margin yet — products without any applicable rule sell at list price.
        </p>
      )}
    </section>
  );
}

function CategoryRulesCard({
  rules,
  categories,
  catLabel,
  busy,
  onRun,
}: {
  rules: PricingRule[];
  categories: Category[];
  catLabel: (id: string | null) => string;
  busy: boolean;
  onRun: Run;
}) {
  const usedIds = new Set(rules.map((r) => r.categoryId));
  const available = categories.filter((c) => !usedIds.has(c.id));
  const [categoryId, setCategoryId] = useState("");
  const [value, setValue] = useState("");
  const [priority, setPriority] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editPriority, setEditPriority] = useState(false);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-surface">
      <header className="border-b border-[var(--border)] px-5 py-4">
        <h2 className="font-display text-lg font-semibold text-brand-deep">Category margins</h2>
        <p className="text-xs text-muted">
          A subcategory rule beats its parent&apos;s. &quot;Overrides customer margins&quot; makes the
          rule win even over a customer&apos;s own margin (e.g. fresh goods always 40%).
        </p>
      </header>

      {rules.length > 0 && (
        <ul className="divide-y divide-[var(--border)]">
          {rules.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{catLabel(r.categoryId)}</span>
                {editingId === r.id ? (
                  <span className="inline-flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="500"
                      step="0.01"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-20 rounded-md border border-[var(--border)] bg-background px-2 py-1 text-right font-mono text-sm"
                    />
                    <span className="text-xs text-muted">%</span>
                    <label className="ml-2 flex items-center gap-1 text-xs text-muted">
                      <input
                        type="checkbox"
                        checked={editPriority}
                        onChange={(e) => setEditPriority(e.target.checked)}
                        className="accent-accent"
                      />
                      Overrides customer margins
                    </label>
                  </span>
                ) : (
                  <>
                    <span
                      className={`font-mono text-sm font-semibold ${r.isActive ? "text-brand-deep" : "text-muted line-through"}`}
                    >
                      cost + {r.marginPercent}%
                    </span>
                    {r.isPriority && (
                      <span className="inline-flex rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-deep">
                        Overrides customer margins
                      </span>
                    )}
                    {!r.isActive && (
                      <span className="inline-flex rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                        Off
                      </span>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs font-medium">
                {editingId === r.id ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        const ok = await onRun(() =>
                          upsertPricingRule({
                            scope: "category",
                            categoryId: r.categoryId,
                            marginPercent: parseFloat(editValue),
                            isPriority: editPriority,
                            isActive: r.isActive,
                          }),
                        );
                        if (ok) setEditingId(null);
                      }}
                      className="text-brand hover:text-accent disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-muted">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRun(() => togglePricingRule(r.id, !r.isActive))}
                      className="text-muted hover:text-foreground disabled:opacity-50"
                    >
                      {r.isActive ? "Turn off" : "Turn on"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(r.id);
                        setEditValue(String(r.marginPercent));
                        setEditPriority(r.isPriority);
                      }}
                      className="text-brand hover:text-accent"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Delete the ${catLabel(r.categoryId)} margin rule?`)) {
                          onRun(() => deletePricingRule(r.id));
                        }
                      }}
                      className="text-red-700 hover:text-red-900 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-5 py-3">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-background px-2.5 py-1.5 text-sm"
        >
          <option value="">Choose a category…</option>
          {available.map((c) => (
            <option key={c.id} value={c.id}>
              {catLabel(c.id)}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          max="500"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="40"
          className="w-20 rounded-lg border border-[var(--border)] bg-background px-2 py-1.5 text-right font-mono text-sm"
        />
        <span className="text-sm text-muted">%</span>
        <label className="flex items-center gap-1 text-xs text-muted">
          <input
            type="checkbox"
            checked={priority}
            onChange={(e) => setPriority(e.target.checked)}
            className="accent-accent"
          />
          Overrides customer margins
        </label>
        <button
          type="button"
          disabled={busy || !categoryId || value.trim() === ""}
          onClick={async () => {
            const ok = await onRun(() =>
              upsertPricingRule({
                scope: "category",
                categoryId,
                marginPercent: parseFloat(value),
                isPriority: priority,
              }),
            );
            if (ok) {
              setCategoryId("");
              setValue("");
              setPriority(false);
            }
          }}
          className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
        >
          <Plus size={12} /> Add rule
        </button>
      </div>
    </section>
  );
}

function CustomerRulesCard({
  rules,
  customers,
  custName,
  busy,
  onRun,
}: {
  rules: PricingRule[];
  customers: Customer[];
  custName: (id: string | null) => string;
  busy: boolean;
  onRun: Run;
}) {
  const usedIds = new Set(rules.map((r) => r.customerId));
  const available = customers.filter((c) => !usedIds.has(c.id));
  const [customerId, setCustomerId] = useState("");
  const [value, setValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-surface">
      <header className="border-b border-[var(--border)] px-5 py-4">
        <h2 className="font-display text-lg font-semibold text-brand-deep">Customer margins</h2>
        <p className="text-xs text-muted">
          One margin per customer. 0% = sell at cost. Beaten only by manual prices and
          priority category rules.
        </p>
      </header>

      {rules.length > 0 && (
        <ul className="divide-y divide-[var(--border)]">
          {rules.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{custName(r.customerId)}</span>
                {editingId === r.id ? (
                  <span className="inline-flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="500"
                      step="0.01"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-20 rounded-md border border-[var(--border)] bg-background px-2 py-1 text-right font-mono text-sm"
                    />
                    <span className="text-xs text-muted">%</span>
                  </span>
                ) : (
                  <span
                    className={`font-mono text-sm font-semibold ${r.isActive ? "text-brand-deep" : "text-muted line-through"}`}
                  >
                    cost + {r.marginPercent}%
                  </span>
                )}
                {!r.isActive && editingId !== r.id && (
                  <span className="inline-flex rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                    Off
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs font-medium">
                {editingId === r.id ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        const ok = await onRun(() =>
                          upsertPricingRule({
                            scope: "customer",
                            customerId: r.customerId,
                            marginPercent: parseFloat(editValue),
                            isActive: r.isActive,
                          }),
                        );
                        if (ok) setEditingId(null);
                      }}
                      className="text-brand hover:text-accent disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-muted">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRun(() => togglePricingRule(r.id, !r.isActive))}
                      className="text-muted hover:text-foreground disabled:opacity-50"
                    >
                      {r.isActive ? "Turn off" : "Turn on"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(r.id);
                        setEditValue(String(r.marginPercent));
                      }}
                      className="text-brand hover:text-accent"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Delete ${custName(r.customerId)}'s margin rule?`)) {
                          onRun(() => deletePricingRule(r.id));
                        }
                      }}
                      className="text-red-700 hover:text-red-900 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-5 py-3">
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-background px-2.5 py-1.5 text-sm"
        >
          <option value="">Choose a customer…</option>
          {available.map((c) => (
            <option key={c.id} value={c.id}>
              {c.businessName}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          max="500"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="15"
          className="w-20 rounded-lg border border-[var(--border)] bg-background px-2 py-1.5 text-right font-mono text-sm"
        />
        <span className="text-sm text-muted">%</span>
        <button
          type="button"
          disabled={busy || !customerId || value.trim() === ""}
          onClick={async () => {
            const ok = await onRun(() =>
              upsertPricingRule({ scope: "customer", customerId, marginPercent: parseFloat(value) }),
            );
            if (ok) {
              setCustomerId("");
              setValue("");
            }
          }}
          className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
        >
          <Plus size={12} /> Add margin
        </button>
      </div>
    </section>
  );
}
