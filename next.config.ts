import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ],
  },
};

export default nextConfig;
