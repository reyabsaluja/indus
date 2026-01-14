"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries, IChartApi, ISeriesApi } from "lightweight-charts";
import io, { Socket } from "socket.io-client";
import type { CandlestickData, Time } from "lightweight-charts";

// Use CandlestickData from lightweight-charts for type compatibility
type BarData = CandlestickData<Time>;

let socket: Socket | null = null;

// Add styles for the slider
const sliderStyles = `
	input[type="range"].slider::-webkit-slider-track {
		height: 8px;
		background: #e5e7eb;
		border-radius: 4px;
	}
	input[type="range"].slider::-webkit-slider-thumb {
		appearance: none;
		width: 20px;
		height: 20px;
		background: #3b82f6;
		border-radius: 50%;
		cursor: pointer;
		margin-top: -6px;
		box-shadow: 0 2px 4px rgba(0,0,0,0.2);
	}
	input[type="range"].slider::-moz-range-track {
		height: 8px;
		background: #e5e7eb;
		border-radius: 4px;
	}
	input[type="range"].slider::-moz-range-thumb {
		width: 20px;
		height: 20px;
		background: #3b82f6;
		border-radius: 50%;
		cursor: pointer;
		border: none;
		box-shadow: 0 2px 4px rgba(0,0,0,0.2);
	}
`;

interface StockChartProps {
	symbol: string;
	height?: number;
	className?: string;
}

