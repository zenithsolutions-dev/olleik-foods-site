"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/require-admin";
import { indexRules, resolveWithIndex, type RuleIndex } from "@/lib/admin/pricing-engine";
import { fetchPricingRules } from "@/lib/admin/pricing-data";
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

// ---------- Cost-engine helpers (0006) ----------
// Pricing context for the waterfall: costs, active rules, category parents, and
// product list prices/categories. Loaded once per action that needs to price.
type PricingCtx = {
  idx: RuleIndex;
  costs: Map<string, number>;
  parentOf: Map<string, string | null>;
  productInfo: Map<string, { listPriceCents: number; categoryId: string | null }>;
};

async function loadPricingCtx(
  admin: SupabaseClient,
  productIds: string[],
): Promise<PricingCtx> {
  const [{ data: prodRows }, { data: catRows }, { data: costRows }, { rules }] = await Promise.all([
    productIds.length
      ? admin.from("products").select("id, list_price_cents, category_id").in("id", productIds)
      : Promise.resolve({ data: [] as never[] }),
    admin.from("categories").select("id, parent_id"),
    admin.from("product_costs").select("product_id, cost_cents"),
    fetchPricingRules(),
  ]);
  return {
    idx: indexRules(rules),
    costs: new Map(
      ((costRows as { product_id: string; cost_cents: number }[]) ?? []).map((r) => [r.product_id, r.cost_cents]),
    ),
    parentOf: new Map(
      ((catRows as { id: string; parent_id: string | null }[]) ?? []).map((c) => [c.id, c.parent_id]),
    ),
    productInfo: new Map(
      ((prodRows as { id: string; list_price_cents: number; category_id: string | null }[]) ?? []).map((p) => [
        p.id,
        { listPriceCents: p.list_price_cents, categoryId: p.category_id },
      ]),
    ),
  };
}

// Resolve one product for one customer via the waterfall (no manual price).
// Returns the stored price (null = inherit list) + meta fields.
function priceViaRules(ctx: PricingCtx, customerId: string, productId: string) {
  const info = ctx.productInfo.get(productId);
  if (!info) return null;
  const resolved = resolveWithIndex({
    idx: ctx.idx,
    customerId,
    categoryId: info.categoryId,
    parentCategoryId: info.categoryId ? (ctx.parentOf.get(info.categoryId) ?? null) : null,
    costCents: ctx.costs.get(productId) ?? null,
    listPriceCents: info.listPriceCents,
    manualPriceCents: null,
  });
  return {
    priceCents: resolved.source === "list" ? null : resolved.priceCents,
    marginPercent: resolved.marginPercent,
    ruleScope:
      resolved.source === "customer-margin"
        ? ("customer" as const)
        : resolved.source === "category-margin"
          ? ("category" as const)
          : resolved.source === "global-margin"
            ? ("global" as const)
            : null,
  };
}

// Stamp provenance for assignment rows (deny-all meta table; best-effort — a
// meta failure never blocks the price write, it only degrades recompute skips).
async function stampMeta(
  admin: SupabaseClient,
  rows: {
    customer_id: string;
    product_id: string;
    price_source: "manual" | "computed";
    margin_percent?: number | null;
    rule_scope?: "global" | "category" | "customer" | null;
  }[],
): Promise<void> {
  if (rows.length === 0) return;
  const nowIso = new Date().toISOString();
  const { error } = await admin
    .from("customer_product_pricing_meta")
    .upsert(rows.map((r) => ({ ...r, computed_at: nowIso })), {
      onConflict: "customer_id,product_id",
    });
  if (error) console.error("[admin] pricing meta stamp failed (run migration 0006?):", error.message);
}

