import { METRIC_DEFINITIONS } from "@/lib/metric-definitions";
import type { Item } from "@/lib/prompts";
import { getMetricLabel } from "@/lib/prompts";
import { valueAnalysisSchema } from "@/lib/schemas/api";
import type { ValueAnalysis } from "@/lib/types";

export const DEFAULT_EXPLANATION = "No explanation available.";

const EVALUATIONS = new Set(["green", "red", "neutral", "amber"]);

const DEFINITION_KEYS: Record<string, string> = {
	price: "Stock Price",
	pe_ratio: "P/E Ratio",
	volume: "Trading Volume",
	market_cap: "Market Cap",
	enterprise_value: "Enterprise Value",
	shares_outstanding: "Shares Outstanding",
	revenue: "Revenue",
	employees: "Employees",
	price_to_book: "P/B Ratio",
	price_to_sales: "P/S Ratio",
	ev_to_sales: "EV/Sales",
	ev_to_ebitda: "EV/EBITDA",
	forward_pe: "Forward P/E",
	peg_ratio: "PEG Ratio",
	gross_margin: "Gross Margin",
	ebitda_margin: "EBITDA Margin",
	operating_margin: "Operating Margin",
	net_margin: "Net Margin",
	roa: "ROA",
	roe: "ROE",
	total_cash: "Total Cash",
	total_debt: "Total Debt",
	debt_to_equity: "Debt-to-Equity",
	revenue_growth: "Revenue Growth",
	earnings_growth: "Earnings Growth",
	beta: "Beta",
	dividend_yield: "Dividend Yield",
	dividend_per_share: "Dividend Rate",
	payout_ratio: "Payout Ratio",
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseJson(value: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

export function parseValueAnalysis(value: unknown): ValueAnalysis | null {
	const candidate = typeof value === "string" ? parseJson(value) : value;
	if (!isRecord(candidate)) return null;

	if (typeof candidate.metric_display === "string" && typeof candidate.insight === "string") {
		const evaluation =
			typeof candidate.evaluation === "string" && EVALUATIONS.has(candidate.evaluation)
				? candidate.evaluation
				: "neutral";
		const parsed = valueAnalysisSchema.safeParse({
			metric_display: candidate.metric_display,
			insight: candidate.insight,
			evaluation,
			source:
				candidate.source === "model" || candidate.source === "fallback"
					? candidate.source
					: undefined,
		});
		return parsed.success ? parsed.data : null;
	}

	for (const key of Object.keys(candidate).sort((left, right) => Number(left) - Number(right))) {
		if (!/^\d+$/.test(key)) continue;
		const nested = parseValueAnalysis(candidate[key]);
		if (nested) return nested;
	}

	return null;
}

export function normalizeMetricExplanation(
	value: unknown,
	source?: ValueAnalysis["source"],
): string | null {
	const structured = parseValueAnalysis(value);
	if (structured) return JSON.stringify(source ? { ...structured, source } : structured);
	if (typeof value !== "string") return null;

	const text = value.trim();
	if (!text || text.length > 1_200 || /^[{[]/.test(text)) return null;
	return text;
}

function extractJsonText(rawText: string): string {
	const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
	if (fenced?.[1]) return fenced[1];
	const object = rawText.match(/\{[\s\S]*\}/);
	return object?.[0] ?? rawText;
}

function explanationKey(item: Item): string {
	return `${item.symbol}_${item.metric}`;
}

export function parseMetricExplanationResponse(
	rawText: string,
	items: Item[],
): Record<string, string> {
	const parsed = parseJson(extractJsonText(rawText));
	if (isRecord(parsed)) {
		return Object.fromEntries(
			items.map((item, index) => {
				const value = parsed[String(index + 1)] ?? (items.length === 1 ? parsed : null);
				return [
					explanationKey(item),
					normalizeMetricExplanation(value, "model") ?? DEFAULT_EXPLANATION,
				];
			}),
		);
	}

	const lines = rawText
		.split(/\n+/)
		.map((line) => line.trim().match(/^\d+[.)]\s*(.+)$/)?.[1])
		.filter((line): line is string => Boolean(line));

	return Object.fromEntries(
		items.map((item, index) => [
			explanationKey(item),
			normalizeMetricExplanation(lines[index]) ?? DEFAULT_EXPLANATION,
		]),
	);
}

export function createMetricExplanationFallback(item: Item): string {
	const definition = METRIC_DEFINITIONS[DEFINITION_KEYS[item.metric]]?.definition;
	const insight = definition
		? `${definition} This value alone does not establish whether the result is favorable; compare it with relevant history and related metrics.`
		: "This is the currently supplied value. Compare it with relevant history and related metrics before drawing a conclusion.";

	return JSON.stringify({
		metric_display: getMetricLabel(item.symbol, item.metric, item.value),
		insight,
		evaluation: "neutral",
		source: "fallback",
	});
}

export function fillMissingMetricExplanations(
	explanations: Record<string, string>,
	items: Item[],
): Record<string, string> {
	return Object.fromEntries(
		items.map((item) => {
			const key = explanationKey(item);
			const explanation = explanations[key];
			return [
				key,
				explanation && explanation !== DEFAULT_EXPLANATION
					? explanation
					: createMetricExplanationFallback(item),
			];
		}),
	);
}
