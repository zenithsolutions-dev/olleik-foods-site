"use client";

import { useState } from "react";
import { Check, Link2, MessageCircle } from "lucide-react";

// Share a special: WhatsApp click-to-chat (the sender picks who gets it) and copy-link.
// `whatsappUrl` is built on the server (whatsappShareUrl) so the message never includes a hidden price.
export function ShareButtons({ whatsappUrl, url, compact = false }: { whatsappUrl: string; url: string; compact?: boolean }) {
  const [isCopied, setIsCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Clipboard blocked (old browser, insecure page): show the link so it can be copied by hand.
      window.prompt("Copy this link", url);
    }
  }

  // Compact is only smaller where there is a mouse: on a phone the buttons keep a full-size touch target.
  const size = compact ? "h-11 px-3 text-xs sm:h-10" : "h-11 px-4 text-sm";
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-2 rounded-full bg-[#1f7a4d] font-semibold text-white transition hover:bg-[#17603c] ${size}`}
      >
        <MessageCircle size={16} aria-hidden />
        Share on WhatsApp
      </a>
      <button
        type="button"
        onClick={copy}
        className={`inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border-strong)] bg-surface font-semibold text-brand-deep transition hover:border-brand ${size}`}
      >
        {isCopied ? <Check size={16} aria-hidden /> : <Link2 size={16} aria-hidden />}
        <span aria-live="polite">{isCopied ? "Link copied" : "Copy link"}</span>
      </button>
    </div>
  );
}
