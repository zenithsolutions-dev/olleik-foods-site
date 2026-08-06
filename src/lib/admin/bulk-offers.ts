// CP-8a-2 pure bulk-offer logic — no IO, callers pass `now`. Builds the
// pre-apply preview (per-customer effect, skips WITH reasons, aggregate) and
// the batch panel/undo summaries. All price math goes through the SAME
// applyOffersToPrice / offerAppliesToProduct pipeline as 8a's single-customer
// confirmation — one reporting machinery, not two.
//
// Relative + explicit .ts specifiers so node --experimental-strip-types can
// import this module directly: the module the suite tests is the shipped one.
import {
  applyOffersToPrice,
  offerAppliesToProduct,
  offerIsActiveNow,
} from "../pricing.ts";
import { summarizeApplyEffect, type ApplyEffect } from "./offers-overview.ts";
import type { OfferDiscountKind } from "./types";

export const BULK_BATCH_CAP = 200; // approved D-B5 area: hard cap, stated not truncated

// ---------- inputs ----------

export type BulkTemplate = {
  id: string;
  name: string;
  discountKind: OfferDiscountKind | null;
  discountValue: number | null;
};

export type BulkCustomerInput = {
  id: string;
  businessName: string;
  status: string; // 'active' | 'pending' | 'archived'
  lastOrderAt: string | null; // most recent order (any status) — activity signal
  // Assigned catalog with today's effective (pre-new-offer) figures.
  products: {
    productId: string;
    name: string;
    priceCents: number | null; // negotiated; null = list
    listPriceCents: number;
  }[];
  // This customer's existing offers (for stacking math + duplicate skip).
  offers: {
    templateId: string | null;
    isActive: boolean;
    startsAt: string | null;
    endsAt: string | null;
    productId: string | null;
    discountKind: OfferDiscountKind | null;
    discountValue: number | null;
  }[];
};

export type BulkWindow = { startsAt: string | null; endsAt: string | null };

// ---------- targeting (approved D-B1) ----------

export type TargetMode = "all-active" | "ordered-within" | "hand-picked";

export function targetCustomers(
  customers: BulkCustomerInput[],
  mode: TargetMode,
  now: Date,
  opts?: { withinDays?: 30 | 60 | 90; pickedIds?: string[] },
): BulkCustomerInput[] {
  const active = customers.filter((c) => c.status === "active");
  if (mode === "all-active") return active;
  if (mode === "ordered-within") {
    const days = opts?.withinDays ?? 30;
    const cutoff = now.getTime() - days * 24 * 3600_000;
    return active.filter(
      (c) => c.lastOrderAt != null && new Date(c.lastOrderAt).getTime() >= cutoff,
    );
  }
  const picked = new Set(opts?.pickedIds ?? []);
  return active.filter((c) => picked.has(c.id));
}

// ---------- preview (the talking confirmation, at scale) ----------

export type SkipReason =
  | "not-active" // pending/archived — stated, never silent
  | "duplicate-offer" // same template already RUNNING (approved D-B4, no override)
  | "product-not-assigned"; // product-scoped offer, product not in their catalog

export type CustomerPlan = {
  customerId: string;
  businessName: string;
  effect: ApplyEffect; // reused 8a machinery — affectedCount may be 0 (applied AND stated)
};

export type CustomerSkip = {
  customerId: string;
  businessName: string;
  reason: SkipReason;
  detail: string; // human sentence shown next to the name
};

export type BulkPreview = {
  toApply: CustomerPlan[];
  skipped: CustomerSkip[];
  // Aggregates over toApply:
  customersWithMovement: number; // effect.affectedCount > 0
  customersNoChange: number; // applied but nothing moves — shown, applied, stated
  totalProductsAffected: number;
  averageDropPct: number | null; // over moved products, weighted per customer mean
  overCap: boolean; // toApply.length > BULK_BATCH_CAP — refuse, never truncate
};

