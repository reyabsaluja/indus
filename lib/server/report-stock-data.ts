import YahooFinance from "yahoo-finance2";
import { logger } from "@/lib/observability/logger";
import { executeWithRetry } from "@/lib/reliability/async";
import { ResilientCache } from "@/lib/reliability/cache";
import type { ReportNewsSource, ReportStockData } from "@/lib/types";

interface ReportQuote {
	symbol: string;
	shortName?: string;
	longName?: string;
	regularMarketPrice?: number;
	regularMarketChange?: number;
	regularMarketChangePercent?: number;
	marketCap?: number;
}

interface ReportStockDataProvider {
	quote(symbol: string, signal?: AbortSignal): Promise<ReportQuote>;
	quoteSummary(
		symbol: string,
		options: { modules: string[] },
		signal?: AbortSignal,
	): Promise<{
		assetProfile?: { sector?: string; industry?: string };
		defaultKeyStatistics?: { beta?: number };
		financialData?: {
			revenueGrowth?: number;
			profitMargins?: number;
			returnOnEquity?: number;
			debtToEquity?: number;
		};
		summaryDetail?: {
			marketCap?: number;
			trailingPE?: number;
			fiftyTwoWeekLow?: number;
			fiftyTwoWeekHigh?: number;
		};
	}>;
	search?(
		symbol: string,
		options: { quotesCount: number; newsCount: number },
		signal?: AbortSignal,
	): Promise<{
		news: Array<{
			title: string;
			publisher: string;
			link: string;
			providerPublishTime: Date;
			relatedTickers?: string[];
		}>;
	}>;
}

const yahooFinance = new YahooFinance({
	suppressNotices: ["yahooSurvey"],
	versionCheck: false,
	queue: { concurrency: 4 },
});
const defaultProvider: ReportStockDataProvider = {
	quote: async (symbol, signal) =>
		(await yahooFinance.quote(symbol, undefined, {
			fetchOptions: { signal },
		})) as unknown as ReportQuote,
	quoteSummary: (symbol, options, signal) =>
		yahooFinance.quoteSummary(
			symbol,
			{
				modules: options.modules as (
					| "assetProfile"
					| "defaultKeyStatistics"
					| "financialData"
					| "summaryDetail"
				)[],
			},
			{ fetchOptions: { signal } },
		),
	search: (symbol, options, signal) =>
		yahooFinance.search(symbol, options, { fetchOptions: { signal } }),
};

const reportStockDataCache = new ResilientCache<ReportStockData>({
	freshForMs: 60_000,
	staleForMs: 15 * 60_000,
	maxEntries: 100,
});

interface ReportStockDataLoad {
	data: ReportStockData;
	degraded: boolean;
}

interface ReportStockDataOptions {
	provider?: ReportStockDataProvider;
	cache?: ResilientCache<ReportStockData>;
	requestId?: string;
	signal?: AbortSignal;
}

class PartialReportStockDataError extends Error {
	constructor(public readonly data: ReportStockData) {
		super("Yahoo returned partial report stock data");
		this.name = "PartialReportStockDataError";
	}
}