// Clear provenance (used when a price is cleared back to "inherit list").
async function clearMeta(admin: SupabaseClient, customerId: string, productIds: string[]) {
  if (productIds.length === 0) return;
  const { error } = await admin
    .from("customer_product_pricing_meta")
    .delete()
    .eq("customer_id", customerId)
    .in("product_id", productIds);
  if (error) console.error("[admin] pricing meta clear failed:", error.message);
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

// Bulk-assign products, PRICED VIA THE WATERFALL at assign time (0006): margin
// rules produce a concrete price; no cost / no rules keeps the old behavior
// (price_cents = null = list). ignoreDuplicates so re-adding never clobbers an
// existing assignment or its price.
export async function assignProducts(
  customerId: string,
  productIds: string[],
): Promise<ActionResult> {
  await requireAdmin();
  if (productIds.length === 0) return { ok: true };

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const ctx = await loadPricingCtx(admin, productIds);
  const priced = productIds
    .map((productId) => ({ productId, r: priceViaRules(ctx, customerId, productId) }))
    .filter((x): x is { productId: string; r: NonNullable<ReturnType<typeof priceViaRules>> } => x.r != null);

  // Only rows that don't exist yet get inserted (ignoreDuplicates), so meta must
  // also only cover the NEW rows — read what exists first.
  const { data: existingRows } = await admin
    .from("customer_products")
    .select("product_id")
    .eq("customer_id", customerId)
    .in("product_id", productIds);
  const existing = new Set(
    ((existingRows as { product_id: string }[]) ?? []).map((r) => r.product_id),
  );
  const fresh = priced.filter((x) => !existing.has(x.productId));

  const { error } = await admin.from("customer_products").upsert(
    fresh.map((x) => ({
      customer_id: customerId,
      product_id: x.productId,
      price_cents: x.r.priceCents,
    })),
    { onConflict: "customer_id,product_id", ignoreDuplicates: true },
  );
  if (error) {
    console.error("[admin] assign products failed:", error.message);
    return { ok: false, message: "Could not add the products. Please try again." };
  }
  await stampMeta(
    admin,
    fresh.map((x) => ({
      customer_id: customerId,
      product_id: x.productId,
      price_source: "computed" as const,
      margin_percent: x.r.marginPercent,
      rule_scope: x.r.ruleScope,
    })),
  );
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
  // Provenance: a typed price is MANUAL (protected from recompute); clearing it
  // (null = inherit list) removes provenance so the row is recompute-eligible.
  if (priceCents != null) {
    await stampMeta(admin, [
      { customer_id: customerId, product_id: productId, price_source: "manual" },
    ]);
  } else {
    await clearMeta(admin, customerId, [productId]);
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

// Copy ALL of another customer's assignments (and optionally their custom
// prices) onto this customer. Inactive/deleted products are always skipped.
//   mode "merge"     -> add products the target lacks; keep existing rows + prices
//   mode "overwrite" -> DESTRUCTIVE: replace the target's entire catalog
//   prices "copy"    -> bring the source's prices as-is (meta 'manual' — bespoke)
//   prices "list"    -> D2: price via the TARGET customer's margin waterfall
//                       (meta 'computed'; null/list only when nothing applies)
export type CopyCatalogResult =
  | { ok: true; copied: number; skipped: number; mode: "merge" | "overwrite" }
  | { ok: false; message: string };

export async function copyCatalogFromCustomer(
  targetCustomerId: string,
  sourceCustomerId: string,
  options: { mode: "merge" | "overwrite"; prices: "copy" | "list" },
): Promise<CopyCatalogResult> {
  await requireAdmin();
  if (sourceCustomerId === targetCustomerId) {
    return { ok: false, message: "Choose a different customer to copy from." };
  }

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  // Source assignments joined to product activity — skip inactive/deleted.
  const { data: srcRows, error: srcErr } = await admin
    .from("customer_products")
    .select("product_id, price_cents, products(is_active)")
    .eq("customer_id", sourceCustomerId);
  if (srcErr) {
    console.error("[admin] copy catalog: read source failed:", srcErr.message);
    return { ok: false, message: "Could not read the source customer's catalog." };
  }

  type SrcRow = {
    product_id: string;
    price_cents: number | null;
    products: { is_active: boolean } | null;
  };
  const all = (srcRows as unknown as SrcRow[]) ?? [];
  const eligible = all.filter((r) => r.products && r.products.is_active);
  const skipped = all.length - eligible.length;

  // D2: "list" mode prices via the TARGET's waterfall; "copy" carries the
  // source price verbatim. Meta records which, so recompute protects copies.
  const ctx =
    options.prices === "list"
      ? await loadPricingCtx(admin, eligible.map((r) => r.product_id))
      : null;

  const mapRow = (r: SrcRow) => {
    if (options.prices === "copy") {
      return { customer_id: targetCustomerId, product_id: r.product_id, price_cents: r.price_cents };
    }
    const priced = ctx ? priceViaRules(ctx, targetCustomerId, r.product_id) : null;
    return {
      customer_id: targetCustomerId,
      product_id: r.product_id,
      price_cents: priced?.priceCents ?? null,
    };
  };
  const metaFor = (r: SrcRow) => {
    if (options.prices === "copy") {
      return {
        customer_id: targetCustomerId,
        product_id: r.product_id,
        price_source: "manual" as const,
      };
    }
    const priced = ctx ? priceViaRules(ctx, targetCustomerId, r.product_id) : null;
    return {
      customer_id: targetCustomerId,
      product_id: r.product_id,
      price_source: "computed" as const,
      margin_percent: priced?.marginPercent ?? null,
      rule_scope: priced?.ruleScope ?? null,
    };
  };

  if (options.mode === "overwrite") {
    // Destructive: wipe the target's catalog (and its custom prices) first.
    // (Meta rows cascade-delete via the composite FK.)
    const { error: delErr } = await admin
      .from("customer_products")
      .delete()
      .eq("customer_id", targetCustomerId);
    if (delErr) {
      console.error("[admin] copy catalog: clear target failed:", delErr.message);
      return { ok: false, message: "Could not clear the target catalog. Nothing was changed." };
    }
    if (eligible.length > 0) {
      const { error: insErr } = await admin.from("customer_products").insert(eligible.map(mapRow));
      if (insErr) {
        console.error("[admin] copy catalog: insert failed:", insErr.message);
        return { ok: false, message: "Cleared the catalog but the copy failed. Please re-copy." };
      }
      await stampMeta(admin, eligible.map(metaFor));
    }
    revalidate(targetCustomerId);
    return { ok: true, copied: eligible.length, skipped, mode: "overwrite" };
  }

  // Merge: only add products the target doesn't already have (existing rows and
  // their prices are preserved). Compute the new set for an accurate count.
  const { data: tgtRows, error: tgtErr } = await admin
    .from("customer_products")
    .select("product_id")
    .eq("customer_id", targetCustomerId);
  if (tgtErr) {
    console.error("[admin] copy catalog: read target failed:", tgtErr.message);
    return { ok: false, message: "Could not read the target customer's catalog." };
  }
  const existing = new Set(((tgtRows as { product_id: string }[]) ?? []).map((r) => r.product_id));
  const fresh = eligible.filter((r) => !existing.has(r.product_id));

  if (fresh.length > 0) {
    const { error: upErr } = await admin
      .from("customer_products")
      .upsert(fresh.map(mapRow), { onConflict: "customer_id,product_id", ignoreDuplicates: true });
    if (upErr) {
      console.error("[admin] copy catalog: merge failed:", upErr.message);
      return { ok: false, message: "Could not copy the products. Please try again." };
    }
    await stampMeta(admin, fresh.map(metaFor));
  }
  revalidate(targetCustomerId);
  return { ok: true, copied: fresh.length, skipped, mode: "merge" };
}

// Apply one pricing operation to many of a customer's assigned products at once.
// The effective-price rule is unchanged (COALESCE(custom, list)); this only
// writes price_cents. set/percentOff produce MANUAL prices (protected from
// recompute); "reprice" (D3, formerly "clear") re-runs the margin waterfall and
// stores computed prices (null when only the list price applies).
export type BulkPriceOp =
  | { kind: "set"; priceCents: number } // flat price for all selected
  | { kind: "percentOff"; percent: number } // % off EACH product's own list price
  | { kind: "clear" }; // REPRICE BY RULES (waterfall; null when nothing applies)

export type BulkPriceResult = { ok: true; updated: number } | { ok: false; message: string };

export async function bulkUpdateCustomerPrices(
  customerId: string,
  productIds: string[],
  op: BulkPriceOp,
): Promise<BulkPriceResult> {
  await requireAdmin();
  if (productIds.length === 0) return { ok: true, updated: 0 };

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  let rows: { customer_id: string; product_id: string; price_cents: number | null }[];
  let metaRows: Parameters<typeof stampMeta>[1] = [];

  if (op.kind === "set") {
    if (!Number.isInteger(op.priceCents) || op.priceCents < 0) {
      return { ok: false, message: "Price must be a valid non-negative amount." };
    }
    rows = productIds.map((product_id) => ({
      customer_id: customerId,
      product_id,
      price_cents: op.priceCents,
    }));
    metaRows = rows.map((r) => ({
      customer_id: r.customer_id,
      product_id: r.product_id,
      price_source: "manual" as const,
    }));
  } else if (op.kind === "clear") {
    // D3: reprice via the waterfall (margin rules); rows where only the list
    // price applies store null (inherit list) and drop their provenance.
    const ctx = await loadPricingCtx(admin, productIds);
    const priced = productIds
      .map((product_id) => ({ product_id, r: priceViaRules(ctx, customerId, product_id) }))
      .filter((x): x is { product_id: string; r: NonNullable<ReturnType<typeof priceViaRules>> } => x.r != null);
    rows = priced.map((x) => ({
      customer_id: customerId,
      product_id: x.product_id,
      price_cents: x.r.priceCents,
    }));
    metaRows = priced
      .filter((x) => x.r.priceCents != null)
      .map((x) => ({
        customer_id: customerId,
        product_id: x.product_id,
        price_source: "computed" as const,
        margin_percent: x.r.marginPercent,
        rule_scope: x.r.ruleScope,
      }));
    // Rows that resolved to plain list lose their provenance entirely.
    await clearMeta(
      admin,
      customerId,
      priced.filter((x) => x.r.priceCents == null).map((x) => x.product_id),
    );
  } else {
    if (
      typeof op.percent !== "number" ||
      Number.isNaN(op.percent) ||
      op.percent < 0 ||
      op.percent > 100
    ) {
      return { ok: false, message: "Discount must be between 0 and 100 percent." };
    }
    // Authoritative: compute from the DB list price, never a client-sent value.
    const { data: prods, error: pErr } = await admin
      .from("products")
      .select("id, list_price_cents")
      .in("id", productIds);
    if (pErr) {
      console.error("[admin] bulk percentOff: read products failed:", pErr.message);
      return { ok: false, message: "Could not read product prices. Please try again." };
    }
    const listById = new Map(
      (prods as { id: string; list_price_cents: number }[]).map((p) => [p.id, p.list_price_cents]),
    );
    rows = productIds
      .filter((id) => listById.has(id))
      .map((product_id) => ({
        customer_id: customerId,
        product_id,
        price_cents: Math.max(0, Math.round(listById.get(product_id)! * (1 - op.percent / 100))),
      }));
    metaRows = rows.map((r) => ({
      customer_id: r.customer_id,
      product_id: r.product_id,
      price_source: "manual" as const,
    }));
  }

  const { error } = await admin
    .from("customer_products")
    .upsert(rows, { onConflict: "customer_id,product_id" });
  if (error) {
    console.error("[admin] bulk price update failed:", error.message);
    return { ok: false, message: "Could not update the prices. Please try again." };
  }
  await stampMeta(admin, metaRows);
  revalidate(customerId);
  return { ok: true, updated: rows.length };
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