export function buildBulkPreview(args: {
  targets: BulkCustomerInput[];
  template: BulkTemplate;
  window: BulkWindow;
  productId: string | null; // optional product scope for the new offer
  now: Date;
}): BulkPreview {
  const { targets, template, window, productId, now } = args;
  const toApply: CustomerPlan[] = [];
  const skipped: CustomerSkip[] = [];

  const newOffer = {
    isActive: true,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    productId,
    discountKind: template.discountKind,
    discountValue: template.discountValue,
  };

  for (const c of targets) {
    if (c.status !== "active") {
      skipped.push({
        customerId: c.id,
        businessName: c.businessName,
        reason: "not-active",
        detail: c.status === "archived" ? "archived customer" : "pending — not yet active",
      });
      continue;
    }
    // D-B4: the SAME template already running = duplication, not stacking.
    const dup = c.offers.some(
      (o) => o.templateId === template.id && offerIsActiveNow(o, now),
    );
    if (dup) {
      skipped.push({
        customerId: c.id,
        businessName: c.businessName,
        reason: "duplicate-offer",
        detail: `already has "${template.name}" running — apply by hand from their page if you truly want it twice`,
      });
      continue;
    }
    if (productId != null && !c.products.some((p) => p.productId === productId)) {
      skipped.push({
        customerId: c.id,
        businessName: c.businessName,
        reason: "product-not-assigned",
        detail: "the offer's product isn't assigned to this customer",
      });
      continue;
    }

    // Effect: today's price (existing offers included) vs with the new offer
    // stacked — best-single-discount-wins math untouched.
    const rows = c.products
      .filter((p) => productId == null || p.productId === productId)
      .map((p) => {
        const base = p.priceCents ?? p.listPriceCents;
        const applicable = c.offers
          .filter((o) =>
            offerAppliesToProduct(
              {
                isActive: o.isActive,
                startsAt: o.startsAt,
                endsAt: o.endsAt,
                productId: o.productId,
                discountKind: o.discountKind,
                discountValue: o.discountValue,
              },
              p.productId,
              now,
            ),
          )
          .map((o) => ({
            discountKind: o.discountKind as OfferDiscountKind,
            discountValue: o.discountValue as number,
          }));
        const before = applyOffersToPrice(base, applicable).finalCents;
        const withNew =
          newOffer.discountKind != null &&
          newOffer.discountValue != null &&
          offerAppliesToProduct(newOffer, p.productId, now)
            ? applyOffersToPrice(base, [
                ...applicable,
                {
                  discountKind: newOffer.discountKind,
                  discountValue: newOffer.discountValue,
                },
              ]).finalCents
            : before;
        return { name: p.name, beforeCents: before, afterCents: withNew };
      });

    toApply.push({
      customerId: c.id,
      businessName: c.businessName,
      effect: summarizeApplyEffect(rows, window.endsAt),
    });
  }

  const moved = toApply.filter((p) => p.effect.affectedCount > 0);
  const drops = moved
    .map((p) => p.effect.averageDropPct)
    .filter((x): x is number => x != null);

  return {
    toApply,
    skipped,
    customersWithMovement: moved.length,
    customersNoChange: toApply.length - moved.length,
    totalProductsAffected: moved.reduce((n, p) => n + p.effect.affectedCount, 0),
    averageDropPct:
      drops.length > 0 ? drops.reduce((a, b) => a + b, 0) / drops.length : null,
    overCap: toApply.length > BULK_BATCH_CAP,
  };
}

// ---------- batches panel + undo scope ----------

export type BatchRowInput = {
  batchId: string;
  batchSize: number | null;
  templateId: string | null;
  title: string;
  customerId: string;
  customerName: string;
  createdAt: string;
  endsAt: string | null;
  isActive: boolean;
};

export type BatchSummary = {
  batchId: string;
  title: string;
  appliedAt: string;
  originalSize: number; // stamped at creation (batch_size)
  remaining: number; // rows still present
  removedIndividually: number; // originalSize - remaining
  live: boolean; // any member still active-now
  endsAt: string | null;
  customers: { customerId: string; customerName: string }[];
};

export function summarizeBatches(rows: BatchRowInput[], now: Date): BatchSummary[] {
  const byBatch = new Map<string, BatchRowInput[]>();
  for (const r of rows) {
    const list = byBatch.get(r.batchId) ?? [];
    list.push(r);
    byBatch.set(r.batchId, list);
  }
  return [...byBatch.entries()]
    .map(([batchId, members]) => {
      const first = members[0];
      const originalSize = first.batchSize ?? members.length;
      return {
        batchId,
        title: first.title,
        appliedAt: members.map((m) => m.createdAt).sort()[0],
        originalSize,
        remaining: members.length,
        removedIndividually: Math.max(0, originalSize - members.length),
        live: members.some((m) =>
          offerIsActiveNow({ isActive: m.isActive, startsAt: null, endsAt: m.endsAt }, now),
        ),
        endsAt: first.endsAt,
        customers: members
          .map((m) => ({ customerId: m.customerId, customerName: m.customerName }))
          .sort((a, b) => a.customerName.localeCompare(b.customerName)),
      };
    })
    .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
}

// The undo confirmation sentence — unmistakable about scope by construction:
// it names the one offer, the exact remaining count, what was already removed,
// and states that nothing outside the batch is touched.
export function undoConfirmationText(b: BatchSummary): string {
  const removed =
    b.removedIndividually > 0
      ? ` ${b.removedIndividually} of the original ${b.originalSize} ${b.removedIndividually === 1 ? "was" : "were"} already removed individually and ${b.removedIndividually === 1 ? "is" : "are"} unaffected.`
      : "";
  const expired = !b.live
    ? " This batch is no longer live — removing it deletes inert rows and changes no price."
    : "";
  return (
    `Remove "${b.title}" from the ${b.remaining} customer${b.remaining === 1 ? "" : "s"} where it still exists?` +
    removed +
    expired +
    " No other offer — on these customers or anyone else — is touched."
  );
}
