"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/require-admin";
import { validMarginPercent } from "@/lib/admin/pricing-engine";
import { guardAction } from "@/lib/admin/action-guard";
import {
  autoRecomputeForScope,
  computeRecomputeRows,
  writeRecomputeRows,
  type RecomputeRow,
  type RecomputeScope,
} from "@/lib/admin/recompute";
import type { PricingRuleScope } from "@/lib/admin/types";

// Cost & margin-rule mutations + recompute. ADMIN-ONLY: every action re-checks
// requireAdmin() and uses the service-role client on the deny-all tables
// (product_costs / pricing_rules / customer_product_pricing_meta). Nothing here
// is ever reachable from portal code.
//
// CP-1 AUTOPILOT: every cost/rule mutation ends with an automatic, scoped,
// server-side recompute of the affected COMPUTED rows (manual prices are never
// auto-touched — the math and I/O live in @/lib/admin/recompute). The manual
// Recompute button remains as the audit tool and the only path that can
// intentionally reset manual prices.

// D6 note: server-action files may only export async functions, so the
// maxDuration=60 budget for autopilot sweeps lives on the PAGES that invoke
// these actions (admin/pricing, admin/products, admin/customers/[id]).

export type ActionResult =
  | { ok: true; updated?: number; customersTouched?: number; warning?: string }
  | { ok: false; message: string };

// NOTE: never `export type { ... }` (re-export syntax) from a "use server"
// file — the server-actions loader emits it as a RUNTIME export of a
// type-only identifier, so the module throws "ReferenceError: RecomputeScope
// is not defined" at evaluation and EVERY action in it 500s (2026-07-30 prod
// incident; the build passes because evaluation happens on first invocation).
// Import RecomputeScope/RecomputeRow from "@/lib/admin/recompute" directly.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidatePricing(customerId?: string) {
  revalidatePath("/admin/pricing");
  revalidatePath("/admin/products");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/assign");
  if (customerId) revalidatePath(`/admin/customers/${customerId}`);
}

type SweepOutcome = Awaited<ReturnType<typeof autoRecomputeForScope>>;

function sweepResult(prefix: string, swept: SweepOutcome): ActionResult {
  if ("error" in swept) {
    return { ok: true, updated: 0, warning: `${prefix}, but auto-update failed: ${swept.error}` };
  }
  return { ok: true, updated: swept.updated, customersTouched: swept.customers, warning: swept.warning };
}

// ---------------- Product cost ----------------

export async function setProductCost(
  productId: string,
  costCents: number | null,
): Promise<ActionResult> {
  await requireAdmin();
  return guardAction("setProductCost", async () => {
  if (!UUID_RE.test(productId)) return { ok: false, message: "Invalid product." };
  if (costCents != null && (!Number.isInteger(costCents) || costCents < 0)) {
    return { ok: false, message: "Cost must be a valid non-negative amount." };
  }
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  if (costCents == null) {
    const { error } = await admin.from("product_costs").delete().eq("product_id", productId);
    if (error) {
      console.error("[admin] remove product cost failed:", error.message);
      return { ok: false, message: "Could not remove the cost. Please try again." };
    }
  } else {
    const { error } = await admin
      .from("product_costs")
      .upsert(
        { product_id: productId, cost_cents: costCents, updated_at: new Date().toISOString() },
        { onConflict: "product_id" },
      );
    if (error) {
      console.error("[admin] set product cost failed:", error.message);
      return { ok: false, message: "Could not save the cost. Please try again." };
    }
  }

  // Autopilot: costs feed every margin — recompute this product's rows.
  const swept = await autoRecomputeForScope(admin, { kind: "product", productId });
  revalidatePricing();
  return sweepResult("Cost saved", swept);
  });
}

// ---------------- Pricing rules ----------------

export type PricingRuleInput = {
  scope: PricingRuleScope;
  categoryId?: string | null;
  customerId?: string | null;
  productId?: string | null;
  marginPercent: number;
  isPriority?: boolean; // category/product scopes: "Overrides customer margins"
  isActive?: boolean;
};

