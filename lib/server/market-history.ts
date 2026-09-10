import { logger } from "@/lib/observability/logger";
import { executeWithRetry } from "@/lib/reliability/async";
import { type CacheStatus, ResilientCache } from "@/lib/reliability/cache";

export type MarketHistoryTimeframe =
	| "1Min"
	| "5Min"
	| "15Min"
	| "1Hour"
	| "1Day"
	| "1Week"
	| "1Month";

export interface MarketHistoryQuery {
	symbol: string;
	type: "stock" | "crypto";
	timeframe: MarketHistoryTimeframe;
	limit: number;
	startDate: Date;
	endDate: Date;
	requestId?: string;
	signal?: AbortSignal;
}

export interface BarData {
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}

export interface MarketHistoryProvider {
	name: string;
	load(query: MarketHistoryQuery, signal: AbortSignal): Promise<BarData[]>;
}

export interface MarketHistoryCacheValue {
	data: BarData[];
	provider: string;
	fallbackUsed: boolean;
}

export interface MarketHistoryResult extends MarketHistoryCacheValue {
	cacheStatus: CacheStatus;
}

interface MarketHistoryServiceOptions {
	attempts?: number;
	timeoutMs?: number;
	cache?: ResilientCache<MarketHistoryCacheValue>;
}

const CACHE_KEY_BUCKET_MS = 30_000;

function bucketTimestamp(date: Date): number {
	return Math.floor(date.getTime() / CACHE_KEY_BUCKET_MS);
}

function cacheKey(query: MarketHistoryQuery): string {
	return [
		query.symbol,
		query.type,
		query.timeframe,
		query.limit,
		bucketTimestamp(query.startDate),
		bucketTimestamp(query.endDate),
	].join(":");
}

function minimumBarCount(query: MarketHistoryQuery): number {
	return Math.min(2, query.limit);
}

class InsufficientHistoryError extends Error {
	constructor(public readonly value: MarketHistoryCacheValue) {
		super(`${value.provider} returned insufficient history`);
		this.name = "InsufficientHistoryError";
	}
}

export class MarketHistoryService {
	private readonly attempts: number;
	private readonly timeoutMs: number;
	private readonly cache: ResilientCache<MarketHistoryCacheValue>;

	constructor(
		private readonly primary: MarketHistoryProvider,
		private readonly fallback: MarketHistoryProvider,
		options: MarketHistoryServiceOptions = {},
	) {
		this.attempts = options.attempts ?? 2;
		this.timeoutMs = options.timeoutMs ?? 6_000;
		this.cache =
			options.cache ??
			new ResilientCache<MarketHistoryCacheValue>({
				freshForMs: 30_000,
				staleForMs: 15 * 60_000,
				maxEntries: 300,
			});
	}

	async load(query: MarketHistoryQuery): Promise<MarketHistoryResult> {
		try {
			const result = await this.cache.getOrLoad(
				cacheKey(query),
				async (signal) => {
					const minimumBars = minimumBarCount(query);
					let primaryData: BarData[] | null = null;
					try {
						primaryData = await this.loadFrom(this.primary, query, signal);
						if (primaryData.length >= minimumBars) {
							return { data: primaryData, provider: this.primary.name, fallbackUsed: false };
						}
					} catch (primaryError) {
						if (signal.aborted) throw primaryError;
						logger.warn("market_history.fallback_started", {
							requestId: query.requestId,
							symbol: query.symbol,
							timeframe: query.timeframe,
							primaryProvider: this.primary.name,
							fallbackProvider: this.fallback.name,
							errorName: primaryError instanceof Error ? primaryError.name : "UnknownError",
							errorMessage:
								primaryError instanceof Error ? primaryError.message : String(primaryError),
						});
					}

					try {
						const data = await this.loadFrom(this.fallback, query, signal);
						if (data.length < minimumBars) {
							const bestPartial =
								primaryData !== null && primaryData.length > data.length
									? { data: primaryData, provider: this.primary.name }
									: { data, provider: this.fallback.name };
							logger.warn("market_history.insufficient_data", {
								requestId: query.requestId,
								symbol: query.symbol,
								timeframe: query.timeframe,
								primaryBarCount: primaryData?.length ?? null,
								fallbackBarCount: data.length,
								selectedProvider: bestPartial.provider,
							});
							throw new InsufficientHistoryError({
								...bestPartial,
								fallbackUsed: true,
							});
						}

						return { data, provider: this.fallback.name, fallbackUsed: true };
					} catch (fallbackError) {
						if (signal.aborted) throw fallbackError;
						if (fallbackError instanceof InsufficientHistoryError) {
							throw fallbackError;
						}
						if (primaryData) {
							logger.warn("market_history.primary_partial_used", {
								requestId: query.requestId,
								symbol: query.symbol,
								timeframe: query.timeframe,
								barCount: primaryData.length,
								fallbackProvider: this.fallback.name,
								errorName: fallbackError instanceof Error ? fallbackError.name : "UnknownError",
								errorMessage:
									fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
							});
							throw new InsufficientHistoryError({
								data: primaryData,
								provider: this.primary.name,
								fallbackUsed: true,
							});
						}
						throw fallbackError;
					}
				},
				query.signal,
			);

			if (result.status === "stale") {
				logger.warn("market_history.stale_cache_used", {
					requestId: query.requestId,
					symbol: query.symbol,
					timeframe: query.timeframe,
					provider: result.value.provider,
				});
			}

			return { ...result.value, cacheStatus: result.status };
		} catch (error) {
			if (error instanceof InsufficientHistoryError) {
				return { ...error.value, cacheStatus: "miss" };
			}
			throw error;
		}
	}

	private loadFrom(
		provider: MarketHistoryProvider,
		query: MarketHistoryQuery,
		externalSignal: AbortSignal,
	): Promise<BarData[]> {
		return executeWithRetry(({ signal }) => provider.load(query, signal), {
			operation: `${provider.name}.history`,
			attempts: this.attempts,
			timeoutMs: this.timeoutMs,
			signal: externalSignal,
			onRetry: (error, nextAttempt) => {
				logger.warn("provider.retry_scheduled", {
					requestId: query.requestId,
					provider: provider.name,
					operation: "history",
					symbol: query.symbol,
					nextAttempt,
					errorName: error instanceof Error ? error.name : "UnknownError",
					errorMessage: error instanceof Error ? error.message : String(error),
				});
			},
		});
	}
}
