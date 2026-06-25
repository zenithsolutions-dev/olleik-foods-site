"use client";

import { useMemo, useState, useTransition } from "react";
import { formatDate } from "@/lib/admin/store";
import type { Lead, LeadStatus } from "@/lib/admin/types";
import { updateLeadStatus, deleteLead } from "./actions";

const STATUSES: LeadStatus[] = ["new", "contacted", "approved", "rejected"];

export function LeadsClient({
  initialLeads,
  live,
}: {
  initialLeads: Lead[];
  live: boolean;
}) {
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [pending, startTransition] = useTransition();

  // Source of truth is the server prop. After a mutation, the action calls
  // revalidatePath("/admin/leads") so this component re-renders with fresh rows.
  const leads = initialLeads;

  const filtered = useMemo(
    () => (filter === "all" ? leads : leads.filter((l) => l.status === filter)),
    [leads, filter],
  );

  const counts: Record<LeadStatus | "all", number> = useMemo(() => {
    const m: Record<string, number> = { all: leads.length };
    for (const s of STATUSES) m[s] = leads.filter((l) => l.status === s).length;
    return m as Record<LeadStatus | "all", number>;
  }, [leads]);

  function onStatusChange(id: string, status: LeadStatus) {
    startTransition(() => updateLeadStatus(id, status));
  }

  function onDelete(id: string, businessName: string) {
    if (window.confirm(`Delete lead from ${businessName}?`)) {
      startTransition(() => deleteLead(id));
    }
  }

  return (
    <div className="space-y-5">
      {!live && (
        <p className="rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          Showing demo seed data — Supabase isn&apos;t configured, so changes
          won&apos;t persist.
        </p>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-full border border-[var(--border)] bg-surface p-1.5">
        {(["all", ...STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
              filter === s
                ? "bg-brand text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            {s} <span className="ml-1 opacity-70">{counts[s]}</span>
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] bg-surface p-12 text-center text-sm text-muted">
          {leads.length === 0 ? "No leads yet." : "No leads match."}
        </p>
      ) : (
        <ul
          className={`space-y-3 transition-opacity ${pending ? "opacity-60" : ""}`}
        >
          {filtered.map((l) => (
            <li
              key={l.id}
              className="rounded-2xl border border-[var(--border)] bg-surface p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-semibold leading-tight text-brand-deep">
                      {l.businessName}
                    </h3>
                    <StatusBadge status={l.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {l.contactName} ·{" "}
                    <a href={`mailto:${l.email}`} className="underline-offset-2 hover:underline">
                      {l.email}
                    </a>{" "}
                    · <span className="font-mono">{l.phone}</span>
                  </p>
                  {l.message && (
                    <p className="mt-3 rounded-lg bg-brand-mist/40 p-3 text-sm italic text-foreground/85">
                      &ldquo;{l.message}&rdquo;
                    </p>
                  )}
                  <p className="mt-3 text-[11px] text-muted-soft">
                    Submitted {formatDate(l.submittedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <select
                    value={l.status}
                    disabled={pending}
                    onChange={(e) =>
                      onStatusChange(l.id, e.target.value as LeadStatus)
                    }
                    className="rounded-full border border-[var(--border)] bg-background px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onDelete(l.id, l.businessName)}
                    className="text-[11px] text-red-700 hover:text-red-900 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: LeadStatus }) {
  const cls =
    status === "new"
      ? "bg-accent-soft text-accent-deep"
      : status === "contacted"
        ? "bg-brand-mist text-brand-deep"
        : status === "approved"
          ? "bg-brand text-white"
          : "bg-zinc-200 text-zinc-600";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {status}
    </span>
  );
}
