"use client";

import { CheckCircle2, Circle } from "lucide-react";
import type { Activation, AssignedProduct } from "@/lib/admin/customers-data";

// Derived setup state for a customer — NO new columns, NO extra fetch. Every
// item is computed from data the detail page already loads:
//   invited   -> a Supabase Auth user is linked (activation !== "none")
//   assigned  -> has at least one customer_products row
//   priced    -> at least one assignment has a custom price
//   activated -> has signed in (Phase E activation derivation)
export function OnboardingChecklist({
  activation,
  assigned,
  onAssignClick,
}: {
  activation: Activation;
  assigned: AssignedProduct[];
  onAssignClick?: () => void;
}) {
  const items: { label: string; done: boolean; action?: () => void; actionLabel?: string }[] = [
    { label: "Invited to the portal", done: activation !== "none" },
    {
      label: "Has at least one assigned product",
      done: assigned.length > 0,
      action: assigned.length === 0 ? onAssignClick : undefined,
      actionLabel: "Add products",
    },
    { label: "Custom pricing set", done: assigned.some((a) => a.priceCents != null) },
    { label: "Activated (signed in)", done: activation === "active" },
  ];
  const completed = items.filter((i) => i.done).length;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-brand-deep">Setup checklist</h2>
        <span className="text-xs font-medium text-muted">
          {completed} of {items.length} complete
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-2.5 text-sm">
            {it.done ? (
              <CheckCircle2 size={18} className="shrink-0 text-brand" />
            ) : (
              <Circle size={18} className="shrink-0 text-muted-soft" />
            )}
            <span className={it.done ? "text-foreground" : "text-muted"}>{it.label}</span>
            {!it.done && it.action && (
              <button
                type="button"
                onClick={it.action}
                className="ml-auto text-xs font-medium text-brand hover:text-accent"
              >
                {it.actionLabel} →
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
