"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/require-admin";
import { guardAction } from "@/lib/admin/action-guard";
import {
  uploadProductImage,
  deleteProductImageByUrl,
  type UploadResult,
} from "@/lib/admin/product-images";
import { autoRecomputeForScope } from "@/lib/admin/recompute";
import type { ProductUnit } from "@/lib/admin/types";

// Product mutations via the service-role client. Each action re-checks
// requireAdmin() (server functions are POST endpoints; don't rely on the
// proxy/layout gate alone) and returns a result the client surfaces — no silent
// success. Products are DEACTIVATED, never hard-deleted, so customer_products
// pricing rows (ON DELETE CASCADE) are preserved.
//
// CP-1 AUTOPILOT: editing a product's category or sale (list) price re-prices
// its computed customer rows automatically; the result reports the count.

export type ActionResult =
  | { ok: true; updated?: number; warning?: string }
  | { ok: false; message: string };

export type ProductInput = {
  sku: string;
  name: string;
  description?: string;
  categoryId: string | null;
  unit: ProductUnit;
  unitSize: string;
  listPriceCents: number;
  isActive: boolean;
  imageUrl: string | null;
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
    image_url: input.imageUrl ?? null,
  };
}

function revalidate() {
  revalidatePath("/admin/products");
  revalidatePath("/admin/categories"); // per-category counts
  revalidatePath("/admin"); // dashboard counts + avg price
}

// Upload a product image, called from the modal the moment a file is picked so
// the preview can appear before the row is saved. requireAdmin() + service-role
// upload; the returned URL is written onto the product row on save.
export async function uploadProductImageAction(
  formData: FormData,
): Promise<UploadResult> {
  await requireAdmin();
  return guardAction("uploadProductImageAction", async () => {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "No file received." };
  }
  return uploadProductImage(file);
  });
}

// Returns the new product's id on success so the caller can attach admin-only
// data (e.g. the purchase cost via setProductCost) in the same flow.
export type CreateProductResult = { ok: true; id: string } | { ok: false; message: string };

export async function createProduct(input: ProductInput): Promise<CreateProductResult> {
  await requireAdmin();
  return guardAction("createProduct", async () => {
  const invalid = validate(input);
  if (invalid) return { ok: false, message: invalid };

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const { data, error } = await admin.from("products").insert(toRow(input)).select("id").single();
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, message: "That SKU is already in use." };
    console.error("[admin] create product failed:", error?.message);
    return { ok: false, message: "Could not create the product. Please try again." };
  }
  revalidate();
  return { ok: true, id: data.id as string };
  });
}

export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<ActionResult> {
  await requireAdmin();
  return guardAction("updateProduct", async () => {
  const invalid = validate(input);
  if (invalid) return { ok: false, message: invalid };

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  // Note the existing image (cleanup) + category/list price (autopilot trigger).
  const { data: existing } = await admin
    .from("products")
    .select("image_url, category_id, list_price_cents")
    .eq("id", id)
    .maybeSingle();

  const { error } = await admin.from("products").update(toRow(input)).eq("id", id);
  if (error) {
    if (error.code === "23505") return { ok: false, message: "That SKU is already in use." };
    console.error("[admin] update product failed:", error.message);
    return { ok: false, message: "Could not update the product. Please try again." };
  }

  const oldUrl = existing?.image_url as string | null | undefined;
  if (oldUrl && oldUrl !== (input.imageUrl ?? null)) {
    await deleteProductImageByUrl(oldUrl);
  }

  // Autopilot: category moves change which rules apply; list-price changes
  // move list-fallback rows. Either way, this product's computed customer
  // prices must follow immediately.
  const pricingChanged =
    existing != null &&
    ((existing.category_id as string | null) !== (input.categoryId || null) ||
      (existing.list_price_cents as number) !== input.listPriceCents);

  let updated = 0;
  let warning: string | undefined;
  if (pricingChanged) {
    const swept = await autoRecomputeForScope(admin, { kind: "product", productId: id });
    if ("error" in swept) {
      warning = `Product saved, but auto-update failed: ${swept.error}`;
    } else {
      updated = swept.updated;
      warning = swept.warning;
    }
    revalidatePath("/admin/pricing");
    revalidatePath("/admin/assign");
    revalidatePath("/admin/customers");
  }

  revalidate();
  return { ok: true, updated, warning };
  });
}

// CP-3b: set (or clear) a product's tracked stock. stockQty === null UNTRACKS
// the product — its inventory row is deleted and it becomes always-available
// (untracked products never block orders and never alert, D-O4/D-O6).
// This action and the 0010 confirm/cancel functions are the ONLY writers of
// products.is_available: stock 0 -> false, stock > 0 -> true.
export async function setProductInventory(
  productId: string,
  stockQty: number | null,
  lowStockThreshold: number,
): Promise<ActionResult> {
  await requireAdmin();
  return guardAction("setProductInventory", async () => {
    const admin = getAdminClient();
    if (!admin) return { ok: false, message: "Supabase is not configured." };
    if (stockQty !== null && (!Number.isInteger(stockQty) || stockQty < 0))
      return { ok: false, message: "Stock must be a whole number of 0 or more." };
    if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0)
      return { ok: false, message: "The low-stock alert level must be a whole number of 0 or more." };

    if (stockQty === null) {
      const { error } = await admin.from("product_inventory").delete().eq("product_id", productId);
      if (error) {
        if (error.code === "42P01")
          return { ok: false, message: "Inventory isn't enabled yet — run migration 0010 first." };
        console.error("[admin] untrack inventory failed:", error.message);
        return { ok: false, message: "Could not update stock. Please try again." };
      }
      // Untracked products are always available (D-O6).
      await admin.from("products").update({ is_available: true }).eq("id", productId);
      revalidate();
      return { ok: true };
    }

    const { error } = await admin.from("product_inventory").upsert(
      {
        product_id: productId,
        stock_qty: stockQty,
        low_stock_threshold: lowStockThreshold,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "product_id" },
    );
    if (error) {
      if (error.code === "42P01")
        return { ok: false, message: "Inventory isn't enabled yet — run migration 0010 first." };
      console.error("[admin] set inventory failed:", error.message);
      return { ok: false, message: "Could not update stock. Please try again." };
    }
    const { error: availErr } = await admin
      .from("products")
      .update({ is_available: stockQty > 0 })
      .eq("id", productId);
    if (availErr) console.error("[admin] availability flip failed:", availErr.message);
    revalidate();
    return { ok: true };
  });
}

export async function deactivateProduct(id: string): Promise<ActionResult> {
  await requireAdmin();
  return guardAction("deactivateProduct", async () => {
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
  });
}
