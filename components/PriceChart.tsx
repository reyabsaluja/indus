"use client";

import type { CandlestickData, Time } from "lightweight-charts";
import {
	CandlestickSeries,
	ColorType,
	CrosshairMode,
	createChart,
	HistogramSeries,
	type IChartApi,
	type ISeriesApi,
	type LogicalRange,
} from "lightweight-charts";
import { AlertCircle, Radio, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	CHART_RANGES,
	type ChartRangeValue,
	filterRangeData,
	getChartRange,
	getPreviousHistoryEndTimestamp,
	getRangeStartTimestamp,
	prependOlderBars,
	shiftLogicalRange,
} from "@/lib/charts/ranges";
import { getRealtimeStatus, type RealtimeStatus } from "@/lib/realtime/stream-status";
import type { PageChartData } from "@/lib/types";

type AssetType = "stock" | "crypto";
type BarData = CandlestickData<Time> & { time: number; volume?: number };

interface HistoricalDataResponse {
	data: BarData[];
	isEmpty: boolean;
	totalBars: number;
	error?: string;
}

interface ChartSnapshot {
	open: number;
	high: number;
	low: number;
	close: number;
	change: number;
	changePercent: number;
}

export interface PriceChartProps {
	symbol: string;
	type: AssetType;
	height?: number;
	className?: string;
	showControls?: boolean;
	onDataChange?: (data: PageChartData | undefined) => void;
}

function isBarData(value: unknown): value is BarData {
	if (!value || typeof value !== "object") return false;
	const bar = value as Record<string, unknown>;
	return ["time", "open", "high", "low", "close"].every(
		(key) => typeof bar[key] === "number" && Number.isFinite(bar[key]),
	);
}

function parseHistoricalResponse(value: unknown): HistoricalDataResponse | null {
	if (!value || typeof value !== "object") return null;
	const response = value as Record<string, unknown>;
	if (
		!Array.isArray(response.data) ||
		!response.data.every(isBarData) ||
		typeof response.isEmpty !== "boolean" ||
		typeof response.totalBars !== "number"
	) {
		return null;
	}

	return {
		data: response.data,
		isEmpty: response.isEmpty,
		totalBars: response.totalBars,
		error: typeof response.error === "string" ? response.error : undefined,
	};
}

function buildHistoricalUrl(
	symbol: string,
	rangeValue: ChartRangeValue,
	type: AssetType,
	end?: number,
): string {
	const range = getChartRange(rangeValue);
	const params = new URLSearchParams({
		symbol,
		timeframe: range.timeframe,
		limit: "5000",
	});
	if (end === undefined) params.set("start", String(getRangeStartTimestamp(rangeValue)));
	else params.set("end", String(end));
	if (type === "crypto") params.set("type", "crypto");
	return `/api/alpaca?${params.toString()}`;
}

function snapshotFromBar(bar: BarData, firstClose: number): ChartSnapshot {
	const change = bar.close - firstClose;
	return {
		open: bar.open,
		high: bar.high,
		low: bar.low,
		close: bar.close,
		change,
		changePercent: firstClose === 0 ? 0 : (change / firstClose) * 100,
	};
}

function formatPrice(value: number) {
	return new Intl.NumberFormat("en-CA", {
		minimumFractionDigits: value >= 100 ? 2 : 3,
		maximumFractionDigits: value >= 100 ? 2 : 4,
	}).format(value);
}

function getPalette() {
	const dark = document.documentElement.classList.contains("dark");
	return dark
		? {
				text: "#aab8ae",
				grid: "rgba(208, 225, 213, 0.07)",
				border: "rgba(208, 225, 213, 0.16)",
				crosshair: "rgba(208, 225, 213, 0.42)",
				up: "#b7ef49",
				down: "#ff756b",
				volumeUp: "rgba(183, 239, 73, 0.22)",
				volumeDown: "rgba(255, 117, 107, 0.18)",
			}
		: {
				text: "#52655a",
				grid: "rgba(33, 74, 52, 0.08)",
				border: "rgba(33, 74, 52, 0.18)",
				crosshair: "rgba(33, 74, 52, 0.4)",
				up: "#288451",
				down: "#d54c43",
				volumeUp: "rgba(40, 132, 81, 0.2)",
				volumeDown: "rgba(213, 76, 67, 0.16)",
			};
}

