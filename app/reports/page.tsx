"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	ArrowLeft,
	BarChart3,
	Building2,
	Calendar,
	Clock,
	Download,
	Eye,
	FileText,
	Plus,
	Search,
	Trash2,
	TrendingUp,
} from "lucide-react";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { isCompleteReportContent, parseReportContent } from "@/lib/report-content";
import { parseReportDocumentContent, type ReportDocument } from "@/lib/report-document";
import { useAuth } from "@/lib/stores/auth-store";

interface Report {
	id: string;
	symbol: string;
	company_name: string;
	report_content: string;
	created_at: string;
	status: "generating" | "completed" | "error";
	summary: string;
}

const inlineRegex = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;

const renderInline = (text: string): ReactNode[] => {
	const nodes: ReactNode[] = [];
	let lastIndex = 0;
	let key = 0;

	for (const match of text.matchAll(inlineRegex)) {
		const matchIndex = match.index ?? 0;
		if (matchIndex > lastIndex) {
			nodes.push(text.slice(lastIndex, matchIndex));
		}

		const [, bold, italic, code] = match;
		if (bold) {
			nodes.push(<strong key={key++}>{bold}</strong>);
		} else if (italic) {
			nodes.push(<em key={key++}>{italic}</em>);
		} else if (code) {
			nodes.push(
				<code key={key++} className="bg-muted px-1 py-0.5 rounded text-sm">
					{code}
				</code>,
			);
		}

		lastIndex = matchIndex + match[0].length;
	}

	if (lastIndex < text.length) {
		nodes.push(text.slice(lastIndex));
	}

	return nodes;
};

const formatText = (text: string) => {
	if (!text) return null;

	return parseReportContent(text).map((block, index) => {
		if (block.kind === "heading") {
			if (block.level === 1) {
				return (
					<h1 key={index} className="mb-4 border-b pb-2 text-2xl font-bold text-foreground">
						{renderInline(block.text)}
					</h1>
				);
			}
			if (block.level === 2) {
				return (
					<h2 key={index} className="mb-3 mt-6 text-xl font-semibold text-foreground">
						{renderInline(block.text)}
					</h2>
				);
			}
			return (
				<h3 key={index} className="mb-2 mt-4 text-lg font-semibold text-foreground">
					{renderInline(block.text)}
				</h3>
			);
		}

		if (block.kind === "list") {
			return (
				<ul key={index} className="mb-4 list-disc space-y-2 pl-5 text-muted-foreground">
					{block.items.map((item, itemIndex) => (
						<li key={`${index}-${itemIndex}`}>{renderInline(item)}</li>
					))}
				</ul>
			);
		}

		return (
			<p key={index} className="mb-4 leading-relaxed text-muted-foreground">
				{renderInline(block.text)}
			</p>
		);
	});
};

