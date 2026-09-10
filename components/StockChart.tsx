"use client";

import PriceChart, { type PriceChartProps } from "@/components/PriceChart";

export interface StockChartProps extends Omit<PriceChartProps, "type"> {}

export default function StockChart(props: StockChartProps) {
	return <PriceChart {...props} type="stock" />;
}
