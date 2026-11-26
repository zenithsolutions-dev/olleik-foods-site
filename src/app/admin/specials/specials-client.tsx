"use client";

import { useActionState, useState, useTransition } from "react";
import type { SpecialState } from "@/lib/specials";
import { ShareButtons } from "@/components/specials/share-buttons";
import { deleteSpecial, saveSpecial, setSpecialPublished, type SpecialFormState, type SpecialFormValues } from "./actions";

export type AdminSpecial = {
  id: string;
  state: SpecialState;
  title: string;
  priceCents: number;
  unitLabel: string | null;
  sold: number;
  total: number;
  remaining: number;
  isPublished: boolean;
  url: string;
  whatsappUrl: string;
  values: SpecialFormValues;
};
type ProductOption = { id: string; name: string; unitLabel: string; imageUrl: string };

const STATE_LABELS: Record<SpecialState, { label: string; tone: string }> = {
  live: { label: "Live", tone: "bg-emerald-50 text-emerald-800" },
  sold_out: { label: "Sold out", tone: "bg-zinc-200 text-zinc-700" },
  scheduled: { label: "Scheduled", tone: "bg-sky-50 text-sky-800" },
  ended: { label: "Ended", tone: "bg-zinc-100 text-zinc-600" },
  draft: { label: "Draft", tone: "bg-amber-50 text-amber-800" },
};

const EMPTY: SpecialFormValues = {
  id: "",
  product_id: "",
  title: "",
  description: "",
  unit_label: "",
  image_url: "",
  price: "",
  quantity_total: "",
  start_date: "",
  end_date: "",
  is_published: true,
  show_price_to_guests: true,
};

