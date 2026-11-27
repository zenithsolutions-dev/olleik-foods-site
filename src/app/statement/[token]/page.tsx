import type { Metadata } from "next";
import { fetchAdminCustomer } from "@/lib/admin/customers-data";
import { fetchCustomerStatementOrders } from "@/lib/admin/statement-data";
import { getBusinessIdentity } from "@/lib/business";
import { BUSINESS_TIME_ZONE } from "@/lib/dates";
import { buildCustomerStatement } from "@/lib/documents/customer-statement-model";
import { hashToken, linkState } from "@/lib/statement-links";
import { getAdminClient } from "@/lib/supabase/admin";
import { CustomerStatementDocument } from "@/components/documents/customer-statement-document";
import { PrintButton } from "./print-button";

// The page behind a statement link sent by WhatsApp or email. No sign-in: the unguessable, expiring token
// in the address is the key. It renders the CUSTOMER copy through the cost-free reader, so cost and profit
// are never even fetched on this path.
export const dynamic = "force-dynamic"; // never cached, never shared between visitors

export const metadata: Metadata = {
  title: "Account statement",
  robots: { index: false, follow: false },
  referrer: "no-referrer", // the address IS the key: do not hand it to other sites
};

type LinkRow = {
  customer_id: string;
  range_start: string | null;
  range_end: string | null;
  period_label: string;
  expires_at: string;
  revoked_at: string | null;
};

// One answer for every bad link (unknown, expired, revoked): it says nothing about which it was.
function Unavailable({ businessName }: { businessName: string }) {
  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="font-display text-2xl font-semibold text-brand-deep">This statement link no longer works</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Statement links stop working after a few days. Please ask {businessName} to send you a new one.
      </p>
    </main>
  );
}

export default async function StatementLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const business = await getBusinessIdentity();
  const admin = getAdminClient();
  // A token is 43 URL-safe characters; anything else cannot be one, so it is not even looked up.
  if (!admin || !/^[A-Za-z0-9_-]{43}$/.test(token)) return <Unavailable businessName={business.displayName} />;

  const { data: link } = await admin
    .from("statement_links")
    .select("customer_id, range_start, range_end, period_label, expires_at, revoked_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (linkState(link as LinkRow | null, new Date()) !== "valid") return <Unavailable businessName={business.displayName} />;
  const row = link as LinkRow;

  const [{ detail }, data] = await Promise.all([
    fetchAdminCustomer(row.customer_id),
    fetchCustomerStatementOrders(row.customer_id, { startISO: row.range_start, endISO: row.range_end }),
  ]);
  // A closed (archived) account's links stop working with it. A suspended customer can still read what
  // they owe.
  if (!detail || detail.customer.status === "archived") return <Unavailable businessName={business.displayName} />;

  const c = detail.customer;
  const model = buildCustomerStatement({
    orders: data.orders,
    business,
    statementFor: { businessName: c.businessName, contactName: c.contactName, email: c.email, phone: c.phone, address: c.address },
    periodLabel: row.period_label,
    generatedAt: new Date(),
    truncated: data.truncated,
    canWiden: false, // the period is fixed by the link
  });

  return (
    <main>
      <div className="doc-chrome-hidden mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 pt-6 print:hidden">
        <p className="text-sm text-muted">
          Link valid until{" "}
          {new Date(row.expires_at).toLocaleDateString("en-CA", { dateStyle: "medium", timeZone: BUSINESS_TIME_ZONE })}
        </p>
        <PrintButton />
      </div>
      <CustomerStatementDocument model={model} />
    </main>
  );
}
