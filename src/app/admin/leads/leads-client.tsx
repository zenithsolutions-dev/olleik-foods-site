"use client";

import { useMemo, useState } from "react";
import { useAdmin, formatDate } from "@/lib/admin/store";
import type { LeadStatus } from "@/lib/admin/types";

const STATUSES: LeadStatus[] = ["new", "contacted", "approved", "rejected"];

export function LeadsClient() {
  const { state, dispatch, hydrated } = useAdmin();
  const [filter, setFilter] = useState<LeadStatus | "all">("all");

  const filtered = useMemo(
    () =>
      filter === "all"
        ? state.leads
        : state.leads.filter((l) => l.status === filter),
    [state.leads, filter]
  );

  const counts: Record<LeadStatus | "all", number> = useMemo(() => {
    const m: Record<string, number> = { all: state.leads.length };
    for (const s of STATUSES) m[s] = state.leads.filter((l) => l.status === s).length;
    return m as Record<LeadStatus | "all", number>;
  }, [state.leads]);

  if (!hydrated) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="space-y-5">
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
          No leads match.
        </p>
      ) : (
        <ul className="space-y-3">
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
                    onChange={(e) =>
                      dispatch({
                        type: "lead/updateStatus",
                        id: l.id,
                        status: e.target.value as LeadStatus,
                      })
                    }
                    className="rounded-full border border-[var(--border)] bg-background px-3 py-1.5 text-xs font-medium"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete lead from ${l.businessName}?`)) {
                        dispatch({ type: "lead/delete", id: l.id });
                      }
                    }}
                    className="text-[11px] text-red-700 hover:text-red-900"
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
