"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/require-admin";
import { guardAction } from "@/lib/admin/action-guard";
import { BULK_BATCH_CAP } from "@/lib/admin/bulk-offers";
import type { OfferDiscountKind } from "@/lib/admin/types";

// Offer-template library (admin-only, service-role) + apply-to-customer. Every
// action re-checks requireAdmin() (Server Functions are POST endpoints; don't
// rely on the layout/proxy gate alone). offer_templates is an admin-only table
// (RLS deny-all); the PORTAL never touches any of this.

export type ActionResult = { ok: true } | { ok: false; message: string };

export type OfferTemplateInput = {
  name: string;
  description?: string;
  discountKind: OfferDiscountKind | null;
  discountValue: number | null;
};

function revalidateOffers() {
  revalidatePath("/admin/offers");
}

// Templates represent a discount (decision #2): require kind + value, and bound
// the value per kind (percent 0..100; fixed_price/amount_off are cents >= 0).
function validateDiscount(kind: OfferDiscountKind | null, value: number | null): string | null {
  if (!kind) return "Choose a discount type.";
  if (value == null || !Number.isInteger(value) || value < 0) {
    return "Enter a valid discount amount.";
  }
  if (kind === "percent" && value > 100) return "Percent off must be between 0 and 100.";
  return null;
}

function toTemplateRow(input: OfferTemplateInput) {
  return {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    discount_kind: input.discountKind,
    discount_value: input.discountValue,
  };
}

export async function createOfferTemplate(input: OfferTemplateInput): Promise<ActionResult> {
  await requireAdmin();
  if (!input.name.trim()) return { ok: false, message: "Template name is required." };
  const invalid = validateDiscount(input.discountKind, input.discountValue);
  if (invalid) return { ok: false, message: invalid };

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { error } = await admin.from("offer_templates").insert(toTemplateRow(input));
  if (error) {
    console.error("[admin] create offer template failed:", error.message);
    return { ok: false, message: "Could not create the template. Please try again." };
  }
  revalidateOffers();
  return { ok: true };
}

