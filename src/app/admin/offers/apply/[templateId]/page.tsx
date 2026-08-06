import Link from "next/link";
import { fetchAdminOfferTemplates } from "@/lib/admin/offer-templates-data";
import { fetchBulkTargets } from "@/lib/admin/bulk-offers-data";
import { BulkApplyClient } from "./bulk-apply-client";

export const dynamic = "force-dynamic";

// CP-8a-2 bulk apply (approved D-B2: entry from the TEMPLATE — "push this
// offer to the market"). Server component fetches everything batched; the
// client handles targeting, the honest preview, and the atomic confirm.

export default async function BulkApplyPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const [{ templateId }, { templates }, targets] = await Promise.all([
    params,
    fetchAdminOfferTemplates(),
    fetchBulkTargets(),
  ]);
  const template = templates.find((t) => t.id === templateId && !t.isArchived);

  if (!template) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link href="/admin/offers" className="text-sm text-brand hover:text-accent">
          ← Offer library
        </Link>
        <p className="mt-6 rounded-2xl border border-dashed border-[var(--border)] bg-surface p-10 text-center text-sm text-muted">
          Template not found (or archived — restore it first).
        </p>
      </div>
    );
  }

  return (
    <BulkApplyClient
      template={{
        id: template.id,
        name: template.name,
        discountKind: template.discountKind,
        discountValue: template.discountValue,
      }}
      customers={targets.customers}
      live={targets.live}
    />
  );
}
