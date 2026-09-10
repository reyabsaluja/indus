import { logger } from "@/lib/observability/logger";
import { executeWithRetry } from "@/lib/reliability/async";
import { type CacheStatus, ResilientCache } from "@/lib/reliability/cache";

type MaybeString = string | null;
type MaybeNumber = number | null;

interface StockQuote {
	quoteType?: MaybeString;
	shortName?: MaybeString;
	displayName?: MaybeString;
	longName?: MaybeString;
	currency?: MaybeString;
	regularMarketPrice?: MaybeNumber;
	regularMarketChange?: MaybeNumber;
	regularMarketChangePercent?: MaybeNumber;
	regularMarketVolume?: MaybeNumber;
	marketCap?: MaybeNumber;
	circulatingSupply?: MaybeNumber;
	volume24Hr?: MaybeNumber;
	fiftyTwoWeekHigh?: MaybeNumber;
	fiftyTwoWeekLow?: MaybeNumber;
	fiftyTwoWeekHighChangePercent?: MaybeNumber;
	fiftyTwoWeekLowChangePercent?: MaybeNumber;
}

interface StockSummary {
	price?: {
		shortName?: MaybeString;
		longName?: MaybeString;
		currency?: MaybeString;
		regularMarketPrice?: MaybeNumber;
		regularMarketChange?: MaybeNumber;
		regularMarketChangePercent?: MaybeNumber;
		regularMarketVolume?: MaybeNumber;
		marketCap?: MaybeNumber;
		quoteType?: MaybeString;
	};
	assetProfile?: {
		description?: MaybeString;
		website?: MaybeString;
		sector?: MaybeString;
		industry?: MaybeString;
		country?: MaybeString;
		city?: MaybeString;
		state?: MaybeString;
		fullTimeEmployees?: MaybeNumber;
	};
	defaultKeyStatistics?: {
		enterpriseValue?: MaybeNumber;
		sharesOutstanding?: MaybeNumber;
		priceToBook?: MaybeNumber;
		enterpriseToRevenue?: MaybeNumber;
		enterpriseToEbitda?: MaybeNumber;
		forwardPE?: MaybeNumber;
		pegRatio?: MaybeNumber;
		beta?: MaybeNumber;
		bookValue?: MaybeNumber;
		trailingEps?: MaybeNumber;
		forwardEps?: MaybeNumber;
	};
	financialData?: {
		totalRevenue?: MaybeNumber;
		grossMargins?: MaybeNumber;
		ebitdaMargins?: MaybeNumber;
		operatingMargins?: MaybeNumber;
		profitMargins?: MaybeNumber;
		returnOnAssets?: MaybeNumber;
		returnOnEquity?: MaybeNumber;
		totalCash?: MaybeNumber;
		totalDebt?: MaybeNumber;
		debtToEquity?: MaybeNumber;
		currentRatio?: MaybeNumber;
		quickRatio?: MaybeNumber;
		revenueGrowth?: MaybeNumber;
		earningsGrowth?: MaybeNumber;
		recommendationKey?: MaybeString;
		recommendationMean?: MaybeNumber;
		targetMeanPrice?: MaybeNumber;
		targetHighPrice?: MaybeNumber;
		targetLowPrice?: MaybeNumber;
	};
	summaryDetail?: {
		marketCap?: MaybeNumber;
		algorithm?: MaybeString;
		trailingPE?: MaybeNumber;
		dividendYield?: MaybeNumber;
		trailingAnnualDividendYield?: MaybeNumber;
		dividendRate?: MaybeNumber;
		payoutRatio?: MaybeNumber;
		volume?: MaybeNumber;
		averageVolume?: MaybeNumber;
		fiftyTwoWeekHigh?: MaybeNumber;
		fiftyTwoWeekLow?: MaybeNumber;
	};
}

export interface StockDataProvider {
	name: string;
	quote(symbol: string, signal: AbortSignal): Promise<StockQuote>;
	quoteSummary(symbol: string, signal: AbortSignal): Promise<StockSummary>;
}

