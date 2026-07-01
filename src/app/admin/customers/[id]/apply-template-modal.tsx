"use client";

import { useState } from "react";
import type { OfferTemplate } from "@/lib/admin/types";
import { formatDiscount } from "@/lib/admin/offers-format";

// Apply a template to this customer as a snapshot. Optional product link is
// constrained to the customer's ASSIGNED products (decision #3); empty = an
// account-wide offer. Only NON-archived templates are offered.
export function ApplyTemplateModal({
  templates,
  assignedProducts,
  appliedTemplateIds,
  busy,
  onClose,
  onApply,
}: {
  templates: OfferTemplate[];
  assignedProducts: { id: string; name: string }[];
  appliedTemplateIds: string[];
  busy: boolean;
  onClose: () => void;
  onApply: (
    templateId: string,
    overrides: { title?: string; productId: string | null; startsAt: string | null; endsAt: string | null },
  ) => void;
}) {
  const active = templates.filter((t) => !t.isArchived);
  const [templateId, setTemplateId] = useState<string>(active[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [productId, setProductId] = useState<string>(""); // "" = account-wide
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const template = active.find((t) => t.id === templateId);
  const alreadyApplied = templateId !== "" && appliedTemplateIds.includes(templateId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-deep/40 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="my-10 w-full max-w-lg rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-2xl"
      >
        <h3 className="font-display text-xl font-semibold text-brand-deep">Apply offer template</h3>
        <p className="mt-1 text-xs text-muted">
          Copies the template&apos;s discount onto this customer as a new offer (a snapshot — later
          template edits won&apos;t change it).
        </p>

        {active.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-muted">
            No active templates. Create one in the Offer library first.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
              <span className="uppercase tracking-wider">Template</span>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={fieldCls}>
                {active.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {formatDiscount(t.discountKind, t.discountValue)
                      ? ` — ${formatDiscount(t.discountKind, t.discountValue)}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
              <span className="uppercase tracking-wider">Title override (optional)</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={fieldCls}
                placeholder={template?.name ?? "Offer title"}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
              <span className="uppercase tracking-wider">Apply to product (optional)</span>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} className={fieldCls}>
                <option value="">— Account-wide (no specific product) —</option>
                {assignedProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {assignedProducts.length === 0 && (
                <span className="text-[11px] text-muted-soft">
                  This customer has no assigned products yet — offer will be account-wide.
                </span>
              )}
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
                <span className="uppercase tracking-wider">Starts (optional)</span>
                <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={fieldCls} />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
                <span className="uppercase tracking-wider">Ends (optional)</span>
                <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={fieldCls} />
              </label>
            </div>

            {alreadyApplied && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This template is already applied to this customer. Applying again creates a second offer.
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium text-foreground/80 hover:border-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !template}
            onClick={() =>
              onApply(templateId, {
                title: title.trim() || undefined,
                productId: productId || null,
                startsAt: startsAt || null,
                endsAt: endsAt || null,
              })
            }
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
          >
            {busy ? "Applying…" : "Apply template"}
          </button>
        </div>
      </div>
    </div>
  );
}

const fieldCls =
  "w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";
