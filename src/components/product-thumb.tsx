"use client";

import Image from "next/image";
import { useState } from "react";

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
