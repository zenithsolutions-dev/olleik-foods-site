"use client";

import { useState } from "react";
import { Mail, Link2, Copy, Check } from "lucide-react";
import { inviteCustomerToPortal, generateInviteLink } from "./actions";

// Invite affordances shared by the conversion-success panel and the customer
// detail header. Two paths: send the email, or generate a one-time set-password
// link to copy (e.g. paste into WhatsApp). The link is a bearer credential —
// generated on demand, shown once, regenerated fresh on re-click.
export function InviteControls({
  customerId,
  invited,
  compact,
}: {
  customerId: string;
  invited: boolean; // already has a login (Invited/Active)
  compact?: boolean;
}) {
  const [busy, setBusy] = useState<"email" | "link" | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sendEmail() {
    setBusy("email");
    setMsg(null);
    const r = await inviteCustomerToPortal(customerId);
    setBusy(null);
    setMsg(r.message);
  }

  async function makeLink() {
    setBusy("link");
    setMsg(null);
    setCopied(false);
    const r = await generateInviteLink(customerId);
    setBusy(null);
    if (!r.ok) {
      setMsg(r.message);
      return;
    }
    setLink(r.link);
    try {
      await navigator.clipboard.writeText(r.link);
      setCopied(true);
    } catch {
      /* clipboard may be blocked; the input below lets them copy manually */
    }
  }

  async function copyAgain() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      /* ignore */
    }
  }

  const btn =
    "inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-surface px-3.5 py-2 text-sm font-medium text-foreground/80 hover:border-accent hover:text-accent-deep disabled:opacity-50";

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={sendEmail} disabled={busy !== null} className={btn}>
          <Mail size={14} /> {busy === "email" ? "Sending…" : invited ? "Resend email" : "Send email"}
        </button>
        <button type="button" onClick={makeLink} disabled={busy !== null} className={btn}>
          <Link2 size={14} /> {busy === "link" ? "Generating…" : "Copy link"}
        </button>
      </div>

      {link && (
        <div className="rounded-lg border border-[var(--border)] bg-brand-mist/30 p-3">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-background px-2 py-1.5 font-mono text-xs text-foreground"
            />
            <button
              type="button"
              onClick={copyAgain}
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-deep"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-soft">
            One-time link · expires in ~24h · send it to the customer (e.g. WhatsApp). Re-click
            “Copy link” to generate a fresh one.
          </p>
        </div>
      )}

      {msg && <p className="text-xs text-muted">{msg}</p>}
    </div>
  );
}
