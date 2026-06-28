"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/require-admin";
import type {
  CustomerStatus,
  OfferDiscountKind,
  PaymentTerms,
} from "@/lib/admin/types";

// Customer / pricing / offer mutations via the service-role client. Every
// action re-checks requireAdmin() (Server Functions are POST endpoints; don't
// rely on the proxy/layout gate alone) and returns a result the client
// surfaces — no silent success. Customers are ARCHIVED, never hard-deleted, so
// their customer_products and customer_offers are preserved and restorable.

export type ActionResult = { ok: true } | { ok: false; message: string };

function revalidate(customerId?: string) {
  revalidatePath("/admin/customers");
  if (customerId) revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin"); // dashboard customer count
}

// ---------------- Customers ----------------

export type CustomerInput = {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  status: CustomerStatus;
  paymentTerms: PaymentTerms;
  notes?: string;
};

function validateCustomer(input: CustomerInput): string | null {
  if (!input.businessName.trim()) return "Business name is required.";
  if (!input.contactName.trim()) return "Contact name is required.";
  if (!input.email.trim()) return "Email is required.";
  if (!input.phone.trim()) return "Phone is required.";
  return null;
}

function toCustomerRow(input: CustomerInput) {
  return {
    business_name: input.businessName.trim(),
    contact_name: input.contactName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    status: input.status,
    payment_terms: input.paymentTerms,
    notes: input.notes?.trim() || null,
  };
}

export async function createCustomer(input: CustomerInput): Promise<ActionResult> {
  await requireAdmin();
  const invalid = validateCustomer(input);
  if (invalid) return { ok: false, message: invalid };

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { error } = await admin.from("customers").insert(toCustomerRow(input));
  if (error) {
    console.error("[admin] create customer failed:", error.message);
    return { ok: false, message: "Could not create the customer. Please try again." };
  }
  revalidate();
  return { ok: true };
}

export async function updateCustomer(
  id: string,
  input: CustomerInput,
): Promise<ActionResult> {
  await requireAdmin();
  const invalid = validateCustomer(input);
  if (invalid) return { ok: false, message: invalid };

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { error } = await admin.from("customers").update(toCustomerRow(input)).eq("id", id);
  if (error) {
    console.error("[admin] update customer failed:", error.message);
    return { ok: false, message: "Could not update the customer. Please try again." };
  }
  revalidate(id);
  return { ok: true };
}

// Soft-delete: archive. The row, its customer_products, and customer_offers are
// all preserved; the customer just drops out of the active list + dashboard.
export async function archiveCustomer(id: string): Promise<ActionResult> {
  return setCustomerStatus(id, "archived", "archive");
}

export async function restoreCustomer(id: string): Promise<ActionResult> {
  return setCustomerStatus(id, "active", "restore");
}

async function setCustomerStatus(
  id: string,
  status: CustomerStatus,
  verb: string,
): Promise<ActionResult> {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { error } = await admin.from("customers").update({ status }).eq("id", id);
  if (error) {
    console.error(`[admin] ${verb} customer failed:`, error.message);
    return { ok: false, message: `Could not ${verb} the customer. Please try again.` };
  }
  revalidate(id);
  return { ok: true };
}

// ---------------- Portal invite (Phase D) ----------------

export type InviteResult = { ok: boolean; message: string };

// Derive the request origin so invite/reset redirect links work on localhost,
// Vercel preview, and prod without hardcoding.
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

async function findAuthUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return null;
  const match = data.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
  return match?.id ?? null;
}

// Stamp when an invite was last generated/sent (drives the admin "Invited" badge).
async function stampInvited(admin: SupabaseClient, customerId: string): Promise<void> {
  await admin.from("customers").update({ invited_at: new Date().toISOString() }).eq("id", customerId);
}

