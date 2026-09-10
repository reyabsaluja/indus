import { describe, expect, it } from "vitest";
import {
	createMetricExplanationFallback,
	DEFAULT_EXPLANATION,
	fillMissingMetricExplanations,
	normalizeMetricExplanation,
	parseMetricExplanationResponse,
	parseValueAnalysis,
} from "@/lib/metric-explanations";

const item = { symbol: "AAPL", metric: "market_cap", value: 4_750_000_000_000 };

describe("metric explanations", () => {
	it("unwraps numbered provider JSON instead of exposing the wrapper", () => {
		const raw = JSON.stringify({
			1: {
				metric_display: "market capitalization: $4.75T",
				insight: "Market capitalization measures the value of outstanding shares.",
				evaluation: "neutral",
			},
		});

		const explanation = parseMetricExplanationResponse(raw, [item]).AAPL_market_cap;
		expect(parseValueAnalysis(explanation)).toMatchObject({
			metric_display: "market capitalization: $4.75T",
			insight: "Market capitalization measures the value of outstanding shares.",
			source: "model",
		});
		expect(explanation).not.toContain('"1"');
	});

	it("accepts useful structured fields while discarding provider extras", () => {
		const explanation = normalizeMetricExplanation({
			metric_display: "P/E: 31",
			insight: "Investors pay 31 times current earnings.",
			evaluation: "neutral",
			provider_note: "do not render",
		});

		expect(parseValueAnalysis(explanation)).toEqual({
			metric_display: "P/E: 31",
			insight: "Investors pay 31 times current earnings.",
			evaluation: "neutral",
		});
	});

	it("fails closed instead of rendering malformed JSON as prose", () => {
		const result = parseMetricExplanationResponse('{"1":{"metric_display":"truncated"}}', [item]);
		expect(result.AAPL_market_cap).toBe(DEFAULT_EXPLANATION);
		expect(normalizeMetricExplanation('{"1":{"metric_display":"truncated"}}')).toBeNull();
	});

	it("provides a deterministic explanation when the model is unavailable", () => {
		const fallback = parseValueAnalysis(createMetricExplanationFallback(item));
		expect(fallback).toMatchObject({
			metric_display: "AAPL market capitalization: $4.75T",
			evaluation: "neutral",
			source: "fallback",
		});
		expect(fallback?.insight).toContain("total market value");
	});

	it("fills malformed provider entries without replacing valid results", () => {
		const valid = JSON.stringify({
			metric_display: "Market cap: $4.75T",
			insight: "Valid provider response.",
			evaluation: "neutral",
		});
		const filled = fillMissingMetricExplanations({ AAPL_market_cap: valid }, [item]);
		expect(filled.AAPL_market_cap).toBe(valid);
		expect(
			fillMissingMetricExplanations({ AAPL_market_cap: DEFAULT_EXPLANATION }, [item])
				.AAPL_market_cap,
		).not.toBe(DEFAULT_EXPLANATION);
	});
});
