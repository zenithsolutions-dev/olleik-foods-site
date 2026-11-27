// Secure links to a customer's statement, for sending by WhatsApp or email.
// The link is the only thing protecting the statement, so: 256 random bits, stored only as a hash (a
// database leak does not hand out working links), and a short life. Pure apart from node:crypto.
import { createHash, randomBytes } from "node:crypto";

export const LINK_LIFETIME_DAYS = 7;
const DAY_MS = 86_400_000;

export const newToken = (): string => randomBytes(32).toString("base64url");
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");
export const expiryFor = (now: Date): Date => new Date(now.getTime() + LINK_LIFETIME_DAYS * DAY_MS);

export type LinkState = "valid" | "expired" | "revoked" | "missing";

export function linkState(row: { expires_at: string; revoked_at: string | null } | null, now: Date): LinkState {
  if (!row) return "missing";
  if (row.revoked_at) return "revoked";
  return new Date(row.expires_at) <= now ? "expired" : "valid";
}

// The WhatsApp message. Activity only: nothing about cost, profit or margin is ever in a statement.
export function statementMessage(args: { businessName: string; periodLabel: string; url: string; expiresLabel: string }): string {
  return [
    `Hello, here is your account statement from ${args.businessName} (${args.periodLabel}):`,
    args.url,
    `The link works until ${args.expiresLabel}.`,
  ].join("\n");
}

// WhatsApp click-to-chat. wa.me needs the full international number; a number without a country code is
// never guessed — WhatsApp then opens with the message ready and the admin picks the contact.
export function whatsappStatementUrl(phone: string | null | undefined, message: string): { url: string; hasRecipient: boolean } {
  const text = encodeURIComponent(message);
  const raw = phone?.trim() ?? "";
  const digits = raw.replace(/\D/g, "");
  // With "+": any plausible international length. Without it: only 11–15 digits that do not start with 0
  // (a leading 0 is a local trunk prefix, e.g. "07700 900123", not a country code).
  const hasCountryCode = raw.startsWith("+")
    ? digits.length >= 8 && digits.length <= 15
    : digits.length >= 11 && digits.length <= 15 && !digits.startsWith("0");
  return hasCountryCode
    ? { url: `https://wa.me/${digits}?text=${text}`, hasRecipient: true }
    : { url: `https://wa.me/?text=${text}`, hasRecipient: false };
}
