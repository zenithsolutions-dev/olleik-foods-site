import Link from "next/link";
import { CustomerDetailClient } from "./customer-detail-client";
import {
  fetchAdminCustomer,
  fetchAdminCustomers,
  fetchCustomerActivation,
} from "@/lib/admin/customers-data";
import { fetchAdminProducts } from "@/lib/admin/products-data";
import { fetchAdminCategories } from "@/lib/admin/categories-data";
import { fetchAdminOfferTemplates } from "@/lib/admin/offer-templates-data";
import {
  fetchPricingRules,
  fetchProductCosts,
  fetchPricingMeta,
} from "@/lib/admin/pricing-data";
import { fetchCustomerVisibility } from "@/lib/admin/visibility-data";
import { fetchCustomerStatementOrdersWithCosts } from "@/lib/admin/statement-data";
import { buildInternalStatement } from "@/lib/documents/customer-statement-model";
import { getBusinessIdentity } from "@/lib/business";
import { getAdminAccess } from "@/lib/admin/require-admin";
import { metaWithoutMargins } from "@/lib/admin/cost-visibility";

export const dynamic = "force-dynamic";
// D6: cost/rule saves from this page trigger autopilot price sweeps.
export const maxDuration = 60;

export type CopySource = { id: string; businessName: string; assignedCount: number };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { isOwner } = await getAdminAccess();
  const [
    { detail, live },
    { products },
    { categories },
    { customers, counts },
    { templates },
    { costs },
    { rules },
    pricingMeta,
    visibility,
  ] = await Promise.all([
    fetchAdminCustomer(id),
    fetchAdminProducts(),
    fetchAdminCategories(),
    fetchAdminCustomers(),
    fetchAdminOfferTemplates(),
    fetchProductCosts(),
    fetchPricingRules(),
    fetchPricingMeta(id),
    fetchCustomerVisibility(id),
  ]);

  // Copy-catalog source candidates: other non-archived customers, with their
  // assigned-product count (so the picker can show "N products").
  const copySources: CopySource[] = customers
    .filter((c) => c.id !== id && c.status !== "archived")
    .map((c) => ({ id: c.id, businessName: c.businessName, assignedCount: counts[c.id] ?? 0 }))
    .sort((a, b) => a.businessName.localeCompare(b.businessName));

  // Derive the portal activation badge from Supabase Auth (admin API).
  const activation = await fetchCustomerActivation(detail?.customer.userId);

  if (!detail) {
    return (
      <div>
        <Link href="/admin/customers" className="text-sm text-brand hover:text-accent">
          ← All customers
        </Link>
        <p className="mt-6 rounded-2xl border border-dashed border-[var(--border)] bg-surface p-10 text-center text-sm text-muted">
          Customer not found. It may have been removed.
        </p>
      </div>
    );
  }

  // Profit actually earned from this customer: the internal statement's own totals over all time, so the
  // card and the printed statement can never disagree. Owners only; nothing is fetched for anyone else.
  let earned = null;
  if (isOwner) {
    const data = await fetchCustomerStatementOrdersWithCosts(id);
    const c = detail.customer;
    const model = buildInternalStatement({
      orders: data.orders,
      business: await getBusinessIdentity(),
      statementFor: { businessName: c.businessName, contactName: c.contactName, email: c.email, phone: c.phone, address: c.address },
      periodLabel: "All time",
      generatedAt: new Date(),
      truncated: data.truncated,
      canWiden: false,
    });
    earned = {
      orderCount: model.orderCount,
      revenueCents: model.totalCents,
      profitCents: model.totalProfitCents,
      marginPct: model.marginPct,
      linesWithoutCost: model.linesWithoutCost,
      isTruncated: data.truncated,
    };
  }

  return (
    <CustomerDetailClient
      earned={earned}
      detail={detail}
      allProducts={products}
      categories={categories}
      activation={activation}
      copySources={copySources}
      offerTemplates={templates}
      costs={isOwner ? costs : {}}
      pricingRules={isOwner ? rules : []}
      pricingMeta={isOwner ? pricingMeta : metaWithoutMargins(pricingMeta)}
      showCosts={isOwner}
      visibility={visibility}
      live={live}
    />
  );
}
