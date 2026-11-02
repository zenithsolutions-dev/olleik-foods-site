// Pure duplicate detection for a new account or application. No I/O here, so it
// is unit-testable with plain node (scripts/test-duplicates.mjs).
//
// A match on ANY of email, phone or business name blocks the new record. Phone
// and name are compared loosely because the data is typed by hand: phones come
// in many formats, and names differ in case and spacing.

export type DuplicateField = "email" | "phone" | "businessName";

export type AccountRow = {
  email: string | null;
  phone: string | null;
  businessName: string | null;
  // "customer" = an existing account; "lead" = an application still under review.
  source: "customer" | "lead";
};

export type DuplicateCandidate = {
  email: string;
  phone: string;
  businessName: string;
};

export type DuplicateMatch = {
  field: DuplicateField;
  source: AccountRow["source"];
};

// Phones are stored as "(613) 555-0188", "01050677977", "+20 105 …". Comparing
// the last 9 digits makes a leading 0 or a country code irrelevant.
export const PHONE_MATCH_DIGITS = 9;
const MIN_PHONE_DIGITS = 7;

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function normalizePhone(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length < MIN_PHONE_DIGITS) return "";
  return digits.slice(-PHONE_MATCH_DIGITS);
}

export function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Checks each field across all rows, in priority order: email, then phone,
// then business name. The first field that matches wins.
export function findDuplicate(candidate: DuplicateCandidate, rows: AccountRow[]): DuplicateMatch | null {
  const email = normalizeEmail(candidate.email);
  const phone = normalizePhone(candidate.phone);
  const name = normalizeName(candidate.businessName);

  const checks: Array<{ field: DuplicateField; wanted: string; read: (row: AccountRow) => string }> = [
    { field: "email", wanted: email, read: (row) => normalizeEmail(row.email) },
    { field: "phone", wanted: phone, read: (row) => normalizePhone(row.phone) },
    { field: "businessName", wanted: name, read: (row) => normalizeName(row.businessName) },
  ];

  for (const check of checks) {
    if (!check.wanted) continue;
    const hit = rows.find((row) => check.read(row) === check.wanted);
    if (hit) return { field: check.field, source: hit.source };
  }
  return null;
}

const FIELD_LABEL: Record<DuplicateField, string> = {
  email: "email address",
  phone: "phone number",
  businessName: "business name",
};

// Customer-facing wording. Shown on the public apply form and in admin errors.
export function duplicateMessage(match: DuplicateMatch): string {
  const label = FIELD_LABEL[match.field];
  if (match.source === "lead") {
    return `An application with this ${label} is already under review with our team. There is no need to apply again.`;
  }
  if (match.field === "businessName") {
    return "A business with this name is already registered with us. If this is a different location, please contact us.";
  }
  return `This ${label} is already registered with us. Please use a different ${label}.`;
}
