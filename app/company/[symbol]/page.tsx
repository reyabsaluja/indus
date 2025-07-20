"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import FinancialTable from "@/components/FinancialTable";
import StockChart from "@/components/StockChart";
import { batchPreload } from "@/hooks/useExplanation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FavoriteButtonCompact } from "@/components/FavoriteButton";
import {
  ArrowLeft,
  Building2,
  TrendingUp,
  Users,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Share,
  PieChart,
} from "lucide-react";
import { useContextChat } from "@/components/chat/useContextChat";
import { ChatPanel } from "@/components/chat/ChatPanel";

type FinancialData = {
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
};

const CompanyPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const symbol = params?.symbol as string;

  const [financialData, setFinancialData] = useState<FinancialData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);

  // Contextual chat integration
  const contextChat = useContextChat({
    getFinancialData: () => financialData,
    getChartData: () => undefined, // Chart data would be integrated here if available
  });

  // Standardized formatting functions
  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return "—";
    if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatNumber = (value?: number) => {
    if (value === undefined || value === null) return "—";
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toFixed(0);
  };

  const fetchStockData = async (stockSymbol: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/stock-data?symbol=${stockSymbol.toUpperCase()}`,
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch stock data");
      }

      setFinancialData(result.data);

      // Prepare items for batch preload of AI explanations with actual values
      const data = result.data;
      const items = [
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "market_cap",
          value: data.marketCap || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "enterprise_value",
          value: data.enterpriseValue || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "shares_outstanding",
          value: data.sharesOutstanding || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "revenue",
          value: data.revenue || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "employees",
          value: data.employees || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "pe_ratio",
          value: data.peRatio || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "price_to_book",
          value: data.priceToBook || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "ev_to_sales",
          value: data.evToSales || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "ev_to_ebitda",
          value: data.evToEbitda || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "price_to_fcf",
          value: data.priceToCashFlow || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "forward_pe",
          value: data.forwardPE || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "peg_ratio",
          value: data.pegRatio || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "gross_margin",
          value: data.grossMargins || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "ebitda_margin",
          value: data.ebitdaMargins || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "operating_margin",
          value: data.operatingMargins || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "net_margin",
          value: data.netProfitMargins || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "roa",
          value: data.returnOnAssets || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "roe",
          value: data.returnOnEquity || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "total_cash",
          value: data.totalCash || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "total_debt",
          value: data.totalDebt || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "debt_to_equity",
          value: data.debtToEquity || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "revenue_growth",
          value: data.revenueGrowth || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "earnings_growth",
          value: data.earningsGrowth || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "dividend_yield",
          value: data.dividendYield || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "payout_ratio",
          value: data.payoutRatio || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "beta",
          value: data.beta || 0,
        },
        {
          symbol: stockSymbol.toUpperCase(),
          metric: "price_to_sales",
          value: data.priceToSales || 0,
        },
      ].filter((item) => item.value !== 0); // Only preload metrics that have actual values

      // Preload AI explanations for all metrics with actual values
      if (items.length > 0) {
        batchPreload(items);
      }
    } catch (err) {
      console.error("Error fetching stock data:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (symbol) {
      fetchStockData(symbol);
    }
  }, [symbol]);

  if (!symbol) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Building2 className="h-6 w-6" />
              Invalid Company
            </CardTitle>
            <CardDescription>No company symbol provided.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6 overflow-x-hidden max-w-full">
      {/* Navigation */}
      <div>
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Card className="w-full max-w-md">
            <CardContent className="flex items-center justify-center space-x-2 py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="text-muted-foreground">
                Loading {symbol.toUpperCase()} financial data...
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive">
              Error Loading Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-destructive/80">{error}</p>
            <p className="text-sm text-muted-foreground">
              Make sure &quot;{symbol.toUpperCase()}&quot; is a valid stock symbol.
            </p>
            <Button
              variant="destructive"
              onClick={() => router.push("/dashboard")}
            >
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Financial Data */}
      {financialData && !isLoading && (
        <div className="space-y-6">
          {/* Company Header */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-3">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-2">
                    <Building2 className="h-6 w-6 mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-2xl">
                          {financialData.longName ||
                            financialData.shortName ||
                            financialData.symbol}
                        </CardTitle>
                        <FavoriteButtonCompact
                          symbol={financialData.symbol}
                          className="hover:bg-yellow-100 dark:hover:bg-yellow-900/20"
                        />
                      </div>
                      <CardDescription className="text-lg font-mono">
                        {financialData.symbol}
                      </CardDescription>
                    </div>
                  </div>

                  {/* Current Price */}
                  {financialData.regularMarketPrice && (
                    <div className="text-right">
                      <div className="text-2xl font-bold financial-number">
                        {financialData.currency === "USD" ? "$" : ""}
                        {financialData.regularMarketPrice.toFixed(2)}
                        {financialData.currency &&
                          financialData.currency !== "USD" &&
                          ` ${financialData.currency}`}
                      </div>
                      {(financialData.regularMarketChange ||
                        financialData.regularMarketChangePercent) && (
                        <div
                          className={`text-sm font-medium ${
                            (financialData.regularMarketChange || 0) >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {(financialData.regularMarketChange || 0) >= 0
                            ? "+"
                            : ""}
                          {financialData.regularMarketChange?.toFixed(2) || 0}
                          {financialData.regularMarketChangePercent && (
                            <span>
                              {" "}
                              (
                              {(financialData.regularMarketChangePercent ||
                                0) >= 0
                                ? "+"
                                : ""}
                              {financialData.regularMarketChangePercent.toFixed(2)}
                              %)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              {financialData.longBusinessSummary && (
                <CardContent className="space-y-4">
                  {/* Company Overview */}
                  <div>
                    <h3 className="font-semibold text-lg mb-2">
                      Company Overview
                    </h3>
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {showFullDescription
                          ? financialData.longBusinessSummary
                          : `${financialData.longBusinessSummary.slice(0, 250)}${financialData.longBusinessSummary.length > 250 ? "..." : ""}`}
                      </p>
                      {financialData.longBusinessSummary.length > 250 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setShowFullDescription(!showFullDescription)
                          }
                          className="px-0 py-1 h-auto text-primary hover:text-primary/80 -ml-2"
                        >
                          {showFullDescription ? (
                            <>
                              Show Less <ChevronUp className="h-3 w-3 ml-1" />
                            </>
                          ) : (
                            <>
                              Show More <ChevronDown className="h-3 w-3 ml-1" />
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Company Details Grid */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-4 border-t">
                    {financialData.website && (
                      <div>
                        <p className="text-sm font-medium">Website</p>
                        <a
                          href={`https://${financialData.website.replace(/^https?:\/\//, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          {financialData.website.replace(/^https?:\/\//, "")}
                        </a>
                      </div>
                    )}
                    {financialData.sector && (
                      <div>
                        <p className="text-sm font-medium">Sector</p>
                        <p className="text-sm text-muted-foreground">
                          {financialData.sector}
                        </p>
                      </div>
                    )}
                    {financialData.industry && (
                      <div>
                        <p className="text-sm font-medium">Industry</p>
                        <p className="text-sm text-muted-foreground">
                          {financialData.industry}
                        </p>
                      </div>
                    )}
                    {(financialData.city ||
                      financialData.state ||
                      financialData.country) && (
                      <div>
                        <p className="text-sm font-medium">Location</p>
                        <p className="text-sm text-muted-foreground">
                          {[
                            financialData.city,
                            financialData.state,
                            financialData.country,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* Stock Chart */}
          <div className="pt-4">
            <StockChart
              symbol={financialData.symbol}
              height={700}
              showControls={false}
            />
          </div>

          {/* Key Metrics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Card>
              <CardHeader className="pb-1 text-center">
                <CardTitle className="text-lg flex items-center justify-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Market Cap
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-2xl font-bold metric-tile-value">
                  {formatCurrency(financialData.marketCap)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1 text-center">
                <CardTitle className="text-lg flex items-center justify-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Enterprise Value
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-2xl font-bold metric-tile-value">
                  {formatCurrency(financialData.enterpriseValue)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1 text-center">
                <CardTitle className="text-lg flex items-center justify-center gap-2">
                  <Share className="h-4 w-4" />
                  Shares
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-2xl font-bold metric-tile-value">
                  {formatNumber(financialData.sharesOutstanding)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1 text-center">
                <CardTitle className="text-lg flex items-center justify-center gap-2">
                  <PieChart className="h-4 w-4" />
                  Revenue (TTM)
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-2xl font-bold metric-tile-value">
                  {formatCurrency(financialData.revenue)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1 text-center">
                <CardTitle className="text-lg flex items-center justify-center gap-2">
                  <Users className="h-4 w-4" />
                  Employees
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-2xl font-bold metric-tile-value">
                  {formatNumber(financialData.employees)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Financial Metrics Table */}
          <Card>
            <CardHeader>
              <CardTitle>Financial Metrics</CardTitle>
              <CardDescription>
                Comprehensive financial analysis with AI-powered explanations.
                Hover over any metric for detailed insights.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FinancialTable
                data={financialData}
                onChatTrigger={contextChat.openWithMetric}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Contextual Chat Panel */}
      <ChatPanel
        state={contextChat}
        onClose={contextChat.close}
        onSendMessage={contextChat.sendMessage}
        onRegenerateLast={contextChat.regenerateLast}
        onClearError={contextChat.clearError}
      />
    </div>
  );
};

export default CompanyPage;
