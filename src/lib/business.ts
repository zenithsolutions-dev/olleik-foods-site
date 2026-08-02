// ============================================================================
// BUSINESS IDENTITY — ⚠️ PLACEHOLDERS ONLY, FILL IN BEFORE CLIENT HANDOVER ⚠️
// ============================================================================
// Every bracketed value below is DELIBERATELY fake-looking (approved D-C2):
// it must be impossible to mistake a test print for a real document.
//
// PRE-HANDOVER CHECKLIST — replace ALL of these with the client's real details:
//   [ ] legalName   — the registered business name
//   [ ] address     — full street address incl. postal code
//   [ ] phone       — the business phone number
//   [ ] email       — the business email
//   [ ] (when tax is enabled, CP-6 tax delta) taxNumber + taxRateBps +
//       taxEnabled: true, plus the orders.tax_cents snapshot migration —
//       see the CP-6 spec's "tax deferred, not absent" section.
//
// This module is the ONE accessor for business identity. When tax settings
// arrive it either grows here or graduates to a settings table + UI — either
// way every document keeps reading through getBusinessIdentity() and nothing
// in the document layer needs rework.

export type BusinessIdentity = {
  displayName: string; // shown big on documents
  legalName: string;
  address: string;
  phone: string;
  email: string;
  // --- tax: DORMANT (approved ruling — deferred, not absent). While
  // taxEnabled is false no document renders any tax line or tax number.
  taxEnabled: boolean;
  taxRateBps: number; // e.g. 1300 = 13% HST — unused while disabled
  taxNumber: string | null; // business tax number — unused while disabled
};

const IDENTITY: BusinessIdentity = {
  displayName: "Olleik Foods",
  legalName: "Olleik Foods — [LEGAL NAME TBC]",
  address: "[STREET ADDRESS], Ottawa, ON [POSTAL CODE]",
  phone: "[PHONE]",
  email: "[EMAIL]",
  taxEnabled: false,
  taxRateBps: 0,
  taxNumber: null,
};

export function getBusinessIdentity(): BusinessIdentity {
  return IDENTITY;
}
