"use client";

import { useActionState } from "react";
import type { BusinessSettingsRow } from "@/lib/business";
import { saveBusinessSettings, type SettingsState } from "./actions";

const FIELDS: Array<{
  name: keyof BusinessSettingsRow;
  label: string;
  hint: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}> = [
  { name: "display_name", label: "Business name", hint: "Shown in the header and on every document.", required: true, autoComplete: "organization" },
  { name: "legal_name", label: "Legal name", hint: "The registered name printed on invoices and statements." },
  { name: "address", label: "Address", hint: "Full address including postal code.", autoComplete: "street-address" },
  { name: "phone", label: "Phone", hint: "Shown to customers and on documents.", type: "tel", autoComplete: "tel" },
  { name: "email", label: "Email", hint: "Shown to customers and on documents.", type: "email", autoComplete: "email" },
  { name: "whatsapp_number", label: "WhatsApp number", hint: "With country code, e.g. +1 613 555 0142. Used by the WhatsApp buttons.", type: "tel" },
];

export function SettingsForm({ initial }: { initial: BusinessSettingsRow }) {
  const [state, action, isPending] = useActionState<SettingsState, FormData>(saveBusinessSettings, null);

  return (
    <form action={action} className="max-w-xl space-y-5 rounded-xl border border-[var(--border)] bg-surface p-5 sm:p-6">
      {FIELDS.map((f) => (
        <div key={f.name}>
          <label htmlFor={f.name} className="block text-sm font-medium text-foreground">
            {f.label}
            {f.required && <span className="text-red-700"> *</span>}
          </label>
          <input
            id={f.name}
            name={f.name}
            type={f.type ?? "text"}
            required={f.required}
            autoComplete={f.autoComplete}
            defaultValue={state?.values?.[f.name] ?? initial[f.name] ?? ""}
            aria-describedby={`${f.name}-hint`}
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <p id={`${f.name}-hint`} className="mt-1 text-xs text-muted">
            {f.hint}
          </p>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        {state && (
          <p role={state.ok ? "status" : "alert"} className={`text-sm font-medium ${state.ok ? "text-emerald-700" : "text-red-700"}`}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
