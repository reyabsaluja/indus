import type { FinancialData, MetricGroups, PageChartData, PageContext } from "@/lib/types";

const MAX_CONTEXT_SIZE_KB = 25;

interface BuildContextParams {
	financialData: FinancialData;
	chartData?: PageChartData;
	triggerMetric: {
		metricKey: string;
		metricLabel: string;
		value: number | string;
	};
}

export function buildPageContext({
	financialData,
	chartData,
	triggerMetric,
}: BuildContextParams): PageContext {
	const metricGroups: MetricGroups = {
		companyProfile: {
			marketCap: financialData.marketCap,
			enterpriseValue: financialData.enterpriseValue,
			sharesOutstanding: financialData.sharesOutstanding,
			revenue: financialData.revenue,
			employees: financialData.employees,
		},
		margins: {
			grossMargin: financialData.grossMargins,
			ebitdaMargin: financialData.ebitdaMargins,
			operatingMargin: financialData.operatingMargins,
			netMargin: financialData.netProfitMargins,
			roa: financialData.returnOnAssets,
			roe: financialData.returnOnEquity,
		},
		valuation: {
			peRatio: financialData.peRatio,
			forwardPE: financialData.forwardPE,
			pbRatio: financialData.priceToBook,
			psRatio: financialData.priceToSales,
			evToSales: financialData.evToSales,
			evToEbitda: financialData.evToEbitda,
			pegRatio: financialData.pegRatio,
		},
		growth: {
			revenueGrowth: financialData.revenueGrowth,
			earningsGrowth: financialData.earningsGrowth,
			beta: financialData.beta,
		},
		financialHealth: {
			totalCash: financialData.totalCash,
			totalDebt: financialData.totalDebt,
			debtToEquity: financialData.debtToEquity,
		},
		dividends: {
			dividendYield: financialData.dividendYield,
			dividendRate: financialData.dividendRate,
			payoutRatio: financialData.payoutRatio,
		},
	};

	const chart = chartData?.points
		? {
				range: chartData.range ?? "Unknown",
				interval: chartData.interval ?? "1d",
				points: chartData.points.slice(-50).map((point) => ({
					t: point.t,
					o: point.o,
					h: point.h,
					l: point.l,
					c: point.c,
					v: point.v,
				})),
				latestPrice: chartData.latestPrice ?? financialData.regularMarketPrice ?? 0,
				rangeChangePct: chartData.rangeChangePct ?? financialData.regularMarketChangePercent ?? 0,
			}
		: undefined;

	return {
		symbol: financialData.symbol,
		companyName: financialData.longName ?? financialData.shortName ?? financialData.symbol,
		asOf: new Date().toISOString(),
		metricGroups,
		chart,
		trigger: triggerMetric,
	};
}

export function trimContextIfNeeded(context: PageContext): PageContext {
	const sizeKB = new TextEncoder().encode(JSON.stringify(context)).byteLength / 1024;

	if (sizeKB > MAX_CONTEXT_SIZE_KB) {
		return {
			...context,
			chart: context.chart
				? {
						...context.chart,
						points: context.chart.points.slice(-30),
					}
				: undefined,
		};
	}

	return context;
}
