"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/require-admin";
import type { LeadStatus } from "@/lib/admin/types";

// Lead mutations operate on real `leads` rows via the service-role client.
// Each action re-checks requireAdmin(): Server Functions are POST endpoints and
// must not rely on proxy/layout gating alone (per the Next.js proxy docs).

export async function updateLeadStatus(id: string, status: LeadStatus) {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin) return; // demo mode (Supabase not configured) — nothing to persist

  const { error } = await admin.from("leads").update({ status }).eq("id", id);
  if (error) {
    console.error("[admin] updateLeadStatus failed:", error.message);
    throw new Error("Could not update lead status.");
  }
  revalidatePath("/admin/leads");
  revalidatePath("/admin");
}

export async function deleteLead(id: string) {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin) return;

  const { error } = await admin.from("leads").delete().eq("id", id);
  if (error) {
    console.error("[admin] deleteLead failed:", error.message);
    throw new Error("Could not delete lead.");
  }
  revalidatePath("/admin/leads");
  revalidatePath("/admin");
}
