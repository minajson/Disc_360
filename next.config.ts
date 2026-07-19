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
};

export default nextConfig;
