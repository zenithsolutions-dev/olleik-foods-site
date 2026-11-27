import type { BusinessSettingsRow } from "@/lib/business";
import { BUSINESS_TIME_ZONE } from "@/lib/dates";
import { requireAdmin } from "@/lib/admin/require-admin";
import { getAdminClient } from "@/lib/supabase/admin";
import type { NotificationFormValues } from "./actions";
import { NotificationsForm } from "./notifications-form";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

const EMPTY: BusinessSettingsRow = {
  display_name: null,
  legal_name: null,
  address: null,
  phone: null,
  email: null,
  whatsapp_number: null,
};

const KIND_LABELS: Record<string, string> = {
  order: "New order",
  low_stock: "Low stock",
  daily_report: "Daily report",
  statement: "Statement",
  test: "Test",
};

type LogRow = { id: string; created_at: string; kind: string; to_emails: string[]; subject: string; status: string; error: string | null };

export default async function SettingsPage() {
  const adminEmail = await requireAdmin();
  const admin = getAdminClient();
  // The raw rows, not getBusinessIdentity(): the forms must show what is stored, not the fallbacks.
  const [{ data: business }, { data: notifications }, { data: log }] = admin
    ? await Promise.all([
        admin.from("business_settings").select("display_name, legal_name, address, phone, email, whatsapp_number").maybeSingle(),
        admin.from("notification_settings").select("*").maybeSingle(),
        admin.from("email_log").select("id, created_at, kind, to_emails, subject, status, error").order("created_at", { ascending: false }).limit(30),
      ])
    : [{ data: null }, { data: null }, { data: null }];

  const n = notifications as Record<string, unknown> | null;
  const list = (key: string) => ((n?.[key] as string[] | undefined) ?? []).join(", ");
  const initialNotifications: NotificationFormValues = {
    email_from_name: (n?.email_from_name as string | null) ?? "",
    email_from_address: (n?.email_from_address as string | null) ?? "",
    order_notify_emails: list("order_notify_emails"),
    low_stock_notify_emails: list("low_stock_notify_emails"),
    daily_report_enabled: Boolean(n?.daily_report_enabled),
    daily_report_emails: list("daily_report_emails"),
    daily_report_hour: (n?.daily_report_hour as number | undefined) ?? 7,
    daily_report_sections: (n?.daily_report_sections as string[] | undefined) ?? ["yesterday", "week", "low_stock"],
  };
  const rows = (log as LogRow[] | null) ?? [];
  const failedCount = rows.filter((r) => r.status === "failed").length;

  return (
    <div className="space-y-12">
      <section>
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">Setup</p>
          <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
            Business settings
          </h1>
          <p className="mt-2 text-sm text-muted">
            Your business details. They appear in the site header, on invoices, statements and reports.
          </p>
        </header>
        <SettingsForm initial={(business as BusinessSettingsRow | null) ?? EMPTY} />
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-brand-deep">Email notifications</h2>
        <p className="mb-6 mt-2 text-sm text-muted">Who is emailed about new orders and low stock, and the morning report.</p>
        <NotificationsForm initial={initialNotifications} timeZone={BUSINESS_TIME_ZONE} adminEmail={adminEmail} />
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-brand-deep">Recent emails</h2>
        <p className="mb-4 mt-2 text-sm text-muted">
          The last {rows.length} emails the system tried to send.
          {failedCount > 0 && <span className="font-semibold text-red-700"> {failedCount} did not go out.</span>}
        </p>
        {rows.length === 0 ? (
          <p className="max-w-xl rounded-xl border border-dashed border-[var(--border)] bg-surface p-6 text-sm text-muted">
            Nothing sent yet. Use “Send a test email to me” above to check the setup.
          </p>
        ) : (
          <ul className="max-w-3xl divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-surface">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{r.subject}</p>
                  <p className="text-xs text-muted">
                    {KIND_LABELS[r.kind] ?? r.kind} · to {r.to_emails.join(", ")} ·{" "}
                    {new Date(r.created_at).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: BUSINESS_TIME_ZONE })}
                  </p>
                  {r.error && <p className="mt-1 text-xs font-medium text-red-700">{r.error}</p>}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    r.status === "sent" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                  }`}
                >
                  {r.status === "sent" ? "Sent" : "Failed"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