export async function updateOfferTemplate(
  id: string,
  input: OfferTemplateInput,
): Promise<ActionResult> {
  await requireAdmin();
  if (!input.name.trim()) return { ok: false, message: "Template name is required." };
  const invalid = validateDiscount(input.discountKind, input.discountValue);
  if (invalid) return { ok: false, message: invalid };

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { error } = await admin
    .from("offer_templates")
    .update({ ...toTemplateRow(input), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[admin] update offer template failed:", error.message);
    return { ok: false, message: "Could not update the template. Please try again." };
  }
  revalidateOffers();
  return { ok: true };
}

export async function setOfferTemplateArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { error } = await admin
    .from("offer_templates")
    .update({ is_archived: archived, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[admin] archive offer template failed:", error.message);
    return { ok: false, message: `Could not ${archived ? "archive" : "restore"} the template.` };
  }
  revalidateOffers();
  return { ok: true };
}

// Apply a template to a customer as a SNAPSHOT: copy the template's discount into
// a NEW customer_offers row and stamp template_id for provenance. Editing the
// template later never changes this row. Optional product link (decision #3) MUST
// be one of the customer's assigned products.
export async function applyTemplateToCustomer(
  customerId: string,
  templateId: string,
  overrides?: {
    title?: string;
    productId?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
  },
): Promise<ActionResult> {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { data: tpl, error: tErr } = await admin
    .from("offer_templates")
    .select("id, name, description, discount_kind, discount_value, is_archived")
    .eq("id", templateId)
    .maybeSingle();
  if (tErr || !tpl) return { ok: false, message: "Template not found." };
  if (tpl.is_archived) {
    return { ok: false, message: "This template is archived — restore it before applying." };
  }

  // If a product is chosen, it must be assigned to this customer.
  const productId = overrides?.productId ?? null;
  if (productId) {
    const { data: cp, error: cpErr } = await admin
      .from("customer_products")
      .select("product_id")
      .eq("customer_id", customerId)
      .eq("product_id", productId)
      .maybeSingle();
    if (cpErr) {
      console.error("[admin] apply template: assigned-product check failed:", cpErr.message);
      return { ok: false, message: "Could not verify the product. Please try again." };
    }
    if (!cp) return { ok: false, message: "That product isn't assigned to this customer." };
  }

  const { error } = await admin.from("customer_offers").insert({
    customer_id: customerId,
    title: overrides?.title?.trim() || tpl.name,
    description: tpl.description ?? null,
    product_id: productId,
    discount_kind: tpl.discount_kind,
    discount_value: tpl.discount_value,
    starts_at: overrides?.startsAt || null,
    ends_at: overrides?.endsAt || null,
    is_active: true,
    template_id: templateId,
  });
  if (error) {
    console.error("[admin] apply template failed:", error.message);
    return { ok: false, message: "Could not apply the template. Please try again." };
  }
  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/customers");
  return { ok: true };
}

// ---------- CP-8a-2: bulk application (approved spec) ----------
//
// THE atomicity guarantee: one INSERT carrying every row of the batch — a
// single SQL statement, so a half-applied batch is structurally impossible.
// Idempotency: batch_id is generated when the PREVIEW is shown; if rows with
// that id already exist, the action reports the earlier success and writes
// nothing (double-click / resubmit safe). Cap: BULK_BATCH_CAP, refused loudly,
// never truncated. An all-skipped batch creates NOTHING anywhere.

export type BulkApplyLine = {
  customerId: string;
  title: string;
};

export type BulkApplyResult =
  | { ok: true; applied: number; alreadyApplied: boolean }
  | { ok: false; message: string };

export async function applyTemplateBulk(args: {
  batchId: string;
  templateId: string;
  customers: BulkApplyLine[];
  productId: string | null;
  startsAt: string | null;
  endsAt: string | null;
}): Promise<BulkApplyResult> {
  await requireAdmin();
  const res = await guardAction("applyTemplateBulk", async (): Promise<BulkApplyResult> => {
    const admin = getAdminClient();
    if (!admin) return { ok: false, message: "Supabase is not configured." };

    if (!/^[0-9a-f-]{36}$/i.test(args.batchId)) {
      return { ok: false, message: "Invalid batch id — reload and try again." };
    }
    if (args.customers.length === 0) {
      // Approved: an empty batch must not exist as a row anywhere.
      return { ok: false, message: "Every targeted customer was skipped — nothing to apply, so nothing was created." };
    }
    if (args.customers.length > BULK_BATCH_CAP) {
      return {
        ok: false,
        message: `This batch targets ${args.customers.length} customers — above the ${BULK_BATCH_CAP} cap. Narrow the selection and apply in parts.`,
      };
    }

    // Idempotency: same preview submitted twice writes once.
    // (42703 pre-0013 → guardAction maps it to the schema-out-of-date message.)
    const { count: existingCount, error: exErr } = await admin
      .from("customer_offers")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", args.batchId);
    if (exErr) throw exErr;
    if ((existingCount ?? 0) > 0) {
      return { ok: true, applied: existingCount ?? 0, alreadyApplied: true };
    }

    const { data: tpl, error: tErr } = await admin
      .from("offer_templates")
      .select("id, name, description, discount_kind, discount_value, is_archived")
      .eq("id", args.templateId)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!tpl) return { ok: false, message: "Template not found." };
    if (tpl.is_archived) return { ok: false, message: "This template is archived — restore it before applying." };

    // Server-side re-validation of the targets (never trust the client list):
    // every target must be an ACTIVE customer.
    const ids = args.customers.map((c) => c.customerId);
    const { data: activeRows, error: aErr } = await admin
      .from("customers")
      .select("id")
      .in("id", ids)
      .eq("status", "active");
    if (aErr) throw aErr;
    const activeSet = new Set(((activeRows as { id: string }[]) ?? []).map((r) => r.id));
    const invalid = ids.filter((id) => !activeSet.has(id));
    if (invalid.length > 0) {
      return {
        ok: false,
        message: `${invalid.length} targeted customer${invalid.length === 1 ? " is" : "s are"} not active any more — refresh the preview and retry. Nothing was applied.`,
      };
    }

    // ONE atomic INSERT: the whole batch or none of it.
    const size = args.customers.length;
    const { error: insErr } = await admin.from("customer_offers").insert(
      args.customers.map((c) => ({
        customer_id: c.customerId,
        title: c.title.trim() || tpl.name,
        description: tpl.description ?? null,
        product_id: args.productId,
        discount_kind: tpl.discount_kind,
        discount_value: tpl.discount_value,
        starts_at: args.startsAt,
        ends_at: args.endsAt,
        is_active: true,
        template_id: args.templateId,
        batch_id: args.batchId,
        batch_size: size,
      })),
    );
    if (insErr) throw insErr;

    revalidateOffers();
    revalidatePath("/admin/customers");
    return { ok: true, applied: size, alreadyApplied: false };
  });
  return res as BulkApplyResult;
}

// Undo: DELETE scoped by batch identity — touching a row outside the batch is
// structurally impossible (the WHERE clause IS the identity). Second undo
// finds zero rows and says so; an expired batch deletes inert rows harmlessly.
export type BulkUndoResult =
  | { ok: true; removed: number; alreadyUndone: boolean }
  | { ok: false; message: string };

export async function undoOfferBatch(batchId: string): Promise<BulkUndoResult> {
  await requireAdmin();
  const res = await guardAction("undoOfferBatch", async (): Promise<BulkUndoResult> => {
    const admin = getAdminClient();
    if (!admin) return { ok: false, message: "Supabase is not configured." };
    if (!/^[0-9a-f-]{36}$/i.test(batchId)) {
      return { ok: false, message: "Invalid batch id." };
    }
    const { data: removedRows, error } = await admin
      .from("customer_offers")
      .delete()
      .eq("batch_id", batchId)
      .select("id");
    if (error) throw error;
    const removed = ((removedRows as { id: string }[]) ?? []).length;
    revalidateOffers();
    revalidatePath("/admin/customers");
    return { ok: true, removed, alreadyUndone: removed === 0 };
  });
  return res as BulkUndoResult;
}
