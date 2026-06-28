"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users, UserPlus } from "lucide-react";
import type { Lead } from "@/lib/admin/types";
import { CustomerFormModal } from "../customers-client";
import { InviteControls } from "../invite-controls";
import {
  createCustomer,
  convertLeadWithDetails,
  convertLeadsToCustomers,
  type CustomerInput,
  type ConvertOutcome,
} from "../actions";

type Converted = { businessName: string; customerId: string };

export function AddCustomerClient({ leads, live }: { leads: Lead[]; live: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<"leads" | "manual">("leads");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  // Newly created customers in this session → show invite affordance for each.
  const [converted, setConverted] = useState<Converted[]>([]);
  const [summary, setSummary] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function summarize(outcomes: ConvertOutcome[]) {
    const c = outcomes.filter((o) => o.result === "created").length;
    const l = outcomes.filter((o) => o.result === "linked").length;
    const s = outcomes.filter((o) => o.result === "skipped").length;
    const parts = [];
    if (c) parts.push(`${c} created`);
    if (l) parts.push(`${l} linked to existing`);
    if (s) parts.push(`${s} skipped`);
    return parts.join(" · ") || "Nothing to convert.";
  }

  async function bulkConvert() {
    if (selected.size === 0) return;
    setBusy(true);
    setSummary(null);
    const outcomes = await convertLeadsToCustomers([...selected]);
    setBusy(false);
    setSummary(summarize(outcomes));
    const created = outcomes
      .filter((o) => o.result === "created" && o.customerId)
      .map((o) => {
        const lead = leads.find((l) => l.id === o.leadId);
        return { businessName: lead?.businessName ?? "Customer", customerId: o.customerId! };
      });
    setConverted((prev) => [...created, ...prev]);
    setSelected(new Set());
    router.refresh();
  }

  async function reviewConvert(values: CustomerInput) {
    if (!reviewing) return;
    setSaving(true);
    setFormError(null);
    const outcome = await convertLeadWithDetails(reviewing.id, values);
    setSaving(false);
    if (outcome.result === "skipped") {
      setFormError(outcome.message ?? "Could not convert this lead.");
      return;
    }
    if (outcome.customerId) {
      setConverted((prev) => [{ businessName: values.businessName, customerId: outcome.customerId! }, ...prev]);
      setSummary(outcome.result === "linked" ? "Linked to an existing customer." : null);
    }
    setReviewing(null);
    router.refresh();
  }

  async function manualCreate(values: CustomerInput) {
    setSaving(true);
    setFormError(null);
    const r = await createCustomer(values);
    setSaving(false);
    if (!r.ok) {
      setFormError(r.message);
      return;
    }
    setManualOpen(false);
    router.push("/admin/customers");
  }

  return (
    <div className="space-y-6">
      {!live && (
        <p className="rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          Showing demo seed data — Supabase isn&apos;t configured, so changes won&apos;t persist.
        </p>
      )}

      {/* Tabs */}
      <div className="inline-flex rounded-full border border-[var(--border)] bg-surface p-0.5 text-sm">
        <TabButton active={tab === "leads"} onClick={() => setTab("leads")} icon={<Users size={14} />}>
          From approved leads{leads.length > 0 ? ` (${leads.length})` : ""}
        </TabButton>
        <TabButton active={tab === "manual"} onClick={() => setTab("manual")} icon={<UserPlus size={14} />}>
          Manual entry
        </TabButton>
      </div>

      {/* Invite affordance for everyone created/converted this session */}
      {converted.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-brand-mist/30 p-5">
          <p className="text-sm font-medium text-brand-deep">
            Created {converted.length} {converted.length === 1 ? "customer" : "customers"} — invite them now:
          </p>
          {converted.map((c) => (
            <div key={c.customerId} className="rounded-xl border border-[var(--border)] bg-surface p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{c.businessName}</span>
                <a href={`/admin/customers/${c.customerId}`} className="text-xs font-medium text-brand hover:text-accent">
                  Open account →
                </a>
              </div>
              <InviteControls customerId={c.customerId} invited={false} compact />
            </div>
          ))}
        </div>
      )}

      {summary && <p className="text-sm text-muted">{summary}</p>}

      {tab === "leads" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              Approved applications not yet converted. Select several to convert at once, or review one.
            </p>
            <button
              type="button"
              onClick={bulkConvert}
              disabled={busy || selected.size === 0}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
            >
              {busy ? "Converting…" : `Convert selected${selected.size ? ` (${selected.size})` : ""}`}
            </button>
          </div>

          {leads.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--border)] bg-surface p-10 text-center text-sm text-muted">
              No approved leads waiting. Approve applications on the{" "}
              <a href="/admin/leads" className="font-medium text-brand hover:text-accent">
                Leads
              </a>{" "}
              page, or add a customer manually.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-brand-mist/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                    <th className="px-4 py-3 w-8" />
                    <th className="px-4 py-3">Business</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} className="border-b border-[var(--border)] last:border-0 hover:bg-brand-mist/30">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(l.id)}
                          onChange={() => toggle(l.id)}
                          className="accent-accent"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{l.businessName}</p>
                        {l.businessType && <p className="text-xs text-muted">{l.businessType}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted">{l.contactName}</td>
                      <td className="px-4 py-3 text-muted">{l.email}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setFormError(null);
                            setReviewing(l);
                          }}
                          className="text-xs font-medium text-brand hover:text-accent"
                        >
                          Review &amp; convert
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-surface p-8 text-center">
          <p className="text-sm text-muted">
            For a walk-in or phone customer with no online application.
          </p>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setManualOpen(true);
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep"
          >
            <Plus size={14} /> New manual customer
          </button>
        </div>
      )}

      {/* Single convert: prefilled review form */}
      {reviewing && (
        <CustomerFormModal
          initial={{
            id: "",
            businessName: reviewing.businessName,
            contactName: reviewing.contactName,
            email: reviewing.email,
            phone: reviewing.phone,
            address: reviewing.address ?? "",
            status: "active",
            paymentTerms: "cod",
            createdAt: "",
          }}
          title="Convert lead to customer"
          submitLabel="Create customer"
          saving={saving}
          error={formError}
          onClose={() => setReviewing(null)}
          onSave={reviewConvert}
        />
      )}

      {/* Manual add */}
      {manualOpen && (
        <CustomerFormModal
          saving={saving}
          error={formError}
          onClose={() => setManualOpen(false)}
          onSave={manualCreate}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition ${
        active ? "bg-accent text-white" : "text-muted hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
