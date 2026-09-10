import { describe, expect, it, vi } from "vitest";
import { ResilientCache } from "@/lib/reliability/cache";
import {
	type StockDataCacheValue,
	type StockDataProvider,
	StockDataService,
} from "@/lib/server/stock-data";

describe("StockDataService", () => {
	it("returns a quote-only snapshot when summary data is unavailable", async () => {
		const provider: StockDataProvider = {
			name: "yahoo",
			quote: vi.fn().mockResolvedValue({
				shortName: "Example",
				longName: "Example Inc.",
				regularMarketPrice: 125,
				regularMarketChange: 2,
				regularMarketChangePercent: 1.6,
				marketCap: 5_000,
			}),
			quoteSummary: vi.fn().mockRejectedValue(new Error("summary unavailable")),
		};
		const service = new StockDataService(provider, { attempts: 1 });

		await expect(service.load("EXM")).resolves.toMatchObject({
			provider: "yahoo",
			degraded: true,
			cacheStatus: "miss",
			data: {
				symbol: "EXM",
				longName: "Example Inc.",
				regularMarketPrice: 125,
				marketCap: 5_000,
				peRatio: null,
			},
		});
	});

	it("fails only when every Yahoo data surface is unavailable", async () => {
		const provider: StockDataProvider = {
			name: "yahoo",
			quote: vi.fn().mockRejectedValue(new Error("quote unavailable")),
			quoteSummary: vi.fn().mockRejectedValue(new Error("summary unavailable")),
		};
		const service = new StockDataService(provider, { attempts: 1 });

		await expect(service.load("FAIL")).rejects.toThrow("yahoo stock data unavailable");
	});

	it("prefers a stale complete snapshot over a newly partial response", async () => {
		let now = 1_000;
		const quote = vi.fn().mockResolvedValue({
			shortName: "Example",
			regularMarketPrice: 125,
		});
		const quoteSummary = vi
			.fn()
			.mockResolvedValueOnce({
				price: { shortName: "Example", regularMarketPrice: 125 },
				summaryDetail: { trailingPE: 20 },
			})
			.mockRejectedValue(new Error("summary unavailable"));
		const cache = new ResilientCache<StockDataCacheValue>({
			freshForMs: 100,
			staleForMs: 500,
			now: () => now,
		});
		const service = new StockDataService(
			{ name: "yahoo", quote, quoteSummary },
			{ attempts: 1, cache },
		);

		await service.load("EXM");
		now += 150;

		await expect(service.load("EXM")).resolves.toMatchObject({
			cacheStatus: "stale",
			degraded: false,
			data: { peRatio: 20 },
		});
	});

	it("stops all provider work when the requesting client disconnects", async () => {
		const caller = new AbortController();
		const waitForAbort = vi.fn(
			(_symbol: string, signal: AbortSignal) =>
				new Promise<never>((_, reject) => {
					signal.addEventListener("abort", () => reject(signal.reason), { once: true });
				}),
		);
		const service = new StockDataService(
			{ name: "yahoo", quote: waitForAbort, quoteSummary: waitForAbort },
			{ attempts: 2 },
		);

		const pending = service.load("AAPL", { signal: caller.signal });
		caller.abort(new DOMException("Request cancelled", "AbortError"));

		await expect(pending).rejects.toMatchObject({ name: "AbortError" });
		expect(waitForAbort).toHaveBeenCalledTimes(2);
	});
});
