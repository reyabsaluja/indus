import { describe, expect, it, vi } from "vitest";
import { ResilientCache } from "@/lib/reliability/cache";
import {
	type BarData,
	type MarketHistoryCacheValue,
	type MarketHistoryProvider,
	MarketHistoryService,
} from "@/lib/server/market-history";

const query = {
	symbol: "AAPL",
	type: "stock" as const,
	timeframe: "1Day" as const,
	limit: 100,
	startDate: new Date("2026-08-01T00:00:00.000Z"),
	endDate: new Date("2026-08-12T00:00:00.000Z"),
};
const bars: BarData[] = [
	{ time: 1, open: 10, high: 12, low: 9, close: 11, volume: 100 },
	{ time: 2, open: 11, high: 13, low: 10, close: 12, volume: 110 },
];

describe("MarketHistoryService", () => {
	it("uses the fallback provider when the primary is unavailable", async () => {
		const primary: MarketHistoryProvider = {
			name: "alpaca",
			load: vi.fn().mockRejectedValue(new Error("unavailable")),
		};
		const fallback: MarketHistoryProvider = {
			name: "yahoo",
			load: vi.fn().mockResolvedValue(bars),
		};
		const service = new MarketHistoryService(primary, fallback, { attempts: 1 });

		await expect(service.load(query)).resolves.toMatchObject({
			data: bars,
			provider: "yahoo",
			fallbackUsed: true,
			cacheStatus: "miss",
		});
	});

	it("serves stale history when both providers fail during refresh", async () => {
		let now = 1_000;
		const primaryLoad = vi.fn().mockResolvedValueOnce(bars);
		const fallbackLoad = vi.fn().mockRejectedValue(new Error("fallback unavailable"));
		const cache = new ResilientCache<MarketHistoryCacheValue>({
			freshForMs: 100,
			staleForMs: 500,
			now: () => now,
		});
		const service = new MarketHistoryService(
			{ name: "alpaca", load: primaryLoad },
			{ name: "yahoo", load: fallbackLoad },
			{ attempts: 1, cache },
		);

		await service.load(query);
		now += 150;
		primaryLoad.mockRejectedValue(new Error("primary unavailable"));

		await expect(service.load(query)).resolves.toMatchObject({
			data: bars,
			provider: "alpaca",
			cacheStatus: "stale",
		});
	});

	it("deduplicates equivalent current-window requests with slightly different timestamps", async () => {
		const primaryLoad = vi.fn().mockResolvedValue(bars);
		const service = new MarketHistoryService(
			{ name: "alpaca", load: primaryLoad },
			{ name: "yahoo", load: vi.fn() },
			{ attempts: 1 },
		);
		const shiftedQuery = {
			...query,
			startDate: new Date(query.startDate.getTime() + 10_000),
			endDate: new Date(query.endDate.getTime() + 10_000),
		};

		await expect(service.load(query)).resolves.toMatchObject({ cacheStatus: "miss" });
		await expect(service.load(shiftedQuery)).resolves.toMatchObject({ cacheStatus: "hit" });
		expect(primaryLoad).toHaveBeenCalledTimes(1);
	});

	it("preserves an empty success response when both providers have no bars", async () => {
		const service = new MarketHistoryService(
			{ name: "alpaca", load: vi.fn().mockResolvedValue([]) },
			{ name: "yahoo", load: vi.fn().mockResolvedValue([]) },
			{ attempts: 1 },
		);

		await expect(service.load(query)).resolves.toMatchObject({
			data: [],
			provider: "yahoo",
			fallbackUsed: true,
			cacheStatus: "miss",
		});
	});

	it("does not call the fallback when a limit-one request has one primary bar", async () => {
		const primaryLoad = vi.fn().mockResolvedValue([bars[0]]);
		const fallbackLoad = vi.fn().mockResolvedValue([]);
		const service = new MarketHistoryService(
			{ name: "alpaca", load: primaryLoad },
			{ name: "yahoo", load: fallbackLoad },
			{ attempts: 1 },
		);

		await expect(service.load({ ...query, limit: 1 })).resolves.toMatchObject({
			data: [bars[0]],
			provider: "alpaca",
			fallbackUsed: false,
		});
		expect(fallbackLoad).not.toHaveBeenCalled();
	});

	it("keeps a better primary partial result when the fallback returns fewer bars", async () => {
		const service = new MarketHistoryService(
			{ name: "alpaca", load: vi.fn().mockResolvedValue([bars[0]]) },
			{ name: "yahoo", load: vi.fn().mockResolvedValue([]) },
			{ attempts: 1 },
		);

		await expect(service.load({ ...query, limit: 2 })).resolves.toMatchObject({
			data: [bars[0]],
			provider: "alpaca",
			fallbackUsed: true,
			cacheStatus: "miss",
		});
	});

	it("prefers stale complete history over a newly empty provider response", async () => {
		let now = 1_000;
		const primaryLoad = vi.fn().mockResolvedValueOnce(bars).mockResolvedValue([]);
		const fallbackLoad = vi.fn().mockResolvedValue([]);
		const cache = new ResilientCache<MarketHistoryCacheValue>({
			freshForMs: 100,
			staleForMs: 500,
			now: () => now,
		});
		const service = new MarketHistoryService(
			{ name: "alpaca", load: primaryLoad },
			{ name: "yahoo", load: fallbackLoad },
			{ attempts: 1, cache },
		);

		await service.load(query);
		now += 150;

		await expect(service.load(query)).resolves.toMatchObject({
			data: bars,
			provider: "alpaca",
			cacheStatus: "stale",
		});
	});

	it("stops provider work when the requesting client disconnects", async () => {
		const caller = new AbortController();
		const primaryLoad = vi.fn(
			(_query, signal: AbortSignal) =>
				new Promise<BarData[]>((_, reject) => {
					signal.addEventListener("abort", () => reject(signal.reason), { once: true });
				}),
		);
		const fallbackLoad = vi.fn().mockResolvedValue(bars);
		const service = new MarketHistoryService(
			{ name: "alpaca", load: primaryLoad },
			{ name: "yahoo", load: fallbackLoad },
			{ attempts: 2 },
		);

		const pending = service.load({ ...query, signal: caller.signal });
		caller.abort(new DOMException("Request cancelled", "AbortError"));

		await expect(pending).rejects.toMatchObject({ name: "AbortError" });
		expect(primaryLoad).toHaveBeenCalledTimes(1);
		expect(fallbackLoad).not.toHaveBeenCalled();
	});
});
