import type { SupabaseClient } from "@supabase/supabase-js";
import {
  duplicateMessage,
  findDuplicate,
  type AccountRow,
  type DuplicateCandidate,
} from "./find-duplicate";

// Statuses that mean "an application is still being handled".
const OPEN_LEAD_STATUSES = ["new", "contacted", "approved"];

// Read cap for the duplicate scan. Generous for this business; raise it if the
// customer list ever grows past it.
const SCAN_LIMIT = 5000;

// Loads every account a new record could collide with. Archived customers are
// excluded so a retired account does not block a new sign-up. Converted leads
// are excluded because their customer row already appears in the scan.
export async function loadAccounts(
  admin: SupabaseClient,
  options: { includeOpenLeads: boolean },
): Promise<AccountRow[]> {
  const { data: customers, error: customerError } = await admin
    .from("customers")
    .select("email, phone, business_name")
    .neq("status", "archived")
    .limit(SCAN_LIMIT);
  if (customerError) throw new Error(`customer scan failed: ${customerError.message}`);

  const rows: AccountRow[] = (customers ?? []).map((c) => ({
    email: c.email,
    phone: c.phone,
    businessName: c.business_name,
    source: "customer",
  }));

  if (options.includeOpenLeads) {
    const { data: leads, error: leadError } = await admin
      .from("leads")
      .select("email, phone, business_name")
      .in("status", OPEN_LEAD_STATUSES)
      .limit(SCAN_LIMIT);
    if (leadError) throw new Error(`lead scan failed: ${leadError.message}`);
    for (const l of leads ?? []) {
      rows.push({ email: l.email, phone: l.phone, businessName: l.business_name, source: "lead" });
    }
  }

  return rows;
}

// Returns the message to show when the candidate collides with an existing
// record, or null when it is clear to proceed.
//
// Fails closed: if the scan itself errors, we refuse rather than risk creating
// a duplicate. The caller shows the message as-is.
export async function duplicateMessageFor(
  admin: SupabaseClient,
  candidate: DuplicateCandidate,
  options: { includeOpenLeads: boolean },
): Promise<string | null> {
  try {
    const rows = await loadAccounts(admin, options);
    const match = findDuplicate(candidate, rows);
    return match ? duplicateMessage(match) : null;
  } catch (err) {
    console.error("[duplicates] scan failed, refusing to proceed:", (err as Error).message);
    return "We could not verify this against existing records just now. Please try again in a moment.";
  }
}
