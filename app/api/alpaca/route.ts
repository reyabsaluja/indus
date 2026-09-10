import { Alpaca, TimeFrame, TimeFrameUnit, timeFrame } from "@alpacahq/alpaca-trade-api";
import { type NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { env } from "@/lib/env";
import { logger } from "@/lib/observability/logger";
import { finishRequestLog, getRequestHeaders, startRequestLog } from "@/lib/observability/request";
import { alpacaQuerySchema } from "@/lib/schemas/api";
import {
	FixedWindowRateLimiter,
	getClientIp,
	getRateLimitHeaders,
} from "@/lib/security/request-rate-limit";
import {
	type BarData,
	type MarketHistoryProvider,
	MarketHistoryService,
	type MarketHistoryTimeframe,
} from "@/lib/server/market-history";

export const runtime = "nodejs";
export const maxDuration = 30;

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const CURRENT_WINDOW_MS = 30_000;
const RANGE_DAYS_BY_TIMEFRAME = {
	"1Min": 5,
	"5Min": 14,
	"15Min": 45,
	"1Hour": 180,
	"1Day": 4 * 365,
	"1Week": 20 * 365,
	"1Month": 20 * 365,
} as const;

function getStartDate(timeframe: MarketHistoryTimeframe, endDate: Date): Date {
	return new Date(endDate.getTime() - RANGE_DAYS_BY_TIMEFRAME[timeframe] * DAY_IN_MS);
}

function toAlpacaTimeframe(timeframe: MarketHistoryTimeframe) {
	switch (timeframe) {
		case "1Min":
			return TimeFrame.Minute;
		case "5Min":
			return timeFrame(5, TimeFrameUnit.Minute);
		case "15Min":
			return timeFrame(15, TimeFrameUnit.Minute);
		case "1Hour":
			return TimeFrame.Hour;
		case "1Day":
			return TimeFrame.Day;
		case "1Week":
			return TimeFrame.Week;
		case "1Month":
			return TimeFrame.Month;
	}
}

function toYahooTimeframe(
	timeframe: MarketHistoryTimeframe,
): "1m" | "5m" | "15m" | "1h" | "1d" | "1wk" | "1mo" {
	switch (timeframe) {
		case "1Min":
			return "1m";
		case "5Min":
			return "5m";
		case "15Min":
			return "15m";
		case "1Hour":
			return "1h";
		case "1Day":
			return "1d";
		case "1Week":
			return "1wk";
		case "1Month":
			return "1mo";
	}
}

const alpaca = new Alpaca({
	keyId: env.ALPACA_API_KEY,
	secret: env.ALPACA_SECRET_KEY,
	paper: env.ALPACA_IS_PAPER,
	timeoutMs: 5_500,
	retry: false,
});
const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"], versionCheck: false });

const alpacaProvider: MarketHistoryProvider = {
	name: "alpaca",
	async load(query) {
		const request = {
			start: query.startDate,
			end: query.endDate,
			timeframe: toAlpacaTimeframe(query.timeframe),
			limit: query.limit,
		};
		const bars =
			query.type === "crypto"
				? await alpaca.marketData.getCryptoBarsFor(
						query.symbol,
						{ ...request, loc: "us" },
						{ maxPerSymbol: query.limit },
					)
				: await alpaca.marketData.getStockBarsFor(
						query.symbol,
						{ ...request, feed: "iex", adjustment: "split" },
						{ maxPerSymbol: query.limit },
					);

		return Array.from(
			bars,
			(bar): BarData => ({
				time: Math.floor(bar.timestamp.getTime() / 1000),
				open: bar.open,
				high: bar.high,
				low: bar.low,
				close: bar.close,
				volume: bar.volume,
			}),
		).sort((a, b) => a.time - b.time);
	},
};

const yahooProvider: MarketHistoryProvider = {
	name: "yahoo",
	async load(query, signal) {
		const symbol = query.type === "crypto" ? query.symbol.replace("/", "-") : query.symbol;
		const result = await yahooFinance.chart(
			symbol,
			{
				period1: query.startDate,
				period2: query.endDate,
				interval: toYahooTimeframe(query.timeframe),
				includePrePost: false,
			},
			{ fetchOptions: { signal } },
		);

		return result.quotes
			.filter(
				(quote) =>
					quote.open !== null && quote.high !== null && quote.low !== null && quote.close !== null,
			)
			.map((quote) => ({
				time: Math.floor(quote.date.getTime() / 1000),
				open: quote.open as number,
				high: quote.high as number,
				low: quote.low as number,
				close: quote.close as number,
				volume: quote.volume ?? 0,
			}))
			.slice(-query.limit);
	},
};

const historyService = new MarketHistoryService(alpacaProvider, yahooProvider);
const historyRateLimiter = new FixedWindowRateLimiter({ limit: 90, windowMs: 60_000 });

export async function GET(request: NextRequest) {
	const requestLog = startRequestLog(request, "/api/alpaca");
	const { searchParams } = new URL(request.url);
	const parsed = alpacaQuerySchema.safeParse({
		symbol: searchParams.get("symbol"),
		type: searchParams.get("type") ?? undefined,
		timeframe: searchParams.get("timeframe") ?? undefined,
		limit: searchParams.get("limit") ?? undefined,
		start: searchParams.get("start") ?? undefined,
		end: searchParams.get("end") ?? undefined,
	});

	if (!parsed.success) {
		finishRequestLog(requestLog, 400);
		return NextResponse.json(
			{ error: "Invalid query parameters", details: parsed.error.issues },
			{ status: 400, headers: getRequestHeaders(requestLog) },
		);
	}

	const { symbol, type, timeframe, limit } = parsed.data;
	const startParam = parsed.data.start;
	const endParam = parsed.data.end;
	const rateLimit = historyRateLimiter.check(getClientIp(request));
	const sharedHeaders = {
		"Cache-Control": "private, no-store",
		...getRequestHeaders(requestLog),
		...getRateLimitHeaders(rateLimit),
	};
	if (!rateLimit.allowed) {
		finishRequestLog(requestLog, 429, { symbol, timeframe, type });
		return NextResponse.json(
			{ error: "Too many market history requests" },
			{ status: 429, headers: sharedHeaders },
		);
	}

	try {
		const endDate: Date = endParam
			? new Date(endParam * 1000)
			: new Date(Math.floor(Date.now() / CURRENT_WINDOW_MS) * CURRENT_WINDOW_MS);
		const startDate = startParam ? new Date(startParam * 1000) : getStartDate(timeframe, endDate);
		const result = await historyService.load({
			symbol,
			type,
			timeframe,
			limit,
			startDate,
			endDate,
			requestId: requestLog.requestId,
			signal: request.signal,
		});
		const sortedData = result.data;
		const responseHeaders = {
			...sharedHeaders,
			"X-Indus-Cache": result.cacheStatus,
			"X-Indus-Provider": result.provider,
		};
		finishRequestLog(requestLog, 200, {
			symbol,
			timeframe,
			type,
			provider: result.provider,
			cacheStatus: result.cacheStatus,
			fallbackUsed: result.fallbackUsed,
			barCount: sortedData.length,
		});
		return NextResponse.json(
			{
				data: sortedData,
				isEmpty: sortedData.length < 2,
				symbol: symbol.toUpperCase(),
				timeframe: timeframe,
				totalBars: sortedData.length,
				earliestTimestamp: sortedData.length > 0 ? sortedData[0].time : null,
				latestTimestamp: sortedData.length > 0 ? sortedData[sortedData.length - 1].time : null,
				provider: result.provider,
				fallbackUsed: result.fallbackUsed,
			},
			{ headers: responseHeaders },
		);
	} catch (error) {
		logger.error("alpaca.history_failed", error, {
			requestId: requestLog.requestId,
			symbol,
			timeframe,
			type,
		});
		finishRequestLog(requestLog, 502, { symbol, timeframe, type });
		return NextResponse.json(
			{ error: "Failed to fetch historical data" },
			{ status: 502, headers: sharedHeaders },
		);
	}
}
