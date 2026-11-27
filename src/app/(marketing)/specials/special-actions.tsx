import Link from "next/link";
import { Phone } from "lucide-react";
import type { BusinessIdentity } from "@/lib/business";
import { whatsappShareUrl, type PublicSpecial } from "@/lib/specials";
import { ShareButtons } from "@/components/specials/share-buttons";

// What a visitor can do with a special on the public site.
//   guest     ask about it (phone / WhatsApp), sign in, or open an account — ordering needs an account
//   customer  go order it in their account
// Everyone can share it. The share text is built from the PUBLIC view of the special, so a hidden price
// never ends up in a WhatsApp message.
export function SpecialActions({
  special,
  url,
  business,
  isCustomer,
}: {
  special: PublicSpecial;
  url: string;
  business: BusinessIdentity;
  isCustomer: boolean;
}) {
  const hasPhone = !business.phone.startsWith("[");
  const askUrl = business.whatsappNumber
    ? `https://wa.me/${business.whatsappNumber}?text=${encodeURIComponent(`Hello, I'm interested in your special: ${special.title}\n${url}`)}`
    : null;
  const primary = "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-white transition hover:bg-accent-deep";
  const secondary = "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--border-strong)] px-5 text-sm font-semibold text-brand-deep transition hover:border-brand";

  return (
    <div className="space-y-3">
      {!special.isSoldOut && (
        <div className="flex flex-wrap gap-2">
          {isCustomer ? (
            <Link href="/portal" className={primary}>
              Order in your account
            </Link>
          ) : (
            <>
              <Link href="/login" className={primary}>
                Sign in to order
              </Link>
              <Link href="/apply" className={secondary}>
                Open an account
              </Link>
            </>
          )}
          {askUrl ? (
            <a href={askUrl} target="_blank" rel="noopener noreferrer" className={secondary}>
              Ask on WhatsApp
            </a>
          ) : hasPhone ? (
            <a href={`tel:${business.phone.replace(/[^\d+]/g, "")}`} className={secondary}>
              <Phone size={16} aria-hidden />
              {business.phone}
            </a>
          ) : (
            <Link href="/contact" className={secondary}>
              Contact us
            </Link>
          )}
        </div>
      )}
      <ShareButtons
        compact
        url={url}
        whatsappUrl={whatsappShareUrl({
          title: special.title,
          priceCents: special.priceCents,
          unitLabel: special.unitLabel,
          remaining: special.remaining,
          url,
          businessName: business.displayName,
        })}
      />
    </div>
  );
}
