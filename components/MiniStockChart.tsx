"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries, IChartApi, ISeriesApi } from "lightweight-charts";

interface MiniStockChartProps {
	symbol: string;
	height?: number;
	className?: string;
}

export default function MiniStockChart({ symbol, height = 200, className = "" }: MiniStockChartProps) {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadHistoricalData = async (stockSymbol: string) => {
		setIsLoading(true);
		setError(null);

		try {
			// Load 1 day timeframe for mini chart
			const response = await fetch(`/api/alpaca?symbol=${stockSymbol}&timeframe=1Day`);
			const result = await response.json();

			if (response.ok && result.data && !result.isEmpty) {
				if (candlestickSeriesRef.current) {
					candlestickSeriesRef.current.setData(result.data);
				}
			} else {
				setError(`Failed to load data`);
			}
		} catch (error) {
			setError(`Error loading data`);
			console.error("Error loading data:", error);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		if (!chartContainerRef.current) return;

		// Create compact chart with dark mode styling
		const chart = createChart(chartContainerRef.current, {
			width: chartContainerRef.current.clientWidth,
			height: height,
			layout: {
				background: { color: "transparent" },
				textColor: "#9ca3af",
			},
			grid: {
				vertLines: { visible: false },
				horzLines: { visible: false },
			},
			crosshair: {
				vertLine: { visible: false },
				horzLine: { visible: false },
			},
			rightPriceScale: {
				visible: false,
			},
			timeScale: {
				visible: false,
				rightOffset: 2,
				barSpacing: 3,
				minBarSpacing: 0.5,
			},
			handleScroll: false,
			handleScale: false,
		});

		// Create candlestick series
		const candlestickSeries = chart.addSeries(CandlestickSeries, {
			upColor: "#26a69a",
			downColor: "#ef5350",
			borderVisible: false,
			wickUpColor: "#1a7a6b",
			wickDownColor: "#c43e3a",
			priceLineVisible: false,
		});

		chartRef.current = chart;
		candlestickSeriesRef.current = candlestickSeries;

		// Load initial data
		loadHistoricalData(symbol);

		// Handle resize
		const handleResize = () => {
			if (chartContainerRef.current && chartRef.current) {
				chartRef.current.applyOptions({
					width: chartContainerRef.current.clientWidth,
				});
			}
		};

		window.addEventListener("resize", handleResize);

		return () => {
			window.removeEventListener("resize", handleResize);
			if (chartRef.current) {
				chartRef.current.remove();
			}
		};
	}, [symbol, height]);

	return (
		<div className={`relative ${className}`}>
			{isLoading && (
				<div className="absolute inset-0 bg-background/75 flex items-center justify-center z-10 rounded">
					<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
				</div>
			)}

			{error && (
				<div className="absolute inset-0 flex items-center justify-center z-10 rounded bg-background/75">
					<span className="text-xs text-muted-foreground">Chart unavailable</span>
				</div>
			)}

			<div ref={chartContainerRef} className="w-full border border-border rounded" style={{ height: `${height}px` }} />
		</div>
	);
}
