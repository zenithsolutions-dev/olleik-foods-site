"use client";

import { useState, useTransition } from "react";
import { Mail, MessageCircle } from "lucide-react";
import type { RangeSearchParams } from "@/lib/dates";
import { revokeStatementLinks, sendStatement, type SendStatementResult } from "./actions";

// The send buttons on the customer copy of a statement. Never printed.
export function SendStatement({
  customerId,
  range,
  customerEmail,
}: {
  customerId: string;
  range: RangeSearchParams; // the period this page is showing; the server works out dates and label from it
  customerEmail: string | null;
}) {
  const [result, setResult] = useState<SendStatementResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function send(via: "email" | "whatsapp") {
    // Open the tab NOW, inside the click: a tab opened after the server answers is blocked as a pop-up.
    const tab = via === "whatsapp" ? window.open("", "_blank") : null;
    if (tab) tab.opener = null; // the page it ends up on must not be able to steer this one
    startTransition(async () => {
      let url: string | undefined;
      try {
        const res = await sendStatement({ customerId, range, via });
        setResult(res);
        url = res.whatsappUrl;
      } catch {
        setResult({ ok: false, message: "Could not reach the server. Check your connection and try again." });
      } finally {
        if (tab && url) tab.location.href = url;
        else tab?.close(); // never leave a blank tab behind
      }
    });
  }

  function revoke() {
    if (!window.confirm("Cancel every statement link sent to this customer? The links will stop opening.")) return;
    startTransition(async () => {
      try {
        setResult(await revokeStatementLinks(customerId));
      } catch {
        setResult({ ok: false, message: "Could not reach the server. Check your connection and try again." });
      }
    });
  }

  const button = "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--border-strong)] bg-surface px-4 text-sm font-semibold text-brand-deep hover:border-brand disabled:opacity-60";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={isPending} onClick={() => send("whatsapp")} className={button}>
          <MessageCircle size={16} aria-hidden /> Send by WhatsApp
        </button>
        <button type="button" disabled={isPending || !customerEmail} onClick={() => send("email")} className={button}>
          <Mail size={16} aria-hidden /> Send by email
        </button>
      </div>
      {/* Said in words, not a tooltip: a tooltip is invisible on a phone. */}
      <p className="text-xs text-muted">
        {customerEmail ? `Email goes to ${customerEmail}.` : "No email address on file for this customer, so email is off."} The
        customer gets a private link that works for 7 days.{" "}
        <button type="button" disabled={isPending} onClick={revoke} className="font-medium text-red-700 underline disabled:opacity-60">
          Cancel links already sent
        </button>
      </p>
      {isPending && <p className="text-xs text-muted">Working…</p>}
      {result && !isPending && (
        <p role={result.ok ? "status" : "alert"} className={`text-xs font-medium ${result.ok ? "text-emerald-700" : "text-red-700"}`}>
          {result.message}{" "}
          {result.whatsappUrl && (
            <a href={result.whatsappUrl} target="_blank" rel="noopener noreferrer" className="underline">
              Open WhatsApp
            </a>
          )}
        </p>
      )}
    </div>
  );
}