export default function StockChart({ symbol: initialSymbol, height = 500, className = "" }: StockChartProps) {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
	const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol);
	const [selectedTimeframe, setSelectedTimeframe] = useState("1Min");
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [connectionStatus, setConnectionStatus] = useState("disconnected");
	const [isLoadingMoreData, setIsLoadingMoreData] = useState(false);
	const [websocketEnabled, setWebsocketEnabled] = useState(true);
	const [hasReachedDataLimit, setHasReachedDataLimit] = useState(false);
	const [dataLimitMessage, setDataLimitMessage] = useState<string | null>(null);

	// Use refs for values only needed in callbacks (no UI display)
	const isLoadingMoreDataRef = useRef(false);
	const earliestLoadedTimestampRef = useRef<number | null>(null);
	const selectedSymbolRef = useRef(selectedSymbol);
	const selectedTimeframeRef = useRef(selectedTimeframe);
	const historicalDataRef = useRef<BarData[]>([]);
	const hasReachedDataLimitRef = useRef(false);

	const timeframes = [
		{ value: "1Min", label: "1 Min" },
		{ value: "5Min", label: "5 Min" },
		{ value: "15Min", label: "15 Min" },
		{ value: "1Hour", label: "1 Hour" },
		{ value: "1Day", label: "1 Day" },
		{ value: "1Week", label: "1 Week" },
		{ value: "1Month", label: "1 Month" },
	];

	// Add debug info only in development mode
	const addDebugInfo = (message: string) => {
		if (process.env.NODE_ENV === "development") {
			console.log(`🔍 DEBUG: ${message}`);
		}
	};

	const loadHistoricalData = async (symbol: string, timeframe: string = selectedTimeframe) => {
		addDebugInfo(`Loading historical data for ${symbol} (${timeframe})...`);

		// Clear existing chart data immediately to prevent timeframe mixing
		if (candlestickSeriesRef.current) {
			candlestickSeriesRef.current.setData([]);
		}

		// Reset data limit state
		hasReachedDataLimitRef.current = false;

		try {
			const response = await fetch(`/api/alpaca?symbol=${symbol}&timeframe=${timeframe}`);
			const result = await response.json();

			if (response.ok && result.data && !result.isEmpty) {
				historicalDataRef.current = result.data;
				earliestLoadedTimestampRef.current = result.earliestTimestamp;

				addDebugInfo(`Set earliestLoadedDate to: ${result.earliestTimestamp}`);

				addDebugInfo(`Loaded ${result.totalBars} historical bars for ${symbol}`);

				// Update chart with historical data
				if (candlestickSeriesRef.current) {
					candlestickSeriesRef.current.setData(result.data);
				}
			} else {
				addDebugInfo(`Failed to load historical data: ${result.error}`);
				setError(result.error);
			}
		} catch (error) {
			addDebugInfo(`Error loading historical data: ${error}`);
			setError("Internal server error");
		}
	};

	const loadMoreHistoricalData = async () => {
		const symbol = selectedSymbolRef.current;
		const timeframe = selectedTimeframeRef.current;
		const earliestDate = earliestLoadedTimestampRef.current;

		if (!earliestDate || isLoadingMoreDataRef.current) return;

		setIsLoadingMoreData(true);
		isLoadingMoreDataRef.current = true;

		try {
			const response = await fetch(`/api/alpaca?symbol=${symbol}&timeframe=${timeframe}&end=${earliestDate}`);
			const result = await response.json();

			if (response.ok && result.data && !result.isEmpty) {
				// Filter out overlap at boundary, then prepend new data
				const filteredNewData = result.data.filter((bar: BarData) => bar.time < historicalDataRef.current[0].time);
				const combinedData = [...filteredNewData, ...historicalDataRef.current];

				historicalDataRef.current = combinedData;
				earliestLoadedTimestampRef.current = result.earliestTimestamp;

				addDebugInfo(`Loaded ${filteredNewData.length} new bars, total: ${combinedData.length}`);

				if (candlestickSeriesRef.current) {
					candlestickSeriesRef.current.setData(combinedData);
				}
			} else {
				hasReachedDataLimitRef.current = true;
				setHasReachedDataLimit(true);

				// Calculate how far back we've gone
				if (earliestLoadedTimestampRef.current) {
					const earliestDate = new Date(earliestLoadedTimestampRef.current * 1000);
					const yearsBack = Math.round((Date.now() - earliestDate.getTime()) / (365 * 24 * 60 * 60 * 1000));
					setDataLimitMessage(`Reached data limit: ${earliestDate.toLocaleDateString()} (${yearsBack} years ago)`);
				}

				addDebugInfo(`No more historical data available for ${symbol} - reached data limit`);
			}
		} catch (error) {
			addDebugInfo(`Error loading more historical data: ${error}`);
		} finally {
			setIsLoadingMoreData(false);
			isLoadingMoreDataRef.current = false;
		}
	};

	useEffect(() => {
		if (!chartContainerRef.current) return;

		// Create chart following documentation pattern - Dark Mode
		const chart = createChart(chartContainerRef.current, {
			width: chartContainerRef.current.clientWidth,
			height: height,
			layout: {
				background: { color: "transparent" },
				textColor: "#e5e7eb",
			},
			grid: {
				vertLines: { color: "#374151" },
				horzLines: { color: "#374151" },
			},
			crosshair: {
				mode: 1,
				vertLine: {
					color: "#6b7280",
					width: 1,
					style: 2,
				},
				horzLine: {
					color: "#6b7280",
					width: 1,
					style: 2,
				},
			},
			rightPriceScale: {
				borderColor: "#4b5563",
				textColor: "#e5e7eb",
			},
			timeScale: {
				borderColor: "#4b5563",
				timeVisible: true,
				secondsVisible: false,
				// Set zoom limits
				rightOffset: 12,
				barSpacing: 6,
				minBarSpacing: 0.5, // Minimum zoom (maximum zoom in)
				maxBarSpacing: 50, // Maximum zoom (maximum zoom out)
			},
		});

		// Create candlestick series
		const candlestickSeries = chart.addSeries(CandlestickSeries, {
			upColor: "#26a69a",
			downColor: "#ef5350",
			borderVisible: false, // Remove black borders
			wickUpColor: "#1a7a6b", // Thicker, darker up wicks
			wickDownColor: "#c43e3a", // Thicker, darker down wicks
			priceLineVisible: false,
		});

		chartRef.current = chart;
		candlestickSeriesRef.current = candlestickSeries;

		// Add visible logical range listener for dynamic data loading (with debounce)
		let rangeChangeTimeout: NodeJS.Timeout;
		chart.timeScale().subscribeVisibleLogicalRangeChange((logicalRange) => {
			// Clear previous timeout to debounce rapid changes
			if (rangeChangeTimeout) clearTimeout(rangeChangeTimeout);

			rangeChangeTimeout = setTimeout(() => {
				if (logicalRange && earliestLoadedTimestampRef.current && !isLoadingMoreDataRef.current && !hasReachedDataLimitRef.current) {
					// Only trigger if user has actually scrolled to the beginning (not initial load)
					// And ensure we have sufficient data already loaded to avoid immediate trigger
					if (logicalRange.from !== null && logicalRange.from <= 3 && historicalDataRef.current.length > 50) {
						addDebugInfo(`Triggering loadMoreHistoricalData: From=${earliestLoadedTimestampRef.current}, timeframe=${selectedTimeframeRef.current}`);
						loadMoreHistoricalData();
					}
				}
			}, 500); // 500ms debounce to prevent immediate triggers
		});

		// Handle resize
		const handleResize = () => {
			if (chartContainerRef.current && chartRef.current) {
				chartRef.current.applyOptions({
					width: chartContainerRef.current.clientWidth,
				});
			}
		};

		window.addEventListener("resize", handleResize);

		setIsLoading(false);

		return () => {
			window.removeEventListener("resize", handleResize);
			if (chartRef.current) {
				chartRef.current.remove();
			}
		};
	}, []);

	useEffect(() => {
		addDebugInfo("Initializing socket connection...");

		// Only try to connect to socket.io if websocket is enabled
		if (!websocketEnabled) {
			addDebugInfo("WebSocket disabled due to configuration issues");
			setConnectionStatus("disabled");
			return;
		}

		// Connect to the socket endpoint first to initialize the server
		fetch("/api/socket")
			.then(() => {
				addDebugInfo("Socket endpoint initialized");

				// Now connect to socket.io after the server is initialized
				socket = io({
					path: "/api/socket_io",
					transports: ["websocket", "polling"],
					timeout: 10000,
					reconnection: true,
					reconnectionAttempts: 5,
					reconnectionDelay: 1000,
				});

				// Connection events
				socket.on("connect", () => {
					addDebugInfo("✅ Connected to socket.io");
					setConnectionStatus("connected");
					setError(null);
				});

				socket.on("disconnect", (reason: string) => {
					addDebugInfo(`❌ Disconnected from socket.io: ${reason}`);
					setConnectionStatus("disconnected");
				});

				socket.on("connect_error", (err: Error) => {
					addDebugInfo(`🔴 Connection error: ${err.message}`);
					setError(null); // Don't show connection errors as user errors
					setConnectionStatus("error");
					setWebsocketEnabled(false);
				});

				socket.on("error", (err: Error) => {
					addDebugInfo(`🔴 Socket error: ${err.message}`);
					// Don't show socket errors as user errors - they're configuration issues
					setConnectionStatus("error");
				});

				// Data events
				socket.on("stock_bar", (data: BarData) => {
					addDebugInfo(`📊 Received stock_bar data: ${JSON.stringify(data)}`);
					// Only update chart with live data if timeframe is 1Min
					if (candlestickSeriesRef.current && selectedTimeframeRef.current === "1Min") {
						// Update the chart with live data
						candlestickSeriesRef.current.update(data);
						addDebugInfo(`📈 Updated chart with live data (1Min timeframe)`);
					} else if (selectedTimeframeRef.current !== "1Min") {
						addDebugInfo(`📊 Ignoring live data - timeframe is ${selectedTimeframeRef.current} (not 1Min)`);
					}
				});

				socket.on("alpaca_error", (error: { message: string; error?: string }) => {
					addDebugInfo(`🔴 Alpaca error: ${JSON.stringify(error)}`);
					// Don't show alpaca errors as user errors - they're configuration issues
					setWebsocketEnabled(false);
				});

				socket.on("alpaca_connected", () => {
					addDebugInfo("✅ Alpaca WebSocket connected");
				});

				socket.on("alpaca_disconnected", (reason: string) => {
					addDebugInfo(`❌ Alpaca WebSocket disconnected: ${reason}`);
				});
			})
			.catch((err) => {
				addDebugInfo(`Socket endpoint error: ${err.message}`);
				setError(`Failed to initialize socket endpoint: ${err.message}`);
				setWebsocketEnabled(false);
			});

		// Add cleanup for tab closure
		const handleBeforeUnload = () => {
			if (socket && socket.connected) {
				addDebugInfo("Tab closing - unsubscribing from symbol");
				socket.emit("unsubscribe", { symbol: selectedSymbolRef.current, type: "stock" });
				socket.disconnect();
			}
		};

		window.addEventListener("beforeunload", handleBeforeUnload);

		return () => {
			// Remove event listener
			window.removeEventListener("beforeunload", handleBeforeUnload);

			if (socket) {
				addDebugInfo("Component unmounting - cleaning up socket connection");
				// Unsubscribe from current symbol before disconnecting
				if (socket.connected && selectedSymbolRef.current) {
					socket.emit("unsubscribe", { symbol: selectedSymbolRef.current, type: "stock" });
				}
				socket.disconnect();
				socket = null;
			}
		};
	}, [websocketEnabled]);

	// Update refs when state changes
	useEffect(() => {
		selectedSymbolRef.current = selectedSymbol;
	}, [selectedSymbol]);

	useEffect(() => {
		selectedTimeframeRef.current = selectedTimeframe;
	}, [selectedTimeframe]);

	// Handle symbol changes (data loading only) - timeframe changes are handled by onClick
	useEffect(() => {
		// Reset data state when symbol changes
		historicalDataRef.current = [];
		earliestLoadedTimestampRef.current = null;
		setHasReachedDataLimit(false);
		hasReachedDataLimitRef.current = false;
		setDataLimitMessage(null);

		// Load historical data for new symbol
		loadHistoricalData(selectedSymbol, selectedTimeframe);
	}, [selectedSymbol]); // Only trigger on symbol change, not timeframe

	// Handle WebSocket subscriptions separately
	useEffect(() => {
		// Only try to subscribe if websocket is enabled and connected
		if (websocketEnabled && socket && socket.connected) {
			addDebugInfo(`Subscribing to symbol: ${selectedSymbol}`);
			socket.emit("subscribe", { symbol: selectedSymbol });
		} else {
			if (!websocketEnabled) {
				addDebugInfo(`WebSocket disabled - using historical data only for ${selectedSymbol}`);
			} else {
				addDebugInfo(`Cannot subscribe to ${selectedSymbol} - socket not connected`);
			}
		}
	}, [connectionStatus, selectedSymbol, websocketEnabled]);

	// Update symbol when prop changes
	useEffect(() => {
		setSelectedSymbol(initialSymbol);
	}, [initialSymbol]);

	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: sliderStyles }} />
			<div className={`bg-card rounded-lg border border-border ${className}`}>
				{/* Timeframe Selector */}
				<div className="p-4 border-b border-border">
					<div className="flex items-center justify-between">
						<h3 className="text-lg font-semibold">Price Chart</h3>
						<div className="flex items-center gap-1 bg-muted rounded-lg p-1">
							{timeframes.map((timeframe) => (
								<button
									key={timeframe.value}
									onClick={() => {
										// Clear all data states before switching timeframe
										historicalDataRef.current = [];
										earliestLoadedTimestampRef.current = null;
										hasReachedDataLimitRef.current = false;
										setHasReachedDataLimit(false);
										setDataLimitMessage(null);

										// Clear chart immediately
										if (candlestickSeriesRef.current) {
											candlestickSeriesRef.current.setData([]);
										}

										setSelectedTimeframe(timeframe.value);
										loadHistoricalData(selectedSymbol, timeframe.value);
									}}
									className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${selectedTimeframe === timeframe.value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background"}`}
								>
									{timeframe.label}
								</button>
							))}
						</div>
					</div>
				</div>

				{error && (
					<div className="mx-4 mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
						<p className="text-destructive font-semibold">Failed to load historical data.</p>
						<p className="text-destructive">Error: {error}</p>
					</div>
				)}

				<div className="relative p-4">
					{isLoading && (
						<div className="absolute inset-0 bg-background/90 flex items-center justify-center z-10 rounded-lg">
							<div className="flex items-center space-x-2">
								<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
								<span className="text-muted-foreground">Initializing chart...</span>
							</div>
						</div>
					)}

					{/* Data Limit Reached Indicator */}
					{hasReachedDataLimit && dataLimitMessage && (
						<div className="absolute top-8 left-8 z-20 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-4 py-2 rounded-lg shadow-lg max-w-xs">
							<div className="flex items-center space-x-2">
								<div className="flex-shrink-0">
									<svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
										<path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
									</svg>
								</div>
								<div className="text-sm">
									<p className="font-medium">Data Limit Reached</p>
									<p className="text-xs">{dataLimitMessage}</p>
								</div>
							</div>
						</div>
					)}

					{/* Loading More Data Indicator */}
					{isLoadingMoreData && (
						<div className="absolute top-8 right-8 z-20 bg-blue-500/10 border border-blue-500/30 text-blue-400 px-4 py-2 rounded-lg shadow-lg">
							<div className="flex items-center space-x-2">
								<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
								<span className="text-sm">Loading more data...</span>
							</div>
						</div>
					)}

					<div ref={chartContainerRef} className={`w-full max-w-full border border-border rounded-lg overflow-hidden`} style={{ height: `${height}px` }} />
				</div>
			</div>
		</>
	);
}
