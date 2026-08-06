"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Pencil, Archive, RotateCcw, Users } from "lucide-react";
import type { OfferDiscountKind, OfferTemplate } from "@/lib/admin/types";
import { formatDiscount } from "@/lib/admin/offers-format";
import {
  createOfferTemplate,
  updateOfferTemplate,
  setOfferTemplateArchived,
  type OfferTemplateInput,
} from "./actions";

export function OffersClient({
  templates,
  live,
}: {
  templates: OfferTemplate[];
  live: boolean;
}) {
  const [view, setView] = useState<"active" | "archived">("active");
  const [modal, setModal] = useState<{ open: boolean; template: OfferTemplate | null }>({
    open: false,
    template: null,
  });
  const [busy, setBusy] = useState(false);

  const visible = templates.filter((t) => (view === "active" ? !t.isArchived : t.isArchived));
  const archivedCount = templates.filter((t) => t.isArchived).length;

  async function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(true);
    const r = await action();
    setBusy(false);
    if (!r.ok) window.alert(r.message ?? "Something went wrong.");
    return r.ok;
  }

  return (
    <div className="space-y-6">
      {!live && (
        <p className="rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          Showing demo state — Supabase isn&apos;t configured, so templates won&apos;t persist.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-[var(--border)] bg-surface p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setView("active")}
            className={`rounded-full px-4 py-1.5 font-medium ${
              view === "active" ? "bg-accent text-white" : "text-muted hover:text-foreground"
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setView("archived")}
            className={`rounded-full px-4 py-1.5 font-medium ${
              view === "archived" ? "bg-accent text-white" : "text-muted hover:text-foreground"
            }`}
          >
            Archived {archivedCount > 0 && `(${archivedCount})`}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setModal({ open: true, template: null })}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(200,122,42,0.6)] hover:bg-accent-deep"
        >
          <Plus size={14} /> New template
        </button>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-surface">
        {visible.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted">
            {view === "active"
              ? "No templates yet. Create one to reuse it across customers."
              : "No archived templates."}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {visible.map((t) => (
              <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{t.name}</p>
                    <span className="inline-flex rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-deep">
                      {formatDiscount(t.discountKind, t.discountValue) ?? "No discount"}
                    </span>
                  </div>
                  {t.description && <p className="mt-1 text-sm text-muted">{t.description}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs font-medium">
                  {/* CP-8a-2: push this offer to many customers at once. */}
                  {!t.isArchived && (
                    <Link
                      href={`/admin/offers/apply/${t.id}`}
                      className="inline-flex items-center gap-1 text-brand hover:text-accent"
                    >
                      <Users size={13} /> Apply to many…
                    </Link>
                  )}
                  {!t.isArchived && (
                    <button
                      type="button"
                      onClick={() => setModal({ open: true, template: t })}
                      className="inline-flex items-center gap-1 text-brand hover:text-accent"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                  )}
                  {t.isArchived ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => setOfferTemplateArchived(t.id, false))}
                      className="inline-flex items-center gap-1 text-brand hover:text-accent disabled:opacity-50"
                    >
                      <RotateCcw size={13} /> Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Archive template “${t.name}”? Already-applied offers are kept.`)) {
                          run(() => setOfferTemplateArchived(t.id, true));
                        }
                      }}
                      className="inline-flex items-center gap-1 text-muted hover:text-foreground disabled:opacity-50"
                    >
                      <Archive size={13} /> Archive
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {modal.open && (
        <TemplateModal
          initial={modal.template}
          onClose={() => setModal({ open: false, template: null })}
          onSave={async (values) => {
            const ok = await run(() =>
              modal.template
                ? updateOfferTemplate(modal.template.id, values)
                : createOfferTemplate(values),
            );
            if (ok) setModal({ open: false, template: null });
          }}
        />
      )}
    </div>
  );
}

// Shared discount editor used here AND in the customer OfferModal: a kind select
// + a value input that adapts (percent = whole number; fixed_price/amount_off =
// dollars, stored as cents). `allowNone` lets the customer offer be informational.
export function DiscountFields({
  kind,
  setKind,
  valueText,
  setValueText,
  allowNone = false,
}: {
  kind: OfferDiscountKind | null;
  setKind: (k: OfferDiscountKind | null) => void;
  valueText: string;
  setValueText: (v: string) => void;
  allowNone?: boolean;
}) {
  const isPercent = kind === "percent";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
        <span className="uppercase tracking-wider">Discount type</span>
        <select
          value={kind ?? "none"}
          onChange={(e) => setKind(e.target.value === "none" ? null : (e.target.value as OfferDiscountKind))}
          className={fieldCls}
        >
          {allowNone && <option value="none">None (informational)</option>}
          <option value="percent">Percent off</option>
          <option value="fixed_price">Fixed price</option>
          <option value="amount_off">Amount off</option>
        </select>
      </label>
      {kind && (
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
          <span className="uppercase tracking-wider">{isPercent ? "Percent (0–100)" : "Amount ($)"}</span>
          <div className="inline-flex items-center gap-1">
            {!isPercent && <span className="text-sm text-muted">$</span>}
            <input
              type="number"
              min="0"
              max={isPercent ? "100" : undefined}
              step={isPercent ? "1" : "0.01"}
              value={valueText}
              onChange={(e) => setValueText(e.target.value)}
              className={fieldCls}
              placeholder={isPercent ? "10" : "0.00"}
            />
            {isPercent && <span className="text-sm text-muted">%</span>}
          </div>
        </label>
      )}
    </div>
  );
}

// Convert the discount editor's text into the integer stored value (cents for
// money kinds, whole percent for percent). null kind => null value.
export function parseDiscountValue(
  kind: OfferDiscountKind | null,
  valueText: string,
): number | null {
  if (!kind) return null;
  const n = parseFloat(valueText);
  if (!Number.isFinite(n)) return NaN; // caller validates
  return kind === "percent" ? Math.round(n) : Math.round(n * 100);
}

// Inverse: stored value -> editor text (dollars for money kinds).
export function discountValueToText(
  kind: OfferDiscountKind | null,
  value: number | null | undefined,
): string {
  if (!kind || value == null) return "";
  return kind === "percent" ? String(value) : (value / 100).toFixed(2);
}

function TemplateModal({
  initial,
  onClose,
  onSave,
}: {
  initial: OfferTemplate | null;
  onClose: () => void;
  onSave: (values: OfferTemplateInput) => void | Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [kind, setKind] = useState<OfferDiscountKind | null>(initial?.discountKind ?? "percent");
  const [valueText, setValueText] = useState(
    discountValueToText(initial?.discountKind ?? "percent", initial?.discountValue),
  );
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      discountKind: kind,
      discountValue: parseDiscountValue(kind, valueText),
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
          {initial ? "Edit template" : "New template"}
        </h3>
        <p className="mt-1 text-xs text-muted">
          A reusable discount. Apply it to a customer from their detail page.
        </p>

        <div className="mt-5 space-y-4">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            <span className="uppercase tracking-wider">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={fieldCls} placeholder="Seasonal 10% off" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            <span className="uppercase tracking-wider">Description (optional)</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={fieldCls} />
          </label>
          <DiscountFields kind={kind} setKind={setKind} valueText={valueText} setValueText={setValueText} />
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
            {saving ? "Saving…" : initial ? "Save changes" : "Create template"}
          </button>
        </div>
      </form>
    </div>
  );
}

const fieldCls =
  "w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";
