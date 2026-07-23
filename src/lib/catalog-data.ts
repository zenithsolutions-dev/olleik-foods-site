import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import { slugify } from "./catalog";
import { SEED_DATA } from "./admin/mock-data";

// Public catalog read path. Runs server-side via the service-role client (the
// public/marketing pages are unauthenticated, and products/categories have no
// anon SELECT policy — the tables stay closed to the browser key). The column
// projections below are EXPLICIT and deliberately omit list_price_cents: no
// price ever leaves the database on this path. Olleik shows negotiated pricing
// only after sign-in.

// list_price_cents is intentionally NOT in this list. parent_id (0006) is pure
// taxonomy — still no price/cost data on this path.
const PRODUCT_COLUMNS =
  "id, name, description, category_id, unit, unit_size, image_url, is_active";
const CATEGORY_COLUMNS = "id, name, description, parent_id";

export type PublicProduct = {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  unitSize: string;
  imageUrl: string | null;
};

export type PublicSubcategory = {
  id: string;
  name: string;
  products: PublicProduct[];
};

export type PublicCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parentId: string | null;
  // For a PARENT: own products + all children's products (so tiles/counts and
  // the empty check cover the whole tree). For a child: just its own.
  products: PublicProduct[];
  // Present on parents that have subcategories: own products first (as
  // ownProducts) then each child, for the subheading layout on the detail page.
  ownProducts: PublicProduct[];
  children: PublicSubcategory[];
};

export type PublicCatalog = {
  categories: PublicCategory[]; // ALL categories, including empty ones
  live: boolean;
};

type CatRow = { id: string; name: string; description: string | null; parent_id: string | null };
type ProdRow = {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  unit: string;
  unit_size: string;
  image_url: string | null;
};

function group(cats: CatRow[], prods: ProdRow[]): PublicCategory[] {
  const byCat = new Map<string, PublicProduct[]>();
  for (const p of prods) {
    if (!p.category_id) continue; // uncategorized → hidden from the public catalog
    const item: PublicProduct = {
      id: p.id,
      name: p.name,
      description: p.description,
      unit: p.unit,
      unitSize: p.unit_size,
      imageUrl: p.image_url,
    };
    const arr = byCat.get(p.category_id);
    if (arr) arr.push(item);
    else byCat.set(p.category_id, [item]);
  }
  return cats.map((c) => {
    const own = byCat.get(c.id) ?? [];
    const children: PublicSubcategory[] = cats
      .filter((child) => child.parent_id === c.id)
      .map((child) => ({ id: child.id, name: child.name, products: byCat.get(child.id) ?? [] }));
    return {
      id: c.id,
      slug: slugify(c.name),
      name: c.name,
      description: c.description,
      parentId: c.parent_id,
      products: [...own, ...children.flatMap((ch) => ch.products)],
      ownProducts: own,
      children,
    };
  });
}

// Fallback used only when Supabase isn't configured (local/preview without env).
// Mirrors the admin readers; built from the same seed, and price-free because
// list_price_cents simply isn't read.
function buildFromSeed(): PublicCategory[] {
  const cats: CatRow[] = SEED_DATA.categories.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description ?? null,
    parent_id: c.parentId ?? null,
  }));
  const prods: ProdRow[] = SEED_DATA.products
    .filter((p) => p.isActive)
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      category_id: p.categoryId,
      unit: p.unit,
      unit_size: p.unitSize,
      image_url: p.imageUrl ?? null,
    }));
  return group(cats, prods);
}

export async function fetchPublicCatalog(): Promise<PublicCatalog> {
  const admin = getAdminClient();
  if (!admin) return { categories: buildFromSeed(), live: false };

  const [
    { data: cats, error: catErr },
    { data: prods, error: prodErr },
  ] = await Promise.all([
    admin.from("categories").select(CATEGORY_COLUMNS).order("name", { ascending: true }),
    admin
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  if (catErr || prodErr) {
    console.error(
      "[catalog] failed to load public catalog:",
      catErr?.message ?? prodErr?.message,
    );
    return { categories: [], live: true };
  }

  return { categories: group(cats as CatRow[], prods as ProdRow[]), live: true };
}

/** TOP-LEVEL categories with at least one active product (own or in a child) —
 *  for the index/homepage tiles. Subcategories don't get their own tiles; their
 *  products roll up into the parent (D4). */
export function visibleCategories(catalog: PublicCatalog): PublicCategory[] {
  return catalog.categories.filter((c) => !c.parentId && c.products.length > 0);
}

/** Resolve a slug to a category, including real-but-empty ones (for the detail page). */
export function findCategoryBySlug(
  catalog: PublicCatalog,
  slug: string,
): PublicCategory | undefined {
  return catalog.categories.find((c) => c.slug === slug);
}
