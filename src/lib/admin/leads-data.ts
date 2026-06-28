import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Lead, LeadStatus } from "./types";
import { SEED_DATA } from "./mock-data";

// Server-side read of the `leads` table via the service-role client (RLS is
// deny-by-default on leads, so the anon client can't read them — reads go
// through the service role, matching how the migration routes writes).
//
// `live` tells the UI whether it's showing real DB rows or the demo seed:
//   - Supabase configured  -> real rows (live: true)
//   - not configured       -> SEED_DATA.leads (live: false), so local dev/demo
//     still renders something before the project is provisioned.

type LeadRow = {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  message: string | null;
  status: LeadStatus;
  submitted_at: string;
};

export type AdminLeads = { leads: Lead[]; live: boolean };

export async function fetchAdminLeads(): Promise<AdminLeads> {
  const admin = getAdminClient();
  if (!admin) {
    return { leads: SEED_DATA.leads, live: false };
  }

  const { data, error } = await admin
    .from("leads")
    .select(
      "id, business_name, contact_name, email, phone, message, status, submitted_at",
    )
    .order("submitted_at", { ascending: false });

  if (error) {
    // Surface in server logs; show an empty live list rather than masking the
    // problem with seed data.
    console.error("[admin] failed to load leads:", error.message);
    return { leads: [], live: true };
  }

  const leads: Lead[] = (data as LeadRow[]).map((r) => ({
    id: r.id,
    businessName: r.business_name,
    contactName: r.contact_name,
    email: r.email,
    phone: r.phone,
    message: r.message ?? undefined,
    status: r.status,
    submittedAt: r.submitted_at,
  }));

  return { leads, live: true };
}

// Approved-but-not-yet-converted leads, with the extra fields needed to prefill
// a new customer. Used by the lead -> customer conversion screen (Phase E).
// Kept separate from fetchAdminLeads so the main leads page is unaffected by the
// 0004 columns.
type ConvertLeadRow = {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string | null;
  business_type: string | null;
  monthly_volume: string | null;
  status: LeadStatus;
  converted_customer_id: string | null;
  submitted_at: string;
};

export async function fetchApprovedLeadsForConversion(): Promise<{ leads: Lead[]; live: boolean }> {
  const admin = getAdminClient();
  if (!admin) {
    const leads = SEED_DATA.leads.filter((l) => l.status === "approved");
    return { leads, live: false };
  }

  const { data, error } = await admin
    .from("leads")
    .select(
      "id, business_name, contact_name, email, phone, address, business_type, monthly_volume, status, converted_customer_id, submitted_at",
    )
    .eq("status", "approved")
    .is("converted_customer_id", null)
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("[admin] failed to load approved leads:", error.message);
    return { leads: [], live: true };
  }

  const leads: Lead[] = (data as ConvertLeadRow[]).map((r) => ({
    id: r.id,
    businessName: r.business_name,
    contactName: r.contact_name,
    email: r.email,
    phone: r.phone,
    message: undefined,
    status: r.status,
    submittedAt: r.submitted_at,
    address: r.address ?? undefined,
    businessType: r.business_type ?? undefined,
    monthlyVolume: r.monthly_volume ?? undefined,
    convertedCustomerId: r.converted_customer_id,
  }));

  return { leads, live: true };
}