const StructuredReport = ({ document }: { document: ReportDocument }) => (
	<div className="space-y-10">
		<section aria-labelledby="executive-summary">
			<h2
				id="executive-summary"
				className="border-b border-border pb-3 text-xl font-semibold text-foreground"
			>
				Executive Summary
			</h2>
			<p className="mt-5 leading-7 text-foreground/85">{document.executiveSummary}</p>
		</section>

		<section aria-labelledby="financial-snapshot">
			<h2
				id="financial-snapshot"
				className="border-b border-border pb-3 text-xl font-semibold text-foreground"
			>
				Financial Snapshot
			</h2>
			<dl className="mt-5 divide-y divide-border rounded-xl border border-border bg-background/45">
				{document.financialSnapshot.map((metric) => (
					<div key={`${metric.label}-${metric.value}`} className="px-4 py-5 sm:px-5">
						<div className="flex flex-wrap items-baseline justify-between gap-2">
							<dt className="font-semibold text-foreground">{metric.label}</dt>
							<dd className="font-mono text-sm font-semibold text-primary">{metric.value}</dd>
						</div>
						<dd className="mt-2 text-sm leading-6 text-muted-foreground">{metric.analysis}</dd>
					</div>
				))}
			</dl>
		</section>

		{document.version === 2 && (
			<>
				<section aria-labelledby="analysis-watchpoints">
					<h2
						id="analysis-watchpoints"
						className="border-b border-border pb-3 text-xl font-semibold text-foreground"
					>
						Analysis and Watchpoints
					</h2>
					<ul className="mt-5 list-disc space-y-3 pl-5 text-sm leading-6 text-muted-foreground">
						{document.analysisAndWatchpoints.map((observation) => (
							<li key={observation}>{observation}</li>
						))}
					</ul>
				</section>

				<section aria-labelledby="recent-news">
					<h2
						id="recent-news"
						className="border-b border-border pb-3 text-xl font-semibold text-foreground"
					>
						Recent News and Potential Impact
					</h2>
					{document.recentNews.length > 0 ? (
						<div className="mt-5 space-y-4">
							{document.recentNews.map((article) => (
								<article
									key={`${article.url}-${article.publishedAt}`}
									className="rounded-xl border border-border p-5"
								>
									<a
										href={article.url}
										target="_blank"
										rel="noopener noreferrer"
										className="font-semibold text-foreground underline decoration-border underline-offset-4 hover:decoration-primary"
									>
										{article.headline}
									</a>
									<p className="mt-2 font-mono text-xs text-muted-foreground">
										{article.publisher} · {format(new Date(article.publishedAt), "MMM d, yyyy")}
									</p>
									<p className="mt-3 text-sm leading-6 text-muted-foreground">{article.impact}</p>
								</article>
							))}
						</div>
					) : (
						<p className="mt-5 text-sm text-muted-foreground">
							No recent company news was available from the report data provider.
						</p>
					)}
				</section>
			</>
		)}

		<section aria-labelledby="data-limitations">
			<h2
				id="data-limitations"
				className="border-b border-border pb-3 text-xl font-semibold text-foreground"
			>
				Data Limitations
			</h2>
			<ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
				{document.dataLimitations.map((limitation) => (
					<li key={limitation}>{limitation}</li>
				))}
			</ul>
		</section>

		<p className="border-t border-border pt-5 text-xs text-muted-foreground">
			This report is educational and is not investment advice.
		</p>
	</div>
);

