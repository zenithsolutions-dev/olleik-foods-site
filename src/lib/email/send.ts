import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Email } from "./templates";

// The ONE place email leaves the app. Every attempt, sent or failed, is written to email_log so the admin
// can see it. Never throws: a failed email must not fail the order or the stock change that caused it.
//
// The service is reached over its HTTP API (POST {EMAIL_API_URL}/emails, the Resend request shape):
//   EMAIL_API_KEY   the service's key (required to send)
//   EMAIL_API_URL   defaults to https://api.resend.com; local development points it at a test inbox
// The sender name and address come from Settings and must be on the domain verified with the service.

export type EmailKind = "order" | "low_stock" | "daily_report" | "statement" | "test";

const DEFAULT_API_URL = "https://api.resend.com";
const SEND_TIMEOUT_MS = 10_000;

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}

export async function sendEmail(args: {
  kind: EmailKind;
  to: string[];
  email: Email;
  relatedId?: string;
  // Stops the service sending the same message twice if a request is retried.
  idempotencyKey?: string;
  attachments?: Array<{ filename: string; content: string }>; // content is Base64
}): Promise<{ ok: boolean; error?: string }> {
  const { kind, to, email } = args;
  if (to.length === 0) return { ok: false, error: "No recipients." };
  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "No database is connected." };
  const subject = email.subject.replace(/[\r\n]+/g, " ").slice(0, 200);

  const finish = async (error: string | null, providerId: string | null) => {
    const { error: logError } = await admin.from("email_log").insert({
      kind,
      to_emails: to,
      subject,
      status: error ? "failed" : "sent",
      error,
      provider_id: providerId,
      related_id: args.relatedId ?? null,
    });
    if (logError) console.error("[email] could not write email_log:", logError.message);
    if (error) console.error(`[email] ${kind} failed: ${error}`);
    return error ? { ok: false, error } : { ok: true };
  };

  const { data: settings } = await admin
    .from("notification_settings")
    .select("email_from_name, email_from_address")
    .maybeSingle();
  const fromAddress = settings?.email_from_address as string | null | undefined;
  if (!fromAddress) return finish("No sender address is set. Add one in Settings → Notifications.", null);
  const apiKey = process.env.EMAIL_API_KEY;
  if (!apiKey) return finish("The email service is not connected yet (EMAIL_API_KEY is missing).", null);

  const fromName = ((settings?.email_from_name as string | null) ?? "").replace(/["\\<>\r\n]/g, "").trim();
  try {
    const response = await fetch(`${process.env.EMAIL_API_URL?.trim() || DEFAULT_API_URL}/emails`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "user-agent": "wholesale-ordering/1.0", // the service rejects requests without one
        ...(args.idempotencyKey ? { "idempotency-key": args.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        // Quoted, so a name with a comma ("Acme, Inc") is still one valid sender.
        from: fromName ? `"${fromName}" <${fromAddress}>` : fromAddress,
        to,
        subject,
        html: email.html,
        text: email.text,
        ...(args.attachments ? { attachments: args.attachments } : {}),
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    // The service's reply is not ours to trust: only a string message is used, and only a bounded piece of it
    // (it is stored in email_log and shown to admins).
    const body = (await response.json().catch(() => null)) as { id?: unknown; message?: unknown } | null;
    if (!response.ok) {
      const reason = typeof body?.message === "string" ? body.message.slice(0, 300) : `The email service answered ${response.status}.`;
      return finish(reason, null);
    }
    return finish(null, typeof body?.id === "string" ? body.id : null);
  } catch (e) {
    return finish(e instanceof Error ? `Could not reach the email service: ${e.message}` : "Could not reach the email service.", null);
  }
}
