"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, AlertCircle, Building, Heart, Zap, TrendingUp } from "lucide-react";

export default function SearchPage() {
	const router = useRouter();
	const [searchTerm, setSearchTerm] = useState("");
	const [isSearching, setIsSearching] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Popular categories for quick access
	const STOCK_CATEGORIES = [
		{
			title: "Tech Giants",
			icon: <Zap className="h-5 w-5" />,
			stocks: [
				{ symbol: "AAPL", name: "Apple Inc." },
				{ symbol: "MSFT", name: "Microsoft Corporation" },
				{ symbol: "GOOGL", name: "Alphabet Inc." },
				{ symbol: "AMZN", name: "Amazon.com Inc." },
				{ symbol: "META", name: "Meta Platforms Inc." },
				{ symbol: "NVDA", name: "NVIDIA Corporation" },
			],
		},
		{
			title: "Financial Services",
			icon: <Building className="h-5 w-5" />,
			stocks: [
				{ symbol: "JPM", name: "JPMorgan Chase & Co." },
				{ symbol: "BAC", name: "Bank of America Corp" },
				{ symbol: "WFC", name: "Wells Fargo & Company" },
				{ symbol: "GS", name: "Goldman Sachs Group Inc" },
				{ symbol: "V", name: "Visa Inc." },
				{ symbol: "MA", name: "Mastercard Inc." },
			],
		},
		{
			title: "Healthcare",
			icon: <Heart className="h-5 w-5" />,
			stocks: [
				{ symbol: "JNJ", name: "Johnson & Johnson" },
				{ symbol: "PFE", name: "Pfizer Inc." },
				{ symbol: "UNH", name: "UnitedHealth Group Inc" },
				{ symbol: "ABBV", name: "AbbVie Inc." },
				{ symbol: "MRK", name: "Merck & Co Inc" },
				{ symbol: "LLY", name: "Eli Lilly and Company" },
			],
		},
		{
			title: "Energy & Utilities",
			icon: <TrendingUp className="h-5 w-5" />,
			stocks: [
				{ symbol: "XOM", name: "Exxon Mobil Corporation" },
				{ symbol: "CVX", name: "Chevron Corporation" },
				{ symbol: "NEE", name: "NextEra Energy Inc" },
				{ symbol: "DUK", name: "Duke Energy Corporation" },
				{ symbol: "SO", name: "Southern Company" },
				{ symbol: "COP", name: "ConocoPhillips" },
			],
		},
	];

	const searchStock = async (symbol: string) => {
		if (!symbol.trim()) {
			setError("Please enter a stock symbol");
			return;
		}

		setIsSearching(true);
		setError(null);

		try {
			// First, try to validate the stock exists by fetching basic data
			const response = await fetch(`/api/stock-data?symbol=${symbol.toUpperCase()}`);
			const result = await response.json();

			if (response.ok && result.data) {
				if (symbol.toUpperCase().includes("-")) {
					// Crypto exists, navigate directly to crypto page
					router.push(`/crypto?query=${symbol.toUpperCase()}`);
				} else {
					// Stock exists, navigate directly to company page
					router.push(`/company/${symbol.toUpperCase()}`);
				}
			} else {
				// Stock doesn't exist or API error
				setError(`"${symbol.toUpperCase()}" is not a valid stock symbol or data is not available.`);
			}
		} catch (err) {
			console.error("Search error:", err);
			setError("Search failed. Please check your internet connection and try again.");
		} finally {
			setIsSearching(false);
		}
	};

	const handleSearchSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		searchStock(searchTerm);
	};

	const handleQuickSearch = (symbol: string) => {
		setSearchTerm(symbol);
		searchStock(symbol);
	};

	return (
		<div className="flex-1 space-y-6 p-6 overflow-x-hidden max-w-full">
			{/* Header */}
			<div className="space-y-2">
				<h1 className="text-3xl font-bold tracking-tight">Discover</h1>
				<p className="text-muted-foreground">Search for any publicly traded stock on Yahoo Finance. Enter a ticker symbol to get comprehensive financial analysis.</p>
			</div>

			{/* Main Search Card */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Search className="h-5 w-5" />
						Stock Symbol Search
					</CardTitle>
					<CardDescription>Enter a ticker symbol like AAPL, TSLA, or MSFT</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<form onSubmit={handleSearchSubmit} className="flex gap-4">
						<div className="flex-1">
							<Input id="stock-search" type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value.toUpperCase())} placeholder="Type any stock symbol..." className="text-lg font-mono" disabled={isSearching} />
						</div>
						<Button type="submit" disabled={isSearching || !searchTerm.trim()} className="px-8">
							{isSearching ? "Searching..." : "Search"}
						</Button>
					</form>

					{/* Error Display */}
					{error && (
						<Card className="border-destructive bg-destructive/10">
							<CardContent className="pt-6">
								<div className="flex items-start gap-3">
									<AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
									<div className="space-y-2">
										<p className="font-medium text-destructive">Search Error</p>
										<p className="text-sm text-destructive/80">{error}</p>
										<div className="space-y-1">
											<p className="text-sm font-medium text-destructive">Tips:</p>
											<ul className="text-sm text-destructive/80 space-y-1 ml-4">
												<li>• Make sure you&apos;re using the correct ticker symbol</li>
												<li>• Try searching for major exchanges (NYSE, NASDAQ)</li>
												<li>• Some international stocks may not be available</li>
											</ul>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					)}

					{/* Search Tips */}
					<Card className="border-primary/20 bg-primary/5">
						<CardContent className="pt-4">
							<h4 className="font-medium text-primary mb-2">Search Tips:</h4>
							<ul className="text-sm text-muted-foreground space-y-1">
								<li>• Enter ticker symbols like AAPL, GOOGL, TSLA</li>
								<li>• Works with most NYSE and NASDAQ stocks</li>
								<li>• International stocks may be available with proper suffixes</li>
								<li>• ETFs and mutual funds are also supported</li>
							</ul>
						</CardContent>
					</Card>
				</CardContent>
			</Card>

			{/* Browse by Category */}
			<div className="space-y-4">
				<h2 className="text-2xl font-bold tracking-tight">Browse by Category</h2>

				<div className="grid gap-6">
					{STOCK_CATEGORIES.map((category) => (
						<Card key={category.title}>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									{category.icon}
									{category.title}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
									{category.stocks.map((stock) => (
										<Button key={stock.symbol} variant="outline" className="h-auto flex-col items-start space-y-2 p-4" onClick={() => handleQuickSearch(stock.symbol)}>
											<div className="flex w-full items-center justify-between">
												<span className="font-semibold">{stock.symbol}</span>
												<span className="text-muted-foreground">→</span>
											</div>
											<span className="text-left text-sm text-muted-foreground">{stock.name}</span>
										</Button>
									))}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			</div>

			{/* Example Searches */}
			<Card>
				<CardHeader>
					<CardTitle>Popular Examples</CardTitle>
					<CardDescription>Quick access to commonly searched stocks</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-wrap gap-2">
						{["AAPL", "TSLA", "GOOGL", "AMZN", "MSFT", "NVDA", "META", "NFLX", "UBER", "SPOT"].map((symbol) => (
							<Button key={symbol} variant="secondary" size="sm" onClick={() => handleQuickSearch(symbol)} className="font-mono">
								{symbol}
							</Button>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
