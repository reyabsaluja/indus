import { describe, expect, it } from "vitest";
import {
	CHART_RANGES,
	filterRangeData,
	getChartRange,
	getPreviousHistoryEndTimestamp,
	getRangeStartTimestamp,
	prependOlderBars,
	shiftLogicalRange,
} from "@/lib/charts/ranges";

describe("chart ranges", () => {
	it("maps product ranges to bounded provider intervals", () => {
		expect(CHART_RANGES.map(({ value }) => value)).toEqual(["1D", "5D", "1M", "6M", "1Y", "5Y"]);
		expect(getChartRange("1M").timeframe).toBe("1Hour");
		expect(getChartRange("5Y").timeframe).toBe("1Week");
	});

	it("uses an expanded fetch window so closed-market days do not empty short ranges", () => {
		const now = Date.UTC(2026, 7, 7, 12);
		const sevenDaysInSeconds = 7 * 24 * 60 * 60;
		expect(getRangeStartTimestamp("1D", now)).toBe(Math.floor(now / 1000) - sevenDaysInSeconds);
	});

	it("shows the latest session window while preserving sparse provider results", () => {
		const day = 24 * 60 * 60;
		const data = [0, 1, 2, 3].map((offset) => ({ time: offset * day, close: offset }));
		expect(filterRangeData(data, "1D").map(({ close }) => close)).toEqual([2, 3]);
		expect(filterRangeData(data.slice(0, 1), "1D")).toEqual(data.slice(0, 1));
	});

	it("requests the next history page immediately before the earliest loaded bar", () => {
		expect(getPreviousHistoryEndTimestamp(1_700_000_000)).toBe(1_699_999_999);
		expect(getPreviousHistoryEndTimestamp(0)).toBe(0);
	});

	it("prepends only genuinely older bars in chronological order", () => {
		const current = [{ time: 30 }, { time: 40 }];
		const older = [{ time: 20 }, { time: 30 }, { time: 10 }];

		expect(prependOlderBars(current, older)).toEqual([
			{ time: 10 },
			{ time: 20 },
			{ time: 30 },
			{ time: 40 },
		]);
		expect(prependOlderBars(current, [{ time: 30 }])).toEqual(current);
	});

	it("keeps the current viewport anchored after older bars are prepended", () => {
		expect(shiftLogicalRange({ from: -4.5, to: 35.5 }, 80)).toEqual({
			from: 75.5,
			to: 115.5,
		});
		expect(shiftLogicalRange(null, 80)).toBeNull();
	});
});
