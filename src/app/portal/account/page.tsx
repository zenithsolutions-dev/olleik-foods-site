import { requireCustomer } from "@/lib/portal/require-customer";

export const dynamic = "force-dynamic";

const TERMS_LABEL: Record<string, string> = {
  "net-15": "Net 15",
  "net-30": "Net 30",
  "card-on-file": "Card on file",
  cod: "COD",
};

export default async function PortalAccountPage() {
  const c = await requireCustomer();

  const rows: Array<[string, string]> = [
    ["Business", c.businessName],
    ["Contact", c.contactName],
    ["Email", c.email],
    ["Phone", c.phone],
    ["Address", c.address || "—"],
    ["Payment terms", TERMS_LABEL[c.paymentTerms] ?? c.paymentTerms],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          Account
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your account details. To update anything here, contact your Olleik rep.
        </p>
      </div>

      <dl className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface">
        {rows.map(([label, value], i) => (
          <div
            key={label}
            className={`flex flex-wrap justify-between gap-2 px-6 py-4 ${
              i > 0 ? "border-t border-[var(--border)]" : ""
            }`}
          >
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-sm font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
