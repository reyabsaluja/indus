export type MetricDefinition = {
	metric_display: string;
	definition: string;
	explanation: string;
	learn_more_url: string;
};

export interface FinancialData {
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

export interface ReportStockData {
	shortName?: string;
	longName?: string;
	regularMarketPrice?: number;
	regularMarketChange?: number;
	regularMarketChangePercent?: number;
	marketCap?: number;
	peRatio?: number;
	sector?: string;
	industry?: string;
	beta?: number;
	fiftyTwoWeekLow?: number;
	fiftyTwoWeekHigh?: number;
	revenueGrowth?: number;
	netProfitMargins?: number;
	returnOnEquity?: number;
	debtToEquity?: number;
	recentNews?: ReportNewsSource[];
}

export interface ReportNewsSource {
	headline: string;
	publisher: string;
	publishedAt: string;
	url: string;
}

export interface CryptoData {
	symbol: string;
	shortName?: string;
	longName?: string;
	regularMarketPrice?: number;
	currency?: string;
	longBusinessSummary?: string;
	website?: string;
	category?: string;
	algorithm?: string;
	marketCap?: number;
	circulatingSupply?: number;
	totalSupply?: number;
	maxSupply?: number;
	volume?: number;
	volume24h?: number;
	percentChange24h?: number;
	percentChange7d?: number;
	percentChange30d?: number;
	allTimeHigh?: number;
	allTimeLow?: number;
	ath24hChange?: number;
	atl24hChange?: number;
	rank?: number;
	dominance?: number;
	volatility?: number;
	beta?: number;
	sharpeRatio?: number;
	tradingPairs?: number;
	githubActivity?: number;
	communityScore?: number;
	developerScore?: number;
	liquidityScore?: number;
	fiftyTwoWeekHigh?: number;
	fiftyTwoWeekLow?: number;
}

interface ChartPoint {
	t: number;
	o: number;
	h: number;
	l: number;
	c: number;
	v: number;
}

export interface PageChartData {
	range?: string;
	interval?: string;
	points?: ChartPoint[];
	latestPrice?: number;
	rangeChangePct?: number;
}

export interface MetricGroups {
	companyProfile: {
		marketCap?: number;
		enterpriseValue?: number;
		sharesOutstanding?: number;
		revenue?: number;
		employees?: number;
	};
	margins: {
		grossMargin?: number;
		ebitdaMargin?: number;
		operatingMargin?: number;
		netMargin?: number;
		roa?: number;
		roe?: number;
	};
	valuation: {
		peRatio?: number;
		forwardPE?: number;
		pbRatio?: number;
		psRatio?: number;
		evToSales?: number;
		evToEbitda?: number;
		pegRatio?: number;
	};
	growth: {
		revenueGrowth?: number | null;
		earningsGrowth?: number | null;
		beta?: number;
	};
	financialHealth: {
		totalCash?: number;
		totalDebt?: number;
		debtToEquity?: number;
	};
	dividends: {
		dividendYield?: number;
		dividendRate?: number;
		payoutRatio?: number;
	};
}

export interface PageContext {
	symbol: string;
	companyName: string;
	asOf: string;
	metricGroups: MetricGroups;
	chart?: {
		range: string;
		interval: string;
		points: ChartPoint[];
		latestPrice: number;
		rangeChangePct: number;
	};
	trigger: {
		metricKey: string;
		metricLabel: string;
		value: number | string;
	};
}

export interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	createdAt: number;
	streaming?: boolean;
}

export interface ContextChatState {
	open: boolean;
	initialContext?: PageContext;
	messages: ChatMessage[];
	sending: boolean;
	error?: string | null;
	triggerMetric?: {
		metricKey: string;
		label: string;
		value: number | string;
	};
}

export interface ValueAnalysis {
	metric_display: string;
	insight: string;
	evaluation: "green" | "red" | "neutral" | "amber";
	source?: "model" | "fallback";
}
