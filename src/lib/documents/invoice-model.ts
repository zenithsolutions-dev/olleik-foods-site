// CP-6 pure invoice model — NO imports, NO IO, and BY CONSTRUCTION no cost or
// profit fields anywhere in its input or output types. This is the customer
// document: the admin prints it to hand over, the customer downloads it from
// the portal — both render the SAME model. Unit- and live-tested from
// scripts/test-documents.mjs (the engine pattern).
//
// Figures come EXCLUSIVELY from the order's stored snapshot (order_items froze
// name/sku/prices at submission; orders.total_cents is the charged total).
// Nothing is ever recomputed from current prices — a reprint six months later
// carries identical figures, which the live test proves by changing prices
// after the order and asserting the model doesn't move.
//
// TAX — DORMANT, NOT ABSENT (approved ruling): the model always carries
// subtotalCents / taxCents / totalCents. While the business config has
// taxEnabled=false, taxCents is null and renderers show a single Total row.
// The future delta (documented in the CP-6 spec): flip the config, snapshot
// tax at order time (orders.tax_cents migration + submit_order_atomic), and
// pass it here — pre-tax orders keep taxCents null automatically.

export type InvoiceParty = {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  address?: string;
};

export type InvoiceBusiness = {
  displayName: string;
  legalName: string;
  address: string;
  phone: string;
  email: string;
  taxEnabled: boolean;
  taxNumber: string | null;
};

// The snapshotted line shape — deliberately has NO cost field to accept.
export type InvoiceLineInput = {
  name: string;
  sku: string;
  unit: string;
  unitSize: string;
  qty: number;
  unitPriceCents: number;
  lineTotalCents: number;
  appliedOfferTitle: string | null;
};

export type InvoiceSource = {
  orderId: string;
  status: string;
  fulfillment: string;
  createdAt: string; // ISO
  paymentTerms: string;
  notes: string | null;
  totalCents: number; // the charged total, verbatim from the order row
  lines: InvoiceLineInput[];
  // Present when order-time tax snapshots exist (post-tax-enablement orders).
  taxCents?: number | null;
};

export type InvoiceModel = {
  documentNumber: string; // "Order #ab12cd34" (approved D-C5 — no legal sequence)
  orderIdFull: string;
  issuedAt: string; // the ORDER date (the document reflects the order, not the print)
  status: string;
  cancelled: boolean; // renderers watermark every page (approved D-C4)
  fulfillment: string;
  paymentTerms: string;
  notes: string | null;
  business: InvoiceBusiness;
  billTo: InvoiceParty;
  lines: InvoiceLineInput[];
  subtotalCents: number;
  taxCents: number | null; // null while tax is dormant → single Total row
  totalCents: number;
  // Non-null when the stored order total disagrees with the line sum — should
  // be impossible (the DB function enforces it) but a money document must
  // surface, never mask, an inconsistency.
  integrityWarning: string | null;
};

export function buildInvoiceModel(args: {
  source: InvoiceSource;
  business: InvoiceBusiness;
  billTo: InvoiceParty;
}): InvoiceModel {
  const { source, business, billTo } = args;
  const subtotalCents = source.lines.reduce((n, l) => n + l.lineTotalCents, 0);
  const taxCents = business.taxEnabled ? (source.taxCents ?? null) : null;
  const totalCents = source.totalCents;
  const expected = subtotalCents + (taxCents ?? 0);
  return {
    documentNumber: `Order #${source.orderId.slice(0, 8)}`,
    orderIdFull: source.orderId,
    issuedAt: source.createdAt,
    status: source.status,
    cancelled: source.status === "cancelled",
    fulfillment: source.fulfillment,
    paymentTerms: source.paymentTerms,
    notes: source.notes,
    business,
    billTo,
    lines: source.lines,
    subtotalCents,
    taxCents,
    totalCents,
    integrityWarning:
      expected === totalCents
        ? null
        : `Stored order total (${totalCents}) does not equal the sum of its lines (${expected}) — investigate before sending this document.`,
  };
}
