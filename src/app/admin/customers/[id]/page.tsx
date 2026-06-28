import Link from "next/link";
import { CustomerDetailClient } from "./customer-detail-client";
import { fetchAdminCustomer, fetchCustomerActivation } from "@/lib/admin/customers-data";
import { fetchAdminProducts } from "@/lib/admin/products-data";
import { fetchAdminCategories } from "@/lib/admin/categories-data";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ detail, live }, { products }, { categories }] = await Promise.all([
    fetchAdminCustomer(id),
    fetchAdminProducts(),
    fetchAdminCategories(),
  ]);

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
      live={live}
    />
  );
}
