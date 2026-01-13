import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Allow production builds to successfully complete even if there are ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow production builds to successfully complete even if there are type errors
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['yahoo-finance2'],
  // Disable image optimization for Vercel deployment unless you have a pro plan
  images: {
    unoptimized: true,
  },
  // Suppress punycode deprecation warning
  webpack: (config) => {
    config.ignoreWarnings = [
      { module: /node_modules\/punycode/ },
    ];
    return config;
  },
};

export default nextConfig;
