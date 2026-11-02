// Pure helpers for the product thumbnails. Deliberately NOT in components/product-thumb.tsx (a "use client"
// module): server-side data code calls topThumbs(), and a function imported from a client module cannot run on the
// server (the same mistake that crashed Offer library > Running now).

export type ThumbItem = { name: string; imageUrl: string | null };

/** Pick the lines worth showing in an order-list strip: biggest line totals first, ties by name. */
export function topThumbs(
  lines: { name: string; imageUrl: string | null; totalCents: number }[],
  max = 3,
): ThumbItem[] {
  return [...lines]
    .sort((a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name))
    .slice(0, max)
    .map(({ name, imageUrl }) => ({ name, imageUrl }));
}