// Invite a customer to the portal: create (or link) a Supabase Auth user, set
// customers.user_id atomically, and email them a set-password link. Admin-only,
// service-role — this is admin context, so service-role is correct here. The
// PORTAL never does any of this; it only reads via the session client.
export async function inviteCustomerToPortal(customerId: string): Promise<InviteResult> {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { data: cust, error: cErr } = await admin
    .from("customers")
    .select("id, email, user_id")
    .eq("id", customerId)
    .maybeSingle();
  if (cErr || !cust) return { ok: false, message: "Customer not found." };

  const email = cust.email as string;
  const origin = await requestOrigin();
  const redirectTo = `${origin}/auth/confirm?next=/auth/set-password`;

  // Already linked → resend a set-password / recovery email.
  if (cust.user_id) {
    const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      console.error("[admin] resend invite failed:", error.message);
      return { ok: false, message: "Could not resend the invite. Please try again." };
    }
    await stampInvited(admin, customerId);
    revalidate(customerId);
    return { ok: true, message: `Invite re-sent to ${email}.` };
  }

  // New invite — create the auth user and send the set-password email.
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  if (!inviteErr && invited?.user) {
    const userId = invited.user.id;
    const { error: linkErr } = await admin
      .from("customers")
      .update({ user_id: userId })
      .eq("id", customerId);
    if (linkErr) {
      // Roll back the just-created auth user so we never half-link.
      await admin.auth.admin.deleteUser(userId);
      console.error("[admin] link after invite failed, rolled back:", linkErr.message);
      const msg =
        linkErr.code === "23505"
          ? "That login is already linked to another customer."
          : "Could not link the invite. Please try again.";
      return { ok: false, message: msg };
    }
    await stampInvited(admin, customerId);
    revalidate(customerId);
    return { ok: true, message: `Invite sent to ${email}.` };
  }

  // Email already has an auth user → auto-link the existing user (Decision 2).
  const alreadyExists =
    inviteErr &&
    ((inviteErr as { code?: string }).code === "email_exists" ||
      /already.*regist/i.test(inviteErr.message));
  if (alreadyExists) {
    const existingId = await findAuthUserIdByEmail(admin, email);
    if (!existingId) {
      return {
        ok: false,
        message: "This email already has a login, but it couldn't be located in Supabase Auth.",
      };
    }
    const { error: linkErr } = await admin
      .from("customers")
      .update({ user_id: existingId })
      .eq("id", customerId);
    if (linkErr) {
      const msg =
        linkErr.code === "23505"
          ? "That login is already linked to another customer."
          : "Could not link the existing login.";
      console.error("[admin] link existing user failed:", linkErr.message);
      return { ok: false, message: msg };
    }
    const { error: mailErr } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
    if (mailErr) console.error("[admin] linked existing user but email failed:", mailErr.message);
    await stampInvited(admin, customerId);
    revalidate(customerId);
    return { ok: true, message: `Linked an existing login and emailed ${email}.` };
  }

  console.error("[admin] invite failed:", inviteErr?.message);
  return { ok: false, message: "Could not send the invite. Please try again." };
}

export type InviteLinkResult =
  | { ok: true; message: string; link: string }
  | { ok: false; message: string };

