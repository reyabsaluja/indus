import { afterEach, describe, expect, it, vi } from "vitest";
import {
	FixedWindowRateLimiter,
	getClientIp,
	getRateLimitHeaders,
} from "@/lib/security/request-rate-limit";

afterEach(() => {
	vi.useRealTimers();
});

describe("FixedWindowRateLimiter", () => {
	it("allows requests up to the limit and resets in a new window", () => {
		let now = 1_000;
		const limiter = new FixedWindowRateLimiter({
			limit: 2,
			windowMs: 1_000,
			now: () => now,
		});

		expect(limiter.check("client")).toMatchObject({ allowed: true, remaining: 1 });
		expect(limiter.check("client")).toMatchObject({ allowed: true, remaining: 0 });
		expect(limiter.check("client")).toMatchObject({ allowed: false, remaining: 0 });
		now = 2_001;
		expect(limiter.check("client")).toMatchObject({ allowed: true, remaining: 1 });
	});

	it("extracts the first forwarded address and emits retry metadata", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-12T12:00:00.000Z"));
		const request = new Request("https://example.test", {
			headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
		});

		expect(getClientIp(request)).toBe("203.0.113.10");
		expect(
			getRateLimitHeaders({
				allowed: false,
				limit: 10,
				remaining: 0,
				resetAt: Math.floor(Date.now() / 1000) + 5,
			}),
		).toEqual({
			"Retry-After": "5",
			"X-RateLimit-Limit": "10",
			"X-RateLimit-Remaining": "0",
			"X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 5),
		});
	});
});
