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
    revalidate(customerId);
    return { ok: true, message: `Linked an existing login and emailed ${email}.` };
  }

  console.error("[admin] invite failed:", inviteErr?.message);
  return { ok: false, message: "Could not send the invite. Please try again." };
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
