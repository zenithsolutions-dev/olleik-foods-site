import type { NextConfig } from "next";

// Allow next/image to load uploaded product photos from the Supabase Storage
// public bucket. The host is derived from the configured Supabase URL so there
// is no hardcoded project ref.
const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : undefined;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Product images are uploaded to a server action as multipart form data.
      // The default 1 MB cap would reject them; this matches the 5 MB limit
      // enforced server-side in uploadProductImage().
      bodySizeLimit: "5mb",
    },
  },
  images: {
    // Serve images directly instead of through Vercel's metered Image
    // Optimization. On the free plan that optimizer exhausted its quota and
    // began returning 402 (OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED), which
    // broke every photo site-wide. The source URLs are already sized via query
    // params, so bypassing the optimizer is a safe trade.
    // Re-enable optimization (remove this flag) if the project moves to a paid plan.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      ...(supabaseHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
