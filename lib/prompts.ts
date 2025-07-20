export type Item = {
  symbol: string;
  metric: string;
  value: number;
};

export function makeBatchPrompt(items: Item[]): string {
  let prompt = `For each of the following financial metrics, provide analytical insights about the specific values following the exact JSON format specified in the system prompt. Return a JSON object where each key corresponds to the item number and the value is the value analysis:\n\n`;

  items.forEach((item, idx) => {
    const label = getMetricLabel(item.symbol, item.metric, item.value);
    prompt += `${idx + 1}. ${label}\n`;
  });

  prompt += `\nReturn format: {"1": {"metric_display": "...", "insight": "...", "evaluation": "green|red|neutral|amber"}, "2": {...}, ...} where each value follows the ValueAnalysis JSON structure.`;

  return prompt;
}

function getMetricLabel(symbol: string, metric: string, value: number): string {
  const formatCurrency = (val: number) => {
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toFixed(2)}`;
  };

  const formatPercentage = (val: number) => `${(val * 100).toFixed(1)}%`;
  const formatRatio = (val: number) => val.toFixed(1);

  switch (metric) {
    // Basic metrics
    case "price":
      return `${symbol} current stock price: $${value}`;
    case "pe_ratio":
      return `${symbol} P/E ratio: ${formatRatio(value)}`;
    case "volume":
      return `${symbol} trading volume: ${value.toLocaleString()}`;

    // Profile metrics
    case "market_cap":
      return `${symbol} market capitalization: ${formatCurrency(value)}`;
    case "enterprise_value":
      return `${symbol} enterprise value: ${formatCurrency(value)}`;
    case "shares_outstanding":
      return `${symbol} shares outstanding: ${(value / 1e9).toFixed(1)}B shares`;
    case "revenue":
      return `${symbol} annual revenue: ${formatCurrency(value)}`;
    case "employees":
      return `${symbol} employee count: ${value.toLocaleString()} employees`;

    // Valuation metrics
    case "price_to_book":
      return `${symbol} price-to-book ratio: ${formatRatio(value)}`;
    case "ev_to_sales":
      return `${symbol} EV/Sales ratio: ${formatRatio(value)}`;
    case "ev_to_ebitda":
      return `${symbol} EV/EBITDA ratio: ${formatRatio(value)}`;
    case "price_to_fcf":
      return `${symbol} price-to-free-cash-flow ratio: ${formatRatio(value)}`;
    case "forward_pe":
      return `${symbol} forward P/E ratio: ${formatRatio(value)}`;
    case "peg_ratio":
      return `${symbol} PEG ratio: ${formatRatio(value)}`;
    case "price_to_sales":
      return `${symbol} price-to-sales ratio: ${formatRatio(value)}`;

    // Margin metrics
    case "gross_margin":
      return `${symbol} gross profit margin: ${formatPercentage(value)}`;
    case "ebitda_margin":
      return `${symbol} EBITDA margin: ${formatPercentage(value)}`;
    case "operating_margin":
      return `${symbol} operating margin: ${formatPercentage(value)}`;
    case "net_margin":
      return `${symbol} net profit margin: ${formatPercentage(value)}`;

    // Return metrics
    case "roa":
      return `${symbol} return on assets (ROA): ${formatPercentage(value)}`;
    case "roe":
      return `${symbol} return on equity (ROE): ${formatPercentage(value)}`;

    // Financial health
    case "total_cash":
      return `${symbol} total cash: ${formatCurrency(value)}`;
    case "total_debt":
      return `${symbol} total debt: ${formatCurrency(value)}`;
    case "debt_to_equity":
      return `${symbol} debt-to-equity ratio: ${formatRatio(value)}`;

    // Growth metrics
    case "revenue_growth":
      return `${symbol} revenue growth rate: ${formatPercentage(value)}`;
    case "earnings_growth":
      return `${symbol} earnings growth rate: ${formatPercentage(value)}`;
    case "revenue_growth_3y":
      return `${symbol} 3-year revenue growth (CAGR): ${formatPercentage(value)}`;
    case "earnings_growth_3y":
      return `${symbol} 3-year earnings growth (CAGR): ${formatPercentage(value)}`;

    // Dividend metrics
    case "dividend_yield":
      return `${symbol} dividend yield: ${formatPercentage(value)}`;
    case "payout_ratio":
      return `${symbol} dividend payout ratio: ${formatPercentage(value)}`;
    case "dividend_per_share":
      return `${symbol} dividend per share: $${value.toFixed(2)}`;

    // Risk metrics
    case "beta":
      return `${symbol} beta coefficient: ${formatRatio(value)}`;

    default:
      return `${symbol} ${metric}: ${value}`;
  }
}
