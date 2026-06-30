import Link from "next/link";
import { CustomerDetailClient } from "./customer-detail-client";
import {
  fetchAdminCustomer,
  fetchAdminCustomers,
  fetchCustomerActivation,
} from "@/lib/admin/customers-data";
import { fetchAdminProducts } from "@/lib/admin/products-data";
import { fetchAdminCategories } from "@/lib/admin/categories-data";

export const dynamic = "force-dynamic";

export type CopySource = { id: string; businessName: string; assignedCount: number };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ detail, live }, { products }, { categories }, { customers, counts }] = await Promise.all([
    fetchAdminCustomer(id),
    fetchAdminProducts(),
    fetchAdminCategories(),
    fetchAdminCustomers(),
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

  return (
    <CustomerDetailClient
      detail={detail}
      allProducts={products}
      categories={categories}
      activation={activation}
      copySources={copySources}
      live={live}
    />
  );
}
