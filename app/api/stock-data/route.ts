import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { logger } from "@/lib/observability/logger";
import { finishRequestLog, getRequestHeaders, startRequestLog } from "@/lib/observability/request";
import { stockDataQuerySchema } from "@/lib/schemas/api";
import {
	FixedWindowRateLimiter,
	getClientIp,
	getRateLimitHeaders,
} from "@/lib/security/request-rate-limit";
import { type StockDataProvider, StockDataService } from "@/lib/server/stock-data";

export const runtime = "nodejs";
export const maxDuration = 30;

const yahooFinance = new YahooFinance({
	suppressNotices: ["yahooSurvey"],
	versionCheck: false,
	queue: { concurrency: 4 },
});

const yahooProvider: StockDataProvider = {
	name: "yahoo",
	quote: (symbol, signal) =>
		yahooFinance.quote(symbol, undefined, {
			fetchOptions: { signal },
		}),
	quoteSummary: (symbol, signal) =>
		yahooFinance.quoteSummary(
			symbol,
			{
				modules: [
					"price",
					"defaultKeyStatistics",
					"financialData",
					"summaryDetail",
					"assetProfile",
				],
			},
			{ fetchOptions: { signal } },
		),
};

const stockDataService = new StockDataService(yahooProvider);
const stockDataRateLimiter = new FixedWindowRateLimiter({ limit: 120, windowMs: 60_000 });

export async function GET(request: Request) {
	const requestLog = startRequestLog(request, "/api/stock-data");
	const { searchParams } = new URL(request.url);
	const parsed = stockDataQuerySchema.safeParse({
		symbol: searchParams.get("symbol"),
	});

	if (!parsed.success) {
		finishRequestLog(requestLog, 400);
		return NextResponse.json(
			{ error: "Symbol is required" },
			{ status: 400, headers: getRequestHeaders(requestLog) },
		);
	}

	const { symbol } = parsed.data;
	const rateLimit = stockDataRateLimiter.check(getClientIp(request));
	const sharedHeaders = {
		"Cache-Control": "private, no-store",
		...getRequestHeaders(requestLog),
		...getRateLimitHeaders(rateLimit),
	};

	if (!rateLimit.allowed) {
		finishRequestLog(requestLog, 429, { symbol });
		return NextResponse.json(
			{ error: "Too many stock data requests" },
			{ status: 429, headers: sharedHeaders },
		);
	}

	try {
		const result = await stockDataService.load(symbol, {
			requestId: requestLog.requestId,
			signal: request.signal,
		});
		const responseHeaders = {
			...sharedHeaders,
			"X-Indus-Cache": result.cacheStatus,
			"X-Indus-Provider": result.provider,
			"X-Indus-Degraded": String(result.degraded || result.cacheStatus === "stale"),
		};
		finishRequestLog(requestLog, 200, {
			symbol,
			provider: result.provider,
			cacheStatus: result.cacheStatus,
			degraded: result.degraded || result.cacheStatus === "stale",
		});
		return NextResponse.json(
			{
				data: result.data,
				meta: {
					provider: result.provider,
					cacheStatus: result.cacheStatus,
					degraded: result.degraded || result.cacheStatus === "stale",
				},
			},
			{ headers: responseHeaders },
		);
	} catch (error) {
		logger.error("stock_data.request_failed", error, {
			requestId: requestLog.requestId,
			symbol,
		});
		finishRequestLog(requestLog, 502, { symbol });
		return NextResponse.json(
			{ error: `Failed to fetch data for ${symbol}` },
			{ status: 502, headers: sharedHeaders },
		);
	}
}
