"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, TrendingUp, Activity, BarChart3 } from "lucide-react";
import { FavoritesSection } from "@/components/FavoritesSection";

// Popular stocks organized by categories
const POPULAR_STOCKS = [
  { symbol: "AAPL", name: "Apple Inc.", category: "Tech" },
  { symbol: "MSFT", name: "Microsoft Corporation", category: "Tech" },
  { symbol: "GOOGL", name: "Alphabet Inc.", category: "Tech" },
  { symbol: "AMZN", name: "Amazon.com Inc.", category: "Tech" },
  { symbol: "TSLA", name: "Tesla Inc.", category: "Auto" },
  { symbol: "NVDA", name: "NVIDIA Corporation", category: "Tech" },
  { symbol: "META", name: "Meta Platforms Inc.", category: "Tech" },
  { symbol: "NFLX", name: "Netflix Inc.", category: "Media" },
];

const TRENDING_STOCKS = [
  { symbol: "CRM", name: "Salesforce Inc." },
  { symbol: "ORCL", name: "Oracle Corporation" },
  { symbol: "AMD", name: "Advanced Micro Devices" },
  { symbol: "UBER", name: "Uber Technologies Inc." },
  { symbol: "SPOT", name: "Spotify Technology" },
  { symbol: "SHOP", name: "Shopify Inc." },
];

export default function Dashboard() {
  const router = useRouter();

  const handleStockClick = (symbol: string) => {
    router.push(`/company/${symbol}`);
  };

  return (
    <div className="flex-1 space-y-6 p-6 overflow-x-hidden max-w-full">
      {/* Header Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Explore popular stocks and get comprehensive financial insights with
          AI-powered explanations
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card
          className="cursor-pointer transition-colors hover:bg-accent/50"
          onClick={() => router.push("/search")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-xl">Search Any Stock</CardTitle>
              <CardDescription>
                Search for any publicly traded company on Yahoo Finance
              </CardDescription>
            </div>
            <Search className="h-8 w-8 text-primary" />
          </CardHeader>
        </Card>

        <Card
          className="cursor-pointer transition-colors hover:bg-accent/50"
          onClick={() => router.push("/company/AAPL")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-xl">View Sample Analysis</CardTitle>
              <CardDescription>
                See a detailed financial analysis of Apple Inc. (AAPL)
              </CardDescription>
            </div>
            <BarChart3 className="h-8 w-8 text-primary" />
          </CardHeader>
        </Card>
      </div>

      {/* Favorites Section */}
      <FavoritesSection />

      {/* Popular Stocks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Popular Stocks
          </CardTitle>
          <CardDescription>
            Most actively searched stocks across all categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {POPULAR_STOCKS.map((stock) => (
              <Button
                key={stock.symbol}
                variant="outline"
                className="h-auto flex-col items-start space-y-2 p-4"
                onClick={() => handleStockClick(stock.symbol)}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-semibold">{stock.symbol}</span>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {stock.category}
                  </span>
                </div>
                <span className="text-left text-sm text-muted-foreground">
                  {stock.name}
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trending Stocks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Trending Stocks
          </CardTitle>
          <CardDescription>
            Stocks gaining momentum and investor interest
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TRENDING_STOCKS.map((stock) => (
              <Button
                key={stock.symbol}
                variant="outline"
                className="h-auto flex-col items-start space-y-2 p-4"
                onClick={() => handleStockClick(stock.symbol)}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-semibold">{stock.symbol}</span>
                  <span className="text-muted-foreground">→</span>
                </div>
                <span className="text-left text-sm text-muted-foreground">
                  {stock.name}
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
