"use client";

import { useActionState } from "react";
import { DAILY_REPORT_SECTIONS, DAILY_REPORT_SECTION_LABELS } from "@/lib/email/templates";
import { saveNotificationSettings, sendTestEmail, type NotificationFormValues, type NotificationState } from "./actions";

const inputCls =
  "mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

const hourLabel = (hour: number) => `${hour % 12 === 0 ? 12 : hour % 12}:00 ${hour < 12 ? "AM" : "PM"}`;

function Message({ state }: { state: { ok: boolean; message: string } | null }) {
  if (!state) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={`text-sm font-medium ${state.ok ? "text-emerald-700" : "text-red-700"}`}>
      {state.message}
    </p>
  );
}

export function NotificationsForm({
  initial,
  timeZone,
  adminEmail,
}: {
  initial: NotificationFormValues;
  timeZone: string;
  adminEmail: string | null;
}) {
  const [state, action, isPending] = useActionState<NotificationState, FormData>(saveNotificationSettings, null);
  const [testState, testAction, isTesting] = useActionState<{ ok: boolean; message: string } | null, FormData>(sendTestEmail, null);
  const v = state?.values ?? initial;

  const recipients = (name: "order_notify_emails" | "low_stock_notify_emails" | "daily_report_emails", label: string, hint: string) => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <textarea id={name} name={name} rows={2} defaultValue={v[name]} placeholder="name@example.com, another@example.com" aria-describedby={`${name}-hint`} className={inputCls} />
      <p id={`${name}-hint`} className="mt-1 text-xs text-muted">
        {hint}
      </p>
    </div>
  );

  return (
    <div className="max-w-xl space-y-5">
      <form action={action} className="space-y-6 rounded-xl border border-[var(--border)] bg-surface p-5 sm:p-6">
        <fieldset className="space-y-4">
          <legend className="font-display text-lg font-semibold text-brand-deep">Sender</legend>
          <div>
            <label htmlFor="email_from_name" className="block text-sm font-medium text-foreground">
              Sender name
            </label>
            <input id="email_from_name" name="email_from_name" defaultValue={v.email_from_name} placeholder="Your business name" className={inputCls} />
          </div>
          <div>
            <label htmlFor="email_from_address" className="block text-sm font-medium text-foreground">
              Sender address
            </label>
            <input id="email_from_address" name="email_from_address" type="email" defaultValue={v.email_from_address} placeholder="orders@yourdomain.com" aria-describedby="from-hint" className={inputCls} />
            <p id="from-hint" className="mt-1 text-xs text-muted">
              Must be on the domain connected to your email service. Nothing is sent until this is set.
            </p>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-display text-lg font-semibold text-brand-deep">Who gets what</legend>
          {recipients("order_notify_emails", "New orders", "Emailed the moment a customer submits an order. Leave empty to turn off.")}
          {recipients("low_stock_notify_emails", "Low stock", "Emailed once when a product reaches its low-stock level. Leave empty to turn off.")}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-display text-lg font-semibold text-brand-deep">Daily report</legend>
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-foreground">
            <input type="checkbox" name="daily_report_enabled" defaultChecked={v.daily_report_enabled} className="h-5 w-5" />
            Send a report every morning
          </label>
          {recipients("daily_report_emails", "Send it to", "One or more addresses.")}
          <div>
            <label htmlFor="daily_report_hour" className="block text-sm font-medium text-foreground">
              Send at
            </label>
            <select id="daily_report_hour" name="daily_report_hour" defaultValue={v.daily_report_hour} aria-describedby="hour-hint" className={inputCls}>
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {hourLabel(hour)}
                </option>
              ))}
            </select>
            <p id="hour-hint" className="mt-1 text-xs text-muted">
              Time zone: {timeZone}.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Include</p>
            <div className="mt-1 grid gap-x-4 sm:grid-cols-2">
              {DAILY_REPORT_SECTIONS.map((key) => (
                <label key={key} className="flex min-h-11 items-center gap-3 text-sm text-foreground">
                  <input type="checkbox" name="daily_report_sections" value={key} defaultChecked={v.daily_report_sections.includes(key)} className="h-5 w-5" />
                  {DAILY_REPORT_SECTION_LABELS[key]}
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={isPending} className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60">
            {isPending ? "Saving…" : "Save notifications"}
          </button>
          <Message state={state} />
        </div>
      </form>

      {adminEmail && (
        <form action={testAction} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-surface p-5 sm:p-6">
          <button type="submit" disabled={isTesting} className="rounded-md border border-brand px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand-mist disabled:opacity-60">
            {isTesting ? "Sending…" : "Send a test email to me"}
          </button>
          <p className="text-xs text-muted">Goes to {adminEmail}. Save first if you changed the sender.</p>
          <Message state={testState} />
        </form>
      )}
    </div>
  );
}