// Generate a one-time set-password link WITHOUT sending an email (the WhatsApp
// path). The link is a BEARER credential: it is generated on demand, returned
// once for the admin to copy, never stored, and regenerated fresh on re-click.
// Service-role under /admin only; the admin never learns the password.
export async function generateInviteLink(customerId: string): Promise<InviteLinkResult> {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { data: cust, error: cErr } = await admin
    .from("customers")
    .select("id, email, user_id")
    .eq("id", customerId)
    .maybeSingle();
  if (cErr || !cust) return { ok: false, message: "Customer not found." };

  const email = cust.email as string;
  const origin = await requestOrigin();
  const redirectTo = `${origin}/auth/confirm?next=/auth/set-password`;

  // Build OUR OWN link from the generated token_hash, pointing at /auth/confirm.
  // This uses verifyOtp (token_hash) — no PKCE code verifier, no URL hash — so it
  // works identically on desktop and mobile. We deliberately do NOT hand out
  // data.properties.action_link (the Supabase /auth/v1/verify URL), whose
  // verify→hash/code redirect is what broke the flow.
  const confirmLink = (
    data: { properties?: { hashed_token?: string } | null } | null,
    type: "invite" | "recovery",
  ): string | null => {
    const token = data?.properties?.hashed_token;
    if (!token) return null;
    return `${origin}/auth/confirm?token_hash=${encodeURIComponent(token)}&type=${type}&next=${encodeURIComponent("/auth/set-password")}`;
  };

  // Already linked → fresh recovery link.
  if (cust.user_id) {
    const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } });
    const link = confirmLink(data, "recovery");
    if (error || !link) {
      console.error("[admin] recovery link failed:", error?.message);
      return { ok: false, message: "Could not generate the link. Please try again." };
    }
    await stampInvited(admin, customerId);
    revalidate(customerId);
    return { ok: true, message: "Set-password link generated.", link };
  }

  // New → invite link CREATES the auth user and returns a token without emailing.
  const { data, error } = await admin.auth.admin.generateLink({ type: "invite", email, options: { redirectTo } });
  if (!error && data?.user && confirmLink(data, "invite")) {
    const userId = data.user.id;
    const { error: linkErr } = await admin.from("customers").update({ user_id: userId }).eq("id", customerId);
    if (linkErr) {
      await admin.auth.admin.deleteUser(userId); // roll back so we never half-link
      const msg = linkErr.code === "23505" ? "That login is already linked to another customer." : "Could not link the invite.";
      return { ok: false, message: msg };
    }
    await stampInvited(admin, customerId);
    revalidate(customerId);
    return { ok: true, message: "Invite link generated.", link: confirmLink(data, "invite")! };
  }

  // Email already has an auth user → auto-link, then a recovery link.
  const alreadyExists =
    error && ((error as { code?: string }).code === "email_exists" || /already.*regist/i.test(error.message));
  if (alreadyExists) {
    const existingId = await findAuthUserIdByEmail(admin, email);
    if (!existingId) return { ok: false, message: "This email already has a login that couldn't be located." };
    const { error: linkErr } = await admin.from("customers").update({ user_id: existingId }).eq("id", customerId);
    if (linkErr) {
      const msg = linkErr.code === "23505" ? "That login is already linked to another customer." : "Could not link the existing login.";
      return { ok: false, message: msg };
    }
    const { data: rec, error: recErr } = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } });
    const link = confirmLink(rec, "recovery");
    if (recErr || !link) return { ok: false, message: "Linked the login but could not generate a link." };
    await stampInvited(admin, customerId);
    revalidate(customerId);
    return { ok: true, message: "Linked an existing login; link generated.", link };
  }

  console.error("[admin] generateInviteLink failed:", error?.message);
  return { ok: false, message: "Could not generate the invite link." };
}

// ---------------- Lead -> customer conversion (Phase E) ----------------

export type ConvertOutcome = {
  leadId: string;
  result: "created" | "linked" | "skipped";
  customerId?: string;
  message?: string;
};

function revalidateConversions(customerId?: string) {
  revalidate(customerId);
  revalidatePath("/admin/leads");
  revalidatePath("/admin/customers/new");
}

// A non-archived customer with the same email (case-insensitive), if any.
async function findActiveCustomerByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  const { data } = await admin
    .from("customers")
    .select("id")
    .neq("status", "archived")
    .ilike("email", email)
    .limit(1);
  return data?.[0]?.id ?? null;
}

// Link a lead to an already-existing customer instead of creating a duplicate.
export async function linkLeadToExistingCustomer(
  leadId: string,
  customerId: string,
): Promise<ConvertOutcome> {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin) return { leadId, result: "skipped", message: "Supabase is not configured." };

  const { error: leadErr } = await admin
    .from("leads")
    .update({ status: "converted", converted_customer_id: customerId })
    .eq("id", leadId);
  if (leadErr) {
    console.error("[admin] link lead failed:", leadErr.message);
    return { leadId, result: "skipped", message: "Could not link the lead." };
  }
  // Best-effort backfill of provenance on the customer (only if not already set).
  await admin.from("customers").update({ source_lead_id: leadId }).eq("id", customerId).is("source_lead_id", null);
  revalidateConversions(customerId);
  return { leadId, result: "linked", customerId };
}

