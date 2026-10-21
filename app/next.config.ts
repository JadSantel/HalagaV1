import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep synthetic account-route tests separate from an existing dev server.
  distDir: process.env.HALAGA_ACCOUNT_INTEGRATION_TEST === "true" ? ".next/account-integration" : ".next",
  // Local private bytes must never become deployment artifacts.
  outputFileTracingExcludes: { "/*": ["./private-draft-photos/**/*"] },
  async headers() {
    return ["/account/:path*", "/api/auth/:path*", "/drafts/:path*"].map((source) => ({ source, headers: [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Cache-Control", value: "no-store" },
      { key: "X-Content-Type-Options", value: "nosniff" },
    ] }));
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      // Transform Tailwind's entry only; CSS modules must retain module exports.
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