async function fetchReportStockData(
	symbol: string,
	provider: ReportStockDataProvider,
	requestId?: string,
	externalSignal?: AbortSignal,
): Promise<ReportStockDataLoad> {
	const search = provider.search;
	const newsRequest = search
		? executeWithRetry(({ signal }) => search(symbol, { quotesCount: 0, newsCount: 5 }, signal), {
				operation: "yahoo.report_news",
				attempts: 1,
				timeoutMs: 4_000,
				signal: externalSignal,
			})
		: Promise.resolve({ news: [] });
	const [quoteResult, summaryResult, newsResult] = await Promise.allSettled([
		executeWithRetry(({ signal }) => provider.quote(symbol, signal), {
			operation: "yahoo.report_quote",
			attempts: 2,
			timeoutMs: 6_000,
			signal: externalSignal,
			onRetry: (error, nextAttempt) => {
				logger.warn("provider.retry_scheduled", {
					requestId,
					provider: "yahoo",
					operation: "report_quote",
					symbol,
					nextAttempt,
					errorName: error instanceof Error ? error.name : "UnknownError",
					errorMessage: error instanceof Error ? error.message : String(error),
				});
			},
		}),
		executeWithRetry(
			({ signal }) =>
				provider.quoteSummary(
					symbol,
					{
						modules: ["defaultKeyStatistics", "financialData", "summaryDetail", "assetProfile"],
					},
					signal,
				),
			{
				operation: "yahoo.report_quote_summary",
				attempts: 2,
				timeoutMs: 6_000,
				signal: externalSignal,
				onRetry: (error, nextAttempt) => {
					logger.warn("provider.retry_scheduled", {
						requestId,
						provider: "yahoo",
						operation: "report_quote_summary",
						symbol,
						nextAttempt,
						errorName: error instanceof Error ? error.name : "UnknownError",
						errorMessage: error instanceof Error ? error.message : String(error),
					});
				},
			},
		),
		newsRequest,
	]);
	const quote = quoteResult.status === "fulfilled" ? quoteResult.value : null;
	const rawSummary = summaryResult.status === "fulfilled" ? summaryResult.value : null;
	const summary =
		rawSummary && Object.values(rawSummary).some((value) => value !== undefined && value !== null)
			? rawSummary
			: null;
	const recentNews =
		newsResult.status === "fulfilled"
			? normalizeRecentNews(newsResult.value?.news ?? [], symbol)
			: [];

	if (!quote && !summary && recentNews.length === 0) {
		throw new AggregateError(
			[
				quoteResult.status === "rejected" ? quoteResult.reason : null,
				summaryResult.status === "rejected" ? summaryResult.reason : null,
			].filter(Boolean),
			"Yahoo report stock data unavailable",
		);
	}

	const degraded = !quote || !summary || newsResult.status === "rejected";
	if (degraded) {
		logger.warn("report.stock_data_partial", {
			requestId,
			symbol,
			quoteAvailable: Boolean(quote),
			summaryAvailable: Boolean(summary),
			newsAvailable: newsResult.status === "fulfilled",
		});
	}

	return {
		degraded,
		data: {
			shortName: quote?.shortName,
			longName: quote?.longName,
			regularMarketPrice: quote?.regularMarketPrice,
			regularMarketChange: quote?.regularMarketChange,
			regularMarketChangePercent: quote?.regularMarketChangePercent,
			marketCap: quote?.marketCap ?? summary?.summaryDetail?.marketCap,
			peRatio: summary?.summaryDetail?.trailingPE,
			sector: summary?.assetProfile?.sector,
			industry: summary?.assetProfile?.industry,
			beta: summary?.defaultKeyStatistics?.beta,
			fiftyTwoWeekLow: summary?.summaryDetail?.fiftyTwoWeekLow,
			fiftyTwoWeekHigh: summary?.summaryDetail?.fiftyTwoWeekHigh,
			revenueGrowth: summary?.financialData?.revenueGrowth,
			netProfitMargins: summary?.financialData?.profitMargins,
			returnOnEquity: summary?.financialData?.returnOnEquity,
			debtToEquity: summary?.financialData?.debtToEquity,
			recentNews,
		},
	};
}

function normalizeRecentNews(
	articles: Array<{
		title: string;
		publisher: string;
		link: string;
		providerPublishTime: Date;
		relatedTickers?: string[];
	}>,
	symbol: string,
): ReportNewsSource[] {
	const now = Date.now();
	const oldestAllowed = now - 30 * 24 * 60 * 60 * 1_000;
	const seenUrls = new Set<string>();
	return articles
		.flatMap((article) => {
			const publishedAt = new Date(article.providerPublishTime);
			const publishedTime = publishedAt.getTime();
			const related = article.relatedTickers?.map((ticker) => ticker.toUpperCase());
			let url: URL;
			try {
				url = new URL(article.link);
			} catch {
				return [];
			}
			if (
				!article.title.trim() ||
				!article.publisher.trim() ||
				(url.protocol !== "http:" && url.protocol !== "https:") ||
				url.toString().length > 2_048 ||
				!Number.isFinite(publishedTime) ||
				publishedTime < oldestAllowed ||
				publishedTime > now + 5 * 60 * 1_000 ||
				(related && related.length > 0 && !related.includes(symbol.toUpperCase()))
			) {
				return [];
			}
			if (seenUrls.has(url.toString())) return [];
			seenUrls.add(url.toString());
			return [
				{
					headline: article.title.trim().slice(0, 300),
					publisher: article.publisher.trim().slice(0, 120),
					publishedAt: publishedAt.toISOString(),
					url: url.toString(),
				},
			];
		})
		.slice(0, 5);
}

export async function loadReportStockData(
	symbol: string,
	options: ReportStockDataOptions = {},
): Promise<ReportStockData | null> {
	const provider = options.provider ?? defaultProvider;
	try {
		const activeCache =
			options.cache ?? (provider === defaultProvider ? reportStockDataCache : null);
		if (!activeCache) {
			return (await fetchReportStockData(symbol, provider, options.requestId, options.signal)).data;
		}

		const result = await activeCache.getOrLoad(
			symbol,
			async (signal) => {
				const loaded = await fetchReportStockData(symbol, provider, options.requestId, signal);
				if (loaded.degraded) {
					throw new PartialReportStockDataError(loaded.data);
				}
				return loaded.data;
			},
			options.signal,
		);
		if (result.status === "stale") {
			logger.warn("report.stock_data_stale_cache_used", {
				requestId: options.requestId,
				symbol,
			});
		}
		return result.value;
	} catch (error) {
		if (options.signal?.aborted) {
			throw options.signal.reason ?? error;
		}
		if (error instanceof PartialReportStockDataError) {
			return error.data;
		}
		logger.warn("report.stock_data_unavailable", {
			requestId: options.requestId,
			symbol,
			errorMessage: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}
