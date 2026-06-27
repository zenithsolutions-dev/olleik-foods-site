import { CustomersClient } from "./customers-client";
import { fetchAdminCustomers } from "@/lib/admin/customers-data";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const { customers, counts, live } = await fetchAdminCustomers();
  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
          Accounts
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          Customers
        </h1>
        <p className="mt-2 text-sm text-muted">
          Each customer sees their own assigned product list with negotiated pricing.
        </p>
      </header>
      <CustomersClient customers={customers} counts={counts} live={live} />
    </div>
  );
}
