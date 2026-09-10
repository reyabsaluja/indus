import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	output: "standalone",
	serverExternalPackages: ["@alpacahq/alpaca-trade-api", "yahoo-finance2"],
	// The application serves images directly; the current image configuration is provider-neutral.
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