function buildStockData(
	symbol: string,
	quote: StockQuote | null,
	quoteSummary: StockSummary | null,
) {
	const summaryPrice = quoteSummary?.price;
	const currentPrice = quote?.regularMarketPrice ?? summaryPrice?.regularMarketPrice ?? 0;
	const change = quote?.regularMarketChange ?? summaryPrice?.regularMarketChange ?? 0;
	const changePercent =
		quote?.regularMarketChangePercent ?? summaryPrice?.regularMarketChangePercent ?? 0;
	const shortName =
		quote?.shortName ??
		quote?.displayName ??
		summaryPrice?.shortName ??
		summaryPrice?.longName ??
		symbol;
	const longName = quote?.longName ?? summaryPrice?.longName ?? shortName;
	const isCrypto =
		quote?.quoteType === "CRYPTOCURRENCY" ||
		summaryPrice?.quoteType === "CRYPTOCURRENCY" ||
		symbol.includes("-USD") ||
		symbol.includes("-USDT") ||
		symbol.includes("-BTC");

	return {
		symbol: symbol.toUpperCase(),
		shortName,
		longName,
		regularMarketPrice: currentPrice,
		regularMarketChange: change,
		regularMarketChangePercent: changePercent,
		currency: quote?.currency ?? summaryPrice?.currency ?? "USD",
		longBusinessSummary: quoteSummary?.assetProfile?.description ?? null,
		website: quoteSummary?.assetProfile?.website ?? null,
		sector: quoteSummary?.assetProfile?.sector ?? null,
		industry: quoteSummary?.assetProfile?.industry ?? null,
		country: quoteSummary?.assetProfile?.country ?? "US",
		city: quoteSummary?.assetProfile?.city ?? null,
		state: quoteSummary?.assetProfile?.state ?? null,
		marketCap:
			quote?.marketCap ?? summaryPrice?.marketCap ?? quoteSummary?.summaryDetail?.marketCap ?? null,
		enterpriseValue: quoteSummary?.defaultKeyStatistics?.enterpriseValue ?? null,
		sharesOutstanding: quoteSummary?.defaultKeyStatistics?.sharesOutstanding ?? null,
		revenue: quoteSummary?.financialData?.totalRevenue ?? null,
		employees: quoteSummary?.assetProfile?.fullTimeEmployees ?? null,
		circulatingSupply: quote?.circulatingSupply ?? null,
		totalSupply: null,
		maxSupply: null,
		volume24h:
			quote?.volume24Hr ?? quote?.regularMarketVolume ?? summaryPrice?.regularMarketVolume ?? 0,
		percentChange24h: changePercent,
		percentChange7d: null,
		percentChange30d: null,
		allTimeHigh: quote?.fiftyTwoWeekHigh ?? quoteSummary?.summaryDetail?.fiftyTwoWeekHigh ?? null,
		allTimeLow: quote?.fiftyTwoWeekLow ?? quoteSummary?.summaryDetail?.fiftyTwoWeekLow ?? null,
		ath24hChange: quote?.fiftyTwoWeekHighChangePercent ?? null,
		atl24hChange: quote?.fiftyTwoWeekLowChangePercent ?? null,
		rank: null,
		dominance: null,
		algorithm: quoteSummary?.summaryDetail?.algorithm ?? null,
		category: isCrypto ? "Cryptocurrency" : null,
		tradingPairs: null,
		githubActivity: null,
		communityScore: null,
		developerScore: null,
		liquidityScore: null,
		volatility: null,
		sharpeRatio: null,
		peRatio: isCrypto ? null : (quoteSummary?.summaryDetail?.trailingPE ?? null),
		priceToBook: isCrypto ? null : (quoteSummary?.defaultKeyStatistics?.priceToBook ?? null),
		evToSales: isCrypto ? null : (quoteSummary?.defaultKeyStatistics?.enterpriseToRevenue ?? null),
		evToEbitda: isCrypto ? null : (quoteSummary?.defaultKeyStatistics?.enterpriseToEbitda ?? null),
		priceToCashFlow: null,
		evToGrossProfit: null,
		forwardPE: isCrypto ? null : (quoteSummary?.defaultKeyStatistics?.forwardPE ?? null),
		pegRatio: isCrypto ? null : (quoteSummary?.defaultKeyStatistics?.pegRatio ?? null),
		grossMargins: isCrypto ? null : (quoteSummary?.financialData?.grossMargins ?? null),
		ebitdaMargins: isCrypto ? null : (quoteSummary?.financialData?.ebitdaMargins ?? null),
		operatingMargins: isCrypto ? null : (quoteSummary?.financialData?.operatingMargins ?? null),
		pretaxMargins: null,
		netProfitMargins: isCrypto ? null : (quoteSummary?.financialData?.profitMargins ?? null),
		freeCashflowMargin: null,
		returnOnAssets: isCrypto ? null : (quoteSummary?.financialData?.returnOnAssets ?? null),
		returnOnEquity: isCrypto ? null : (quoteSummary?.financialData?.returnOnEquity ?? null),
		totalCash: isCrypto ? null : (quoteSummary?.financialData?.totalCash ?? null),
		totalDebt: isCrypto ? null : (quoteSummary?.financialData?.totalDebt ?? null),
		debtToEquity: isCrypto ? null : (quoteSummary?.financialData?.debtToEquity ?? null),
		currentRatio: isCrypto ? null : (quoteSummary?.financialData?.currentRatio ?? null),
		quickRatio: isCrypto ? null : (quoteSummary?.financialData?.quickRatio ?? null),
		revenueGrowth: isCrypto ? null : (quoteSummary?.financialData?.revenueGrowth ?? null),
		earningsGrowth: isCrypto ? null : (quoteSummary?.financialData?.earningsGrowth ?? null),
		dividendYield: isCrypto ? null : (quoteSummary?.summaryDetail?.dividendYield ?? null),
		trailingAnnualDividendYield: isCrypto
			? null
			: (quoteSummary?.summaryDetail?.trailingAnnualDividendYield ?? null),
		dividendRate: isCrypto ? null : (quoteSummary?.summaryDetail?.dividendRate ?? null),
		payoutRatio: isCrypto ? null : (quoteSummary?.summaryDetail?.payoutRatio ?? null),
		volume:
			quote?.regularMarketVolume ??
			summaryPrice?.regularMarketVolume ??
			quoteSummary?.summaryDetail?.volume ??
			0,
		avgVolume: quoteSummary?.summaryDetail?.averageVolume ?? 0,
		beta: isCrypto ? null : (quoteSummary?.defaultKeyStatistics?.beta ?? null),
		bookValue: isCrypto ? null : (quoteSummary?.defaultKeyStatistics?.bookValue ?? null),
		priceToSales: null,
		recommendationKey: isCrypto ? null : (quoteSummary?.financialData?.recommendationKey ?? null),
		recommendationMean: isCrypto ? null : (quoteSummary?.financialData?.recommendationMean ?? null),
		targetMeanPrice: isCrypto ? null : (quoteSummary?.financialData?.targetMeanPrice ?? null),
		targetHighPrice: isCrypto ? null : (quoteSummary?.financialData?.targetHighPrice ?? null),
		targetLowPrice: isCrypto ? null : (quoteSummary?.financialData?.targetLowPrice ?? null),
		fiftyTwoWeekHigh:
			quote?.fiftyTwoWeekHigh ?? quoteSummary?.summaryDetail?.fiftyTwoWeekHigh ?? null,
		fiftyTwoWeekLow: quote?.fiftyTwoWeekLow ?? quoteSummary?.summaryDetail?.fiftyTwoWeekLow ?? null,
		trailingEps: isCrypto ? null : (quoteSummary?.defaultKeyStatistics?.trailingEps ?? null),
		forwardEps: isCrypto ? null : (quoteSummary?.defaultKeyStatistics?.forwardEps ?? null),
		fromYahooFinance: Boolean(quote || quoteSummary),
		isCrypto,
		timestamp: new Date().toISOString(),
	};
}

