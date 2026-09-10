import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	serverExternalPackages: ["@alpacahq/alpaca-trade-api", "yahoo-finance2"],
	// Disable image optimization for Vercel deployment unless you have a pro plan
	images: {
		unoptimized: true,
	},
	// Suppress punycode deprecation warning
	webpack: (config) => {
		config.ignoreWarnings = [{ module: /node_modules\/punycode/ }];
		return config;
	},
};

export default nextConfig;
