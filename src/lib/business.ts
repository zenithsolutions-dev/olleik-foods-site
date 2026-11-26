// ============================================================================
// BUSINESS IDENTITY — the ONE accessor for who the business is.
// ============================================================================
// Values come from the single `business_settings` row (migration 0016, edited on the admin Settings page).
// A blank field falls back to its env var (BUSINESS_DISPLAY_NAME, BUSINESS_LEGAL_NAME, BUSINESS_ADDRESS,
// BUSINESS_PHONE, BUSINESS_EMAIL), then to a bracketed placeholder that cannot be mistaken for a real value.
// No business name lives in the code: the system is resold to other wholesalers.
import { createClient } from "@supabase/supabase-js";
import { cache } from "react";

export type BusinessIdentity = {
  displayName: string; // shown big on documents and in headers
  legalName: string;
  address: string;
  phone: string;
  email: string;
  whatsappNumber: string | null; // digits only, ready for https://wa.me/<number>
  // --- tax: DORMANT (approved ruling — deferred, not absent). While
  // taxEnabled is false no document renders any tax line or tax number.
  taxEnabled: boolean;
  taxRateBps: number; // e.g. 1300 = 13% HST — unused while disabled
  taxNumber: string | null; // business tax number — unused while disabled
};

export type BusinessSettingsRow = {
  display_name: string | null;
  legal_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  whatsapp_number: string | null;
};

export function identityFromRow(
  row: BusinessSettingsRow | null,
  env: Record<string, string | undefined> = process.env,
): BusinessIdentity {
  const pick = (value: string | null | undefined, envName: string, placeholder: string) =>
    value?.trim() || env[envName]?.trim() || placeholder;
  return {
    displayName: pick(row?.display_name, "BUSINESS_DISPLAY_NAME", "[BUSINESS NAME]"),
    legalName: pick(row?.legal_name, "BUSINESS_LEGAL_NAME", "[LEGAL NAME]"),
    address: pick(row?.address, "BUSINESS_ADDRESS", "[ADDRESS]"),
    phone: pick(row?.phone, "BUSINESS_PHONE", "[PHONE]"),
    email: pick(row?.email, "BUSINESS_EMAIL", "[EMAIL]"),
    whatsappNumber: row?.whatsapp_number?.replace(/\D/g, "") || null,
    taxEnabled: false,
    taxRateBps: 0,
    taxNumber: null,
  };
}

// Validates the admin Settings form. Blank optional fields are stored as null so the fallbacks above apply.
const LIMITS: Record<keyof BusinessSettingsRow, number> = {
  display_name: 80,
  legal_name: 120,
  address: 300,
  phone: 40,
  email: 254,
  whatsapp_number: 40,
};

export function parseBusinessSettings(
  input: Partial<Record<keyof BusinessSettingsRow, string>>,
): { ok: true; row: BusinessSettingsRow } | { ok: false; error: string } {
  const clean = (key: keyof BusinessSettingsRow) => input[key]?.trim() || null;
  const row: BusinessSettingsRow = {
    display_name: clean("display_name"),
    legal_name: clean("legal_name"),
    address: clean("address"),
    phone: clean("phone"),
    email: clean("email")?.toLowerCase() ?? null,
    whatsapp_number: clean("whatsapp_number"),
  };
  if (!row.display_name) return { ok: false, error: "Business name is required." };
  for (const key of Object.keys(LIMITS) as Array<keyof BusinessSettingsRow>) {
    if ((row[key]?.length ?? 0) > LIMITS[key]) return { ok: false, error: `${key.replace("_", " ")} is too long.` };
  }
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return { ok: false, error: "Email address is not valid." };
  const digits = row.whatsapp_number?.replace(/\D/g, "") ?? "";
  // wa.me needs the full international number: 8 to 15 digits including the country code.
  if (row.whatsapp_number && (digits.length < 8 || digits.length > 15)) {
    return { ok: false, error: "WhatsApp number must include the country code, e.g. +1 613 555 0142." };
  }
  return { ok: true, row };
}

// One read per request. The row is public (RLS: select for everyone), so the anon key is enough and portal
// code may call this. Supabase not configured (demo mode) or a failed read → env / placeholders.
export const getBusinessIdentity = cache(async (): Promise<BusinessIdentity> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return identityFromRow(null);
  const { data, error } = await createClient(url, anon, { auth: { persistSession: false } })
    .from("business_settings")
    .select("display_name, legal_name, address, phone, email, whatsapp_number")
    .maybeSingle();
  if (error) console.error("[business] settings read failed:", error.message);
  return identityFromRow(data ?? null);
});
