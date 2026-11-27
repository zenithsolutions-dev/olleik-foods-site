"use server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { getBusinessIdentity } from "@/lib/business";
import { BUSINESS_TIME_ZONE, resolveDateRange, type RangeSearchParams } from "@/lib/dates";
import { sendEmail, siteUrl } from "@/lib/email/send";
import { buildStatementEmail } from "@/lib/email/templates";
import { expiryFor, hashToken, newToken, statementMessage, whatsappStatementUrl } from "@/lib/statement-links";
import { getAdminClient } from "@/lib/supabase/admin";

// Send a customer their statement: by email, or as a ready WhatsApp message. Either way the customer gets
// a secure link (WhatsApp click-to-chat cannot attach a file) to the CUSTOMER copy — never cost or profit.
//
// WhatsApp here is click-to-chat: it opens WhatsApp with the message written and the admin presses send.
// Fully automatic sending would need the WhatsApp Business API (approved templates, per-message cost);
// that would be a third branch in this function and is deliberately not built.

export type SendStatementResult = { ok: boolean; message: string; whatsappUrl?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function sendStatement(input: {
  customerId: string;
  // The page's own period choice (?range=…&from=…&to=…). The dates AND the label printed on the customer's
  // document are worked out here from it, so the label can never disagree with what the link shows.
  range: RangeSearchParams;
  via: "email" | "whatsapp";
}): Promise<SendStatementResult> {
  const adminEmail = await requireAdmin();
  if (!UUID.test(input.customerId)) {
    return { ok: false, message: "Could not prepare the statement. Reload the page and try again." };
  }
  if (input.via !== "email" && input.via !== "whatsapp") return { ok: false, message: "Unknown way to send." };
  const picked = input.range ?? {};
  const period = resolveDateRange(
    picked.range || picked.from || picked.to
      ? { range: String(picked.range ?? ""), from: String(picked.from ?? ""), to: String(picked.to ?? "") }
      : { range: "this-month" }, // the statement page's default
  );
  const periodLabel = period.label;

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Demo mode: no database is connected." };

  const { data: customer } = await admin
    .from("customers")
    .select("id, business_name, contact_name, email, phone, status")
    .eq("id", input.customerId)
    .maybeSingle();
  if (!customer) return { ok: false, message: "Customer not found." };
  if (customer.status === "archived") return { ok: false, message: "This customer is archived. Restore the account to send a statement." };
  if (input.via === "email" && !customer.email) return { ok: false, message: "This customer has no email address on file." };

  const now = new Date();
  const token = newToken();
  const expiresAt = expiryFor(now);
  const { data: link, error } = await admin
    .from("statement_links")
    .insert({
      token_hash: hashToken(token), // the token itself is never stored
      customer_id: customer.id,
      range_start: period.startUTC?.toISOString() ?? null,
      range_end: period.endUTC?.toISOString() ?? null,
      period_label: periodLabel,
      expires_at: expiresAt.toISOString(),
      created_by: adminEmail,
      sent_via: input.via,
    })
    .select("id")
    .single();
  if (error || !link) {
    console.error("[admin] sendStatement link insert failed:", error?.message);
    return { ok: false, message: "Could not create the statement link. Has migration 0020 been applied?" };
  }

  const business = await getBusinessIdentity();
  const url = `${siteUrl()}/statement/${token}`;
  const expiresLabel = expiresAt.toLocaleDateString("en-CA", { dateStyle: "medium", timeZone: BUSINESS_TIME_ZONE });

  if (input.via === "whatsapp") {
    const chat = whatsappStatementUrl(
      customer.phone,
      statementMessage({ businessName: business.displayName, periodLabel, url, expiresLabel }),
    );
    return {
      ok: true,
      whatsappUrl: chat.url,
      message: chat.hasRecipient
        ? "WhatsApp is opening with the message ready. Press send there."
        : "This customer's number has no country code, so WhatsApp will ask you to pick the contact. Add the country code (e.g. +1) to their phone number to skip that.",
    };
  }

  const result = await sendEmail({
    kind: "statement",
    to: [customer.email],
    relatedId: customer.id,
    email: buildStatementEmail({
      customerName: customer.contact_name || customer.business_name,
      businessName: business.displayName,
      periodLabel,
      url,
      expiresLabel,
    }),
  });
  if (!result.ok) {
    // Nobody received this link: do not leave a working key lying around.
    await admin.from("statement_links").delete().eq("id", link.id);
    return { ok: false, message: `The email was not sent: ${result.error ?? "unknown error"}` };
  }
  return { ok: true, message: `Sent to ${customer.email}. The link works until ${expiresLabel}.` };
}

// A link went to the wrong person, or the account is in dispute: switch off every link this customer has.
export async function revokeStatementLinks(customerId: string): Promise<SendStatementResult> {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin || !UUID.test(customerId)) return { ok: false, message: "Could not cancel the links." };
  const { data, error } = await admin
    .from("statement_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("customer_id", customerId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id");
  if (error) {
    console.error("[admin] revokeStatementLinks failed:", error.message);
    return { ok: false, message: "Could not cancel the links. Please try again." };
  }
  const count = data?.length ?? 0;
  return { ok: true, message: count === 0 ? "There were no working links to cancel." : `Cancelled ${count} link${count === 1 ? "" : "s"}. They no longer open.` };
}
