import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessIdentity } from "@/lib/business";
import { BUSINESS_TIME_ZONE } from "@/lib/dates";
import { siteUrl } from "@/lib/email/send";
import { fetchPublicSpecial, viewerIsCustomer } from "@/lib/specials-data";
import { LiveRefresh } from "@/components/specials/live-refresh";
import { SpecialCard } from "@/components/specials/special-card";
import { SpecialActions } from "../special-actions";

// One special on its own address: this is the link that gets shared.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// The share preview (WhatsApp, etc.) is what a GUEST may see: no price when the special hides it.
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const [special, business] = await Promise.all([fetchPublicSpecial(id, { isCustomer: false }), getBusinessIdentity()]);
  if (!special) return { title: `Specials | ${business.displayName}` };
  const price = special.priceCents === null ? "" : `$${(special.priceCents / 100).toFixed(2)}${special.unitLabel ? ` per ${special.unitLabel}` : ""} · `;
  const description = `${price}${special.isSoldOut ? "Sold out" : `Only ${special.remaining} left`} at ${business.displayName}.`;
  return {
    title: `${special.title} | ${business.displayName}`,
    description,
    openGraph: { title: special.title, description, images: special.imageUrl ? [special.imageUrl] : undefined },
  };
}

export default async function SpecialPage({ params }: Params) {
  const { id } = await params;
  const isCustomer = await viewerIsCustomer();
  const [special, business] = await Promise.all([fetchPublicSpecial(id, { isCustomer }), getBusinessIdentity()]);
  // Unpublished, ended, not started or unknown: there is nothing here for a visitor.
  if (!special) notFound();

  return (
    <section className="mx-auto max-w-2xl px-6 pb-20 pt-10 md:pt-14">
      <LiveRefresh />
      <Link href="/specials" className="text-sm font-medium text-brand hover:text-accent">
        ← All specials
      </Link>
      <div className="mt-5">
        <SpecialCard special={special} timeZone={BUSINESS_TIME_ZONE}>
          <SpecialActions special={special} url={`${siteUrl()}/specials/${special.id}`} business={business} isCustomer={isCustomer} />
        </SpecialCard>
      </div>
    </section>
  );
}
