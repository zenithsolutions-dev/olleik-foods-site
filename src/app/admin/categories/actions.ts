"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/require-admin";

// Category mutations via the service-role client. Same guard/result contract as
// the product actions. Deleting a category is BLOCKED while products still
// reference it (products.category_id is ON DELETE SET NULL, so an unguarded
// delete would silently orphan products to "uncategorized").

export type ActionResult = { ok: true } | { ok: false; message: string };

export type CategoryInput = { name: string; description?: string; parentId?: string | null };

function revalidate() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products"); // category dropdown + names
  revalidatePath("/admin");
}

// One-level nesting (0006): a parent must itself be top-level, and a category
// that HAS children can never be given a parent. `selfId` excludes the category
// being edited (can't be its own parent).
async function validateParent(
  admin: SupabaseClient,
  parentId: string | null,
  selfId: string | null,
): Promise<string | null> {
  if (!parentId) return null;
  if (selfId && parentId === selfId) return "A category can't be its own parent.";

  const { data: parent, error } = await admin
    .from("categories")
    .select("id, parent_id")
    .eq("id", parentId)
    .maybeSingle();
  if (error || !parent) return "The chosen parent category was not found.";
  if (parent.parent_id) {
    return "Only one level of nesting is allowed — the chosen parent is itself a subcategory.";
  }

  if (selfId) {
    const { count } = await admin
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", selfId);
    if ((count ?? 0) > 0) {
      return "This category has subcategories, so it must stay top-level (one level of nesting).";
    }
  }
  return null;
}

export async function createCategory(input: CategoryInput): Promise<ActionResult> {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Name is required." };

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const parentErr = await validateParent(admin, input.parentId ?? null, null);
  if (parentErr) return { ok: false, message: parentErr };

  const { error } = await admin
    .from("categories")
    .insert({
      name,
      description: input.description?.trim() || null,
      parent_id: input.parentId ?? null,
    });
  if (error) {
    if (error.code === "23505")
      return { ok: false, message: "A category with that name already exists." };
    console.error("[admin] create category failed:", error.message);
    return { ok: false, message: "Could not create the category. Please try again." };
  }
  revalidate();
  return { ok: true };
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<ActionResult> {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Name is required." };

  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  const parentErr = await validateParent(admin, input.parentId ?? null, id);
  if (parentErr) return { ok: false, message: parentErr };

  const { error } = await admin
    .from("categories")
    .update({
      name,
      description: input.description?.trim() || null,
      parent_id: input.parentId ?? null,
    })
    .eq("id", id);
  if (error) {
    if (error.code === "23505")
      return { ok: false, message: "A category with that name already exists." };
    console.error("[admin] update category failed:", error.message);
    return { ok: false, message: "Could not update the category. Please try again." };
  }
  revalidate();
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  // Guard: block while products still reference this category.
  const { count, error: countErr } = await admin
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);
  if (countErr) {
    console.error("[admin] category usage check failed:", countErr.message);
    return { ok: false, message: "Could not verify category usage. Please try again." };
  }
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message: `${count} product${count === 1 ? "" : "s"} still use this category — reassign them first.`,
    };
  }

  // Guard: block while subcategories still point at this category (deleting a
  // parent would silently break its children's margin-rule inheritance).
  const { count: childCount, error: childErr } = await admin
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", id);
  if (childErr) {
    console.error("[admin] category children check failed:", childErr.message);
    return { ok: false, message: "Could not verify subcategories. Please try again." };
  }
  if ((childCount ?? 0) > 0) {
    return {
      ok: false,
      message: `${childCount} subcategor${childCount === 1 ? "y" : "ies"} still belong to this category — move or delete them first.`,
    };
  }

  const { error } = await admin.from("categories").delete().eq("id", id);
  if (error) {
    console.error("[admin] delete category failed:", error.message);
    return { ok: false, message: "Could not delete the category. Please try again." };
  }
  revalidate();
  return { ok: true };
}
