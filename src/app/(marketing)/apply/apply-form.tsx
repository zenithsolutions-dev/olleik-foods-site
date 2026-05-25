"use client";

import { useActionState } from "react";
import { submitApplication, type ApplyState } from "./actions";

const initial: ApplyState = { status: "idle", message: "" };

const businessTypes = [
  "Restaurant",
  "Café / coffee shop",
  "Bakery",
  "Catering",
  "Food truck",
  "Grocery / convenience",
  "Hotel / institution",
  "Other",
];

const volumes = [
  "Under $2,000 / month",
  "$2,000 – $10,000 / month",
  "$10,000 – $50,000 / month",
  "Over $50,000 / month",
];

export default function ApplyForm() {
  const [state, action, pending] = useActionState(submitApplication, initial);

  if (state.status === "ok") {
    return (
      <div className="text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand-deep">
          ✓
        </div>
        <h2 className="mt-5 text-xl font-semibold text-brand-deep">
          Application received
        </h2>
        <p className="mt-2 text-sm text-muted">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Business name" name="businessName" required />
        <Field label="Contact name" name="contactName" required />
        <Field label="Email" name="email" type="email" required />
        <Field label="Phone" name="phone" type="tel" required />
      </div>

      <Field label="Business address" name="address" />

      <div className="grid gap-5 md:grid-cols-2">
        <Select label="Business type" name="businessType" options={businessTypes} />
        <Select label="Estimated monthly purchase volume" name="monthlyVolume" options={volumes} />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-foreground">
          Anything we should know?
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          className="mt-1.5 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          placeholder="Hours, delivery windows, products you need, dietary requirements..."
        />
      </div>

      {state.status === "error" && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Submitting..." : "Submit application"}
      </button>

      <p className="text-xs text-muted">
        By submitting, you agree to be contacted by Olleik Foods about your
        wholesale account.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-foreground">
        {label} {required && <span className="text-accent">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="mt-1.5 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
    </div>
  );
}

function Select({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: string[];
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue=""
        className="mt-1.5 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      >
        <option value="" disabled>
          Select...
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
