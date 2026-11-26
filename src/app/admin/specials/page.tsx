import { getBusinessIdentity } from "@/lib/business";
import { BUSINESS_TIME_ZONE } from "@/lib/dates";
import { siteUrl } from "@/lib/email/send";
import { fetchAdminProducts } from "@/lib/admin/products-data";
import { remainingQty, specialState, whatsappShareUrl } from "@/lib/specials";
import { fetchAdminSpecials } from "@/lib/specials-data";
import type { SpecialFormValues } from "./actions";
import { SpecialsClient, type AdminSpecial } from "./specials-client";

export const dynamic = "force-dynamic";

// A stored instant as the local calendar day the admin picked (en-CA formats as YYYY-MM-DD).
const localDay = (iso: string | null, shiftMs = 0) =>
  iso ? new Date(new Date(iso).getTime() + shiftMs).toLocaleDateString("en-CA", { timeZone: BUSINESS_TIME_ZONE }) : "";

export default async function SpecialsPage() {
  const [{ specials, migrationApplied }, { products }, business] = await Promise.all([
    fetchAdminSpecials(),
    fetchAdminProducts(),
    getBusinessIdentity(),
  ]);
  const now = new Date();
  const base = siteUrl();

  const rows: AdminSpecial[] = specials.map((s) => {
    const url = `${base}/specials/${s.id}`;
    const values: SpecialFormValues = {
      id: s.id,
      product_id: s.product_id,
      title: s.title,
      description: s.description ?? "",
      unit_label: s.unit_label ?? "",
      image_url: s.image_url ?? "",
      price: (s.special_price_cents / 100).toFixed(2),
      quantity_total: String(s.quantity_total),
      start_date: localDay(s.starts_at),
      end_date: localDay(s.ends_at, -1), // stored as the NEXT midnight: show the last day it runs
      is_published: s.is_published,
      show_price_to_guests: s.show_price_to_guests,
    };
    return {
      id: s.id,
      state: specialState(s, now),
      title: s.title,
      priceCents: s.special_price_cents,
      unitLabel: s.unit_label,
      sold: s.quantity_sold,
      total: s.quantity_total,
      remaining: remainingQty(s),
      isPublished: s.is_published,
      url,
      // What a guest may see: no price in the message when this special hides it from guests.
      whatsappUrl: whatsappShareUrl({
        title: s.title,
        priceCents: s.show_price_to_guests ? s.special_price_cents : null,
        unitLabel: s.unit_label,
        remaining: remainingQty(s),
        url,
        businessName: business.displayName,
      }),
      values,
    };
  });

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">Specials</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          A limited quantity of a product at a special price, shown to every visitor of your website. Publish one
          and it is live at once; the number left drops with each order and it stops selling at zero.
        </p>
      </header>
      {!migrationApplied && (
        <p className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Specials are not set up in the database yet (migration 0019).
        </p>
      )}
      <SpecialsClient
        specials={rows}
        products={products
          .filter((p) => p.isActive)
          .map((p) => ({ id: p.id, name: p.name, unitLabel: `${p.unitSize} / ${p.unit}`, imageUrl: p.imageUrl ?? "" }))}
      />
    </div>
  );
}
