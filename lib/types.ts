export type Item = {
  symbol: string;
  metric: string;
  value: number;
};

export type StructuredExplanation = {
  metric_display: string;
  definition: string;
  explanation: string;
  insight: string;
  learn_more_url: string;
  evaluation?: "green" | "red" | "neutral" | "amber";
};

export type MetricDefinition = {
  metric_display: string;
  definition: string;
  explanation: string;
  learn_more_url: string;
};

// New types for contextual chat
export interface ChartPoint {
  t: number; // timestamp
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
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
    interval: string;
    points: ChartPoint[];
    latestPrice: number;
    dayChangePct: number;
  };
  cachedExplanations: Record<string, string>;
  trigger: {
    metricKey: string;
    metricLabel: string;
    value: number | string;
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
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

export type ValueAnalysis = StructuredExplanation;