// Core: convert one lead using an explicit customer payload (the edited review
// form for single convert, or the lead's own fields for bulk).
async function convertOne(
  admin: SupabaseClient,
  leadId: string,
  payload: {
    businessName: string;
    contactName: string;
    email: string;
    phone: string;
    address: string;
  },
): Promise<ConvertOutcome> {
  // Already converted? skip (idempotent).
  const { data: lead } = await admin
    .from("leads")
    .select("id, converted_customer_id")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return { leadId, result: "skipped", message: "Lead not found." };
  if (lead.converted_customer_id) {
    return { leadId, result: "skipped", customerId: lead.converted_customer_id, message: "Already converted." };
  }

  // Dedup by email → link to the existing customer instead of duplicating.
  const existingId = await findActiveCustomerByEmail(admin, payload.email);
  if (existingId) {
    return linkLeadToExistingCustomer(leadId, existingId);
  }

  // Create the customer (active), with provenance, then stamp the lead.
  const { data: created, error: insErr } = await admin
    .from("customers")
    .insert({
      business_name: payload.businessName.trim(),
      contact_name: payload.contactName.trim(),
      email: payload.email.trim(),
      phone: payload.phone.trim(),
      address: payload.address.trim(),
      status: "active",
      payment_terms: "cod",
      source_lead_id: leadId,
    })
    .select("id")
    .single();

  if (insErr || !created) {
    // Unique-email race → fall back to linking.
    if (insErr?.code === "23505") {
      const dupId = await findActiveCustomerByEmail(admin, payload.email);
      if (dupId) return linkLeadToExistingCustomer(leadId, dupId);
    }
    console.error("[admin] convert insert failed:", insErr?.message);
    return { leadId, result: "skipped", message: "Could not create the customer." };
  }

  const { error: leadErr } = await admin
    .from("leads")
    .update({ status: "converted", converted_customer_id: created.id })
    .eq("id", leadId);
  if (leadErr) {
    // Customer exists and is linked via source_lead_id; only the lead stamp
    // failed. Surface it — trivial to reconcile, no orphan.
    console.error("[admin] convert: lead stamp failed:", leadErr.message);
  }
  revalidateConversions(created.id);
  return { leadId, result: "created", customerId: created.id };
}

// Single convert with the (possibly edited) review-form values.
export async function convertLeadWithDetails(
  leadId: string,
  input: CustomerInput,
): Promise<ConvertOutcome> {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin) return { leadId, result: "skipped", message: "Supabase is not configured." };
  if (!input.businessName.trim() || !input.email.trim()) {
    return { leadId, result: "skipped", message: "Business name and email are required." };
  }
  return convertOne(admin, leadId, {
    businessName: input.businessName,
    contactName: input.contactName,
    email: input.email,
    phone: input.phone,
    address: input.address,
  });
}

// Bulk convert directly from lead data (no review).
export async function convertLeadsToCustomers(leadIds: string[]): Promise<ConvertOutcome[]> {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin) return leadIds.map((id) => ({ leadId: id, result: "skipped" as const, message: "Supabase is not configured." }));

  const outcomes: ConvertOutcome[] = [];
  for (const leadId of leadIds) {
    const { data: lead } = await admin
      .from("leads")
      .select("business_name, contact_name, email, phone, address")
      .eq("id", leadId)
      .maybeSingle();
    if (!lead) {
      outcomes.push({ leadId, result: "skipped", message: "Lead not found." });
      continue;
    }
    outcomes.push(
      await convertOne(admin, leadId, {
        businessName: lead.business_name ?? "",
        contactName: lead.contact_name ?? "",
        email: lead.email ?? "",
        phone: lead.phone ?? "",
        address: lead.address ?? "",
      }),
    );
  }
  return outcomes;
}

// ---------------- Per-customer pricing (customer_products) ----------------

// Bulk-assign products at list price (price_cents = null). ignoreDuplicates so
// re-adding never clobbers an existing custom price.
export async function assignProducts(
  customerId: string,
  productIds: string[],
): Promise<ActionResult> {
  await requireAdmin();
  if (productIds.length === 0) return { ok: true };

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const rows = productIds.map((productId) => ({
    customer_id: customerId,
    product_id: productId,
    price_cents: null,
  }));
  const { error } = await admin
    .from("customer_products")
    .upsert(rows, { onConflict: "customer_id,product_id", ignoreDuplicates: true });
  if (error) {
    console.error("[admin] assign products failed:", error.message);
    return { ok: false, message: "Could not add the products. Please try again." };
  }
  revalidate(customerId);
  return { ok: true };
}

