"use server";

import { revalidatePath } from "next/cache";
import { getBusinessIdentity, parseBusinessSettings, type BusinessSettingsRow } from "@/lib/business";
import { sendEmail } from "@/lib/email/send";
import { parseNotificationSettings } from "@/lib/email/templates";
import { requireAdmin } from "@/lib/admin/require-admin";
import { getAdminClient } from "@/lib/supabase/admin";

// values: what the admin typed, handed back so a rejected save does not wipe the form (React resets it).
export type SettingsState = { ok: boolean; message: string; values: Record<keyof BusinessSettingsRow, string> } | null;

export async function saveBusinessSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireAdmin();
  const text = (name: string) => String(formData.get(name) ?? "");
  const values = {
    display_name: text("display_name"),
    legal_name: text("legal_name"),
    address: text("address"),
    phone: text("phone"),
    email: text("email"),
    whatsapp_number: text("whatsapp_number"),
  };
  const parsed = parseBusinessSettings(values);
  if (!parsed.ok) return { ok: false, message: parsed.error, values };

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Demo mode: no database is connected, nothing was saved.", values };

  const { error } = await admin
    .from("business_settings")
    .update({ ...parsed.row, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) {
    console.error("[admin] saveBusinessSettings failed:", error.message);
    return { ok: false, message: "Could not save. Please try again.", values };
  }
  revalidatePath("/", "layout"); // the name and contact details appear on every page
  return { ok: true, message: "Saved.", values };
}

// ---------- notifications ----------

export type NotificationFormValues = {
  email_from_name: string;
  email_from_address: string;
  order_notify_emails: string;
  low_stock_notify_emails: string;
  daily_report_enabled: boolean;
  daily_report_emails: string;
  daily_report_hour: number;
  daily_report_sections: string[];
};
export type NotificationState = { ok: boolean; message: string; values: NotificationFormValues } | null;

export async function saveNotificationSettings(_prev: NotificationState, formData: FormData): Promise<NotificationState> {
  await requireAdmin();
  const text = (name: string) => String(formData.get(name) ?? "");
  const sections = formData.getAll("daily_report_sections").map(String);
  const values: NotificationFormValues = {
    email_from_name: text("email_from_name"),
    email_from_address: text("email_from_address"),
    order_notify_emails: text("order_notify_emails"),
    low_stock_notify_emails: text("low_stock_notify_emails"),
    daily_report_enabled: formData.get("daily_report_enabled") !== null,
    daily_report_emails: text("daily_report_emails"),
    daily_report_hour: Number(text("daily_report_hour")),
    daily_report_sections: sections,
  };
  const parsed = parseNotificationSettings({
    ...values,
    daily_report_enabled: values.daily_report_enabled ? "on" : "",
    daily_report_hour: text("daily_report_hour"),
  });
  if (!parsed.ok) return { ok: false, message: parsed.error, values };

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Demo mode: no database is connected, nothing was saved.", values };
  const { error } = await admin
    .from("notification_settings")
    .update({ ...parsed.row, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) {
    console.error("[admin] saveNotificationSettings failed:", error.message);
    return { ok: false, message: "Could not save. Has migration 0018 been applied?", values };
  }
  revalidatePath("/admin/settings");
  return { ok: true, message: "Saved.", values };
}

export async function sendTestEmail(): Promise<{ ok: boolean; message: string }> {
  const adminEmail = await requireAdmin();
  if (!adminEmail) return { ok: false, message: "Demo mode: no email can be sent." };
  const business = await getBusinessIdentity();
  const line = `This is a test email from ${business.displayName}. If you can read it, email is set up correctly.`;
  const result = await sendEmail({
    kind: "test",
    to: [adminEmail],
    email: { subject: `Test email — ${business.displayName}`, text: line, html: `<p style="font-family:Arial,Helvetica,sans-serif;font-size:16px">${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` },
  });
  revalidatePath("/admin/settings"); // the log below the form shows this attempt
  return result.ok ? { ok: true, message: `Sent to ${adminEmail}.` } : { ok: false, message: result.error ?? "Could not send." };
}
