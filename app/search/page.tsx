"use client";

import { AlertCircle, Building, Heart, Search, TrendingUp, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
		} catch {
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
			<h1 className="text-3xl font-bold tracking-tight">Discover</h1>

			{/* Main Search Card */}
			<Card className="gap-4 py-4">
				<CardHeader className="gap-1 px-4 sm:px-5">
					<CardTitle className="flex items-center gap-2">
						<Search className="h-5 w-5" />
						Stock Symbol Search
					</CardTitle>
					<CardDescription>Enter a ticker symbol like AAPL, TSLA, or MSFT</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3 px-4 sm:px-5">
					<form onSubmit={handleSearchSubmit} className="flex flex-col gap-2 sm:flex-row">
						<div className="flex-1">
							<Input
								id="stock-search"
								type="text"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
								placeholder="Type any stock symbol..."
								className="text-lg font-mono"
								disabled={isSearching}
							/>
						</div>
						<Button type="submit" disabled={isSearching || !searchTerm.trim()} className="px-5">
							{isSearching ? "Searching..." : "Search"}
						</Button>
					</form>

					{error && (
						<Card className="border-destructive bg-destructive/10">
							<CardContent className="pt-6">
								<div className="flex items-start gap-3">
									<AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
									<div>
										<p className="font-medium text-destructive">Search Error</p>
										<p className="text-sm text-destructive/80">{error}</p>
									</div>
								</div>
							</CardContent>
						</Card>
					)}
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
										<Button
											key={stock.symbol}
											variant="outline"
											className="h-auto flex-col items-start space-y-2 p-4"
											onClick={() => handleQuickSearch(stock.symbol)}
										>
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
		</div>
	);
}