export default function PriceChart({
	symbol,
	type,
	height = 540,
	className = "",
	showControls = true,
	onDataChange,
}: PriceChartProps) {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
	const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
	const eventSourceRef = useRef<EventSource | null>(null);
	const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const requestIdRef = useRef(0);
	const hasUserNavigatedHistoryRef = useRef(false);
	const historicalDataRef = useRef<BarData[]>([]);
	const earliestLoadedTimestampRef = useRef<number | null>(null);
	const isLoadingOlderRef = useRef(false);
	const hasReachedHistoryLimitRef = useRef(false);
	const selectedRangeRef = useRef<ChartRangeValue>("1D");
	const symbolRef = useRef(symbol);
	const snapshotBaselineRef = useRef<number | null>(null);
	const latestSnapshotRef = useRef<ChartSnapshot | null>(null);
	const onDataChangeRef = useRef(onDataChange);
	onDataChangeRef.current = onDataChange;

	const [selectedRange, setSelectedRange] = useState<ChartRangeValue>("1D");
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");
	const [showReconnecting, setShowReconnecting] = useState(false);
	const [latestSnapshot, setLatestSnapshot] = useState<ChartSnapshot | null>(null);
	const [hoverSnapshot, setHoverSnapshot] = useState<ChartSnapshot | null>(null);
	const [isLoadingOlder, setIsLoadingOlder] = useState(false);
	const [historyLimitReached, setHistoryLimitReached] = useState(false);
	selectedRangeRef.current = selectedRange;
	symbolRef.current = symbol;

	const clearReconnectTimer = useCallback(() => {
		if (reconnectTimerRef.current) {
			clearTimeout(reconnectTimerRef.current);
			reconnectTimerRef.current = null;
		}
	}, []);

	const applySeriesData = useCallback((data: BarData[]) => {
		const palette = getPalette();
		candlestickSeriesRef.current?.setData(data);
		volumeSeriesRef.current?.setData(
			data.map((bar) => ({
				time: bar.time as Time,
				value: bar.volume ?? 0,
				color: bar.close >= bar.open ? palette.volumeUp : palette.volumeDown,
			})),
		);
	}, []);

	const loadHistoricalData = useCallback(async () => {
		const requestId = ++requestIdRef.current;
		hasUserNavigatedHistoryRef.current = false;
		setIsLoading(true);
		setError(null);
		earliestLoadedTimestampRef.current = null;
		snapshotBaselineRef.current = null;
		hasReachedHistoryLimitRef.current = false;
		setHistoryLimitReached(false);
		isLoadingOlderRef.current = false;
		setIsLoadingOlder(false);
		onDataChangeRef.current?.(undefined);

		try {
			const response = await fetch(buildHistoricalUrl(symbol, selectedRange, type));
			const payload: unknown = await response.json().catch(() => null);
			const result = parseHistoricalResponse(payload);

			if (requestId !== requestIdRef.current) return;
			if (!response.ok || !result || result.isEmpty) {
				setError(result?.error ?? "No market history is available for this range.");
				historicalDataRef.current = [];
				applySeriesData([]);
				latestSnapshotRef.current = null;
				setLatestSnapshot(null);
				setHoverSnapshot(null);
				return;
			}

			const rangeData = filterRangeData(result.data, selectedRange);
			historicalDataRef.current = rangeData;
			earliestLoadedTimestampRef.current = rangeData[0]?.time ?? null;
			applySeriesData(rangeData);
			chartRef.current?.timeScale().fitContent();

			const first = rangeData[0];
			const latest = rangeData.at(-1);
			if (first && latest) {
				snapshotBaselineRef.current = first.close;
				const snapshot = snapshotFromBar(latest, first.close);
				latestSnapshotRef.current = snapshot;
				setLatestSnapshot(snapshot);
				setHoverSnapshot(snapshot);
				onDataChangeRef.current?.({
					range: selectedRange,
					interval: getChartRange(selectedRange).timeframe,
					points: rangeData.slice(-100).map((bar) => ({
						t: bar.time,
						o: bar.open,
						h: bar.high,
						l: bar.low,
						c: bar.close,
						v: bar.volume ?? 0,
					})),
					latestPrice: snapshot.close,
					rangeChangePct: snapshot.changePercent,
				});
			}
		} catch {
			if (requestId === requestIdRef.current) {
				setError("Market history is temporarily unavailable. Try again in a moment.");
			}
		} finally {
			if (requestId === requestIdRef.current) {
				setIsLoading(false);
			}
		}
	}, [applySeriesData, selectedRange, symbol, type]);

	const loadOlderHistory = useCallback(async () => {
		const earliestTimestamp = earliestLoadedTimestampRef.current;
		const requestId = requestIdRef.current;
		if (
			earliestTimestamp === null ||
			isLoadingOlderRef.current ||
			hasReachedHistoryLimitRef.current
		) {
			return;
		}

		isLoadingOlderRef.current = true;
		hasUserNavigatedHistoryRef.current = false;
		setIsLoadingOlder(true);
		try {
			const response = await fetch(
				buildHistoricalUrl(
					symbolRef.current,
					selectedRangeRef.current,
					type,
					getPreviousHistoryEndTimestamp(earliestTimestamp),
				),
			);
			const payload: unknown = await response.json().catch(() => null);
			const result = parseHistoricalResponse(payload);
			if (requestId !== requestIdRef.current) return;
			if (!response.ok || !result) return;
			if (result.isEmpty) {
				hasReachedHistoryLimitRef.current = true;
				setHistoryLimitReached(true);
				return;
			}

			const current = historicalDataRef.current;
			const combined = prependOlderBars(current, result.data);
			const prependedCount = combined.length - current.length;
			if (prependedCount === 0) {
				hasReachedHistoryLimitRef.current = true;
				setHistoryLimitReached(true);
				return;
			}

			const currentVisibleRange = chartRef.current?.timeScale().getVisibleLogicalRange() ?? null;
			historicalDataRef.current = combined;
			earliestLoadedTimestampRef.current = combined[0]?.time ?? earliestTimestamp;
			applySeriesData(combined);
			const restoredRange = shiftLogicalRange(currentVisibleRange, prependedCount);
			if (restoredRange) chartRef.current?.timeScale().setVisibleLogicalRange(restoredRange);
		} catch {
			// Keep the current chart usable; another left pan can retry the history request.
		} finally {
			if (requestId === requestIdRef.current) {
				isLoadingOlderRef.current = false;
				setIsLoadingOlder(false);
			}
		}
	}, [applySeriesData, type]);

	useEffect(() => {
		if (!chartContainerRef.current) return;
		const palette = getPalette();
		const monoFont =
			getComputedStyle(document.body).getPropertyValue("--font-geist-mono").trim() || "monospace";
		const chart = createChart(chartContainerRef.current, {
			width: chartContainerRef.current.clientWidth,
			height: chartContainerRef.current.clientHeight,
			layout: {
				background: { type: ColorType.Solid, color: "transparent" },
				textColor: palette.text,
				fontFamily: monoFont,
				fontSize: 11,
			},
			grid: {
				vertLines: { color: palette.grid },
				horzLines: { color: palette.grid },
			},
			crosshair: {
				mode: CrosshairMode.Normal,
				vertLine: {
					color: palette.crosshair,
					width: 1,
					style: 2,
					labelBackgroundColor: palette.text,
				},
				horzLine: {
					color: palette.crosshair,
					width: 1,
					style: 2,
					labelBackgroundColor: palette.text,
				},
			},
			rightPriceScale: {
				borderColor: palette.border,
				scaleMargins: { top: 0.08, bottom: 0.24 },
			},
			timeScale: {
				borderColor: palette.border,
				timeVisible: true,
				secondsVisible: false,
				rightOffset: 5,
				barSpacing: 8,
				minBarSpacing: 0.5,
			},
			handleScroll: {
				mouseWheel: true,
				pressedMouseMove: true,
				horzTouchDrag: true,
				vertTouchDrag: false,
			},
			handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
		});

		const candlestickSeries = chart.addSeries(CandlestickSeries, {
			upColor: palette.up,
			downColor: palette.down,
			borderVisible: false,
			wickUpColor: palette.up,
			wickDownColor: palette.down,
			priceLineVisible: true,
			lastValueVisible: true,
		});
		const volumeSeries = chart.addSeries(HistogramSeries, {
			priceFormat: { type: "volume" },
			priceScaleId: "volume",
			lastValueVisible: false,
			priceLineVisible: false,
		});
		chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

		chartRef.current = chart;
		candlestickSeriesRef.current = candlestickSeries;
		volumeSeriesRef.current = volumeSeries;

		chart.subscribeCrosshairMove((param) => {
			const value = param.seriesData.get(candlestickSeries);
			if (isBarData(value)) {
				const firstClose = snapshotBaselineRef.current ?? value.close;
				setHoverSnapshot(snapshotFromBar(value, firstClose));
			} else {
				setHoverSnapshot(latestSnapshotRef.current);
			}
		});

		let historyTimer: ReturnType<typeof setTimeout> | null = null;
		const markUserNavigation = () => {
			hasUserNavigatedHistoryRef.current = true;
		};
		const chartContainer = chartContainerRef.current;
		chartContainer.addEventListener("pointerdown", markUserNavigation, { capture: true });
		chartContainer.addEventListener("touchstart", markUserNavigation, {
			capture: true,
			passive: true,
		});
		chartContainer.addEventListener("wheel", markUserNavigation, {
			capture: true,
			passive: true,
		});
		const handleVisibleRangeChange = (range: LogicalRange | null) => {
			if (historyTimer) clearTimeout(historyTimer);
			if (!hasUserNavigatedHistoryRef.current) return;
			const bars = range ? candlestickSeries.barsInLogicalRange(range) : null;
			if (!bars || bars.barsBefore > 10 || historicalDataRef.current.length < 2) return;
			historyTimer = setTimeout(() => void loadOlderHistory(), 250);
		};
		chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

		const resizeObserver = new ResizeObserver(([entry]) => {
			if (!entry) return;
			chart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height });
		});
		resizeObserver.observe(chartContainerRef.current);

		const themeObserver = new MutationObserver(() => {
			const next = getPalette();
			chart.applyOptions({
				layout: { textColor: next.text },
				grid: { vertLines: { color: next.grid }, horzLines: { color: next.grid } },
				rightPriceScale: { borderColor: next.border },
				timeScale: { borderColor: next.border },
			});
			candlestickSeries.applyOptions({
				upColor: next.up,
				downColor: next.down,
				wickUpColor: next.up,
				wickDownColor: next.down,
			});
			applySeriesData(historicalDataRef.current);
		});
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => {
			if (historyTimer) clearTimeout(historyTimer);
			chartContainer.removeEventListener("pointerdown", markUserNavigation, { capture: true });
			chartContainer.removeEventListener("touchstart", markUserNavigation, { capture: true });
			chartContainer.removeEventListener("wheel", markUserNavigation, { capture: true });
			chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
			resizeObserver.disconnect();
			themeObserver.disconnect();
			chart.remove();
			chartRef.current = null;
			candlestickSeriesRef.current = null;
			volumeSeriesRef.current = null;
		};
	}, [applySeriesData, loadOlderHistory]);

	useEffect(() => {
		void loadHistoricalData();
	}, [loadHistoricalData]);

	useEffect(() => {
		if (selectedRange !== "1D") {
			setRealtimeStatus("historical");
			setShowReconnecting(false);
			return;
		}

		const eventSource = new EventSource(`/api/stream/${encodeURIComponent(symbol)}`);
		eventSourceRef.current = eventSource;
		setRealtimeStatus("connecting");
		setShowReconnecting(false);
		clearReconnectTimer();

		eventSource.onopen = () => {
			setRealtimeStatus(getRealtimeStatus("transport-open"));
			setShowReconnecting(false);
		};
		eventSource.onerror = () => {
			if (eventSource.readyState === EventSource.CLOSED) return;
			setRealtimeStatus(getRealtimeStatus("transport-error"));
			if (!reconnectTimerRef.current) {
				reconnectTimerRef.current = setTimeout(() => setShowReconnecting(true), 2500);
			}
		};
		const handleReady = () => {
			clearReconnectTimer();
			setRealtimeStatus(getRealtimeStatus("upstream-ready"));
			setShowReconnecting(false);
		};
		const handleBar = (event: MessageEvent<string>) => {
			try {
				const data: unknown = JSON.parse(event.data);
				if (!isBarData(data)) return;
				candlestickSeriesRef.current?.update(data);
				const palette = getPalette();
				volumeSeriesRef.current?.update({
					time: data.time as Time,
					value: data.volume ?? 0,
					color: data.close >= data.open ? palette.volumeUp : palette.volumeDown,
				});
				const existing = historicalDataRef.current;
				const last = existing.at(-1);
				historicalDataRef.current =
					last?.time === data.time ? [...existing.slice(0, -1), data] : [...existing, data];
				const firstClose = snapshotBaselineRef.current ?? data.close;
				const snapshot = snapshotFromBar(data, firstClose);
				latestSnapshotRef.current = snapshot;
				setLatestSnapshot(snapshot);
				setHoverSnapshot(snapshot);
				onDataChangeRef.current?.({
					range: selectedRange,
					interval: getChartRange(selectedRange).timeframe,
					points: historicalDataRef.current.slice(-100).map((bar) => ({
						t: bar.time,
						o: bar.open,
						h: bar.high,
						l: bar.low,
						c: bar.close,
						v: bar.volume ?? 0,
					})),
					latestPrice: snapshot.close,
					rangeChangePct: snapshot.changePercent,
				});
			} catch {
				return;
			}
		};
		const handleStreamError = () => {
			setRealtimeStatus(getRealtimeStatus("provider-error"));
			setShowReconnecting(false);
			clearReconnectTimer();
			eventSource.close();
		};
		eventSource.addEventListener("ready", handleReady);
		eventSource.addEventListener("bar", handleBar as EventListener);
		eventSource.addEventListener("stream-error", handleStreamError as EventListener);

		return () => {
			clearReconnectTimer();
			eventSource.removeEventListener("ready", handleReady);
			eventSource.removeEventListener("bar", handleBar as EventListener);
			eventSource.removeEventListener("stream-error", handleStreamError as EventListener);
			eventSource.close();
			if (eventSourceRef.current === eventSource) eventSourceRef.current = null;
		};
	}, [clearReconnectTimer, selectedRange, symbol]);

	const snapshot = hoverSnapshot ?? latestSnapshot;
	const positive = (snapshot?.change ?? 0) >= 0;
	const statusLabel =
		realtimeStatus === "connected"
			? "Live"
			: realtimeStatus === "historical"
				? "Historical"
				: realtimeStatus === "reconnecting"
					? "Reconnecting"
					: "Connecting";

	return (
		<section
			className={`overflow-hidden rounded-[1.35rem] border border-border/70 bg-card shadow-sm ${className}`}
			aria-label={`${symbol} price chart`}
		>
			<div className="border-b border-border/70 px-4 py-4 sm:px-5">
				<div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
					<div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-3">
						<div>
							<div className="flex items-center gap-2">
								<h2 className="font-mono text-sm font-bold tracking-[0.12em]">{symbol}</h2>
								<span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
									<span
										className={`size-1.5 rounded-full ${realtimeStatus === "connected" ? "bg-primary" : "bg-muted-foreground/60"}`}
									/>
									{statusLabel}
								</span>
							</div>
							{snapshot && (
								<div className="mt-1 flex items-baseline gap-2">
									<span className="font-mono text-2xl font-semibold tracking-[-0.04em]">
										{formatPrice(snapshot.close)}
									</span>
									<span
										className={`font-mono text-xs font-medium ${positive ? "text-primary" : "text-destructive"}`}
									>
										{positive ? "+" : ""}
										{formatPrice(snapshot.change)} ({positive ? "+" : ""}
										{snapshot.changePercent.toFixed(2)}%)
									</span>
								</div>
							)}
						</div>

						{snapshot && (
							<dl className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
								{[
									["O", snapshot.open],
									["H", snapshot.high],
									["L", snapshot.low],
									["C", snapshot.close],
								].map(([label, value]) => (
									<div key={label} className="flex gap-1.5">
										<dt>{label}</dt>
										<dd className="font-mono text-foreground">{formatPrice(Number(value))}</dd>
									</div>
								))}
							</dl>
						)}
					</div>

					{showControls && (
						<div
							className="flex w-full items-center gap-1 overflow-x-auto rounded-full border border-border bg-background/65 p-1 xl:w-auto"
							role="group"
							aria-label="Chart range"
						>
							{CHART_RANGES.map((range) => (
								<button
									key={range.value}
									type="button"
									onClick={() => setSelectedRange(range.value)}
									aria-pressed={selectedRange === range.value}
									className={`min-w-11 rounded-full px-3 py-1.5 font-mono text-[10px] font-semibold transition-colors ${
										selectedRange === range.value
											? "bg-foreground text-background shadow-sm"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									{range.label}
								</button>
							))}
						</div>
					)}
				</div>
			</div>

			<div className="relative bg-background/25 p-2 sm:p-3">
				<div
					ref={chartContainerRef}
					className="w-full overflow-hidden rounded-xl"
					style={{ height: `clamp(340px, 52vw, ${height}px)` }}
					role="img"
					aria-label={
						snapshot
							? `${symbol} ${selectedRange} chart. Latest price ${formatPrice(snapshot.close)}, change ${snapshot.changePercent.toFixed(2)} percent.`
							: `${symbol} ${selectedRange} price chart`
					}
				/>

				{isLoading && (
					<div className="absolute inset-2 z-10 flex items-center justify-center rounded-xl bg-card/90 backdrop-blur-sm sm:inset-3">
						<div className="text-center">
							<RefreshCw className="mx-auto size-5 animate-spin text-primary" />
							<p className="mt-3 text-xs text-muted-foreground">
								Loading {selectedRange} market history…
							</p>
						</div>
					</div>
				)}

				{error && !isLoading && (
					<div className="absolute inset-2 z-10 flex items-center justify-center rounded-xl bg-card/95 p-6 backdrop-blur-sm sm:inset-3">
						<div className="max-w-sm text-center">
							<span className="mx-auto flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
								<AlertCircle className="size-5" />
							</span>
							<h3 className="mt-4 text-sm font-semibold">Chart unavailable</h3>
							<p className="mt-2 text-xs leading-5 text-muted-foreground">{error}</p>
							<Button
								variant="outline"
								size="sm"
								onClick={() => void loadHistoricalData()}
								className="mt-4 rounded-full"
							>
								<RefreshCw className="size-3.5" />
								Try again
							</Button>
						</div>
					</div>
				)}

				{showReconnecting && realtimeStatus === "reconnecting" && (
					<div className="absolute left-1/2 top-7 z-20 -translate-x-1/2 rounded-full border border-border bg-card/95 px-3 py-1.5 shadow-lg backdrop-blur">
						<div className="flex items-center gap-2 text-[10px] text-muted-foreground">
							<Radio className="size-3 animate-pulse text-primary" />
							Reconnecting live feed
						</div>
					</div>
				)}

				{isLoadingOlder && (
					<div className="absolute left-5 top-5 z-20 rounded-full border border-border bg-card/95 px-3 py-1.5 shadow-lg backdrop-blur">
						<div className="flex items-center gap-2 text-[10px] text-muted-foreground">
							<RefreshCw className="size-3 animate-spin text-primary" />
							Loading older history
						</div>
					</div>
				)}

				{historyLimitReached && !isLoadingOlder && (
					<div
						className="absolute right-5 top-5 z-20 rounded-full border border-border bg-card/95 px-3 py-1.5 text-[10px] text-muted-foreground shadow-lg backdrop-blur"
						role="status"
					>
						Oldest available data reached
					</div>
				)}
			</div>
		</section>
	);
}