function validateRuleInput(input: PricingRuleInput): string | null {
  if (!validMarginPercent(input.marginPercent)) {
    return "Margin must be between 0 and 500 with at most 2 decimals.";
  }
  if (input.scope === "category" && (!input.categoryId || !UUID_RE.test(input.categoryId))) {
    return "Choose a category for this rule.";
  }
  if (input.scope === "customer" && (!input.customerId || !UUID_RE.test(input.customerId))) {
    return "Choose a customer for this rule.";
  }
  if (input.scope === "product" && (!input.productId || !UUID_RE.test(input.productId))) {
    return "Choose a product for this rule.";
  }
  if (input.isPriority && input.scope !== "category" && input.scope !== "product") {
    return "Only category and product rules can override customer margins.";
  }
  return null;
}

// The recompute scope a rule mutation must sweep.
function scopeForRule(rule: {
  scope: PricingRuleScope;
  category_id?: string | null;
  customer_id?: string | null;
  product_id?: string | null;
}): RecomputeScope {
  if (rule.scope === "category" && rule.category_id) {
    return { kind: "category", categoryId: rule.category_id };
  }
  if (rule.scope === "customer" && rule.customer_id) {
    return { kind: "customer", customerId: rule.customer_id };
  }
  if (rule.scope === "product" && rule.product_id) {
    return { kind: "product", productId: rule.product_id };
  }
  return { kind: "all" };
}

export async function upsertPricingRule(input: PricingRuleInput): Promise<ActionResult> {
  await requireAdmin();
  return guardAction("upsertPricingRule", async () => {
  const invalid = validateRuleInput(input);
  if (invalid) return { ok: false, message: invalid };

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  // One rule per target (partial unique indexes): update-if-exists, else insert.
  let existingQuery = admin.from("pricing_rules").select("id").eq("scope", input.scope);
  if (input.scope === "category") existingQuery = existingQuery.eq("category_id", input.categoryId!);
  if (input.scope === "customer") existingQuery = existingQuery.eq("customer_id", input.customerId!);
  if (input.scope === "product") existingQuery = existingQuery.eq("product_id", input.productId!);
  const { data: existing, error: exErr } = await existingQuery.maybeSingle();
  if (exErr) {
    console.error("[admin] rule lookup failed:", exErr.message);
    return { ok: false, message: "Could not check existing rules. Please try again." };
  }

  const priorityAllowed = input.scope === "category" || input.scope === "product";
  const row = {
    scope: input.scope,
    category_id: input.scope === "category" ? input.categoryId : null,
    customer_id: input.scope === "customer" ? input.customerId : null,
    product_id: input.scope === "product" ? input.productId : null,
    margin_percent: input.marginPercent,
    is_priority: priorityAllowed ? (input.isPriority ?? false) : false,
    is_active: input.isActive ?? true,
    updated_at: new Date().toISOString(),
  };

  // Write, then READ BACK — a rule that silently fails to persist produces
  // wrong prices with no trace (live incident 2026-07-29), so persistence is
  // verified explicitly and failures name their likely cause.
  const { data: saved, error } = existing
    ? await admin.from("pricing_rules").update(row).eq("id", existing.id).select("id, scope").maybeSingle()
    : await admin.from("pricing_rules").insert(row).select("id, scope").maybeSingle();
  if (error || !saved || saved.scope !== input.scope) {
    if (error?.code === "23505") {
      return { ok: false, message: "A rule for that target already exists — edit it instead." };
    }
    if (error?.code === "23514") {
      return {
        ok: false,
        message:
          "The database rejected this rule shape — migration 0007 has probably not been applied yet. Run it, then retry.",
      };
    }
    if (error?.code === "42703" || error?.code === "42P01") {
      return {
        ok: false,
        message: "The pricing tables are out of date — run migration 0007, then retry.",
      };
    }
    console.error("[admin] save pricing rule failed:", error?.code ?? "row not persisted");
    return { ok: false, message: "Could not save the rule — it was NOT persisted. Please retry." };
  }

  const swept = await autoRecomputeForScope(admin, scopeForRule(row));
  revalidatePricing(input.customerId ?? undefined);
  return sweepResult("Rule saved", swept);
  });
}

