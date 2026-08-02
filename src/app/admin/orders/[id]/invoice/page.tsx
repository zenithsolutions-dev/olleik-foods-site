import Link from "next/link";
import { fetchAdminOrder } from "@/lib/admin/orders-data";
import { getBusinessIdentity } from "@/lib/business";
import { buildInvoiceModel } from "@/lib/documents/invoice-model";
import { InvoiceDocument } from "@/components/documents/invoice-document";
import { PrintToolbar } from "@/components/documents/print-toolbar";

export const dynamic = "force-dynamic";

// CP-6 admin invoice: the CUSTOMER document, printed to hand over — built
// from the order's frozen snapshot (never recomputed) and NEVER carrying
// cost/profit (the model's input type cannot accept them). requireAdmin runs
// in the admin layout; fetchAdminOrder is the same read as the detail page.

export default async function AdminInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await fetchAdminOrder(id);
  if (!order) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link href="/admin/orders" className="text-sm text-brand hover:text-accent">
          ← All orders
        </Link>
        <p className="mt-6 rounded-2xl border border-dashed border-[var(--border)] bg-surface p-10 text-center text-sm text-muted">
          Order not found.
        </p>
      </div>
    );
  }

  const model = buildInvoiceModel({
    business: getBusinessIdentity(),
    billTo: order.customer
      ? {
          businessName: order.customer.businessName,
          contactName: order.customer.contactName,
          email: order.customer.email,
          phone: order.customer.phone,
        }
      : {
          businessName: "(removed customer)",
          contactName: "—",
          email: "—",
          phone: "—",
        },
    source: {
      orderId: order.id,
      status: order.status,
      fulfillment: order.fulfillment,
      createdAt: order.createdAt,
      paymentTerms: order.paymentTerms,
      notes: order.notes,
      totalCents: order.totalCents,
      // Snapshot fields ONLY — costCents exists on these lines but the input
      // type has no slot for it, so it cannot leak into the document.
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
      <PrintToolbar backHref={`/admin/orders/${order.id}`} backLabel="Back to order" />
      <InvoiceDocument model={model} />
    </div>
  );
}
