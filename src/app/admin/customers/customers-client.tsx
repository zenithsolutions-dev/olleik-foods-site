"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useAdmin } from "@/lib/admin/store";
import type { Customer, CustomerStatus } from "@/lib/admin/types";

const STATUSES: CustomerStatus[] = ["active", "pending", "suspended"];

export function CustomersClient() {
  const { state, dispatch, hydrated } = useAdmin();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cp of state.customerProducts)
      map[cp.customerId] = (map[cp.customerId] ?? 0) + 1;
    return map;
  }, [state.customerProducts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return state.customers;
    return state.customers.filter(
      (c) =>
        c.businessName.toLowerCase().includes(q) ||
        c.contactName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [state.customers, query]);

  if (!hydrated) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-soft" />
          <input
            type="text"
            placeholder="Search business, contact, email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-full border border-[var(--border)] bg-surface py-2 pl-9 pr-4 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(200,122,42,0.6)] hover:bg-accent-deep"
        >
          <Plus size={14} /> Add customer
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 && (
          <p className="col-span-full rounded-2xl border border-dashed border-[var(--border)] bg-surface p-10 text-center text-sm text-muted">
            No customers match.
          </p>
        )}
        {filtered.map((c) => (
          <Link
            key={c.id}
            href={`/admin/customers/${c.id}`}
            className="block rounded-2xl border border-[var(--border)] bg-surface p-5 transition hover:border-[var(--border-strong)] hover:shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-semibold leading-tight text-brand-deep">
                  {c.businessName}
                </h3>
                <p className="mt-0.5 text-xs text-muted">{c.contactName}</p>
              </div>
              <StatusBadge status={c.status} />
            </div>
            <dl className="mt-4 space-y-1.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-soft">Phone</dt>
                <dd className="font-mono text-foreground">{c.phone}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-soft">Terms</dt>
                <dd className="text-foreground/80">{c.paymentTerms}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-soft">Catalog</dt>
                <dd className="text-foreground/80">{counts[c.id] ?? 0} products</dd>
              </div>
            </dl>
            <p className="mt-4 text-[11px] text-accent">View account →</p>
          </Link>
        ))}
      </div>

      {creating && (
        <CustomerFormModal
          onClose={() => setCreating(false)}
          onSave={(values) => {
            dispatch({ type: "customer/add", input: values });
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: CustomerStatus }) {
  const cls =
    status === "active"
      ? "bg-brand text-white"
      : status === "pending"
        ? "bg-accent-soft text-accent-deep"
        : "bg-zinc-200 text-zinc-600";
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {status}
    </span>
  );
}

export function CustomerFormModal({
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  initial?: Customer | null;
  onClose: () => void;
  onSave: (values: Omit<Customer, "id" | "createdAt">) => void;
  onDelete?: () => void;
}) {
  const [businessName, setBusinessName] = useState(initial?.businessName ?? "");
  const [contactName, setContactName] = useState(initial?.contactName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [status, setStatus] = useState<CustomerStatus>(initial?.status ?? "pending");
  const [paymentTerms, setPaymentTerms] = useState<Customer["paymentTerms"]>(
    initial?.paymentTerms ?? "card-on-file"
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-deep/40 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            businessName: businessName.trim(),
            contactName: contactName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            address: address.trim(),
            status,
            paymentTerms,
            notes: notes.trim() || undefined,
          });
        }}
        onClick={(e) => e.stopPropagation()}
        className="my-10 w-full max-w-xl rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-2xl"
      >
        <h3 className="font-display text-xl font-semibold text-brand-deep">
          {initial ? "Edit customer" : "New customer"}
        </h3>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Business name" full>
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Contact name">
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Phone">
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as CustomerStatus)} className={inputCls}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Address" full>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Payment terms" full>
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value as Customer["paymentTerms"])}
              className={inputCls}
            >
              <option value="net-15">Net 15</option>
              <option value="net-30">Net 30</option>
              <option value="card-on-file">Card on file</option>
              <option value="cod">COD</option>
            </select>
          </Field>
          <Field label="Notes (optional)" full>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} />
          </Field>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          {onDelete ? (
            <button type="button" onClick={onDelete} className="text-xs font-medium text-red-700 hover:text-red-900">
              Delete customer
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium text-foreground/80 hover:border-accent"
            >
              Cancel
            </button>
            <button type="submit" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep">
              {initial ? "Save changes" : "Create customer"}
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
