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
};

export default config;