// Set (or clear) a customer-specific price. null = inherit the list price.
export async function setCustomerProductPrice(
  customerId: string,
  productId: string,
  priceCents: number | null,
): Promise<ActionResult> {
  await requireAdmin();
  if (priceCents != null && (!Number.isInteger(priceCents) || priceCents < 0)) {
    return { ok: false, message: "Price must be a valid non-negative amount." };
  }

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { error } = await admin
    .from("customer_products")
    .upsert(
      { customer_id: customerId, product_id: productId, price_cents: priceCents },
      { onConflict: "customer_id,product_id" },
    );
  if (error) {
    console.error("[admin] set customer price failed:", error.message);
    return { ok: false, message: "Could not update the price. Please try again." };
  }
  revalidate(customerId);
  return { ok: true };
}

export async function removeCustomerProduct(
  customerId: string,
  productId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { error } = await admin
    .from("customer_products")
    .delete()
    .eq("customer_id", customerId)
    .eq("product_id", productId);
  if (error) {
    console.error("[admin] remove customer product failed:", error.message);
    return { ok: false, message: "Could not remove the product. Please try again." };
  }
  revalidate(customerId);
  return { ok: true };
}

// ---------------- Offers (customer_offers) ----------------

export type OfferInput = {
  title: string;
  description?: string;
  productId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  // Stored but not surfaced in the Phase C UI (offers are informational).
  discountKind?: OfferDiscountKind | null;
  discountValue?: number | null;
};

function validateOffer(input: OfferInput): string | null {
  if (!input.title.trim()) return "Offer title is required.";
  if (input.startsAt && input.endsAt && input.endsAt < input.startsAt)
    return "The end date must be on or after the start date.";
  if (
    input.discountValue != null &&
    (!Number.isInteger(input.discountValue) || input.discountValue < 0)
  )
    return "Discount value must be a valid non-negative number.";
  return null;
}

function toOfferRow(customerId: string, input: OfferInput) {
  return {
    customer_id: customerId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    product_id: input.productId || null,
    discount_kind: input.discountKind ?? null,
    discount_value: input.discountValue ?? null,
    starts_at: input.startsAt || null,
    ends_at: input.endsAt || null,
    is_active: input.isActive,
  };
}

export async function createOffer(
  customerId: string,
  input: OfferInput,
): Promise<ActionResult> {
  await requireAdmin();
  const invalid = validateOffer(input);
  if (invalid) return { ok: false, message: invalid };

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { error } = await admin.from("customer_offers").insert(toOfferRow(customerId, input));
  if (error) {
    console.error("[admin] create offer failed:", error.message);
    return { ok: false, message: "Could not create the offer. Please try again." };
  }
  revalidate(customerId);
  return { ok: true };
}

export async function updateOffer(
  customerId: string,
  offerId: string,
  input: OfferInput,
): Promise<ActionResult> {
  await requireAdmin();
  const invalid = validateOffer(input);
  if (invalid) return { ok: false, message: invalid };

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { error } = await admin
    .from("customer_offers")
    .update(toOfferRow(customerId, input))
    .eq("id", offerId);
  if (error) {
    console.error("[admin] update offer failed:", error.message);
    return { ok: false, message: "Could not update the offer. Please try again." };
  }
  revalidate(customerId);
  return { ok: true };
}

export async function toggleOfferActive(
  customerId: string,
  offerId: string,
  isActive: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { error } = await admin
    .from("customer_offers")
    .update({ is_active: isActive })
    .eq("id", offerId);
  if (error) {
    console.error("[admin] toggle offer failed:", error.message);
    return { ok: false, message: "Could not update the offer. Please try again." };
  }
  revalidate(customerId);
  return { ok: true };
}

export async function deleteOffer(
  customerId: string,
  offerId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { error } = await admin.from("customer_offers").delete().eq("id", offerId);
  if (error) {
    console.error("[admin] delete offer failed:", error.message);
    return { ok: false, message: "Could not delete the offer. Please try again." };
  }
  revalidate(customerId);
  return { ok: true };
}