const inputCls =
  "mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function SpecialsClient({ specials, products }: { specials: AdminSpecial[]; products: ProductOption[] }) {
  // null = form closed. The form is keyed by what it edits, so opening another special starts clean.
  const [editing, setEditing] = useState<SpecialFormValues | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [isBusy, startTransition] = useTransition();

  const run = (action: () => Promise<{ ok: boolean; message: string }>) =>
    startTransition(async () => setNotice(await action()));

  return (
    <div className="space-y-6">
      {editing ? (
        <SpecialForm key={editing.id || "new"} initial={editing} products={products} onClose={() => setEditing(null)} />
      ) : (
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setEditing(EMPTY);
          }}
          className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"
        >
          New special
        </button>
      )}

      {notice && (
        <p role={notice.ok ? "status" : "alert"} className={`text-sm font-medium ${notice.ok ? "text-emerald-700" : "text-red-700"}`}>
          {notice.message}
        </p>
      )}

      {specials.length === 0 ? (
        <p className="max-w-xl rounded-xl border border-dashed border-[var(--border)] bg-surface p-6 text-sm text-muted">
          No specials yet. Create one to put a limited-quantity deal in front of every visitor.
        </p>
      ) : (
        <ul className="space-y-3">
          {specials.map((s) => (
            <li key={s.id} className="rounded-xl border border-[var(--border)] bg-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-semibold text-brand-deep">{s.title}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATE_LABELS[s.state].tone}`}>
                      {STATE_LABELS[s.state].label}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    <span className="font-semibold tabular-nums text-foreground">{money(s.priceCents)}</span>
                    {s.unitLabel ? ` per ${s.unitLabel}` : ""} ·{" "}
                    <span className="tabular-nums">
                      {s.sold.toLocaleString("en-CA")} sold, {s.remaining.toLocaleString("en-CA")} left of {s.total.toLocaleString("en-CA")}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setEditing(s.values)} className="h-10 rounded-full border border-[var(--border-strong)] px-4 text-xs font-semibold text-brand-deep hover:border-brand">
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => run(() => setSpecialPublished(s.id, !s.isPublished))}
                    className="h-10 rounded-full border border-[var(--border-strong)] px-4 text-xs font-semibold text-brand-deep hover:border-brand disabled:opacity-60"
                  >
                    {s.isPublished ? "Take off the site" : "Publish"}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      if (window.confirm(`Delete “${s.title}”? Orders already placed keep their prices.`)) run(() => deleteSpecial(s.id));
                    }}
                    className="h-10 rounded-full border border-red-200 px-4 text-xs font-semibold text-red-700 hover:border-red-400 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {(s.state === "live" || s.state === "sold_out") && (
                <div className="mt-4 border-t border-[var(--border)] pt-4">
                  <ShareButtons whatsappUrl={s.whatsappUrl} url={s.url} compact />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SpecialForm({ initial, products, onClose }: { initial: SpecialFormValues; products: ProductOption[]; onClose: () => void }) {
  const [state, action, isPending] = useActionState<SpecialFormState, FormData>(saveSpecial, null);
  const v = state?.values ?? initial;
  // Picking a product fills in what is known about it; every field stays editable.
  const [prefill, setPrefill] = useState<ProductOption | null>(null);
  const isNew = !initial.id;
  // After a rejected save, what the admin typed wins over the product's details.
  const picked = state ? null : prefill;

  if (state?.ok) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
        <span role="status">{state.message}</span>
        <button type="button" onClick={onClose} className="font-semibold underline">
          Done
        </button>
      </div>
    );
  }

  const field = (name: keyof SpecialFormValues, label: string, hint: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <input id={name} name={name} defaultValue={String(v[name] ?? "")} aria-describedby={`${name}-hint`} className={inputCls} {...props} />
      <p id={`${name}-hint`} className="mt-1 text-xs text-muted">
        {hint}
      </p>
    </div>
  );

  return (
    <form action={action} className="max-w-2xl space-y-5 rounded-xl border border-[var(--border)] bg-surface p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold text-brand-deep">{isNew ? "New special" : "Edit special"}</h2>
      <input type="hidden" name="id" value={initial.id} />

      <div>
        <label htmlFor="product_id" className="block text-sm font-medium text-foreground">
          Product
        </label>
        <select
          // Keyed by the value so a rejected save keeps the chosen product (React resets a <select> to the
          // option it was first rendered with).
          key={v.product_id}
          id="product_id"
          name="product_id"
          required
          defaultValue={v.product_id}
          onChange={(e) => setPrefill(products.find((p) => p.id === e.target.value) ?? null)}
          className={inputCls}
        >
          <option value="">Choose a product…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.unitLabel})
            </option>
          ))}
        </select>
      </div>

      {/* Keyed by the picked product so its details replace the defaults; typing afterwards is kept. */}
      <div key={prefill?.id ?? "as-loaded"} className="space-y-5">
        {field("title", "Title", "What visitors read first, e.g. “Olive oil 3 L tins — pallet deal”.", { required: true, maxLength: 120, defaultValue: picked && isNew ? picked.name : v.title })}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-foreground">
            Description (optional)
          </label>
          <textarea id="description" name="description" rows={2} maxLength={500} defaultValue={v.description} className={inputCls} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {field("price", "Special price ($)", "Per unit.", { required: true, inputMode: "decimal", placeholder: "18.99" })}
          {field("unit_label", "Unit", "What one unit is.", { placeholder: "3 L / tin", defaultValue: picked ? picked.unitLabel : v.unit_label })}
          {field("quantity_total", "Quantity available", "The special stops when this many are ordered.", { required: true, inputMode: "numeric", placeholder: "500" })}
          {field("image_url", "Picture (optional)", "A web address. Filled from the product when it has one.", { type: "url", defaultValue: picked ? picked.imageUrl : v.image_url })}
          {field("start_date", "Starts (optional)", "Leave empty to start now.", { type: "date" })}
          {field("end_date", "Ends (optional)", "Last day it runs. Leave empty for no end.", { type: "date" })}
        </div>
      </div>

      <div className="space-y-1">
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-foreground">
          <input type="checkbox" name="is_published" defaultChecked={v.is_published} className="h-5 w-5" />
          Show on the website
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-foreground">
          <input type="checkbox" name="show_price_to_guests" defaultChecked={v.show_price_to_guests} className="h-5 w-5" />
          Show the price to visitors who are not signed in
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={isPending} className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60">
          {isPending ? "Saving…" : "Save special"}
        </button>
        <button type="button" onClick={onClose} className="rounded-md px-4 py-2.5 text-sm font-semibold text-muted hover:text-foreground">
          Cancel
        </button>
        {state && !state.ok && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
