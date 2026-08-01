"use server";

import { requireCustomer } from "@/lib/portal/require-customer";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// CP-3d portal change-signature poll (approved spec). SESSION CLIENT ONLY —
// RLS scopes the read to the caller's own orders, exactly like every other
// portal read. No service role, no new authorization surface; catalog and
// pricing are deliberately NOT polled.
//
// NOTE: only declared `export type X = ...` here — never `export type { X }`.

export type MyOrdersSignatureResult = { ok: true; signature: string } | { ok: false };

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export async function pollMyOrdersSignature(): Promise<MyOrdersSignatureResult> {
  await requireCustomer(); // same gate as the orders pages themselves
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, status")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    if (error.code !== "42P01") console.error("[portal] orders poll failed:", error.message);
    return { ok: false };
  }
  const rows = (data as { id: string; status: string }[]) ?? [];
  return { ok: true, signature: hash(rows.map((r) => `${r.id}:${r.status}`).join("|")) };
}
