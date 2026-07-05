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
  async headers() {
    // Nothing in this app is meant to be embedded, and the private admin
    // gallery must never be framed — deny framing everywhere, block MIME
    // sniffing, and trim the referrer.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default config;
