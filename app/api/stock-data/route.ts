import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({
    suppressNotices: ["yahooSurvey"],
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  try {
    // Try to fetch real Yahoo Finance data first
    let quote = null;
    let quoteSummary = null;
    let currentPrice = 0;
    let change = 0;
    let changePercent = 0;
    let shortName = symbol;
    let longName = symbol;

    try {
      // Fetch quote data and summary data in parallel
      [quote, quoteSummary] = await Promise.all([
        yahooFinance.quote(symbol),
        yahooFinance.quoteSummary(symbol, {
          modules: [
            "defaultKeyStatistics",
            "financialData",
            "summaryDetail",
            "assetProfile",
          ],
        }),
      ]);

      // Get basic price data
      currentPrice = quote.regularMarketPrice || 0;
      change = quote.regularMarketChange || 0;
      changePercent = quote.regularMarketChangePercent || 0;
      shortName = quote.shortName || quote.displayName || symbol;
      longName = quote.longName || shortName;

      console.log(`Yahoo Finance data for ${symbol}:`, {
        price: currentPrice,
        change: change,
        changePercent: changePercent,
        hasQuoteSummary: !!quoteSummary,
        quoteType: quote.quoteType,
      });
    } catch (apiError) {
      console.error(`Yahoo Finance API failed for ${symbol}:`, apiError);
      return NextResponse.json(
        { error: `Failed to fetch data for ${symbol}` },
        { status: 500 }
      );
    }

    // Check if this is a cryptocurrency
    const isCrypto = quote?.quoteType === "CRYPTOCURRENCY" || symbol.includes('-USD') || symbol.includes('-USDT') || symbol.includes('-BTC');

    // Extract comprehensive financial metrics from Yahoo Finance data
    const data = {
      // Basic info
      symbol: symbol.toUpperCase(),
      shortName: shortName,
      longName: longName,

      // Current price info (using corrected values)
      regularMarketPrice: currentPrice,
      regularMarketChange: change,
      regularMarketChangePercent: changePercent,
      currency: "USD",

      // Company profile/overview (extract from quoteSummary if available)
      longBusinessSummary:
        quoteSummary?.assetProfile?.description || null,
      website: quoteSummary?.assetProfile?.website || null,
      sector: quoteSummary?.assetProfile?.sector || null,
      industry: quoteSummary?.assetProfile?.industry || null,
      country: quoteSummary?.assetProfile?.country || "US",
      city: quoteSummary?.assetProfile?.city || null,
      state: quoteSummary?.assetProfile?.state || null,

      // Profile data (extract from quoteSummary if available)
      marketCap:
        quote?.marketCap ||
        quoteSummary?.summaryDetail?.marketCap ||
        null,
      enterpriseValue:
        quoteSummary?.defaultKeyStatistics?.enterpriseValue || null,
      sharesOutstanding:
        quoteSummary?.defaultKeyStatistics?.sharesOutstanding || null,
      revenue: quoteSummary?.financialData?.totalRevenue || null,
      employees: quoteSummary?.assetProfile?.fullTimeEmployees || null,

      // Crypto-specific fields
      circulatingSupply: quote?.circulatingSupply || null,
      totalSupply: null, // Not directly available from Yahoo Finance
      maxSupply: null, // Not directly available from Yahoo Finance
      volume24h: quote?.volume24Hr || quote?.regularMarketVolume || 0,
      percentChange24h: quote?.regularMarketChangePercent || 0,
      percentChange7d: null, // Would need historical data calculation
      percentChange30d: null, // Would need historical data calculation
      allTimeHigh: quote?.fiftyTwoWeekHigh || null,
      allTimeLow: quote?.fiftyTwoWeekLow || null,
      ath24hChange: quote?.fiftyTwoWeekHighChangePercent || null,
      atl24hChange: quote?.fiftyTwoWeekLowChangePercent || null,
      rank: null, // Would need market cap ranking
      dominance: null, // Would need total market cap calculation
      algorithm: quoteSummary?.summaryDetail?.algorithm || null,
      category: isCrypto ? "Cryptocurrency" : null,
      tradingPairs: null, // Not available from Yahoo Finance
      githubActivity: null, // Not available from Yahoo Finance
      communityScore: null, // Not available from Yahoo Finance
      developerScore: null, // Not available from Yahoo Finance
      liquidityScore: null, // Not available from Yahoo Finance
      volatility: null, // Would need historical data calculation
      sharpeRatio: null, // Would need historical data calculation

      // Valuation metrics (TTM) - mostly not applicable for crypto
      peRatio: isCrypto ? null : (
        quoteSummary?.summaryDetail?.trailingPE ||
        null
      ),
      priceToBook: isCrypto ? null : quoteSummary?.defaultKeyStatistics?.priceToBook || null,
      evToSales: isCrypto ? null : (
        quoteSummary?.defaultKeyStatistics?.enterpriseToRevenue || null
      ),
      evToEbitda: isCrypto ? null : (
        quoteSummary?.defaultKeyStatistics?.enterpriseToEbitda || null
      ),
      priceToCashFlow: isCrypto ? null : null, // Not available in current Yahoo Finance API
      evToGrossProfit: null, // Not available in Yahoo Finance

      // Valuation metrics (NTM) - mostly not applicable for crypto
      forwardPE: isCrypto ? null : quoteSummary?.defaultKeyStatistics?.forwardPE || null,
      pegRatio: isCrypto ? null : quoteSummary?.defaultKeyStatistics?.pegRatio || null,

      // Margins (from financial data) - not applicable for crypto
      grossMargins: isCrypto ? null : quoteSummary?.financialData?.grossMargins || null,
      ebitdaMargins: isCrypto ? null : quoteSummary?.financialData?.ebitdaMargins || null,
      operatingMargins: isCrypto ? null : quoteSummary?.financialData?.operatingMargins || null,
      pretaxMargins: null, // Not directly available
      netProfitMargins: isCrypto ? null : quoteSummary?.financialData?.profitMargins || null,
      freeCashflowMargin: null, // Calculate if needed

      // Returns - not applicable for crypto
      returnOnAssets: isCrypto ? null : quoteSummary?.financialData?.returnOnAssets || null,
      returnOnEquity: isCrypto ? null : quoteSummary?.financialData?.returnOnEquity || null,

      // Financial Health - not applicable for crypto
      totalCash: isCrypto ? null : quoteSummary?.financialData?.totalCash || null,
      totalDebt: isCrypto ? null : quoteSummary?.financialData?.totalDebt || null,
      debtToEquity: isCrypto ? null : quoteSummary?.financialData?.debtToEquity || null,
      currentRatio: isCrypto ? null : quoteSummary?.financialData?.currentRatio || null,
      quickRatio: isCrypto ? null : quoteSummary?.financialData?.quickRatio || null,

      // Growth metrics - not applicable for crypto
      revenueGrowth: isCrypto ? null : quoteSummary?.financialData?.revenueGrowth || null,
      earningsGrowth: isCrypto ? null : quoteSummary?.financialData?.earningsGrowth || null,

      // Dividend info - not applicable for crypto
      dividendYield: isCrypto ? null : quoteSummary?.summaryDetail?.dividendYield || null,
      trailingAnnualDividendYield: isCrypto ? null : (
        quoteSummary?.summaryDetail?.trailingAnnualDividendYield || null
      ),
      dividendRate: isCrypto ? null : quoteSummary?.summaryDetail?.dividendRate || null,
      payoutRatio: isCrypto ? null : quoteSummary?.summaryDetail?.payoutRatio || null,

      // Volume and trading
      volume:
        quote?.regularMarketVolume || quoteSummary?.summaryDetail?.volume || 0,
      avgVolume: quoteSummary?.summaryDetail?.averageVolume || 0,

      // Additional useful data
      beta: isCrypto ? null : quoteSummary?.defaultKeyStatistics?.beta || null,
      bookValue: isCrypto ? null : quoteSummary?.defaultKeyStatistics?.bookValue || null,
      priceToSales: isCrypto ? null : null, // Not available in current Yahoo Finance API

      // Analyst recommendations - not applicable for crypto
      recommendationKey: isCrypto ? null : quoteSummary?.financialData?.recommendationKey || null,
      recommendationMean: isCrypto ? null : (
        quoteSummary?.financialData?.recommendationMean || null
      ),
      targetMeanPrice: isCrypto ? null : quoteSummary?.financialData?.targetMeanPrice || null,
      targetHighPrice: isCrypto ? null : quoteSummary?.financialData?.targetHighPrice || null,
      targetLowPrice: isCrypto ? null : quoteSummary?.financialData?.targetLowPrice || null,

      // Additional metrics
      fiftyTwoWeekHigh: quoteSummary?.summaryDetail?.fiftyTwoWeekHigh || null,
      fiftyTwoWeekLow: quoteSummary?.summaryDetail?.fiftyTwoWeekLow || null,
      trailingEps: isCrypto ? null : quoteSummary?.defaultKeyStatistics?.trailingEps || null,
      forwardEps: isCrypto ? null : quoteSummary?.defaultKeyStatistics?.forwardEps || null,

      // Flag to indicate data source and type
      fromYahooFinance: !!quoteSummary,
      isCrypto: isCrypto,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error fetching stock data:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock data" },
      { status: 500 },
    );
  }
}