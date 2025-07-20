"use client";

import React from "react";
import Hoverable from "./Hoverable";
import MetricNameHover from "./MetricNameHover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CryptoData = {
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
};

interface CryptoFinancialTableProps {
  data: CryptoData;
  onChatTrigger?: (metricKey: string, metricLabel: string, value: number | string) => void;
}

const CryptoFinancialTable: React.FC<CryptoFinancialTableProps> = ({ data, onChatTrigger }) => {
  // Helper function to check if a value should be displayed
  const hasValidData = (value?: number) => {
    return value !== undefined && value !== null && value !== 0;
  };

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

  const formatPercentage = (value?: number) => {
    if (value === undefined || value === null) return "—";
    return `${value.toFixed(2)}%`;
  };

  const formatRatio = (value?: number) => {
    if (value === undefined || value === null) return "—";
    return value.toFixed(2);
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="grid gap-6 lg:grid-cols-3 min-w-0">
        {/* Market Overview */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead colSpan={2} className="text-base font-semibold">
                Market Overview
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">
                <MetricNameHover metricName="Market Cap">
                  Market Cap
                </MetricNameHover>
              </TableCell>
              <TableCell className="text-right font-mono">
                <Hoverable
                  symbol={data.symbol}
                  metric="market_cap"
                  value={data.marketCap || 0}
                  onChatTrigger={onChatTrigger}
                  metricLabel="Market Cap"
                >
                  <span>{formatCurrency(data.marketCap)}</span>
                </Hoverable>
              </TableCell>
            </TableRow>
            {hasValidData(data.rank) && (
              <TableRow>
                <TableCell className="font-medium">
                  <MetricNameHover metricName="Market Rank">
                    Market Rank
                  </MetricNameHover>
                </TableCell>
                <TableCell className="text-right font-mono">
                  <Hoverable
                    symbol={data.symbol}
                    metric="market_rank"
                    value={data.rank || 0}
                    onChatTrigger={onChatTrigger}
                    metricLabel="Market Rank"
                  >
                    <span>#{data.rank}</span>
                  </Hoverable>
                </TableCell>
              </TableRow>
            )}
            {hasValidData(data.dominance) && (
              <TableRow>
                <TableCell className="font-medium">
                  <MetricNameHover metricName="Market Dominance">
                    Market Dominance
                  </MetricNameHover>
                </TableCell>
                <TableCell className="text-right font-mono">
                  <Hoverable
                    symbol={data.symbol}
                    metric="market_dominance"
                    value={data.dominance || 0}
                    onChatTrigger={onChatTrigger}
                    metricLabel="Market Dominance"
                  >
                    <span>{formatPercentage(data.dominance)}</span>
                  </Hoverable>
                </TableCell>
              </TableRow>
            )}
            <TableRow>
              <TableCell className="font-medium">
                <MetricNameHover metricName="24h Volume">
                  24h Volume
                </MetricNameHover>
              </TableCell>
              <TableCell className="text-right font-mono">
                <Hoverable
                  symbol={data.symbol}
                  metric="volume_24h"
                  value={data.volume24h || data.volume || 0}
                  onChatTrigger={onChatTrigger}
                  metricLabel="24h Volume"
                >
                  <span>{formatCurrency(data.volume24h || data.volume)}</span>
                </Hoverable>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {/* Supply Metrics */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead colSpan={2} className="text-base font-semibold">
                Supply Metrics
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">
                <MetricNameHover metricName="Circulating Supply">
                  Circulating Supply
                </MetricNameHover>
              </TableCell>
              <TableCell className="text-right font-mono">
                <Hoverable
                  symbol={data.symbol}
                  metric="circulating_supply"
                  value={data.circulatingSupply || 0}
                  onChatTrigger={onChatTrigger}
                  metricLabel="Circulating Supply"
                >
                  <span>{formatNumber(data.circulatingSupply)}</span>
                </Hoverable>
              </TableCell>
            </TableRow>
            {hasValidData(data.totalSupply) && (
              <TableRow>
                <TableCell className="font-medium">
                  <MetricNameHover metricName="Total Supply">
                    Total Supply
                  </MetricNameHover>
                </TableCell>
                <TableCell className="text-right font-mono">
                  <Hoverable
                    symbol={data.symbol}
                    metric="total_supply"
                    value={data.totalSupply || 0}
                    onChatTrigger={onChatTrigger}
                    metricLabel="Total Supply"
                  >
                    <span>{formatNumber(data.totalSupply)}</span>
                  </Hoverable>
                </TableCell>
              </TableRow>
            )}
            {hasValidData(data.maxSupply) && (
              <TableRow>
                <TableCell className="font-medium">
                  <MetricNameHover metricName="Max Supply">
                    Max Supply
                  </MetricNameHover>
                </TableCell>
                <TableCell className="text-right font-mono">
                  <Hoverable
                    symbol={data.symbol}
                    metric="max_supply"
                    value={data.maxSupply || 0}
                    onChatTrigger={onChatTrigger}
                    metricLabel="Max Supply"
                  >
                    <span>{formatNumber(data.maxSupply)}</span>
                  </Hoverable>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Price Performance */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead colSpan={2} className="text-base font-semibold">
                Price Performance
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">
                <MetricNameHover metricName="24h Change">
                  24h Change
                </MetricNameHover>
              </TableCell>
              <TableCell className="text-right font-mono">
                <Hoverable
                  symbol={data.symbol}
                  metric="percent_change_24h"
                  value={data.percentChange24h || 0}
                  onChatTrigger={onChatTrigger}
                  metricLabel="24h Change"
                >
                  <span className={data.percentChange24h && data.percentChange24h >= 0 ? "text-green-600" : "text-red-600"}>
                    {formatPercentage(data.percentChange24h)}
                  </span>
                </Hoverable>
              </TableCell>
            </TableRow>
            {hasValidData(data.percentChange7d) && (
              <TableRow>
                <TableCell className="font-medium">
                  <MetricNameHover metricName="7d Change">
                    7d Change
                  </MetricNameHover>
                </TableCell>
                <TableCell className="text-right font-mono">
                  <Hoverable
                    symbol={data.symbol}
                    metric="percent_change_7d"
                    value={data.percentChange7d || 0}
                    onChatTrigger={onChatTrigger}
                    metricLabel="7d Change"
                  >
                    <span className={data.percentChange7d && data.percentChange7d >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatPercentage(data.percentChange7d)}
                    </span>
                  </Hoverable>
                </TableCell>
              </TableRow>
            )}
            {hasValidData(data.percentChange30d) && (
              <TableRow>
                <TableCell className="font-medium">
                  <MetricNameHover metricName="30d Change">
                    30d Change
                  </MetricNameHover>
                </TableCell>
                <TableCell className="text-right font-mono">
                  <Hoverable
                    symbol={data.symbol}
                    metric="percent_change_30d"
                    value={data.percentChange30d || 0}
                    onChatTrigger={onChatTrigger}
                    metricLabel="30d Change"
                  >
                    <span className={data.percentChange30d && data.percentChange30d >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatPercentage(data.percentChange30d)}
                    </span>
                  </Hoverable>
                </TableCell>
              </TableRow>
            )}
            {hasValidData(data.allTimeHigh) && (
              <TableRow>
                <TableCell className="font-medium">
                  <MetricNameHover metricName="All-Time High">
                    All-Time High
                  </MetricNameHover>
                </TableCell>
                <TableCell className="text-right font-mono">
                  <Hoverable
                    symbol={data.symbol}
                    metric="all_time_high"
                    value={data.allTimeHigh || 0}
                    onChatTrigger={onChatTrigger}
                    metricLabel="All-Time High"
                  >
                    <span>{formatCurrency(data.allTimeHigh)}</span>
                  </Hoverable>
                </TableCell>
              </TableRow>
            )}
            {hasValidData(data.allTimeLow) && (
              <TableRow>
                <TableCell className="font-medium">
                  <MetricNameHover metricName="All-Time Low">
                    All-Time Low
                  </MetricNameHover>
                </TableCell>
                <TableCell className="text-right font-mono">
                  <Hoverable
                    symbol={data.symbol}
                    metric="all_time_low"
                    value={data.allTimeLow || 0}
                    onChatTrigger={onChatTrigger}
                    metricLabel="All-Time Low"
                  >
                    <span>{formatCurrency(data.allTimeLow)}</span>
                  </Hoverable>
                </TableCell>
              </TableRow>
            )}
            {hasValidData(data.fiftyTwoWeekHigh) && (
              <TableRow>
                <TableCell className="font-medium">
                  <MetricNameHover metricName="52W High">
                    52W High
                  </MetricNameHover>
                </TableCell>
                <TableCell className="text-right font-mono">
                  <Hoverable
                    symbol={data.symbol}
                    metric="fifty_two_week_high"
                    value={data.fiftyTwoWeekHigh || 0}
                    onChatTrigger={onChatTrigger}
                    metricLabel="52W High"
                  >
                    <span>{formatCurrency(data.fiftyTwoWeekHigh)}</span>
                  </Hoverable>
                </TableCell>
              </TableRow>
            )}
            {hasValidData(data.fiftyTwoWeekLow) && (
              <TableRow>
                <TableCell className="font-medium">
                  <MetricNameHover metricName="52W Low">
                    52W Low
                  </MetricNameHover>
                </TableCell>
                <TableCell className="text-right font-mono">
                  <Hoverable
                    symbol={data.symbol}
                    metric="fifty_two_week_low"
                    value={data.fiftyTwoWeekLow || 0}
                    onChatTrigger={onChatTrigger}
                    metricLabel="52W Low"
                  >
                    <span>{formatCurrency(data.fiftyTwoWeekLow)}</span>
                  </Hoverable>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Technology & Community (if available) */}
        {(data.algorithm || hasValidData(data.githubActivity) || hasValidData(data.communityScore) || hasValidData(data.developerScore)) && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead colSpan={2} className="text-base font-semibold">
                  Technology & Community
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.algorithm && (
                <TableRow>
                  <TableCell className="font-medium">Algorithm</TableCell>
                  <TableCell className="text-right">{data.algorithm}</TableCell>
                </TableRow>
              )}
              {hasValidData(data.githubActivity) && (
                <TableRow>
                  <TableCell className="font-medium">
                    <MetricNameHover metricName="GitHub Activity">
                      GitHub Activity
                    </MetricNameHover>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <Hoverable
                      symbol={data.symbol}
                      metric="github_activity"
                      value={data.githubActivity || 0}
                      onChatTrigger={onChatTrigger}
                      metricLabel="GitHub Activity"
                    >
                      <span>{formatRatio(data.githubActivity)}</span>
                    </Hoverable>
                  </TableCell>
                </TableRow>
              )}
              {hasValidData(data.communityScore) && (
                <TableRow>
                  <TableCell className="font-medium">
                    <MetricNameHover metricName="Community Score">
                      Community Score
                    </MetricNameHover>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <Hoverable
                      symbol={data.symbol}
                      metric="community_score"
                      value={data.communityScore || 0}
                      onChatTrigger={onChatTrigger}
                      metricLabel="Community Score"
                    >
                      <span>{formatRatio(data.communityScore)}</span>
                    </Hoverable>
                  </TableCell>
                </TableRow>
              )}
              {hasValidData(data.developerScore) && (
                <TableRow>
                  <TableCell className="font-medium">
                    <MetricNameHover metricName="Developer Score">
                      Developer Score
                    </MetricNameHover>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <Hoverable
                      symbol={data.symbol}
                      metric="developer_score"
                      value={data.developerScore || 0}
                      onChatTrigger={onChatTrigger}
                      metricLabel="Developer Score"
                    >
                      <span>{formatRatio(data.developerScore)}</span>
                    </Hoverable>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

        {/* Risk & Analytics (if available) */}
        {(hasValidData(data.volatility) || hasValidData(data.beta) || hasValidData(data.sharpeRatio) || hasValidData(data.liquidityScore)) && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead colSpan={2} className="text-base font-semibold">
                  Risk & Analytics
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hasValidData(data.volatility) && (
                <TableRow>
                  <TableCell className="font-medium">
                    <MetricNameHover metricName="Volatility">
                      Volatility
                    </MetricNameHover>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <Hoverable
                      symbol={data.symbol}
                      metric="volatility"
                      value={data.volatility || 0}
                      onChatTrigger={onChatTrigger}
                      metricLabel="Volatility"
                    >
                      <span>{formatPercentage(data.volatility)}</span>
                    </Hoverable>
                  </TableCell>
                </TableRow>
              )}
              {hasValidData(data.beta) && (
                <TableRow>
                  <TableCell className="font-medium">
                    <MetricNameHover metricName="Beta">
                      Beta
                    </MetricNameHover>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <Hoverable
                      symbol={data.symbol}
                      metric="beta"
                      value={data.beta || 0}
                      onChatTrigger={onChatTrigger}
                      metricLabel="Beta"
                    >
                      <span>{formatRatio(data.beta)}</span>
                    </Hoverable>
                  </TableCell>
                </TableRow>
              )}
              {hasValidData(data.sharpeRatio) && (
                <TableRow>
                  <TableCell className="font-medium">
                    <MetricNameHover metricName="Sharpe Ratio">
                      Sharpe Ratio
                    </MetricNameHover>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <Hoverable
                      symbol={data.symbol}
                      metric="sharpe_ratio"
                      value={data.sharpeRatio || 0}
                      onChatTrigger={onChatTrigger}
                      metricLabel="Sharpe Ratio"
                    >
                      <span>{formatRatio(data.sharpeRatio)}</span>
                    </Hoverable>
                  </TableCell>
                </TableRow>
              )}
              {hasValidData(data.liquidityScore) && (
                <TableRow>
                  <TableCell className="font-medium">
                    <MetricNameHover metricName="Liquidity Score">
                      Liquidity Score
                    </MetricNameHover>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <Hoverable
                      symbol={data.symbol}
                      metric="liquidity_score"
                      value={data.liquidityScore || 0}
                      onChatTrigger={onChatTrigger}
                      metricLabel="Liquidity Score"
                    >
                      <span>{formatRatio(data.liquidityScore)}</span>
                    </Hoverable>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default CryptoFinancialTable; 