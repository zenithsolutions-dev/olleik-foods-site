"use client";

import Image from "next/image";
import { useState } from "react";
import type { ThumbItem } from "@/lib/product-thumbs";

// One small product picture used everywhere a product appears in a list (cart,
// checkout, order lines, pickers). A fixed-size box is reserved up front, so the
// row never shifts while the image loads (no layout shift) and a product without
// a photo — or a photo that fails to load — shows the same neutral letter tile
// instead of a broken image. Images are lazy by default; pass `eager` only for
// a thumbnail that is above the fold on first paint.
//
// The tile and the image share one footprint on purpose: swapping one for the
// other can never move the text next to it.

export const THUMB_SIZES = { sm: 32, md: 48, lg: 64 } as const;
export type ThumbSize = keyof typeof THUMB_SIZES;

export function ProductThumb({
  src,
  name,
  size = "md",
  eager = false,
  className = "",
}: {
  src?: string | null;
  name: string;
  size?: ThumbSize;
  eager?: boolean;
  className?: string;
}) {
  const px = THUMB_SIZES[size];
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
  const letter = name.trim().charAt(0).toUpperCase() || "•";

  return (
    <span
      data-testid="product-thumb"
      data-state={showImage ? "image" : "fallback"}
      style={{ width: px, height: px }}
      className={`relative inline-block shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-brand-mist align-middle ${className}`}
    >
      {showImage ? (
        <Image
          src={src as string}
          alt={name}
          fill
          sizes={`${px}px`}
          loading={eager ? "eager" : "lazy"}
          className="object-cover"
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : (
        <span
          aria-hidden
          className="font-display absolute inset-0 grid place-items-center bg-gradient-to-br from-brand-mist to-accent-soft/50 font-semibold text-brand-deep/45"
          style={{ fontSize: Math.round(px * 0.42) }}
        >
          {letter}
        </span>
      )}
    </span>
  );
}

// A compact overlapping row of the first few products on an order (order lists).
// The row's width depends only on how many thumbnails it shows (never on whether
// an image has loaded), and "+N" stands for the rest, so rows line up and never jump.
export function ProductThumbStrip({
  items,
  total,
  max = 3,
}: {
  items: ThumbItem[];
  total: number;
  max?: number;
}) {
  const shown = items.slice(0, max);
  const more = Math.max(0, total - shown.length);
  if (shown.length === 0) return null;
  const px = THUMB_SIZES.sm;
  return (
    <span data-testid="thumb-strip" className="flex shrink-0 items-center">
      {shown.map((it, i) => (
        <ProductThumb
          key={`${it.name}-${i}`}
          src={it.imageUrl}
          name={it.name}
          size="sm"
          className={`ring-2 ring-surface ${i > 0 ? "-ml-2" : ""}`}
        />
      ))}
      {more > 0 && (
        <span
          style={{ width: px, height: px }}
          className="-ml-2 grid shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-surface text-[11px] font-semibold text-muted ring-2 ring-surface"
        >
          +{more}
        </span>
      )}
    </span>
  );
}
