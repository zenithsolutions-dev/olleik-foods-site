"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/require-admin";
import type { ProductUnit } from "@/lib/admin/types";

// Product mutations via the service-role client. Each action re-checks
// requireAdmin() (server functions are POST endpoints; don't rely on the
// proxy/layout gate alone) and returns a result the client surfaces — no silent
// success. Products are DEACTIVATED, never hard-deleted, so customer_products
// pricing rows (ON DELETE CASCADE) are preserved.

export type ActionResult = { ok: true } | { ok: false; message: string };

export type ProductInput = {
  sku: string;
  name: string;
  description?: string;
  categoryId: string | null;
  unit: ProductUnit;
  unitSize: string;
  listPriceCents: number;
  isActive: boolean;
};

function validate(input: ProductInput): string | null {
  if (!input.sku.trim()) return "SKU is required.";
  if (!input.name.trim()) return "Name is required.";
  if (!input.unitSize.trim()) return "Unit size is required.";
  if (!Number.isInteger(input.listPriceCents) || input.listPriceCents < 0)
    return "List price must be a valid non-negative amount.";
  return null;
}

function toRow(input: ProductInput) {
  return {
    sku: input.sku.trim(),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    category_id: input.categoryId || null,
    unit: input.unit,
    unit_size: input.unitSize.trim(),
    list_price_cents: input.listPriceCents,
    is_active: input.isActive,
  };
}

function revalidate() {
  revalidatePath("/admin/products");
  revalidatePath("/admin/categories"); // per-category counts
  revalidatePath("/admin"); // dashboard counts + avg price
}

export async function createProduct(input: ProductInput): Promise<ActionResult> {
  await requireAdmin();
  const invalid = validate(input);
  if (invalid) return { ok: false, message: invalid };

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { error } = await admin.from("products").insert(toRow(input));
  if (error) {
    if (error.code === "23505") return { ok: false, message: "That SKU is already in use." };
    console.error("[admin] create product failed:", error.message);
    return { ok: false, message: "Could not create the product. Please try again." };
  }
  revalidate();
  return { ok: true };
}

export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<ActionResult> {
  await requireAdmin();
  const invalid = validate(input);
  if (invalid) return { ok: false, message: invalid };

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { error } = await admin.from("products").update(toRow(input)).eq("id", id);
  if (error) {
    if (error.code === "23505") return { ok: false, message: "That SKU is already in use." };
    console.error("[admin] update product failed:", error.message);
    return { ok: false, message: "Could not update the product. Please try again." };
  }
  revalidate();
  return { ok: true };
}

export async function deactivateProduct(id: string): Promise<ActionResult> {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { error } = await admin
    .from("products")
    .update({ is_active: false })
    .eq("id", id);
  if (error) {
    console.error("[admin] deactivate product failed:", error.message);
    return { ok: false, message: "Could not deactivate the product. Please try again." };
  }
  revalidate();
  return { ok: true };
}
