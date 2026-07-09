import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root — the enclosing directory tree contains
  // unrelated lockfiles that would otherwise confuse root inference.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