export async function togglePricingRule(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdmin();
  return guardAction("togglePricingRule", async () => {
  if (!UUID_RE.test(id)) return { ok: false, message: "Invalid rule." };
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { data: rule, error } = await admin
    .from("pricing_rules")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("scope, category_id, customer_id, product_id")
    .maybeSingle();
  if (error || !rule) {
    console.error("[admin] toggle pricing rule failed:", error?.message ?? "not found");
    return { ok: false, message: "Could not update the rule. Please try again." };
  }

  const swept = await autoRecomputeForScope(admin, scopeForRule(rule));
  revalidatePricing(rule.customer_id ?? undefined);
  return sweepResult("Rule updated", swept);
  });
}

export async function deletePricingRule(id: string): Promise<ActionResult> {
  await requireAdmin();
  return guardAction("deletePricingRule", async () => {
  if (!UUID_RE.test(id)) return { ok: false, message: "Invalid rule." };
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { data: rule, error } = await admin
    .from("pricing_rules")
    .delete()
    .eq("id", id)
    .select("scope, category_id, customer_id, product_id")
    .maybeSingle();
  if (error || !rule) {
    console.error("[admin] delete pricing rule failed:", error?.message ?? "not found");
    return { ok: false, message: "Could not delete the rule. Please try again." };
  }

  const swept = await autoRecomputeForScope(admin, scopeForRule(rule));
  revalidatePricing(rule.customer_id ?? undefined);
  return sweepResult("Rule deleted", swept);
  });
}

// ---------------- Recompute (manual audit tool) ----------------

export type RecomputePreview =
  | {
      ok: true;
      rows: RecomputeRow[]; // capped at PREVIEW_CAP for transport; totals cover ALL rows
      totalRows: number;
      willChange: number;
      skippedManual: number;
      oldTotalCents: number;
      newTotalCents: number;
      oldProfitCents: number; // only rows with a cost
      newProfitCents: number;
    }
  | { ok: false; message: string };

const PREVIEW_CAP = 400;

export async function previewRecompute(
  scope: RecomputeScope,
  includeManual: boolean,
): Promise<RecomputePreview> {
  await requireAdmin();
  return guardAction("previewRecompute", async () => {
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const result = await computeRecomputeRows(admin, scope, includeManual);
  if ("error" in result) return { ok: false, message: result.error };

  const { rows } = result;
  let oldTotal = 0,
    newTotal = 0,
    oldProfit = 0,
    newProfit = 0,
    willChange = 0,
    skippedManual = 0;
  for (const r of rows) {
    const effectiveNew = r.isManual && !includeManual ? r.oldPriceCents : r.newPriceCents;
    oldTotal += r.oldPriceCents;
    newTotal += effectiveNew;
    if (r.costCents != null) {
      oldProfit += r.oldPriceCents - r.costCents;
      newProfit += effectiveNew - r.costCents;
    }
    if (r.willChange) willChange++;
    if (r.isManual && !includeManual) skippedManual++;
  }
  return {
    ok: true,
    rows: rows.slice(0, PREVIEW_CAP),
    totalRows: rows.length,
    willChange,
    skippedManual,
    oldTotalCents: oldTotal,
    newTotalCents: newTotal,
    oldProfitCents: oldProfit,
    newProfitCents: newProfit,
  };
  });
}

export async function applyRecompute(
  scope: RecomputeScope,
  includeManual: boolean,
  expectedChanges: number,
): Promise<{ ok: true; updated: number; warning?: string } | { ok: false; message: string }> {
  await requireAdmin();
  return guardAction("applyRecompute", async () => {
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const result = await computeRecomputeRows(admin, scope, includeManual);
  if ("error" in result) return { ok: false, message: result.error };

  const toWrite = result.rows.filter((r) => r.willChange);
  // Stale-preview guard: rules/costs changed between preview and apply.
  if (toWrite.length !== expectedChanges) {
    return {
      ok: false,
      message: `The data changed since the preview (${toWrite.length} rows would now change, preview said ${expectedChanges}). Please re-preview.`,
    };
  }

  const written = await writeRecomputeRows(admin, toWrite);
  if ("error" in written) return { ok: false, message: written.error };

  revalidatePricing(scope.kind === "customer" ? scope.customerId : undefined);
  return { ok: true, updated: written.updated, warning: written.warning };
  });
}
