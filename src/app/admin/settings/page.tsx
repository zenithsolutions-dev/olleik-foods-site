import type { BusinessSettingsRow } from "@/lib/business";
import { getAdminClient } from "@/lib/supabase/admin";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

const EMPTY: BusinessSettingsRow = {
  display_name: null,
  legal_name: null,
  address: null,
  phone: null,
  email: null,
  whatsapp_number: null,
};

export default async function SettingsPage() {
  // The raw row, not getBusinessIdentity(): the form must show what is stored, not the fallbacks.
  const { data } =
    (await getAdminClient()
      ?.from("business_settings")
      .select("display_name, legal_name, address, phone, email, whatsapp_number")
      .maybeSingle()) ?? {};

  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">Setup</p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
          Business settings
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your business details. They appear in the site header, on invoices, statements and reports.
        </p>
      </header>
      <SettingsForm initial={data ?? EMPTY} />
    </div>
  );
}
