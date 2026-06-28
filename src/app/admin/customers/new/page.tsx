import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { fetchApprovedLeadsForConversion } from "@/lib/admin/leads-data";
import { AddCustomerClient } from "./add-customer-client";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  const { leads, live } = await fetchApprovedLeadsForConversion();

  return (
    <div>
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-1 text-sm text-brand hover:text-accent"
      >
        <ArrowLeft size={14} /> All customers
      </Link>
      <header className="mt-4 mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">Accounts</p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          Add a customer
        </h1>
        <p className="mt-2 text-sm text-muted">
          Convert an approved application into an account — or add a walk-in manually.
        </p>
      </header>
      <AddCustomerClient leads={leads} live={live} />
    </div>
  );
}
