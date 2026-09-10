"use client";

import {
	ArrowLeft,
	ArrowRight,
	BrainCircuit,
	Building2,
	ChevronDown,
	ChevronUp,
	ExternalLink,
	Globe2,
	MapPin,
	RefreshCw,
	ShieldCheck,
	Sparkles,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useContextChat } from "@/components/chat/useContextChat";
import { FavoriteButtonCompact } from "@/components/FavoriteButton";
import FinancialTable from "@/components/FinancialTable";
import StockChart from "@/components/StockChart";
import { Button } from "@/components/ui/button";
import type { FinancialData, PageChartData } from "@/lib/types";
import {
	formatCurrency,
	formatLargeNumber,
	formatPercent,
	formatPercentagePoints,
	formatRatio,
} from "@/lib/utils";

interface ResearchLens {
	label: string;
	metric: string;
	value: number;
	displayValue: string;
	question: string;
}

function isNumber(value: number | undefined): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function buildResearchLenses(data: FinancialData): ResearchLens[] {
	return [
		isNumber(data.peRatio)
			? {
					label: "Valuation",
					metric: "pe_ratio",
					value: data.peRatio,
					displayValue: `${formatRatio(data.peRatio)} P/E`,
					question: "What expectations are embedded in this valuation?",
				}
			: null,
		isNumber(data.netProfitMargins)
			? {
					label: "Profitability",
					metric: "net_margin",
					value: data.netProfitMargins,
					displayValue: `${formatPercent(data.netProfitMargins)} net margin`,
					question: "What does this margin say about earnings quality?",
				}
			: null,
		isNumber(data.revenueGrowth)
			? {
					label: "Growth",
					metric: "revenue_growth",
					value: data.revenueGrowth,
					displayValue: `${formatPercent(data.revenueGrowth)} revenue growth`,
					question: "How should I read this growth rate with the margins?",
				}
			: null,
		isNumber(data.debtToEquity)
			? {
					label: "Balance sheet",
					metric: "debt_to_equity",
					value: data.debtToEquity,
					displayValue: `${formatPercentagePoints(data.debtToEquity, 1)} debt/equity`,
					question: "Where is the balance-sheet risk in this view?",
				}
			: null,
	].filter((lens): lens is ResearchLens => lens !== null);
}

