import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toPublicSpecial, type PublicSpecial, type SpecialRow } from "@/lib/specials";

// Specials for a signed-in customer, read through THEIR session: the database only returns published
// specials to active customers (0019). productId is included here, and only here, so the card can add the
// product to the cart.
export type PortalSpecial = PublicSpecial & { productId: string };

export async function fetchMySpecials(): Promise<PortalSpecial[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("specials").select("*").eq("is_published", true);
  if (error) {
    if (error.code !== "42P01" && error.code !== "PGRST205") console.error("[portal] specials read failed:", error.message);
    return [];
  }
  const now = new Date();
  return ((data as SpecialRow[]) ?? [])
    .flatMap((row) => {
      const special = toPublicSpecial(row, { isCustomer: true }, now);
      return special ? [{ ...special, productId: row.product_id }] : [];
    })
    .sort((a, b) => Number(a.isSoldOut) - Number(b.isSoldOut) || a.remaining - b.remaining);
}
