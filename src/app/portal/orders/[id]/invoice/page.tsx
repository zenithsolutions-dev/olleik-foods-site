import Link from "next/link";
import { requireCustomer } from "@/lib/portal/require-customer";
import { fetchMyOrder } from "@/lib/portal/portal-data";
import { getBusinessIdentity } from "@/lib/business";
import { buildInvoiceModel } from "@/lib/documents/invoice-model";
import { InvoiceDocument } from "@/components/documents/invoice-document";
import { PrintToolbar } from "@/components/documents/print-toolbar";

export const dynamic = "force-dynamic";

// CP-6 portal invoice (approved D-C3): the customer downloads their OWN
// invoice. SESSION CLIENT ONLY — fetchMyOrder is the exact read the order
// screen uses, so RLS decides ownership and someone else's order id is
// simply "not found". The rendered model is the same cost-free InvoiceModel
// the admin prints; nothing new is exposed.

export default async function PortalInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const customer = await requireCustomer();
  const { id } = await params;
  const order = await fetchMyOrder(id);
  if (!order) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/portal/orders" className="text-sm text-brand hover:text-accent">
          ← My orders
        </Link>
        <p className="mt-6 rounded-2xl border border-dashed border-[var(--border)] bg-surface p-10 text-center text-sm text-muted">
          Order not found.
        </p>
      </div>
    );
  }

  const model = buildInvoiceModel({
    business: getBusinessIdentity(),
    billTo: {
      businessName: customer.businessName,
      contactName: customer.contactName,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
    },
    source: {
      orderId: order.id,
      status: order.status,
      fulfillment: order.fulfillment,
      createdAt: order.createdAt,
      paymentTerms: order.paymentTerms,
      notes: order.notes,
      totalCents: order.totalCents,
      lines: order.lines.map((l) => ({
        name: l.name,
        sku: l.sku,
        unit: l.unit,
        unitSize: l.unitSize,
        qty: l.qty,
        unitPriceCents: l.unitPriceCents,
        lineTotalCents: l.lineTotalCents,
        appliedOfferTitle: l.appliedOfferTitle,
      })),
    },
  });

  return (
    <div>
      <PrintToolbar backHref={`/portal/orders/${order.id}`} backLabel="Back to order" />
      <InvoiceDocument model={model} />
    </div>
  );
}
