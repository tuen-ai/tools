import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    // Supabase Storage will serve transformed images; allow the project URL host.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/**",
      },
    ],
  },
  experimental: {
    // Admin cover-image upload uses a server action — raise the body
    // limit beyond the 1 MB default so 4-6 MB JPEGs work.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default config;
