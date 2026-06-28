import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CustomerStatus, PaymentTerms } from "@/lib/admin/types";

// Authoritative customer gate — the portal's analog of requireAdmin(). Uses the
// SESSION-BOUND anon client so Postgres RLS scopes the read to the caller's own
// `customers` row (policy: user_id = auth.uid()). NEVER uses the service-role
// client — that is the governing security rule for all /portal code.
//
// Redirects (never returns) when the caller isn't a signed-in, ACTIVE customer.

export type PortalCustomer = {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  status: CustomerStatus;
  paymentTerms: PaymentTerms;
};

export async function requireCustomer(): Promise<PortalCustomer> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS already restricts this to the caller's own row; the user_id filter is
  // belt-and-suspenders, not the only defense.
  const { data: rows, error } = await supabase
    .from("customers")
    .select("id, business_name, contact_name, email, phone, address, status, payment_terms")
    .eq("user_id", user.id)
    .limit(1);

  if (error) {
    console.error("[portal] requireCustomer read failed:", error.message);
    redirect("/login?status=pending");
  }

  const row = rows?.[0];
  if (!row || row.status !== "active") {
    redirect("/login?status=pending");
  }

  return {
    id: row.id,
    businessName: row.business_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    status: row.status,
    paymentTerms: row.payment_terms,
  };
}
