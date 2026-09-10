interface RateLimitWindow {
	count: number;
	resetAtMs: number;
}

export interface RateLimitResult {
	allowed: boolean;
	limit: number;
	remaining: number;
	resetAt: number;
}

interface FixedWindowRateLimiterOptions {
	limit: number;
	windowMs: number;
	maxEntries?: number;
	now?: () => number;
}

export class FixedWindowRateLimiter {
	private readonly windows = new Map<string, RateLimitWindow>();
	private readonly maxEntries: number;
	private readonly now: () => number;

	constructor(private readonly options: FixedWindowRateLimiterOptions) {
		this.maxEntries = Math.max(1, options.maxEntries ?? 5_000);
		this.now = options.now ?? Date.now;
	}

	check(key: string): RateLimitResult {
		const now = this.now();
		const current = this.windows.get(key);
		const window =
			current && current.resetAtMs > now
				? current
				: { count: 0, resetAtMs: now + this.options.windowMs };

		window.count += 1;
		this.windows.set(key, window);
		this.prune(now);

		return {
			allowed: window.count <= this.options.limit,
			limit: this.options.limit,
			remaining: Math.max(0, this.options.limit - window.count),
			resetAt: Math.ceil(window.resetAtMs / 1000),
		};
	}

	private prune(now: number): void {
		if (this.windows.size <= this.maxEntries) {
			return;
		}

		for (const [key, window] of this.windows) {
			if (window.resetAtMs <= now) {
				this.windows.delete(key);
			}
		}

		while (this.windows.size > this.maxEntries) {
			const oldestKey = this.windows.keys().next().value;
			if (oldestKey === undefined) {
				break;
			}
			this.windows.delete(oldestKey);
		}
	}
}

export function getClientIp(request: Request): string {
	const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
	return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
	const headers: Record<string, string> = {
		"X-RateLimit-Limit": String(result.limit),
		"X-RateLimit-Remaining": String(result.remaining),
		"X-RateLimit-Reset": String(result.resetAt),
	};

	if (!result.allowed) {
		headers["Retry-After"] = String(Math.max(1, result.resetAt - Math.floor(Date.now() / 1000)));
	}

	return headers;
}
