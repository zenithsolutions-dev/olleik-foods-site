import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import type { OfferDiscountKind, OfferTemplate } from "./types";

// Server-side read of `offer_templates` via the service-role client. Admin-only
// table (RLS deny-all to anon/authenticated; service-role bypasses). Returns ALL
// rows incl. archived — consumers filter (the library list, the apply picker,
// and templateId→name provenance mapping all need different slices). There is no
// demo seed for this new table, so `live:false` yields an empty list.

const TEMPLATE_COLUMNS =
  "id, name, description, discount_kind, discount_value, is_archived, created_at, updated_at";

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  discount_kind: OfferDiscountKind | null;
  discount_value: number | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

function toTemplate(r: TemplateRow): OfferTemplate {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    discountKind: r.discount_kind,
    discountValue: r.discount_value,
    isArchived: r.is_archived,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export type AdminOfferTemplates = {
  templates: OfferTemplate[];
  live: boolean;
};

export async function fetchAdminOfferTemplates(): Promise<AdminOfferTemplates> {
  const admin = getAdminClient();
  if (!admin) return { templates: [], live: false };

  const { data, error } = await admin
    .from("offer_templates")
    .select(TEMPLATE_COLUMNS)
    .order("name", { ascending: true });

  if (error) {
    console.error("[admin] failed to load offer templates (run migration 0005?):", error.message);
    return { templates: [], live: true };
  }
  return { templates: (data as TemplateRow[]).map(toTemplate), live: true };
}
