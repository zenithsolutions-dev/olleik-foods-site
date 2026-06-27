/**
 * Presentation / "chrome" map for the public catalog.
 *
 * Category DATA — names, descriptions, and the products shown — now comes live
 * from Supabase (see catalog-data.ts). This file only supplies visual chrome:
 * a hero image, an optional short blurb, and a gradient, keyed by the slugified
 * category name. Categories with no entry here fall back to the default
 * gradient and their database description. Still price-free by design: Olleik
 * shows negotiated pricing only after sign-in.
 */

export type CategoryChrome = {
  blurb?: string;
  image?: string;
  imageAlt?: string;
  gradient: string;
};

export const DEFAULT_GRADIENT = "from-brand-mist via-brand-soft to-accent-soft/60";

/**
 * Slug used in /catalog/[category] URLs, derived from the category name.
 * "Meat & Poultry" -> "meat-poultry", "Dry Goods" -> "dry-goods".
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Curated visuals for the categories we have photography for. Keyed by slug.
// Anything not listed here renders with DEFAULT_GRADIENT + its DB description.
const CHROME: Record<string, CategoryChrome> = {
  produce: {
    blurb: "Daily-sourced fruit and vegetables from regional growers.",
    image:
      "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "An abundant market display of fresh fruits and vegetables",
    gradient: DEFAULT_GRADIENT,
  },
  "fresh-produce": {
    blurb: "Daily-sourced fruit and vegetables from regional growers.",
    image:
      "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "An abundant market display of fresh fruits and vegetables",
    gradient: DEFAULT_GRADIENT,
  },
  "meat-poultry": {
    blurb: "Restaurant-grade cuts, portion control, halal & specialty.",
    image:
      "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Assorted raw and cured meats on a wooden board",
    gradient: DEFAULT_GRADIENT,
  },
  "dairy-eggs": {
    blurb: "Cheese, butter, cream, cultured dairy, and farm-fresh eggs.",
    image:
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Small jars of cream layered with fresh berries",
    gradient: DEFAULT_GRADIENT,
  },
  "dry-goods": {
    blurb: "Grains, oils, spices, canned goods, and baking essentials.",
    image:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Round artisan bread loaves beside stalks of wheat",
    gradient: DEFAULT_GRADIENT,
  },
  beverages: {
    blurb: "Coffee, espresso, juices, bottled water, and soft drinks.",
    image:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Three cups of latte art viewed from above",
    gradient: DEFAULT_GRADIENT,
  },
  "packaging-disposables": {
    blurb: "Disposables, take-out packaging, sanitation, and PPE.",
    gradient: "from-brand-mist via-brand-soft to-accent-soft/60",
  },
};

export function getCategoryChrome(slug: string): CategoryChrome {
  return CHROME[slug] ?? { gradient: DEFAULT_GRADIENT };
}
