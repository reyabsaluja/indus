import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("health route", () => {
	it("keeps liveness available when readiness configuration is invalid", async () => {
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not-a-url");
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
		vi.stubEnv("ALPACA_API_KEY", "");
		vi.stubEnv("ALPACA_SECRET_KEY", "");
		vi.stubEnv("GEMINI_API_KEY", "");

		const live = await GET(new Request("https://example.test/api/health?mode=live"));
		expect(live.status).toBe(200);
		await expect(live.json()).resolves.toMatchObject({
			status: "ok",
			mode: "live",
			checks: { process: "ok" },
		});

		const ready = await GET(new Request("https://example.test/api/health"));
		expect(ready.status).toBe(503);
		await expect(ready.json()).resolves.toMatchObject({
			status: "degraded",
			mode: "ready",
			checks: {
				process: "ok",
				supabase: "invalid",
				alpaca: "invalid",
				gemini: "invalid",
			},
		});
	});
});
