import { afterEach, describe, expect, test, vi } from "vitest";
import { ResilientCache } from "@/lib/reliability/cache";
import { loadReportStockData } from "@/lib/server/report-stock-data";
import type { ReportStockData } from "@/lib/types";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("loadReportStockData", () => {
	test("loads a bounded financial snapshot directly from the provider", async () => {
		const provider = {
			quote: vi.fn().mockResolvedValue({
				symbol: "AAPL",
				shortName: "Example",
				longName: "Example Corporation",
				regularMarketPrice: 125,
				regularMarketChange: 2,
				regularMarketChangePercent: 1.6,
				marketCap: 5_000,
			}),
			quoteSummary: vi.fn().mockResolvedValue({
				assetProfile: { sector: "Technology", industry: "Software" },
				defaultKeyStatistics: { beta: 1.2 },
				financialData: {
					revenueGrowth: 0.1,
					profitMargins: 0.2,
					returnOnEquity: 0.3,
					debtToEquity: 40,
				},
				summaryDetail: {
					marketCap: 6_000,
					trailingPE: 25,
					fiftyTwoWeekLow: 90,
					fiftyTwoWeekHigh: 140,
				},
			}),
		};

		await expect(loadReportStockData("AAPL", { provider })).resolves.toEqual({
			shortName: "Example",
			longName: "Example Corporation",
			regularMarketPrice: 125,
			regularMarketChange: 2,
			regularMarketChangePercent: 1.6,
			marketCap: 5_000,
			peRatio: 25,
			sector: "Technology",
			industry: "Software",
			beta: 1.2,
			fiftyTwoWeekLow: 90,
			fiftyTwoWeekHigh: 140,
			revenueGrowth: 0.1,
			netProfitMargins: 0.2,
			returnOnEquity: 0.3,
			debtToEquity: 40,
			recentNews: [],
		});
		expect(provider.quote).toHaveBeenCalledWith("AAPL", expect.any(AbortSignal));
		expect(provider.quoteSummary).toHaveBeenCalledWith(
			"AAPL",
			{
				modules: ["defaultKeyStatistics", "financialData", "summaryDetail", "assetProfile"],
			},
			expect.any(AbortSignal),
		);
	});

	test("includes only recent, symbol-related news with safe source links", async () => {
		vi.spyOn(Date, "now").mockReturnValue(new Date("2026-09-03T12:00:00.000Z").getTime());
		const provider = {
			quote: vi.fn().mockResolvedValue({ symbol: "AAPL", longName: "Apple Inc." }),
			quoteSummary: vi.fn().mockResolvedValue({ summaryDetail: { trailingPE: 25 } }),
			search: vi.fn().mockResolvedValue({
				news: [
					{
						title: "Apple announces a product update",
						publisher: "Example News",
						link: "https://example.test/apple-update",
						providerPublishTime: new Date("2026-09-02T10:00:00.000Z"),
						relatedTickers: ["AAPL"],
					},
					{
						title: "Unrelated company headline",
						publisher: "Example News",
						link: "https://example.test/unrelated",
						providerPublishTime: new Date("2026-09-02T10:00:00.000Z"),
						relatedTickers: ["MSFT"],
					},
					{
						title: "Unsafe link",
						publisher: "Example News",
						link: "javascript:alert(1)",
						providerPublishTime: new Date("2026-09-02T10:00:00.000Z"),
						relatedTickers: ["AAPL"],
					},
				],
			}),
		};

		await expect(loadReportStockData("AAPL", { provider })).resolves.toMatchObject({
			recentNews: [
				{
					headline: "Apple announces a product update",
					publisher: "Example News",
					publishedAt: "2026-09-02T10:00:00.000Z",
					url: "https://example.test/apple-update",
				},
			],
		});
		expect(provider.search).toHaveBeenCalledWith(
			"AAPL",
			{ quotesCount: 0, newsCount: 5 },
			expect.any(AbortSignal),
		);
	});

	test("falls back to summary market capitalization", async () => {
		const provider = {
			quote: vi.fn().mockResolvedValue({ symbol: "MSFT" }),
			quoteSummary: vi.fn().mockResolvedValue({ summaryDetail: { marketCap: 9_000 } }),
		};

		await expect(loadReportStockData("MSFT", { provider })).resolves.toMatchObject({
			marketCap: 9_000,
		});
	});

	test("returns null when the provider is unavailable", async () => {
		const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const provider = {
			quote: vi.fn().mockRejectedValue(new Error("provider unavailable")),
			quoteSummary: vi.fn().mockResolvedValue({}),
		};

		await expect(loadReportStockData("NVDA", { provider })).resolves.toBeNull();
		expect(warning).toHaveBeenCalledWith(expect.stringContaining("report.stock_data_unavailable"));
	});

	test("preserves recent news when financial snapshot providers are unavailable", async () => {
		vi.spyOn(Date, "now").mockReturnValue(new Date("2026-09-03T12:00:00.000Z").getTime());
		const provider = {
			quote: vi.fn().mockRejectedValue(new Error("quote unavailable")),
			quoteSummary: vi.fn().mockRejectedValue(new Error("summary unavailable")),
			search: vi.fn().mockResolvedValue({
				news: [
					{
						title: "Apple announces a product update",
						publisher: "Example News",
						link: "https://example.test/apple-update",
						providerPublishTime: new Date("2026-09-02T10:00:00.000Z"),
						relatedTickers: ["AAPL"],
					},
				],
			}),
		};

		await expect(loadReportStockData("AAPL", { provider })).resolves.toMatchObject({
			recentNews: [expect.objectContaining({ headline: "Apple announces a product update" })],
		});
	});

	test("returns the available quote when summary retrieval fails", async () => {
		const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const provider = {
			quote: vi.fn().mockResolvedValue({
				symbol: "TSLA",
				longName: "Tesla, Inc.",
				regularMarketPrice: 250,
			}),
			quoteSummary: vi.fn().mockRejectedValue(new Error("summary unavailable")),
		};

		await expect(loadReportStockData("TSLA", { provider })).resolves.toMatchObject({
			longName: "Tesla, Inc.",
			regularMarketPrice: 250,
		});
		expect(warning).toHaveBeenCalledWith(expect.stringContaining("report.stock_data_partial"));
	});

	test("prefers a stale complete snapshot over newly partial report evidence", async () => {
		let now = 1_000;
		const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const provider = {
			quote: vi.fn().mockResolvedValue({
				symbol: "META",
				longName: "Meta Platforms, Inc.",
				regularMarketPrice: 500,
			}),
			quoteSummary: vi
				.fn()
				.mockResolvedValueOnce({
					summaryDetail: { trailingPE: 25 },
					financialData: { revenueGrowth: 0.2 },
				})
				.mockRejectedValue(new Error("summary unavailable")),
		};
		const cache = new ResilientCache<ReportStockData>({
			freshForMs: 100,
			staleForMs: 500,
			now: () => now,
		});

		await expect(loadReportStockData("META", { provider, cache })).resolves.toMatchObject({
			peRatio: 25,
			revenueGrowth: 0.2,
		});
		now += 150;

		await expect(loadReportStockData("META", { provider, cache })).resolves.toMatchObject({
			peRatio: 25,
			revenueGrowth: 0.2,
		});
		expect(warning).toHaveBeenCalledWith(
			expect.stringContaining("report.stock_data_stale_cache_used"),
		);
	});

	test("propagates caller cancellation instead of generating a report without evidence", async () => {
		const caller = new AbortController();
		const waitForAbort = (signal?: AbortSignal) =>
			new Promise<never>((_, reject) => {
				signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
			});
		const provider = {
			quote: vi.fn((_symbol: string, signal?: AbortSignal) => waitForAbort(signal)),
			quoteSummary: vi.fn(
				(_symbol: string, _options: { modules: string[] }, signal?: AbortSignal) =>
					waitForAbort(signal),
			),
		};

		const pending = loadReportStockData("AAPL", { provider, signal: caller.signal });
		caller.abort(new DOMException("Request cancelled", "AbortError"));

		await expect(pending).rejects.toMatchObject({ name: "AbortError" });
		expect(provider.quote).toHaveBeenCalledTimes(1);
		expect(provider.quoteSummary).toHaveBeenCalledTimes(1);
	});
});
