import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"@": resolve(__dirname, "."),
		},
	},
	test: {
		environment: "node",
		include: ["__tests__/**/*.test.ts", "__tests__/**/*.test.tsx"],
		globals: true,
		coverage: {
			provider: "v8",
			include: [
				"lib/ai/geminiClient.ts",
				"lib/ai/report.ts",
				"lib/chat/messages.ts",
				"lib/env-legacy.ts",
				"lib/realtime/alpaca-stream.ts",
				"lib/reliability/async.ts",
				"lib/reliability/cache.ts",
				"lib/schemas/api.ts",
				"lib/security/ai-access.ts",
				"lib/security/request-rate-limit.ts",
				"lib/server/report-stock-data.ts",
			],
			reporter: ["text", "html", "json-summary"],
			reportsDirectory: "coverage",
			thresholds: {
				lines: 85,
				functions: 85,
				branches: 80,
				statements: 85,
			},
		},
	},
});
