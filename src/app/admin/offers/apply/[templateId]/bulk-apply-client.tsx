"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Send, Users } from "lucide-react";
import { formatMoney } from "@/lib/admin/store";
import { formatDiscount } from "@/lib/admin/offers-format";
import {
  buildBulkPreview,
  targetCustomers,
  BULK_BATCH_CAP,
  type BulkCustomerInput,
  type BulkTemplate,
  type TargetMode,
} from "@/lib/admin/bulk-offers";
import { applyTemplateBulk } from "../../actions";

// CP-8a-2 bulk apply UI. The governing standard: before applying he sees
// EXACTLY what will happen (per customer, including no-change customers and
// every skip with its reason); after applying, the confirmed preview IS the
// report, because the write is one atomic INSERT — all or nothing.

const WITHIN_OPTIONS = [30, 60, 90] as const;

export function BulkApplyClient({
  template,
  customers,
  live,
}: {
  template: BulkTemplate;
  customers: BulkCustomerInput[];
  live: boolean;
}) {
  const [mode, setMode] = useState<TargetMode>("all-active");
  const [withinDays, setWithinDays] = useState<30 | 60 | 90>(30);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [startsAt, setStartsAt] = useState("");
  // batch_id minted when THIS preview mounts a confirm — resubmits reuse it.
  const [batchId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ applied: number; alreadyApplied: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);

  // Resolve targeting, then let the pre-ticked list be pruned one by one
  // ("everyone except two" is two clicks — approved D-B1).
  const resolved = useMemo(
    () =>
      targetCustomers(customers, mode, now, {
        withinDays,
        pickedIds: [...picked],
      }),
    [customers, mode, now, withinDays, picked],
  );
  const finalTargets = useMemo(
    () => resolved.filter((c) => !unticked.has(c.id)),
    [resolved, unticked],
  );

  // Non-active customers are REPORTED as excluded, never silently missing.
  const inactive = useMemo(
    () => customers.filter((c) => c.status !== "active"),
    [customers],
  );

  const preview = useMemo(
    () =>
      buildBulkPreview({
        targets: finalTargets,
        template,
        window: { startsAt: startsAt || null, endsAt: endsAt || null },
        productId: null, // account-wide push; product-scoped stays a per-customer act
        now,
      }),
    [finalTargets, template, startsAt, endsAt, now],
  );

  async function confirm() {
    setBusy(true);
    setError(null);
    const res = await applyTemplateBulk({
      batchId,
      templateId: template.id,
      customers: preview.toApply.map((p) => ({ customerId: p.customerId, title: template.name })),
      productId: null,
      startsAt: startsAt || null,
      endsAt: endsAt || null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setDone({ applied: res.applied, alreadyApplied: res.alreadyApplied });
  }

  const discountLabel = formatDiscount(template.discountKind, template.discountValue);
  const searched = resolved.filter((c) =>
    c.businessName.toLowerCase().includes(search.trim().toLowerCase()),
  );

  if (done) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/admin/offers?tab=running" className="inline-flex items-center gap-1 text-sm text-brand hover:text-accent">
          <ArrowLeft size={14} /> Running now
        </Link>
        <div className="rounded-2xl border border-[var(--border)] bg-surface p-8">
          <h1 className="font-display text-2xl font-semibold text-brand-deep">
            {done.alreadyApplied ? "This batch was already applied" : "Batch applied"}
          </h1>
          <p className="mt-3 text-sm text-foreground/90">
            {done.alreadyApplied
              ? `These ${done.applied} offers were created by an earlier submission of this same preview — nothing was written twice.`
              : `"${template.name}" is now running on ${done.applied} customer${done.applied === 1 ? "" : "s"} — ${preview.customersWithMovement} with immediate price movement, ${preview.customersNoChange} where nothing changes (their prices were already at or below the offer).`}
          </p>
          <p className="mt-2 text-xs text-muted">
            The whole batch was written in one atomic statement. Undo it any time from{" "}
            <Link href="/admin/offers?tab=running" className="font-medium text-brand hover:text-accent">
              Running now → Applied batches
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/admin/offers" className="inline-flex items-center gap-1 text-sm text-brand hover:text-accent">
          <ArrowLeft size={14} /> Offer library
        </Link>
        <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight text-brand-deep">
          Apply “{template.name}” to many customers
        </h1>
        <p className="mt-1 text-sm text-muted">
          {discountLabel ?? "No discount (announcement only)"} · added ALONGSIDE existing offers —
          the best single discount still wins, never compounded.
        </p>
        {!live && (
          <p className="mt-3 rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            Demo state — Supabase isn&apos;t configured; nothing can be applied.
          </p>
        )}
      </div>

      {/* Targeting (approved D-B1: three sharp options) */}
      <section className="rounded-2xl border border-[var(--border)] bg-surface p-5">
        <h2 className="font-display text-base font-semibold text-brand-deep">Who gets it</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["all-active", "All active customers"],
              ["ordered-within", "Ordered recently"],
              ["hand-picked", "Hand-picked"],
            ] as [TargetMode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                mode === m ? "bg-accent text-white" : "border border-[var(--border-strong)] text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
          {mode === "ordered-within" && (
            <select
              value={withinDays}
              onChange={(e) => setWithinDays(Number(e.target.value) as 30 | 60 | 90)}
              className="rounded-full border border-[var(--border-strong)] bg-surface px-3 py-1.5 text-sm"
            >
              {WITHIN_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  within {d} days
                </option>
              ))}
            </select>
          )}
        </div>

        {mode === "hand-picked" && (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers…"
            className="mt-3 w-full rounded-lg border border-[var(--border-strong)] bg-surface px-3 py-2 text-sm"
          />
        )}

        {/* The resolved, pre-ticked, individually-prunable list. */}
        <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-[var(--border)]">
          {(mode === "hand-picked" ? searched : resolved).length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              {mode === "ordered-within"
                ? `No active customer has ordered within ${withinDays} days.`
                : mode === "hand-picked"
                  ? "Search and tick customers to target."
                  : "No active customers."}
            </p>
          ) : (
            (mode === "hand-picked" ? searched : resolved).map((c) => {
              const checked =
                mode === "hand-picked" ? picked.has(c.id) : !unticked.has(c.id);
              return (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2 text-sm last:border-b-0 hover:bg-brand-mist/20"
                >
                  <span className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        if (mode === "hand-picked") {
                          setPicked((s) => {
                            const n = new Set(s);
                            if (n.has(c.id)) n.delete(c.id);
                            else n.add(c.id);
                            return n;
                          });
                        } else {
                          setUnticked((s) => {
                            const n = new Set(s);
                            if (n.has(c.id)) n.delete(c.id);
                            else n.add(c.id);
                            return n;
                          });
                        }
                      }}
                    />
                    {c.businessName}
                  </span>
                  <span className="text-xs text-muted">
                    {c.lastOrderAt
                      ? `last order ${new Date(c.lastOrderAt).toLocaleDateString("en-CA", { dateStyle: "medium" })}`
                      : "no order in 90 days"}
                  </span>
                </label>
              );
            })
          )}
        </div>
        {mode === "hand-picked" && resolved.length === 0 && search === "" && (
          <p className="mt-2 text-xs text-muted">Tip: search above, then tick.</p>
        )}
        {inactive.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            Excluded from targeting: {inactive.length} customer{inactive.length === 1 ? "" : "s"} not
            active ({inactive.filter((c) => c.status === "pending").length} pending,{" "}
            {inactive.filter((c) => c.status === "archived").length} archived) — pending can&apos;t
            see portal prices yet; archived are soft-deleted.
          </p>
        )}
      </section>

      {/* Window */}
      <section className="rounded-2xl border border-[var(--border)] bg-surface p-5">
        <h2 className="font-display text-base font-semibold text-brand-deep">When</h2>
        <div className="mt-3 flex flex-wrap items-end gap-4 text-sm">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-muted">Starts (optional)</span>
            <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="rounded-lg border border-[var(--border-strong)] bg-surface px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-muted">Ends (optional)</span>
            <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="rounded-lg border border-[var(--border-strong)] bg-surface px-3 py-2" />
          </label>
          {!endsAt && (
            <p className="text-xs text-muted">
              No end date = runs until you deactivate or undo it. It will sit under
              &quot;Open-ended&quot; in Running now.
            </p>
          )}
        </div>
      </section>

      {/* The honest preview */}
      <section className="rounded-2xl border-2 border-brand bg-surface p-5">
        <h2 className="font-display text-base font-semibold text-brand-deep">
          Exactly what will happen
        </h2>

        {preview.overCap ? (
          <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
            {preview.toApply.length} customers targeted — above the {BULK_BATCH_CAP} cap. Narrow
            the selection and apply in parts. Nothing has been applied.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-foreground/90">
              <strong>{preview.toApply.length}</strong> customer
              {preview.toApply.length === 1 ? "" : "s"} get the offer —{" "}
              <strong>{preview.customersWithMovement}</strong> with immediate movement on{" "}
              <strong>{preview.totalProductsAffected}</strong> product
              {preview.totalProductsAffected === 1 ? "" : "s"}
              {preview.averageDropPct != null &&
                ` (average drop ${preview.averageDropPct.toFixed(1)}%)`}
              {preview.customersNoChange > 0 && (
                <>
                  , and <strong>{preview.customersNoChange}</strong> where{" "}
                  <em>nothing changes now</em> (their prices are already at or below the offer —
                  still applied, as ruled)
                </>
              )}
              .
            </p>

            {preview.toApply.length > 0 && (
              <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-[var(--border)] text-sm">
                {preview.toApply.map((p) => (
                  <div key={p.customerId} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2 last:border-b-0">
                    <span className="font-medium">{p.businessName}</span>
                    <span className="text-xs text-muted">
                      {p.effect.affectedCount === 0
                        ? "no price moves — already at or below"
                        : `${p.effect.affectedCount} product${p.effect.affectedCount === 1 ? "" : "s"} drop avg ${p.effect.averageDropPct?.toFixed(1)}%` +
                          (p.effect.example
                            ? ` · e.g. ${p.effect.example.name} ${formatMoney(p.effect.example.beforeCents)} → ${formatMoney(p.effect.example.afterCents)}`
                            : "")}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {preview.skipped.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  Skipped — with reasons, never silently ({preview.skipped.length})
                </p>
                <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-dashed border-[var(--border)] text-sm">
                  {preview.skipped.map((s) => (
                    <div key={s.customerId} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2 last:border-b-0">
                      <span>{s.businessName}</span>
                      <span className="text-xs text-muted">{s.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-xs text-muted">
                One atomic write — the whole batch or none of it. Undo is one click on Running now.
              </p>
              <button
                type="button"
                disabled={busy || !live || preview.toApply.length === 0}
                onClick={confirm}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(200,122,42,0.6)] hover:bg-accent-deep disabled:opacity-50"
              >
                {preview.toApply.length === 0 ? (
                  <>
                    <Users size={15} /> Nothing to apply
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    {busy ? "Applying…" : `Apply to ${preview.toApply.length} customer${preview.toApply.length === 1 ? "" : "s"}`}
                  </>
                )}
              </button>
            </div>
            {preview.toApply.length === 0 && (
              <p className="mt-2 text-right text-xs text-muted">
                Every targeted customer was skipped — nothing will be created anywhere.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
