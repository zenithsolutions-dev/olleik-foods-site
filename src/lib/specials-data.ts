import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toPublicSpecial, type PublicSpecial, type SpecialRow } from "@/lib/specials";

// Specials reads for the ADMIN screen and the PUBLIC pages (service role).
// Guests never query the table themselves: these functions decide, field by field, what leaves the server
// (toPublicSpecial drops the price for a guest when the special hides it).

// Is the visitor a signed-in, active customer? Decides whether a hidden price is shown on public pages.
export async function viewerIsCustomer(): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return false;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  // RLS: a session can read only its own customer row.
  const { data } = await supabase.from("customers").select("status").eq("user_id", auth.user.id).maybeSingle();
  return data?.status === "active";
}

const missingTable =(code: string | undefined) => code === "42P01" || code === "PGRST205"; // before 0019

export async function fetchAdminSpecials(): Promise<{ specials: SpecialRow[]; migrationApplied: boolean }> {
  const admin = getAdminClient();
  if (!admin) return { specials: [], migrationApplied: true };
  const { data, error } = await admin.from("specials").select("*").order("created_at", { ascending: false });
  if (error) {
    if (!missingTable(error.code)) console.error("[admin] specials read failed:", error.message);
    return { specials: [], migrationApplied: !missingTable(error.code) };
  }
  return { specials: (data as SpecialRow[]) ?? [], migrationApplied: true };
}

// Live and sold-out specials, live ones first, fewest remaining first (the most urgent on top).
export async function fetchPublicSpecials(viewer: { isCustomer: boolean }): Promise<PublicSpecial[]> {
  const admin = getAdminClient();
  if (!admin) return [];
  const { data, error } = await admin.from("specials").select("*").eq("is_published", true);
  if (error) {
    if (!missingTable(error.code)) console.error("[public] specials read failed:", error.message);
    return [];
  }
  const now = new Date();
  return ((data as SpecialRow[]) ?? [])
    .map((row) => toPublicSpecial(row, viewer, now))
    .filter((s): s is PublicSpecial => s !== null)
    .sort((a, b) => Number(a.isSoldOut) - Number(b.isSoldOut) || a.remaining - b.remaining);
}

export async function fetchPublicSpecial(id: string, viewer: { isCustomer: boolean }): Promise<PublicSpecial | null> {
  const admin = getAdminClient();
  if (!admin || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await admin.from("specials").select("*").eq("id", id).maybeSingle();
  return data ? toPublicSpecial(data as SpecialRow, viewer, new Date()) : null;
}
