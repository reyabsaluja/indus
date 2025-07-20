"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CryptoFinancialTable from "@/components/CryptoFinancialTable";
import CryptoChart from "@/components/CryptoChart";
import { batchPreload } from "@/hooks/useExplanation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Coins, TrendingUp, DollarSign, ChevronDown, ChevronUp } from "lucide-react";

type CryptoData = {
	symbol: string;
	name?: string;
	fullName?: string;
	regularMarketPrice?: number;
	currency?: string;
	description?: string;
	website?: string;
	category?: string;
	algorithm?: string;
	marketCap?: number;
	totalSupply?: number;
	circulatingSupply?: number;
	maxSupply?: number;
	volume?: number;
	percentChange24h?: number;
	percentChange7d?: number;
	percentChange30d?: number;
	allTimeHigh?: number;
	allTimeLow?: number;
	ath24hChange?: number;
	atl24hChange?: number;
	rank?: number;
	dominance?: number;
	priceToSales?: number;
	// Additional crypto-specific metrics
	volatility?: number;
	beta?: number;
	sharpeRatio?: number;
	tradingPairs?: number;
	githubActivity?: number;
	communityScore?: number;
	developerScore?: number;
	liquidityScore?: number;
};

const CryptoPage: React.FC = () => {
	const router = useRouter();
	const searchParams = useSearchParams();
	const query = searchParams!.get("query"); // e.g., "BTC-USD"
	const [coin, cur] = query!.split("-"); // Parse crypto symbol (e.g., "BTC-USD" -> coin=BTC, cur=USD)

	const [cryptoData, setCryptoData] = useState<CryptoData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showFullDescription, setShowFullDescription] = useState(false);

	const fetchCryptoData = async (cryptoSymbol: string) => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch(`/api/stock-data?symbol=${cryptoSymbol}`);
			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || "Failed to fetch data");
			}

			setCryptoData(result.data);

			// Prepare items for batch preload of AI explanations with actual values
			const data = result.data;
			const items = [
				{
					symbol: cryptoSymbol.toUpperCase(),
					metric: "market_cap",
					value: data.marketCap || 0,
				},
				{
					symbol: cryptoSymbol.toUpperCase(),
					metric: "total_supply",
					value: data.totalSupply || 0,
				},
				{
					symbol: cryptoSymbol.toUpperCase(),
					metric: "circulating_supply",
					value: data.circulatingSupply || 0,
				},
				{
					symbol: cryptoSymbol.toUpperCase(),
					metric: "max_supply",
					value: data.maxSupply || 0,
				},
				{
					symbol: cryptoSymbol.toUpperCase(),
					metric: "volume_24h",
					value: data.volume || 0,
				},
				{
					symbol: cryptoSymbol.toUpperCase(),
					metric: "percent_change_24h",
					value: data.percentChange24h || 0,
				},
				{
					symbol: cryptoSymbol.toUpperCase(),
					metric: "percent_change_7d",
					value: data.percentChange7d || 0,
				},
				{
					symbol: cryptoSymbol.toUpperCase(),
					metric: "percent_change_30d",
					value: data.percentChange30d || 0,
				},
				{
					symbol: cryptoSymbol.toUpperCase(),
					metric: "all_time_high",
					value: data.allTimeHigh || 0,
				},
				{
					symbol: cryptoSymbol.toUpperCase(),
					metric: "all_time_low",
					value: data.allTimeLow || 0,
				},
				{
					symbol: cryptoSymbol.toUpperCase(),
					metric: "dominance",
					value: data.dominance || 0,
				},
				{
					symbol: cryptoSymbol.toUpperCase(),
					metric: "volatility",
					value: data.volatility || 0,
				},
				{
					symbol: cryptoSymbol.toUpperCase(),
					metric: "liquidity_score",
					value: data.liquidityScore || 0,
				},
			].filter((item) => item.value !== 0);

			// Preload AI explanations for all metrics with actual values
			if (items.length > 0) {
				batchPreload(items);
			}
		} catch (err) {
			console.error("Error fetching crypto data:", err);
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		if (query) {
			fetchCryptoData(query);
		} else {
			setIsLoading(false);
		}
	}, [query]);

	// Helper function to get display symbol (e.g., "BTC" from "BTC/USD")
	const getDisplaySymbol = (fullSymbol: string) => {
		return fullSymbol?.split("/")[0] || fullSymbol;
	};

	if (!query) {
		return (
			<div className="flex-1 flex items-center justify-center p-6">
				<Card className="w-full max-w-md">
					<CardHeader className="text-center">
						<CardTitle className="flex items-center justify-center gap-2">
							<Coins className="h-6 w-6" />
							No Cryptocurrency Selected
						</CardTitle>
						<CardDescription>Please select a cryptocurrency to view.</CardDescription>
					</CardHeader>
					<CardContent className="text-center">
						<Button onClick={() => router.push("/crypto-search")}>Browse Cryptocurrencies</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex-1 space-y-6 p-6 overflow-x-hidden max-w-full">
			{/* Navigation */}
			<div>
				<Button variant="ghost" onClick={() => router.push("/crypto-search")} className="mb-4">
					<ArrowLeft className="h-4 w-4 mr-2" />
					Back to Crypto Search
				</Button>
			</div>

			{/* Loading State */}
			{isLoading && (
				<div className="flex items-center justify-center py-12">
					<Card className="w-full max-w-md">
						<CardContent className="flex items-center justify-center space-x-2 py-8">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
							<span className="text-muted-foreground">Loading {getDisplaySymbol(query)} crypto data...</span>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Error State */}
			{error && (
				<Card className="border-destructive bg-destructive/10">
					<CardHeader>
						<CardTitle className="text-destructive">Error Loading Data</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-destructive/80">{error}</p>
						<p className="text-sm text-muted-foreground">Make sure &quot;{query}&quot; is a valid cryptocurrency symbol.</p>
						<Button variant="destructive" onClick={() => router.push("/crypto-search")}>
							Back to Crypto Search
						</Button>
					</CardContent>
				</Card>
			)}

			{/* Crypto Data */}
			{cryptoData && !isLoading && (
				<div className="space-y-6">
					{/* Crypto Header */}
					<div className="grid gap-4 md:grid-cols-3">
						<Card className="md:col-span-3">
							<CardHeader className="pb-3">
								<div className="flex items-center gap-2">
									<Coins className="h-6 w-6" />
									<div className="flex-1">
										<CardTitle className="text-2xl">{cryptoData.fullName || cryptoData.name || getDisplaySymbol(query)}</CardTitle>
										<CardDescription className="text-lg font-mono">{query}</CardDescription>
									</div>
								</div>
							</CardHeader>
							{cryptoData.description && (
								<CardContent className="space-y-4">
									{/* Crypto Overview */}
									<div>
										<h3 className="font-semibold text-lg mb-2">Project Overview</h3>
										<div className="space-y-2">
											<p className="text-muted-foreground text-sm leading-relaxed">{showFullDescription ? cryptoData.description : `${cryptoData.description.slice(0, 600)}${cryptoData.description.length > 300 ? "..." : ""}`}</p>
											{cryptoData.description.length > 600 && (
												<Button variant="ghost" size="sm" onClick={() => setShowFullDescription(!showFullDescription)} className="px-0 py-1 h-auto text-primary hover:text-primary/80 -ml-2">
													{showFullDescription ? (
														<>
															Show Less <ChevronUp className="h-3 w-3" />
														</>
													) : (
														<>
															Show More <ChevronDown className="h-3 w-3" />
														</>
													)}
												</Button>
											)}
										</div>
									</div>

									{/* Crypto Details Grid */}
									<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-4 border-t">
										{cryptoData.website && (
											<div>
												<p className="text-sm font-medium">Website</p>
												<a href={`https://${cryptoData.website.replace(/^https?:\/\//, "")}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
													{cryptoData.website.replace(/^https?:\/\//, "")}
												</a>
											</div>
										)}
										{cryptoData.category && (
											<div>
												<p className="text-sm font-medium">Category</p>
												<p className="text-sm text-muted-foreground">{cryptoData.category}</p>
											</div>
										)}
										{cryptoData.algorithm && (
											<div>
												<p className="text-sm font-medium">Algorithm</p>
												<p className="text-sm text-muted-foreground">{cryptoData.algorithm}</p>
											</div>
										)}
										{cryptoData.rank && (
											<div>
												<p className="text-sm font-medium">Market Rank</p>
												<p className="text-sm text-muted-foreground">#{cryptoData.rank}</p>
											</div>
										)}
									</div>

									{/* Current Price */}
									{cryptoData.regularMarketPrice && (
										<div className="flex items-center gap-2 pt-4 border-t">
											<DollarSign className="h-5 w-5 text-green-500" />
											<span className="text-3xl font-bold text-green-500">${cryptoData.regularMarketPrice.toFixed(8)}</span>
											{cryptoData.percentChange24h && (
												<span className={`text-lg font-medium ${cryptoData.percentChange24h >= 0 ? "text-green-500" : "text-red-500"}`}>
													{cryptoData.percentChange24h >= 0 ? "+" : ""}
													{cryptoData.percentChange24h.toFixed(2)}%
												</span>
											)}
										</div>
									)}
								</CardContent>
							)}
						</Card>
					</div>

					{/* Crypto Chart */}
					<Card>
						<CardContent className="p-0">
							<CryptoChart symbol={`${coin}/${cur}`} height={700} showControls={false} />
						</CardContent>
					</Card>

					{/* Key Metrics Cards */}
					<div className="grid gap-4 md:grid-cols-2">
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-base flex items-center gap-2">
									<TrendingUp className="h-4 w-4" />
									Market Cap
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">{cryptoData.marketCap ? `$${(cryptoData.marketCap / 1e9).toFixed(1)}B` : "—"}</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-base flex items-center gap-2">
									<Coins className="h-4 w-4" />
									Circulating Supply
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">{cryptoData.circulatingSupply ? `${(cryptoData.circulatingSupply / 1e6).toFixed(1)}M` : "—"}</div>
							</CardContent>
						</Card>
					</div>

					{/* Financial Metrics Table */}
					<Card>
						<CardHeader>
							<CardTitle>Crypto Metrics</CardTitle>
							<CardDescription>Comprehensive cryptocurrency analysis with AI-powered explanations. Hover over any metric for detailed insights.</CardDescription>
						</CardHeader>
						<CardContent>
							<CryptoFinancialTable data={cryptoData} />
						</CardContent>
					</Card>
				</div>
			)}
		</div>
	);
};

export default CryptoPage;
