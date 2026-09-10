import { describe, expect, test } from "vitest";
import {
	createFallbackReport,
	createReportMessages,
	extractReportSummary,
	parseGeneratedReport,
	REPORT_GENERATION_CONFIG,
} from "@/lib/ai/report";
import { REPORT_DOCUMENT_JSON_SCHEMA } from "@/lib/report-document";

describe("createReportMessages", () => {
	test("prohibits unsupported research claims", () => {
		const messages = createReportMessages("AAPL", {
			longName: "Apple Inc.",
			regularMarketPrice: 200,
			marketCap: 3_000_000_000_000,
		});
		const systemInstruction = messages[0].parts[0].text;

		expect(systemInstruction).toContain("Use only facts present");
		expect(systemInstruction).toContain("price targets");
		expect(systemInstruction).toContain("investment recommendations");
		expect(messages[1].parts[0].text).toContain('"regularMarketPrice":200');
		expect(systemInstruction).toContain("potential business or market relevance");
		expect(systemInstruction).toContain("Never claim that a headline caused a price move");
	});

	test("marks a missing provider snapshot as unavailable", () => {
		const messages = createReportMessages("MSFT", null);
		expect(messages[1].parts[0].text).toContain('"unavailable":true');
	});

	test("allocates enough output for a complete report with bounded thinking", () => {
		expect(REPORT_GENERATION_CONFIG).toEqual({
			maxOutputTokens: 8192,
			responseMimeType: "application/json",
			responseJsonSchema: REPORT_DOCUMENT_JSON_SCHEMA,
			thinkingConfig: { thinkingLevel: "low" },
		});
	});

	test("forbids presentation markup in generated fields", () => {
		const systemInstruction = createReportMessages("AAPL", null)[0].parts[0].text;
		expect(systemInstruction).toContain("Do not use Markdown, HTML, LaTeX");
		expect(createReportMessages("AAPL", null)[1].parts[0].text).not.toContain("##");
	});

	test("builds a complete structured fallback from provider data", () => {
		const document = createFallbackReport("AAPL", {
			longName: "Apple Inc.",
			regularMarketPrice: 200,
			marketCap: 3_000_000_000_000,
			debtToEquity: 147,
			recentNews: [
				{
					headline: "Apple announces a product update",
					publisher: "Example News",
					publishedAt: "2026-09-02T10:00:00.000Z",
					url: "https://example.test/apple-update",
				},
			],
		});
		expect(document.version).toBe(2);
		expect(document.executiveSummary).toContain("Apple Inc. (AAPL)");
		expect(document.financialSnapshot).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ label: "Market capitalization", value: "$3.00T" }),
				expect.objectContaining({ label: "Debt-to-equity", value: "147.0%" }),
			]),
		);
		if (document.version !== 2) throw new Error("Expected current report document");
		expect(document.recentNews[0]).toMatchObject({
			headline: "Apple announces a product update",
			impact: expect.stringContaining("does not establish"),
		});
		expect(document.analysisAndWatchpoints).not.toHaveLength(0);
	});

	test("builds a valid fallback when market data is unavailable", () => {
		const document = createFallbackReport("AAPL", null);
		expect(document.financialSnapshot).toEqual([
			expect.objectContaining({ label: "Data availability", value: "Unavailable" }),
		]);
		expect(document.version).toBe(2);
	});
});

describe("extractReportSummary", () => {
	test("extracts and bounds the executive summary", () => {
		const summary = extractReportSummary(
			{
				version: 1,
				executiveSummary: "A".repeat(180),
				financialSnapshot: [{ label: "Price", value: "$200", analysis: "Current price." }],
				dataLimitations: ["The snapshot is limited."],
			},
			"AAPL",
		);

		expect(summary).toHaveLength(160);
		expect(summary.endsWith("...")).toBe(true);
	});

	test("parses a complete structured report", () => {
		const document = parseGeneratedReport(
			JSON.stringify({
				version: 1,
				executiveSummary:
					"A concise summary with enough detail to satisfy the minimum document length for a report.",
				financialSnapshot: [{ label: "Price", value: "$200", analysis: "Current supplied price." }],
				dataLimitations: ["The snapshot has no comparison period."],
			}),
		);
		expect(document.financialSnapshot[0].value).toBe("$200");
	});

	test("keeps news source metadata server-owned while preserving model impact analysis", () => {
		const trustedNews = [
			{
				headline: "Trusted headline",
				publisher: "Trusted Publisher",
				publishedAt: "2026-09-02T10:00:00.000Z",
				url: "https://example.test/trusted",
			},
		];
		const document = parseGeneratedReport(
			JSON.stringify({
				version: 2,
				executiveSummary:
					"A detailed summary with enough supplied evidence to satisfy the minimum document length safely.",
				financialSnapshot: [{ label: "Price", value: "$200", analysis: "Current supplied price." }],
				analysisAndWatchpoints: ["Track future updates."],
				recentNews: [
					{
						headline: "Model-altered headline",
						publisher: "Untrusted Publisher",
						publishedAt: "2026-09-01T10:00:00.000Z",
						url: "https://example.test/trusted",
						impact: "The headline could affect expectations, although direction is uncertain.",
					},
				],
				dataLimitations: ["The snapshot has no comparison period."],
			}),
			trustedNews,
		);

		expect(document).toMatchObject({
			version: 2,
			recentNews: [
				{
					...trustedNews[0],
					impact: "The headline could affect expectations, although direction is uncertain.",
				},
			],
		});
	});
});
