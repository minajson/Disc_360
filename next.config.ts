import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root — the enclosing directory tree contains
  // unrelated lockfiles that would otherwise confuse root inference.
  turbopack: {
    root: __dirname,
  },
  // Test/production builds can be pointed at an isolated dist dir so a
  // concurrently running `next dev` (which rewrites .next continuously) can
  // never clobber the chunks a `next start` under test is serving.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The floating "N" button is Next.js's dev-tools indicator. It exists ONLY
  // under `next dev` — production builds never include it — but demos are
  // sometimes run against the dev server, so it is disabled outright.
  devIndicators: false,
  // Team logos are served from Supabase storage. Without the host allow-listed
  // here, any team WITH a logo would crash its layout's <Image> in production.
  images: {
    remotePatterns: [
      ...(process.env.NEXT_PUBLIC_SUPABASE_URL
        ? [
            {
              protocol: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).protocol.replace(":", "") as
                | "http"
                | "https",
              hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
              port: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).port,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
