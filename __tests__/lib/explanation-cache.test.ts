import { afterEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "indus_explanations_cache_v4";

function createStorage(initial: Record<string, string> = {}) {
	const values = new Map(Object.entries(initial));
	return {
		getItem: vi.fn((key: string) => values.get(key) ?? null),
		removeItem: vi.fn((key: string) => values.delete(key)),
		setItem: vi.fn((key: string, value: string) => values.set(key, value)),
		values,
	};
}

afterEach(() => {
	vi.resetModules();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("explanation cache", () => {
	it("requires the current metric value and enforces each entry's TTL", async () => {
		const now = 10_000_000;
		vi.spyOn(Date, "now").mockReturnValue(now);
		const storage = createStorage({
			[STORAGE_KEY]: JSON.stringify({
				entries: {
					AAPL_pe_ratio: {
						value: 33.1,
						explanation: "fresh",
						savedAt: now - 1_000,
					},
					MSFT_pe_ratio: {
						value: 40,
						explanation: "expired",
						savedAt: now - 16 * 60 * 1_000,
					},
				},
			}),
		});
		vi.stubGlobal("window", {});
		vi.stubGlobal("localStorage", storage);

		const { getCachedExplanation } = await import("@/hooks/useExplanation");

		expect(getCachedExplanation("AAPL", "pe_ratio", 33.1)).toBe("fresh");
		expect(getCachedExplanation("AAPL", "pe_ratio", 34)).toBeUndefined();
		expect(getCachedExplanation("MSFT", "pe_ratio", 40)).toBeUndefined();
	});

	it("expires provider fallbacks quickly while retaining model explanations", async () => {
		const now = 10_000_000;
		vi.spyOn(Date, "now").mockReturnValue(now);
		const structured = {
			metric_display: "AAPL P/E: 33.1",
			insight: "Compare this value with peers and history.",
			evaluation: "neutral",
		};
		const storage = createStorage({
			[STORAGE_KEY]: JSON.stringify({
				entries: {
					AAPL_pe_ratio: {
						value: 33.1,
						explanation: JSON.stringify({ ...structured, source: "fallback" }),
						savedAt: now - 61_000,
					},
					MSFT_pe_ratio: {
						value: 40,
						explanation: JSON.stringify({ ...structured, source: "model" }),
						savedAt: now - 61_000,
					},
				},
			}),
		});
		vi.stubGlobal("window", {});
		vi.stubGlobal("localStorage", storage);

		const { getCachedExplanation } = await import("@/hooks/useExplanation");

		expect(getCachedExplanation("AAPL", "pe_ratio", 33.1)).toBeUndefined();
		expect(getCachedExplanation("MSFT", "pe_ratio", 40)).toContain('"source":"model"');
	});

	it("repairs previously cached numbered JSON wrappers", async () => {
		const now = 10_000_000;
		vi.spyOn(Date, "now").mockReturnValue(now);
		const storage = createStorage({
			[STORAGE_KEY]: JSON.stringify({
				entries: {
					AAPL_market_cap: {
						value: 4_750_000_000_000,
						explanation: JSON.stringify({
							1: {
								metric_display: "Market capitalization: $4.75T",
								insight: "This measures the value of outstanding shares.",
								evaluation: "neutral",
							},
						}),
						savedAt: now - 1_000,
					},
				},
			}),
		});
		vi.stubGlobal("window", {});
		vi.stubGlobal("localStorage", storage);

		const { getCachedExplanation } = await import("@/hooks/useExplanation");
		const explanation = getCachedExplanation("AAPL", "market_cap", 4_750_000_000_000);

		expect(JSON.parse(explanation ?? "{}")).toMatchObject({
			metric_display: "Market capitalization: $4.75T",
			insight: "This measures the value of outstanding shares.",
		});
		expect(explanation).not.toContain('"1"');
	});

	it("does not refresh existing entries when another explanation is saved", async () => {
		const firstSavedAt = 9_500_000;
		vi.spyOn(Date, "now").mockReturnValue(10_000_000);
		const storage = createStorage({
			[STORAGE_KEY]: JSON.stringify({
				entries: {
					AAPL_pe_ratio: {
						value: 33.1,
						explanation: "existing",
						savedAt: firstSavedAt,
					},
				},
			}),
		});
		vi.stubGlobal("window", {});
		vi.stubGlobal("localStorage", storage);
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				Response.json({
					explanations: {
						MSFT_pe_ratio: "new",
					},
				}),
			),
		);

		const { batchPreload } = await import("@/hooks/useExplanation");
		await batchPreload([{ symbol: "MSFT", metric: "pe_ratio", value: 40 }]);

		const persisted = JSON.parse(storage.values.get(STORAGE_KEY) ?? "{}");
		expect(persisted.entries.AAPL_pe_ratio.savedAt).toBe(firstSavedAt);
		expect(persisted.entries.MSFT_pe_ratio).toMatchObject({
			value: 40,
			explanation: "new",
			savedAt: 10_000_000,
		});
	});

	it("splits preloads at the API boundary without dropping metrics", async () => {
		const storage = createStorage();
		vi.stubGlobal("window", {});
		vi.stubGlobal("localStorage", storage);
		const requests: Array<Array<{ symbol: string; metric: string; value: number }>> = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: string, init?: RequestInit) => {
				const batch = JSON.parse(String(init?.body));
				requests.push(batch);
				return Response.json({
					explanations: Object.fromEntries(
						batch.map((item: { symbol: string; metric: string }) => [
							`${item.symbol}_${item.metric}`,
							`review-${item.metric}`,
						]),
					),
				});
			}),
		);

		const { batchPreload, getCachedExplanation } = await import("@/hooks/useExplanation");
		const items = Array.from({ length: 26 }, (_, index) => ({
			symbol: "AAPL",
			metric: `metric_${index}`,
			value: index,
		}));
		await batchPreload(items);

		expect(requests.map((batch) => batch.length)).toEqual([25, 1]);
		expect(getCachedExplanation("AAPL", "metric_25", 25)).toBe("review-metric_25");
	});

	it("serializes concurrent preloads and still fetches each uncached metric", async () => {
		const storage = createStorage();
		vi.stubGlobal("window", {});
		vi.stubGlobal("localStorage", storage);
		const requestedMetrics: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: string, init?: RequestInit) => {
				const [item] = JSON.parse(String(init?.body));
				requestedMetrics.push(item.metric);
				await Promise.resolve();
				return Response.json({
					explanations: { [`${item.symbol}_${item.metric}`]: `review-${item.metric}` },
				});
			}),
		);

		const { batchPreload, getCachedExplanation } = await import("@/hooks/useExplanation");
		await Promise.all([
			batchPreload([{ symbol: "AAPL", metric: "pe_ratio", value: 30 }]),
			batchPreload([{ symbol: "AAPL", metric: "beta", value: 1.2 }]),
		]);

		expect(requestedMetrics).toEqual(["pe_ratio", "beta"]);
		expect(getCachedExplanation("AAPL", "pe_ratio", 30)).toBe("review-pe_ratio");
		expect(getCachedExplanation("AAPL", "beta", 1.2)).toBe("review-beta");
	});
});