type StockData = ReturnType<typeof buildStockData>;

export interface StockDataCacheValue {
	data: StockData;
	provider: string;
	degraded: boolean;
}

export interface StockDataResult extends StockDataCacheValue {
	cacheStatus: CacheStatus;
}

interface StockDataServiceOptions {
	attempts?: number;
	timeoutMs?: number;
	cache?: ResilientCache<StockDataCacheValue>;
}

export interface StockDataRequestContext {
	requestId?: string;
	signal?: AbortSignal;
}

class PartialStockDataError extends Error {
	constructor(public readonly value: StockDataCacheValue) {
		super(`${value.provider} returned partial stock data`);
		this.name = "PartialStockDataError";
	}
}

export class StockDataService {
	private readonly attempts: number;
	private readonly timeoutMs: number;
	private readonly cache: ResilientCache<StockDataCacheValue>;

	constructor(
		private readonly provider: StockDataProvider,
		options: StockDataServiceOptions = {},
	) {
		this.attempts = options.attempts ?? 2;
		this.timeoutMs = options.timeoutMs ?? 6_000;
		this.cache =
			options.cache ??
			new ResilientCache<StockDataCacheValue>({
				freshForMs: 60_000,
				staleForMs: 15 * 60_000,
				maxEntries: 300,
			});
	}

