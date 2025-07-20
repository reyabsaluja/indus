import { PageContext, MetricGroups, ChartPoint } from "@/lib/types";
import { getCachedExplanation } from "@/hooks/useExplanation";

// Define the financial data structure based on existing FinancialData type
interface FinancialData {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  currency?: string;
  longBusinessSummary?: string;
  website?: string;
  sector?: string;
  industry?: string;
  country?: string;
  city?: string;
  state?: string;
  marketCap?: number;
  enterpriseValue?: number;
  sharesOutstanding?: number;
  revenue?: number;
  employees?: number;
  peRatio?: number;
  priceToBook?: number;
  evToSales?: number;
  evToEbitda?: number;
  priceToCashFlow?: number;
  forwardPE?: number;
  pegRatio?: number;
  grossMargins?: number;
  ebitdaMargins?: number;
  operatingMargins?: number;
  netProfitMargins?: number;
  returnOnAssets?: number;
  returnOnEquity?: number;
  totalCash?: number;
  totalDebt?: number;
  debtToEquity?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  dividendYield?: number;
  dividendRate?: number;
  payoutRatio?: number;
  volume?: number;
  beta?: number;
  bookValue?: number;
  priceToSales?: number;
}

// Interface for chart data (if available)
interface ChartData {
  interval?: string;
  points?: any[];
  latestPrice?: number;
  dayChangePct?: number;
}

interface BuildContextParams {
  financialData: FinancialData;
  chartData?: ChartData;
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
  // Build metric groups
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

  // Gather cached explanations (limit to avoid size issues)
  const cachedExplanations: Record<string, string> = {};
  const metricKeys = [
    'market_cap', 'enterprise_value', 'shares_outstanding', 'revenue', 'employees',
    'pe_ratio', 'forward_pe', 'price_to_book', 'price_to_sales', 'ev_to_sales', 'ev_to_ebitda',
    'gross_margin', 'ebitda_margin', 'operating_margin', 'net_margin', 'roa', 'roe',
    'total_cash', 'total_debt', 'debt_to_equity', 'beta',
    'dividend_yield', 'payout_ratio'
  ];

  // Collect cached explanations, truncating if too long
  for (const metricKey of metricKeys.slice(0, 15)) { // Limit to first 15 to avoid size issues
    const cached = getCachedExplanation(financialData.symbol, metricKey);
    if (cached) {
      // Truncate explanations to avoid payload bloat
      cachedExplanations[metricKey] = cached.length > 280 ? 
        cached.substring(0, 280) + "..." : cached;
    }
  }

  // Build chart context if available
  const chart = chartData?.points ? {
    interval: chartData.interval || '1d',
    points: chartData.points.slice(-50).map(point => ({ // Limit to last 50 points
      t: point.t || Date.now(),
      o: point.o || 0,
      h: point.h || 0,
      l: point.l || 0,
      c: point.c || 0,
      v: point.v || 0,
    })) as ChartPoint[],
    latestPrice: chartData.latestPrice || financialData.regularMarketPrice || 0,
    dayChangePct: chartData.dayChangePct || financialData.regularMarketChangePercent || 0,
  } : undefined;

  return {
    symbol: financialData.symbol,
    companyName: financialData.longName || financialData.shortName || financialData.symbol,
    asOf: new Date().toISOString(),
    metricGroups,
    chart,
    cachedExplanations,
    trigger: triggerMetric,
  };
}

// Helper function to estimate context size and trim if needed
export function trimContextIfNeeded(context: PageContext): PageContext {
  const contextStr = JSON.stringify(context);
  const sizeKB = new Blob([contextStr]).size / 1024;
  
  if (sizeKB > 25) { // If larger than 25KB
    // Remove oldest explanations
    const explanationEntries = Object.entries(context.cachedExplanations);
    const trimmedExplanations: Record<string, string> = {};
    
    // Keep only the first 10 explanations
    for (let i = 0; i < Math.min(10, explanationEntries.length); i++) {
      const [key, value] = explanationEntries[i];
      trimmedExplanations[key] = value.length > 200 ? 
        value.substring(0, 200) + "..." : value;
    }
    
    return {
      ...context,
      cachedExplanations: trimmedExplanations,
      chart: context.chart ? {
        ...context.chart,
        points: context.chart.points.slice(-30) // Reduce chart points
      } : undefined
    };
  }
  
  return context;
} 