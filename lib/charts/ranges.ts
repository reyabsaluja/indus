export const CHART_RANGES = [
	{ value: "1D", label: "1D", timeframe: "1Min", fetchDays: 7, displayDays: 1 },
	{ value: "5D", label: "5D", timeframe: "5Min", fetchDays: 14, displayDays: 8 },
	{ value: "1M", label: "1M", timeframe: "1Hour", fetchDays: 45, displayDays: 31 },
	{ value: "6M", label: "6M", timeframe: "1Day", fetchDays: 210, displayDays: 183 },
	{ value: "1Y", label: "1Y", timeframe: "1Day", fetchDays: 420, displayDays: 366 },
	{ value: "5Y", label: "5Y", timeframe: "1Week", fetchDays: 2_000, displayDays: 1_830 },
] as const;

export type ChartRangeValue = (typeof CHART_RANGES)[number]["value"];

export function getChartRange(value: ChartRangeValue) {
	return CHART_RANGES.find((range) => range.value === value) ?? CHART_RANGES[0];
}

export function getRangeStartTimestamp(value: ChartRangeValue, nowMs = Date.now()): number {
	const range = getChartRange(value);
	return Math.floor((nowMs - range.fetchDays * 24 * 60 * 60 * 1000) / 1000);
}

export function filterRangeData<T extends { time: number }>(
	data: T[],
	value: ChartRangeValue,
): T[] {
	const latest = data.at(-1);
	if (!latest) return [];

	const range = getChartRange(value);
	const cutoff = latest.time - range.displayDays * 24 * 60 * 60;
	const filtered = data.filter((bar) => bar.time >= cutoff);
	return filtered.length >= 2 ? filtered : data;
}

export function getPreviousHistoryEndTimestamp(earliestTimestamp: number): number {
	return Math.max(0, Math.floor(earliestTimestamp) - 1);
}

export function prependOlderBars<T extends { time: number }>(current: T[], older: T[]): T[] {
	const firstTimestamp = current[0]?.time;
	if (firstTimestamp === undefined) {
		return [...older].sort((left, right) => left.time - right.time);
	}

	const unseenOlderBars = older
		.filter((bar) => bar.time < firstTimestamp)
		.sort((left, right) => left.time - right.time);
	return [...unseenOlderBars, ...current];
}

export function shiftLogicalRange(
	range: { from: number; to: number } | null,
	prependedCount: number,
): { from: number; to: number } | null {
	if (!range || prependedCount <= 0) return range;
	return {
		from: range.from + prependedCount,
		to: range.to + prependedCount,
	};
}
