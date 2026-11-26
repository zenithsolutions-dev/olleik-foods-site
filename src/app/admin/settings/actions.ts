"use server";

import { revalidatePath } from "next/cache";
import { parseBusinessSettings, type BusinessSettingsRow } from "@/lib/business";
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