export default function CompanyPage() {
	const params = useParams();
	const router = useRouter();
	const symbol = typeof params?.symbol === "string" ? params.symbol.toUpperCase() : "";
	const [financialData, setFinancialData] = useState<FinancialData | null>(null);
	const [chartData, setChartData] = useState<PageChartData>();
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showFullDescription, setShowFullDescription] = useState(false);
	const financialDataRef = useRef<FinancialData | null>(null);
	const chartDataRef = useRef<PageChartData | undefined>(undefined);
	financialDataRef.current = financialData;
	chartDataRef.current = chartData;

	const contextChat = useContextChat({
		getFinancialData: () => financialDataRef.current,
		getChartData: () => chartDataRef.current,
	});

	useLayoutEffect(() => {
		if (!symbol) return;
		window.scrollTo({ top: 0, left: 0, behavior: "instant" });
	}, [symbol]);

	const fetchStockData = useCallback(async (stockSymbol: string) => {
		setIsLoading(true);
		setError(null);
		setFinancialData(null);
		setChartData(undefined);

		try {
			const response = await fetch(`/api/stock-data?symbol=${encodeURIComponent(stockSymbol)}`);
			const result: unknown = await response.json().catch(() => null);
			if (!response.ok || !result || typeof result !== "object" || !("data" in result)) {
				const message =
					result &&
					typeof result === "object" &&
					"error" in result &&
					typeof result.error === "string"
						? result.error
						: "Financial data is temporarily unavailable.";
				throw new Error(message);
			}
			const data = result.data as FinancialData;
			setFinancialData(data);
		} catch (stockError) {
			setError(
				stockError instanceof Error
					? stockError.message
					: "Financial data is temporarily unavailable.",
			);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		contextChat.reset();
		if (symbol) void fetchStockData(symbol);
	}, [contextChat.reset, fetchStockData, symbol]);

	const researchLenses = useMemo(
		() => (financialData ? buildResearchLenses(financialData) : []),
		[financialData],
	);

	if (!symbol) {
		return (
			<div className="flex min-h-[70vh] items-center justify-center p-6">
				<div className="max-w-md text-center">
					<span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
						<Building2 className="size-5" />
					</span>
					<h1 className="mt-5 text-xl font-semibold">No company selected</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						Choose a valid ticker to open a research view.
					</p>
					<Button onClick={() => router.push("/search")} className="mt-5 rounded-full">
						Search companies
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-[1500px] px-4 pb-14 pt-1 sm:px-6 lg:px-8">
			<Button
				variant="ghost"
				size="sm"
				onClick={() => router.push("/dashboard")}
				className="mb-4 -ml-2 rounded-full text-muted-foreground"
			>
				<ArrowLeft className="size-4" />
				Dashboard
			</Button>

			{isLoading && (
				<div
					className="space-y-4"
					role="status"
					aria-live="polite"
					aria-label={`Loading ${symbol} financial data`}
				>
					<div className="h-44 animate-pulse rounded-[1.5rem] border border-border/70 bg-card" />
					<div className="h-[520px] animate-pulse rounded-[1.5rem] border border-border/70 bg-card" />
				</div>
			)}

			{error && !isLoading && (
				<div className="flex min-h-[60vh] items-center justify-center">
					<div className="max-w-md text-center">
						<span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
							<Building2 className="size-5" />
						</span>
						<h1 className="mt-5 text-xl font-semibold">We couldn’t open {symbol}</h1>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">{error}</p>
						<div className="mt-5 flex justify-center gap-2">
							<Button
								variant="outline"
								onClick={() => router.push("/search")}
								className="rounded-full"
							>
								Search another
							</Button>
							<Button onClick={() => void fetchStockData(symbol)} className="rounded-full">
								<RefreshCw className="size-4" />
								Try again
							</Button>
						</div>
					</div>
				</div>
			)}

			{financialData && !isLoading && (
				<div className="space-y-5">
					<section
						className="relative overflow-hidden rounded-[1.5rem] border border-border/70 bg-card p-5 shadow-sm sm:p-7"
						aria-label={`${financialData.symbol} company snapshot`}
					>
						<div className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full bg-primary/[0.07] blur-3xl" />
						<div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
							<div className="min-w-0">
								<div className="flex flex-wrap items-center gap-2">
									<span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-[11px] font-bold tracking-[0.14em] text-primary">
										{financialData.symbol}
									</span>
									{financialData.sector && (
										<span className="rounded-full border border-border px-3 py-1 text-[10px] text-muted-foreground">
											{financialData.sector}
										</span>
									)}
								</div>
								<div className="mt-4 flex items-start gap-2">
									<h1 className="font-display text-balance text-4xl font-medium leading-none tracking-[-0.035em] sm:text-5xl">
										{financialData.longName ?? financialData.shortName ?? financialData.symbol}
									</h1>
									<FavoriteButtonCompact
										symbol={financialData.symbol}
										companyName={financialData.longName ?? financialData.shortName}
										className="mt-1 rounded-full"
									/>
								</div>
								<div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
									{financialData.industry && <span>{financialData.industry}</span>}
									{(financialData.city || financialData.state || financialData.country) && (
										<span className="inline-flex items-center gap-1.5">
											<MapPin className="size-3" />
											{[financialData.city, financialData.state, financialData.country]
												.filter(Boolean)
												.join(", ")}
										</span>
									)}
									{financialData.website && (
										<a
											href={`https://${financialData.website.replace(/^https?:\/\//, "")}`}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-1.5 transition-colors hover:text-primary"
										>
											<Globe2 className="size-3" />
											Company site
											<ExternalLink className="size-2.5" />
										</a>
									)}
								</div>
							</div>

							<div className="flex items-end justify-between gap-5 lg:flex-col lg:items-end">
								{isNumber(financialData.regularMarketPrice) && (
									<div className="lg:text-right">
										<p className="font-mono text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
											{financialData.currency === "USD" ? "$" : ""}
											{financialData.regularMarketPrice.toFixed(2)}
										</p>
										{isNumber(financialData.regularMarketChangePercent) && (
											<p
												className={`mt-1 font-mono text-xs font-semibold ${financialData.regularMarketChangePercent >= 0 ? "text-primary" : "text-destructive"}`}
											>
												{financialData.regularMarketChangePercent >= 0 ? "+" : ""}
												{financialData.regularMarketChange?.toFixed(2) ?? "0.00"} (
												{financialData.regularMarketChangePercent >= 0 ? "+" : ""}
												{financialData.regularMarketChangePercent.toFixed(2)}%)
											</p>
										)}
									</div>
								)}
								<Button
									onClick={() => {
										const lens = researchLenses[0];
										contextChat.openWithMetric(
											lens?.metric ?? "company_overview",
											lens?.label ?? "Company overview",
											lens?.value ?? financialData.symbol,
										);
									}}
									className="rounded-full px-5"
								>
									<Sparkles className="size-4" />
									Ask Indus
								</Button>
							</div>
						</div>
					</section>

					<section
						aria-label="Key company metrics"
						className="grid overflow-hidden rounded-2xl border border-border/70 bg-card sm:grid-cols-2 lg:grid-cols-4"
					>
						{[
							["Market cap", formatCurrency(financialData.marketCap)],
							["Revenue (TTM)", formatCurrency(financialData.revenue)],
							["Net margin", formatPercent(financialData.netProfitMargins)],
							["Revenue growth", formatPercent(financialData.revenueGrowth)],
						].map(([label, value]) => (
							<div
								key={label}
								className="border-b border-border/70 p-4 last:border-b-0 sm:odd:border-r lg:border-b-0 lg:border-r lg:last:border-r-0"
							>
								<p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
									{label}
								</p>
								<p className="mt-2 font-mono text-lg font-semibold tracking-[-0.03em]">{value}</p>
							</div>
						))}
					</section>

					<StockChart
						symbol={financialData.symbol}
						height={560}
						showControls
						onDataChange={setChartData}
					/>

					<div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
						<section
							className="rounded-[1.35rem] border border-primary/25 bg-primary/[0.055] p-5 sm:p-6"
							aria-labelledby="analyst-heading"
						>
							<div className="flex items-start justify-between gap-4">
								<div>
									<div className="flex items-center gap-2 text-primary">
										<BrainCircuit className="size-4" />
										<p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]">
											Indus analyst
										</p>
									</div>
									<h2
										id="analyst-heading"
										className="font-display mt-3 text-3xl font-medium tracking-[-0.03em]"
									>
										Ask about the company.
									</h2>
								</div>
								<span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-primary">
									<ShieldCheck className="size-3" />
									Current data
								</span>
							</div>
							<p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
								Ask about valuation, profitability, growth, or debt.
							</p>
							<div className="mt-6 grid gap-2 sm:grid-cols-2">
								{researchLenses.map((lens) => (
									<button
										key={lens.metric}
										type="button"
										onClick={() =>
											contextChat.openWithMetric(lens.metric, lens.label, lens.value, lens.question)
										}
										className="group rounded-xl border border-primary/15 bg-background/55 p-3.5 text-left transition-colors hover:border-primary/40 hover:bg-background/80"
									>
										<div className="flex items-center justify-between gap-3">
											<span className="text-xs font-semibold">{lens.label}</span>
											<ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
										</div>
										<p className="mt-1 font-mono text-[10px] text-primary">{lens.displayValue}</p>
										<p className="mt-3 text-xs leading-5 text-muted-foreground">{lens.question}</p>
									</button>
								))}
							</div>
						</section>

						{financialData.longBusinessSummary ? (
							<section
								className="rounded-[1.35rem] border border-border/70 bg-card p-5 sm:p-6"
								aria-labelledby="overview-heading"
							>
								<p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
									Business
								</p>
								<h2
									id="overview-heading"
									className="mt-3 text-lg font-semibold tracking-[-0.025em]"
								>
									Company overview
								</h2>
								<p className="mt-4 text-sm leading-6 text-muted-foreground">
									{showFullDescription
										? financialData.longBusinessSummary
										: `${financialData.longBusinessSummary.slice(0, 420)}${financialData.longBusinessSummary.length > 420 ? "…" : ""}`}
								</p>
								{financialData.longBusinessSummary.length > 420 && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setShowFullDescription((value) => !value)}
										className="mt-3 -ml-3 rounded-full text-primary"
									>
										{showFullDescription ? "Show less" : "Read full profile"}
										{showFullDescription ? (
											<ChevronUp className="size-3.5" />
										) : (
											<ChevronDown className="size-3.5" />
										)}
									</Button>
								)}
								<div className="mt-6 grid grid-cols-2 gap-4 border-t border-border/70 pt-5 text-xs">
									<div>
										<p className="text-muted-foreground">Enterprise value</p>
										<p className="mt-1 font-mono font-medium">
											{formatCurrency(financialData.enterpriseValue)}
										</p>
									</div>
									<div>
										<p className="text-muted-foreground">Employees</p>
										<p className="mt-1 font-mono font-medium">
											{formatLargeNumber(financialData.employees)}
										</p>
									</div>
								</div>
							</section>
						) : null}
					</div>

					<section
						className="rounded-[1.35rem] border border-border/70 bg-card p-4 sm:p-6"
						aria-labelledby="metrics-heading"
					>
						<div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
							<div>
								<p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
									Fundamentals
								</p>
								<h2 id="metrics-heading" className="mt-2 text-xl font-semibold tracking-[-0.025em]">
									Financial metrics
								</h2>
							</div>
							<p className="max-w-lg text-xs leading-5 text-muted-foreground">
								Select a label for its definition or a value for analysis.
							</p>
						</div>
						<FinancialTable data={financialData} onChatTrigger={contextChat.openWithMetric} />
					</section>
				</div>
			)}

			<ChatPanel
				state={contextChat}
				onClose={contextChat.close}
				onSendMessage={contextChat.sendMessage}
				onRegenerateLast={contextChat.regenerateLast}
				onClearError={contextChat.clearError}
				onStop={contextChat.stop}
			/>

			{financialData && !isLoading && (
				<Button
					type="button"
					onClick={() => {
						if (contextChat.initialContext) {
							contextChat.toggle();
							return;
						}
						const lens = researchLenses[0];
						contextChat.openWithMetric(
							lens?.metric ?? "company_overview",
							lens?.label ?? "Company overview",
							lens?.value ?? financialData.symbol,
						);
					}}
					aria-expanded={contextChat.open}
					aria-label={contextChat.open ? "Hide Indus Analyst" : "Show Indus Analyst"}
					className={`fixed z-[60] rounded-full px-4 shadow-xl transition-[right,bottom] ${
						contextChat.open
							? "bottom-[calc(92dvh+0.75rem)] right-4 md:bottom-4 md:right-[500px]"
							: "bottom-4 right-4"
					}`}
				>
					<BrainCircuit className="size-4" />
					{contextChat.open ? "Hide analyst" : "Indus Analyst"}
				</Button>
			)}
		</div>
	);
}
