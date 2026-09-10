import { defineConfig, devices } from "@playwright/test";

const useProductionServer = process.env.E2E_USE_PRODUCTION === "true";
const port = 3100;
const serverURL = `http://localhost:${port}`;

export default defineConfig({
	testDir: "./e2e",
	testMatch: "**/*.e2e.ts",
	fullyParallel: true,
	workers: 2,
	forbidOnly: Boolean(process.env.CI),
	retries: 0,
	timeout: 60_000,
	expect: {
		timeout: 7_500,
	},
	reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
	use: {
		baseURL: serverURL,
		locale: "en-CA",
		timezoneId: "America/Toronto",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	webServer: {
		command: useProductionServer
			? `bun run start --hostname localhost --port ${port}`
			: `bun run dev --hostname localhost --port ${port}`,
		url: serverURL,
		reuseExistingServer: false,
		timeout: 120_000,
		env: {
			...process.env,
			NEXT_PUBLIC_SUPABASE_URL:
				process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
			NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "test-anon-key",
			ALPACA_API_KEY: process.env.ALPACA_API_KEY ?? "test-alpaca-key",
			ALPACA_SECRET_KEY: process.env.ALPACA_SECRET_KEY ?? "test-alpaca-secret",
			ALPACA_IS_PAPER: process.env.ALPACA_IS_PAPER ?? "true",
			GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "test-gemini-key",
		},
	},
	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"] } },
		{ name: "firefox", use: { ...devices["Desktop Firefox"] } },
		{ name: "webkit", use: { ...devices["Desktop Safari"] } },
		{ name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
	],
});
