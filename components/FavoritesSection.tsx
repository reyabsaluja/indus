"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, TrendingUp, TrendingDown, X } from "lucide-react";
import { useFavorites } from "@/lib/context/FavoritesContext";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface StockData {
	symbol: string;
	shortName: string;
	regularMarketPrice: number;
	regularMarketChange: number;
	regularMarketChangePercent: number;
	currency: string;
}

interface FavoriteStockCardProps {
	symbol: string;
	index: number;
}

// Function to fetch real stock data
async function fetchStockData(symbol: string): Promise<StockData | null> {
	try {
		const response = await fetch(`/api/stock-data?symbol=${symbol}`);
		if (!response.ok) {
			throw new Error(`Failed to fetch data for ${symbol}`);
		}
		const result = await response.json();

		const stockData = {
			symbol: result.data.symbol,
			shortName: result.data.shortName || result.data.longName || symbol,
			regularMarketPrice: result.data.regularMarketPrice || 0,
			regularMarketChange: result.data.regularMarketChange || 0,
			regularMarketChangePercent: result.data.regularMarketChangePercent || 0,
			currency: result.data.currency || "USD",
		};

		return stockData;
	} catch (error) {
		console.error(`Error fetching stock data for ${symbol}:`, error);
		return null;
	}
}

function FavoriteStockCard({ symbol, index }: FavoriteStockCardProps) {
	const { removeFromFavorites } = useFavorites();
	const router = useRouter();
	const [isVisible, setIsVisible] = useState(false);
	const [stockData, setStockData] = useState<StockData | null>(null);
	const [isLoadingData, setIsLoadingData] = useState(true);

	// Fetch real stock data
	useEffect(() => {
		const loadStockData = async () => {
			setIsLoadingData(true);
			const data = await fetchStockData(symbol);
			setStockData(data);
			setIsLoadingData(false);
		};

		loadStockData();
	}, [symbol]);

	// Animate in after mount
	useEffect(() => {
		const timer = setTimeout(() => {
			setIsVisible(true);
		}, index * 100); // Stagger animation

		return () => clearTimeout(timer);
	}, [index]);

	const handleRemove = async (e: React.MouseEvent) => {
		e.stopPropagation();
		await removeFromFavorites(symbol);
	};

	const handleClick = () => {
		router.push(`/company/${symbol}`);
	};

	// Use real data or fallback values
	const price = stockData?.regularMarketPrice || 0;
	const change = stockData?.regularMarketChange || 0;
	const changePercent = stockData?.regularMarketChangePercent || 0;
	const isPositive = change >= 0;
	const companyName = stockData?.shortName || symbol;

	// Generate realistic chart data points based on real price and change
	const generateChartData = () => {
		if (!stockData) return [];

		const points = [];
		const startPrice = price - change; // Yesterday's close
		const totalPoints = 12;

		// Create a more realistic intraday pattern
		for (let i = 0; i < totalPoints; i++) {
			const progress = i / (totalPoints - 1);

			// Base trend from start to end price
			const baseTrend = startPrice + change * progress;

			// Add some realistic intraday volatility
			const volatility = Math.abs(change) * 0.3; // 30% of total change as volatility
			const noise = (Math.random() - 0.5) * volatility;

			// Add some momentum - price movements tend to trend
			const momentum = Math.sin(progress * Math.PI) * (Math.abs(change) * 0.2);

			const point = baseTrend + noise + (isPositive ? momentum : -momentum);
			points.push(Math.max(point, 0.01)); // Ensure positive price
		}

		// Ensure the last point matches the current price
		points[points.length - 1] = price;

		return points;
	};

	const chartData = generateChartData();
	const maxPrice = chartData.length > 0 ? Math.max(...chartData) : price;
	const minPrice = chartData.length > 0 ? Math.min(...chartData) : price;

	if (isLoadingData) {
		return (
			<Card className="min-w-[280px]">
				<CardContent className="p-4">
					<div className="space-y-3">
						<div className="flex items-start justify-between">
							<div className="space-y-2">
								<Skeleton className="h-5 w-16" />
								<Skeleton className="h-4 w-24" />
							</div>
							<Skeleton className="h-8 w-8 rounded" />
						</div>
						<div className="flex items-center justify-between">
							<Skeleton className="h-8 w-20" />
							<Skeleton className="h-6 w-16 rounded-full" />
						</div>
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-16 w-full rounded-md" />
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!stockData) {
		return (
			<Card className="min-w-[280px] border-destructive/50">
				<CardContent className="p-4">
					<div className="text-center">
						<p className="text-sm text-destructive">Failed to load {symbol}</p>
						<Button variant="ghost" size="sm" onClick={handleRemove} className="mt-2 text-destructive hover:text-destructive">
							Remove
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={cn("min-w-[280px] cursor-pointer transition-all duration-500 hover:shadow-lg hover:scale-[1.02] group relative overflow-hidden", isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4")} onClick={handleClick}>
			{/* Gradient background on hover */}
			<div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

			<CardContent className="p-4 relative">
				<div className="flex items-start justify-between mb-3">
					<div className="flex-1 min-w-0">
						<h3 className="font-bold text-lg tracking-tight">{symbol}</h3>
						<p className="text-sm text-muted-foreground truncate">{companyName}</p>
					</div>
					<Button variant="ghost" size="sm" onClick={handleRemove} className="opacity-0 group-hover:opacity-100 transition-all duration-200 h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900/20 hover:scale-110">
						<X className="h-4 w-4 text-muted-foreground hover:text-red-500" />
					</Button>
				</div>

				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<div className="text-2xl font-bold tracking-tight">${price.toFixed(2)}</div>
						<Badge variant={isPositive ? "default" : "destructive"} className={cn("flex items-center gap-1 transition-all duration-200", isPositive ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400")}>
							{isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
							{isPositive ? "+" : ""}
							{changePercent.toFixed(2)}%
						</Badge>
					</div>

					<div className={cn("text-sm font-medium", isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
						{isPositive ? "+" : ""}${change.toFixed(2)} today
					</div>
				</div>

				{/* Mini Chart with animated line */}
				{chartData.length > 0 && (
					<div className="mt-4 h-16 w-full relative overflow-hidden rounded-md bg-muted/20">
						<svg width="100%" height="100%" viewBox="0 0 100 40" className="absolute inset-0">
							{/* Background grid */}
							<defs>
								<pattern id={`grid-${symbol}`} width="10" height="10" patternUnits="userSpaceOnUse">
									<path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.1" />
								</pattern>
							</defs>
							<rect width="100" height="40" fill={`url(#grid-${symbol})`} />

							{/* Animated chart line */}
							<path
								d={chartData
									.map((pricePoint, i) => {
										const x = (i / (chartData.length - 1)) * 100;
										const y = 35 - ((pricePoint - minPrice) / (maxPrice - minPrice)) * 30;
										return `${i === 0 ? "M" : "L"} ${x} ${y}`;
									})
									.join(" ")}
								fill="none"
								stroke={isPositive ? "#22c55e" : "#ef4444"}
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="drop-shadow-sm"
								style={{
									strokeDasharray: isVisible ? "none" : "200",
									strokeDashoffset: isVisible ? "0" : "200",
									transition: "stroke-dashoffset 1.5s ease-in-out",
								}}
							/>

							{/* Gradient fill under the line */}
							<defs>
								<linearGradient id={`gradient-${symbol}`} x1="0%" y1="0%" x2="0%" y2="100%">
									<stop offset="0%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity="0.3" />
									<stop offset="100%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity="0" />
								</linearGradient>
							</defs>
							<path
								d={
									chartData
										.map((pricePoint, i) => {
											const x = (i / (chartData.length - 1)) * 100;
											const y = 35 - ((pricePoint - minPrice) / (maxPrice - minPrice)) * 30;
											return `${i === 0 ? "M" : "L"} ${x} ${y}`;
										})
										.join(" ") + " L 100 40 L 0 40 Z"
								}
								fill={`url(#gradient-${symbol})`}
								className="opacity-60"
							/>
						</svg>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function FavoritesLoadingSkeleton() {
	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<Skeleton className="h-5 w-5 rounded" />
				<Skeleton className="h-6 w-24" />
				<Skeleton className="h-5 w-8 rounded-full" />
			</div>
			<div className="flex gap-4 overflow-x-auto pb-4">
				{[1, 2, 3].map((i) => (
					<Card key={i} className="min-w-[280px]">
						<CardContent className="p-4">
							<div className="space-y-3">
								<div className="flex items-start justify-between">
									<div className="space-y-2">
										<Skeleton className="h-5 w-16" />
										<Skeleton className="h-4 w-24" />
									</div>
									<Skeleton className="h-8 w-8 rounded" />
								</div>
								<div className="flex items-center justify-between">
									<Skeleton className="h-8 w-20" />
									<Skeleton className="h-6 w-16 rounded-full" />
								</div>
								<Skeleton className="h-4 w-16" />
								<Skeleton className="h-16 w-full rounded-md" />
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}

export function FavoritesSection() {
	const { favorites, loading } = useFavorites();

	if (loading) {
		return <FavoritesLoadingSkeleton />;
	}

	if (favorites.length === 0) {
		return (
			<div className="space-y-4">
				<div className="flex items-center gap-2">
					<Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
					<h2 className="text-xl font-semibold tracking-tight">Your Favorites</h2>
				</div>
				<Card className="border-dashed">
					<CardContent className="flex flex-col items-center justify-center py-12 text-center">
						<div className="rounded-full bg-muted p-4 mb-4">
							<Star className="h-8 w-8 text-muted-foreground" />
						</div>
						<h3 className="text-lg font-semibold mb-2">No favorites yet</h3>
						<p className="text-muted-foreground max-w-sm">Add stocks to your favorites by clicking the star icon on any company page. They&apos;ll appear here for quick access.</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
				<h2 className="text-xl font-semibold tracking-tight">Your Favorites</h2>
				<Badge variant="secondary" className="font-medium">
					{favorites.length}
				</Badge>
			</div>
			<div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
				{favorites.map((stock, index) => (
					<FavoriteStockCard key={stock.symbol} symbol={stock.symbol} index={index} />
				))}
			</div>
		</div>
	);
}