export default function ReportsPage() {
	const [newReportSymbol, setNewReportSymbol] = useState("");
	const [selectedReport, setSelectedReport] = useState<Report | null>(null);
	const [viewMode, setViewMode] = useState<"list" | "view">("list");
	const [exportingPdf, setExportingPdf] = useState(false);
	const [pdfError, setPdfError] = useState<string | null>(null);
	const { user } = useAuth();
	const queryClient = useQueryClient();
	const reportsQueryKey = useMemo(() => ["reports", user?.id ?? "anonymous"], [user?.id]);

	const reportsQuery = useQuery({
		queryKey: reportsQueryKey,
		enabled: !!user,
		queryFn: async () => {
			const response = await fetch("/api/reports");
			if (!response.ok) {
				throw new Error("Failed to fetch reports");
			}

			const data = await response.json();
			return (data.reports || []) as Report[];
		},
	});

	const reports = reportsQuery.data ?? [];
	const loading = reportsQuery.isLoading;

	const pollReportStatus = useCallback(
		(reportId: string) => {
			const interval = setInterval(async () => {
				try {
					const response = await fetch(`/api/reports/${reportId}`);
					if (response.ok) {
						const data = await response.json();
						if (data.report.status === "completed" || data.report.status === "error") {
							queryClient.setQueryData<Report[]>(reportsQueryKey, (currentReports = []) =>
								currentReports.map((report) => (report.id === reportId ? data.report : report)),
							);
							setSelectedReport((currentReport) =>
								currentReport?.id === reportId ? data.report : currentReport,
							);
							clearInterval(interval);
						}
					}
				} catch {
					clearInterval(interval);
				}
			}, 3000);
		},
		[queryClient, reportsQueryKey],
	);

	const generateMutation = useMutation({
		mutationFn: async (symbol: string) => {
			const response = await fetch("/api/reports/generate", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ symbol }),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error?.error ?? "Error generating report");
			}

			const newReport = await response.json();
			return newReport.report as Report;
		},
		onSuccess: (report) => {
			queryClient.setQueryData<Report[]>(reportsQueryKey, (currentReports = []) => [
				report,
				...currentReports,
			]);
			setNewReportSymbol("");
			pollReportStatus(report.id);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (reportId: string) => {
			const response = await fetch(`/api/reports/${reportId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				throw new Error("Failed to delete report");
			}
		},
		onMutate: async (reportId) => {
			await queryClient.cancelQueries({ queryKey: reportsQueryKey });
			const previousReports = queryClient.getQueryData<Report[]>(reportsQueryKey);
			queryClient.setQueryData<Report[]>(reportsQueryKey, (currentReports = []) =>
				currentReports.filter((report) => report.id !== reportId),
			);
			if (selectedReport?.id === reportId) {
				setSelectedReport(null);
				setViewMode("list");
			}
			return { previousReports };
		},
		onError: (_error, _reportId, context) => {
			if (context?.previousReports) {
				queryClient.setQueryData(reportsQueryKey, context.previousReports);
			}
		},
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: reportsQueryKey });
		},
	});

	const generateReport = async () => {
		if (!newReportSymbol.trim()) return;

		try {
			await generateMutation.mutateAsync(newReportSymbol.toUpperCase());
		} catch {}
	};

	const deleteReport = async (reportId: string) => {
		try {
			await deleteMutation.mutateAsync(reportId);
		} catch {}
	};

	const handleViewReport = (report: Report) => {
		setSelectedReport(report);
		setViewMode("view");
	};

	const handleBackToList = () => {
		setViewMode("list");
		setSelectedReport(null);
		setPdfError(null);
	};

	const exportPdf = async (report: Report) => {
		setExportingPdf(true);
		setPdfError(null);
		try {
			const response = await fetch(`/api/reports/${report.id}/pdf`);
			if (!response.ok || !response.headers.get("Content-Type")?.startsWith("application/pdf")) {
				throw new Error("PDF export failed");
			}
			const blob = await response.blob();
			if (blob.size === 0) throw new Error("PDF export was empty");

			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `${report.symbol
				.toUpperCase()
				.replace(/[^A-Z0-9_-]/g, "-")}-research-report-${format(
				new Date(report.created_at),
				"yyyy-MM-dd",
			)}.pdf`;
			link.click();
			setTimeout(() => URL.revokeObjectURL(url), 0);
		} catch {
			setPdfError("PDF export failed. Please try again.");
		} finally {
			setExportingPdf(false);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
				<div className="container mx-auto p-6 space-y-8">
					<div className="space-y-4">
						<Skeleton className="h-10 w-64" />
						<Skeleton className="h-6 w-96" />
					</div>
					<div className="grid gap-6">
						{[1, 2, 3].map((i) => (
							<Card key={i} className="overflow-hidden">
								<CardContent className="p-6">
									<div className="space-y-4">
										<Skeleton className="h-6 w-32" />
										<Skeleton className="h-4 w-full" />
										<Skeleton className="h-4 w-3/4" />
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			</div>
		);
	}

	// Full-screen report view
	if (viewMode === "view" && selectedReport) {
		const reportIsIncomplete =
			selectedReport.status === "completed" &&
			!isCompleteReportContent(selectedReport.report_content);
		const structuredDocument = parseReportDocumentContent(selectedReport.report_content);

		return (
			<div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
				<div className="container mx-auto min-w-0 max-w-4xl px-4 py-6 sm:px-6">
					{/* Header */}
					<div
						className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8"
						data-print-hidden
					>
						<Button
							variant="ghost"
							onClick={handleBackToList}
							className="flex items-center gap-2 hover:bg-muted"
						>
							<ArrowLeft className="h-4 w-4" />
							Back to Reports
						</Button>
						<div className="flex items-center gap-3">
							<Badge
								variant={
									reportIsIncomplete
										? "destructive"
										: selectedReport.status === "completed"
											? "default"
											: selectedReport.status === "generating"
												? "secondary"
												: "destructive"
								}
								className="px-3 py-1"
							>
								{selectedReport.status === "generating" && (
									<div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent mr-2" />
								)}
								{reportIsIncomplete ? "incomplete" : selectedReport.status}
							</Badge>
							{selectedReport.status === "completed" && !reportIsIncomplete && (
								<Button
									variant="outline"
									size="sm"
									disabled={exportingPdf}
									onClick={() => void exportPdf(selectedReport)}
								>
									<Download className="h-4 w-4 mr-2" />
									{exportingPdf ? "Exporting..." : "Export PDF"}
								</Button>
							)}
						</div>
					</div>
					{pdfError && (
						<p role="alert" className="mb-4 text-right text-sm text-destructive" data-print-hidden>
							{pdfError}
						</p>
					)}

					{/* Report Card */}
					<Card
						className="min-w-0 overflow-visible border-0 bg-card/95 shadow-lg backdrop-blur"
						data-report-document
					>
						<CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 border-b">
							<div className="flex min-w-0 items-start justify-between">
								<div className="min-w-0 space-y-2">
									<div className="flex min-w-0 items-center gap-3">
										<div className="p-2 bg-primary/10 rounded-lg">
											<Building2 className="h-6 w-6 text-primary" />
										</div>
										<div className="min-w-0">
											<CardTitle className="break-words text-2xl font-bold">
												{selectedReport.symbol} Research Report
											</CardTitle>
											<CardDescription className="text-base">
												{selectedReport.company_name}
											</CardDescription>
										</div>
									</div>
									<div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
										<span className="flex items-center gap-2">
											<Calendar className="h-4 w-4" />
											Generated on {format(new Date(selectedReport.created_at), "MMMM d, yyyy")}
										</span>
										<span className="flex items-center gap-2">
											<Clock className="h-4 w-4" />
											{format(new Date(selectedReport.created_at), "h:mm a")}
										</span>
									</div>
								</div>
							</div>
						</CardHeader>

						<CardContent className="min-w-0 p-5 sm:p-8">
							{selectedReport.status === "generating" ? (
								<div className="text-center py-16 space-y-6">
									<div className="relative mx-auto w-24 h-24">
										<div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
										<div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
										<BarChart3 className="absolute inset-4 h-16 w-16 text-primary" />
									</div>
									<div className="space-y-2">
										<h3 className="text-xl font-semibold">Generating report</h3>
										<p className="text-muted-foreground">
											Analyzing current data for {selectedReport.symbol}.
										</p>
									</div>
									<div className="space-y-3 max-w-md mx-auto">
										<Skeleton className="h-4 w-full" />
										<Skeleton className="h-4 w-3/4" />
										<Skeleton className="h-4 w-1/2" />
									</div>
								</div>
							) : selectedReport.status === "error" || reportIsIncomplete ? (
								<div className="text-center py-16 space-y-4">
									<div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
										<FileText className="h-8 w-8 text-destructive" />
									</div>
									<div className="space-y-2">
										<h3 className="text-xl font-semibold text-destructive">
											{reportIsIncomplete
												? "Report Generation Was Incomplete"
												: "Generation Failed"}
										</h3>
										<p className="text-muted-foreground">
											{reportIsIncomplete
												? "The model stopped before every required section was generated. Return to the reports list and generate a replacement."
												: "We encountered an error while generating your report. Please try again."}
										</p>
									</div>
									<Button onClick={() => handleBackToList()} variant="outline">
										Return to Reports
									</Button>
								</div>
							) : (
								<div className="max-w-none break-words [overflow-wrap:anywhere]">
									{structuredDocument ? (
										<StructuredReport document={structuredDocument} />
									) : (
										<div className="space-y-1">{formatText(selectedReport.report_content)}</div>
									)}
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	// Main reports list view
	return (
		<div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
			<div className="container mx-auto p-6 space-y-8">
				{/* Header */}
				<div className="text-center space-y-2">
					<div className="inline-flex items-center gap-3 p-3 bg-primary/10 rounded-full">
						<TrendingUp className="h-8 w-8 text-primary" />
					</div>
					<div className="space-y-2">
						<h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
							Research Reports
						</h1>
						<p className="text-muted-foreground">Generate a report from current company data.</p>
					</div>
				</div>

				{/* Generate New Report Card */}
				<Card className="overflow-hidden shadow-lg border-0 bg-gradient-to-r from-primary/5 to-primary/10">
					<CardHeader className="text-center pb-4">
						<CardTitle className="flex items-center justify-center gap-3 text-2xl">
							<Plus className="h-6 w-6 text-primary" />
							Generate New Report
						</CardTitle>
						<CardDescription>Enter a stock symbol.</CardDescription>
					</CardHeader>
					<CardContent className="pb-8">
						<div className="flex gap-4 max-w-md mx-auto">
							<Input
								placeholder="Enter stock symbol (e.g., AAPL, GOOGL)"
								value={newReportSymbol}
								onChange={(e) => setNewReportSymbol(e.target.value.toUpperCase())}
								onKeyPress={(e) => e.key === "Enter" && generateReport()}
								className="flex-1 h-12 text-center text-lg font-medium"
							/>
							<Button
								onClick={generateReport}
								disabled={generateMutation.isPending || !newReportSymbol.trim()}
								className="h-12 px-8 text-base font-medium"
								size="lg"
							>
								{generateMutation.isPending ? (
									<div className="flex items-center gap-2">
										<div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
										Analyzing...
									</div>
								) : (
									<>
										<Search className="h-5 w-5 mr-2" />
										Generate Report
									</>
								)}
							</Button>
						</div>
					</CardContent>
				</Card>

				{/* Reports Grid */}
				<div className="space-y-6">
					<div className="flex items-center justify-between">
						<h2 className="text-2xl font-semibold">Your Reports</h2>
						<Badge variant="secondary" className="px-3 py-1">
							{reports.length} {reports.length === 1 ? "Report" : "Reports"}
						</Badge>
					</div>

					{reports.length === 0 ? (
						<Card className="overflow-hidden border-dashed border-2">
							<CardContent className="flex flex-col items-center justify-center py-16 text-center">
								<div className="mx-auto w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-6">
									<FileText className="h-10 w-10 text-muted-foreground" />
								</div>
								<h3 className="text-xl font-semibold mb-3">No reports yet</h3>
								<p className="text-muted-foreground mb-6">Generate a report to save it here.</p>
								<Button variant="outline" onClick={() => document.querySelector("input")?.focus()}>
									Create Your First Report
								</Button>
							</CardContent>
						</Card>
					) : (
						<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
							{reports.map((report) => (
								<Card
									key={report.id}
									className="group overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border-0 bg-card/95 backdrop-blur"
									onClick={() => handleViewReport(report)}
								>
									<CardHeader className="pb-3">
										<div className="flex items-start justify-between">
											<div className="space-y-2">
												<div className="flex items-center gap-2">
													<div className="p-1.5 bg-primary/10 rounded-md">
														<Building2 className="h-4 w-4 text-primary" />
													</div>
													<h3 className="font-bold text-lg group-hover:text-primary transition-colors">
														{report.symbol}
													</h3>
												</div>
												<Badge
													variant={
														report.status === "completed"
															? "default"
															: report.status === "generating"
																? "secondary"
																: "destructive"
													}
													className="w-fit"
												>
													{report.status === "generating" && (
														<div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent mr-1" />
													)}
													{report.status}
												</Badge>
											</div>
											<Button
												variant="ghost"
												size="sm"
												onClick={(e) => {
													e.stopPropagation();
													deleteReport(report.id);
												}}
												className="opacity-0 group-hover:opacity-100 transition-opacity"
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									</CardHeader>

									<CardContent>
										<div className="space-y-4">
											<p className="break-words text-sm leading-relaxed text-muted-foreground">
												{report.summary || report.company_name}
											</p>

											<Separator />

											<div className="flex items-center justify-between text-xs text-muted-foreground">
												<span className="flex items-center gap-1">
													<Calendar className="h-3 w-3" />
													{format(new Date(report.created_at), "MMM d, yyyy")}
												</span>
												<Button
													variant="ghost"
													size="sm"
													className="h-8 px-3 text-xs font-medium group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
													onClick={(e) => {
														e.stopPropagation();
														handleViewReport(report);
													}}
												>
													<Eye className="h-3 w-3 mr-1" />
													View Report
												</Button>
											</div>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
