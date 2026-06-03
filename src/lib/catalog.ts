/**
 * Public catalog categories. Intentionally NON-transactional and price-free:
 * Olleik shows negotiated pricing only after sign-in, so these pages exist to
 * demonstrate range and drive "request pricing" — not to publish a price list.
 * Example items are representative of what each category carries; edit freely.
 */

export type Category = {
  slug: string;
  name: string;
  blurb: string;
  description: string;
  image?: string;
  imageAlt?: string;
  gradient?: string;
  highlights: string[];
  examples: string[];
};

export const categories: Category[] = [
  {
    slug: "fresh-produce",
    name: "Fresh Produce",
    blurb: "Daily-sourced fruit and vegetables from regional growers.",
    description:
      "Fruit and vegetables sourced daily, with local growers prioritized in season and specialty importers filling the gaps. Checked for quality at our dock before anything ships.",
    image:
      "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "An abundant market display of fresh fruits and vegetables",
    highlights: ["Local in-season", "Specialty & imported", "Cut & prepped options"],
    examples: [
      "Vine & Roma tomatoes",
      "Leafy greens & herbs",
      "Onions, garlic & root veg",
      "Citrus & seasonal fruit",
      "Berries",
      "Peppers & chilies",
    ],
  },
  {
    slug: "meat-poultry",
    name: "Meat & Poultry",
    blurb: "Restaurant-grade cuts, portion control, halal & specialty.",
    description:
      "Restaurant-grade beef, poultry, lamb, and pork — whole, portioned, or cut to your spec. Halal and specialty options available; ask your rep for current sourcing.",
    image:
      "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Assorted raw and cured meats on a wooden board",
    highlights: ["Portion control", "Halal & specialty", "Cut to spec"],
    examples: [
      "Beef cuts & ground",
      "Chicken (whole & portioned)",
      "Lamb",
      "Pork & charcuterie",
      "Deli & cured meats",
      "Custom butchery",
    ],
  },
  {
    slug: "dairy-eggs",
    name: "Dairy & Eggs",
    blurb: "Cheese, butter, cream, cultured dairy, and farm-fresh eggs.",
    description:
      "A full dairy program — milk, cream, butter, cultured products, and a broad cheese selection — plus farm-fresh eggs, all kept in cold chain to your door.",
    image:
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Small jars of cream layered with fresh berries",
    highlights: ["Broad cheese range", "Cold-chain handled", "Farm-fresh eggs"],
    examples: [
      "Milk & cream",
      "Butter",
      "Block & shredded cheese",
      "Specialty & fresh cheese",
      "Yogurt & cultured dairy",
      "Eggs (shell & liquid)",
    ],
  },
  {
    slug: "dry-goods-pantry",
    name: "Dry Goods & Pantry",
    blurb: "Grains, oils, spices, canned goods, and baking essentials.",
    description:
      "The backbone of the kitchen — flours, grains, oils, vinegars, spices, canned and jarred goods, and baking essentials, in foodservice sizes.",
    image:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Round artisan bread loaves beside stalks of wheat",
    highlights: ["Foodservice sizes", "Bulk staples", "Baking program"],
    examples: [
      "Flours & grains",
      "Oils & vinegars",
      "Spices & seasonings",
      "Canned & jarred goods",
      "Pasta & rice",
      "Baking essentials",
    ],
  },
  {
    slug: "beverages",
    name: "Beverages",
    blurb: "Coffee, espresso, juices, bottled water, and soft drinks.",
    description:
      "Front-of-house and back-of-house drinks — coffee and espresso, juices, bottled water, and soft drinks — in case quantities sized for service.",
    image:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Three cups of latte art viewed from above",
    highlights: ["Coffee & espresso", "Case quantities", "Front-of-house ready"],
    examples: [
      "Coffee beans & ground",
      "Espresso",
      "Juices",
      "Bottled & sparkling water",
      "Soft drinks",
      "Syrups & mixers",
    ],
  },
  {
    slug: "paper-cleaning",
    name: "Paper & Cleaning",
    blurb: "Disposables, take-out packaging, sanitation, and PPE.",
    description:
      "Everything non-food your kitchen burns through — take-out packaging, disposables, sanitation supplies, and PPE — on the same invoice and the same delivery as your food order.",
    gradient: "from-brand-mist via-brand-soft to-accent-soft/60",
    highlights: ["One invoice with food", "Take-out packaging", "Sanitation & PPE"],
    examples: [
      "Take-out containers",
      "Cups & lids",
      "Napkins & towels",
      "Gloves & PPE",
      "Cleaning chemicals",
      "Trash & liners",
    ],
  },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
