import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Category } from "./types";
import { SEED_DATA } from "./mock-data";

// Server-side read of `categories` via the service-role client, plus a
// per-category product-count map (used for the list + the delete guard's UX).
// `counts` is keyed by category id.

type CategoryRow = { id: string; name: string; description: string | null };

export type AdminCategories = {
  categories: Category[];
  counts: Record<string, number>;
  live: boolean;
};

function tally(rows: { category_id: string | null }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    if (r.category_id) counts[r.category_id] = (counts[r.category_id] ?? 0) + 1;
  }
  return counts;
}

export async function fetchAdminCategories(): Promise<AdminCategories> {
  const admin = getAdminClient();
  if (!admin) {
    const counts = tally(
      SEED_DATA.products.map((p) => ({ category_id: p.categoryId })),
    );
    return { categories: SEED_DATA.categories, counts, live: false };
  }

  const [catsRes, prodRes] = await Promise.all([
    admin
      .from("categories")
      .select("id, name, description")
      .order("name", { ascending: true }),
    admin.from("products").select("category_id"),
  ]);

  if (catsRes.error) {
    console.error("[admin] failed to load categories:", catsRes.error.message);
    return { categories: [], counts: {}, live: true };
  }

  let counts: Record<string, number> = {};
  if (prodRes.error) {
    console.error("[admin] failed to load product counts:", prodRes.error.message);
  } else {
    counts = tally(prodRes.data as { category_id: string | null }[]);
  }

  const categories: Category[] = (catsRes.data as CategoryRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
  }));

  return { categories, counts, live: true };
}