	async load(symbol: string, context: StockDataRequestContext = {}): Promise<StockDataResult> {
		try {
			const result = await this.cache.getOrLoad(
				symbol,
				async (signal) => {
					const [quoteResult, summaryResult] = await Promise.allSettled([
						this.loadPart("quote", symbol, context, signal, (attemptSignal) =>
							this.provider.quote(symbol, attemptSignal),
						),
						this.loadPart("quote_summary", symbol, context, signal, (attemptSignal) =>
							this.provider.quoteSummary(symbol, attemptSignal),
						),
					]);
					const quote = quoteResult.status === "fulfilled" ? quoteResult.value : null;
					const rawSummary = summaryResult.status === "fulfilled" ? summaryResult.value : null;
					const summary =
						rawSummary &&
						Object.values(rawSummary).some((value) => value !== undefined && value !== null)
							? rawSummary
							: null;

					if (!quote && !summary) {
						throw new AggregateError(
							[
								quoteResult.status === "rejected" ? quoteResult.reason : null,
								summaryResult.status === "rejected" ? summaryResult.reason : null,
							].filter(Boolean),
							`${this.provider.name} stock data unavailable`,
						);
					}

					const value = {
						data: buildStockData(symbol, quote, summary),
						provider: this.provider.name,
						degraded: !quote || !summary,
					};
					if (value.degraded) {
						logger.warn("stock_data.partial_provider_response", {
							requestId: context.requestId,
							symbol,
							provider: this.provider.name,
							quoteAvailable: Boolean(quote),
							summaryAvailable: Boolean(summary),
						});
						throw new PartialStockDataError(value);
					}

					return value;
				},
				context.signal,
			);

			if (result.status === "stale") {
				logger.warn("stock_data.stale_cache_used", {
					requestId: context.requestId,
					symbol,
					provider: result.value.provider,
				});
			}

			return { ...result.value, cacheStatus: result.status };
		} catch (error) {
			if (error instanceof PartialStockDataError) {
				return { ...error.value, cacheStatus: "miss" };
			}
			throw error;
		}
	}

	private loadPart<T>(
		operation: string,
		symbol: string,
		context: StockDataRequestContext,
		externalSignal: AbortSignal,
		load: (signal: AbortSignal) => Promise<T>,
	): Promise<T> {
		return executeWithRetry(({ signal }) => load(signal), {
			operation: `${this.provider.name}.${operation}`,
			attempts: this.attempts,
			timeoutMs: this.timeoutMs,
			signal: externalSignal,
			onRetry: (error, nextAttempt) => {
				logger.warn("provider.retry_scheduled", {
					requestId: context.requestId,
					provider: this.provider.name,
					operation,
					symbol,
					nextAttempt,
					errorName: error instanceof Error ? error.name : "UnknownError",
					errorMessage: error instanceof Error ? error.message : String(error),
				});
			},
		});
	}
}
