import { describe, expect, it } from "vitest";
import { isCompleteReportContent } from "@/lib/report-content";
import {
	parseReportDocumentContent,
	reportDocumentSchema,
	serializeReportDocument,
} from "@/lib/report-document";

const document = {
	version: 1 as const,
	executiveSummary:
		"The supplied snapshot contains a current price and selected company metrics for review.",
	financialSnapshot: [
		{ label: "Market capitalization", value: "$4.75T", analysis: "The supplied company value." },
	],
	dataLimitations: ["No peer or historical comparison was supplied."],
};

describe("report document", () => {
	it("round-trips a bounded structured document", () => {
		const content = serializeReportDocument(document);
		expect(parseReportDocumentContent(content)).toEqual(document);
		expect(isCompleteReportContent(content)).toBe(true);
	});

	it("validates an in-depth report with safe recent-news sources", () => {
		const current = {
			...document,
			version: 2 as const,
			analysisAndWatchpoints: ["Track the supplied margin alongside future growth updates."],
			recentNews: [
				{
					headline: "Apple announces a product update",
					publisher: "Example News",
					publishedAt: "2026-09-02T10:00:00.000Z",
					url: "https://example.test/apple-update",
					impact: "The announcement may affect product expectations, but direction is uncertain.",
				},
			],
		};
		expect(parseReportDocumentContent(serializeReportDocument(current))).toEqual(current);
		expect(
			reportDocumentSchema.safeParse({
				...current,
				recentNews: [{ ...current.recentNews[0], url: "javascript:alert(1)" }],
			}).success,
		).toBe(false);
	});

	it("rejects missing sections, extra fields, and presentation markup objects", () => {
		expect(parseReportDocumentContent('{"version":1}')).toBeNull();
		expect(reportDocumentSchema.safeParse({ ...document, markdown: "## heading" }).success).toBe(
			false,
		);
	});

	it("keeps complete legacy reports readable during migration", () => {
		const legacy =
			"## Executive Summary\nSummary\n## Available Financial Snapshot\nData\n## Data Limitations\nLimit\nThis report is educational and is not investment advice.";
		expect(isCompleteReportContent(legacy)).toBe(true);
	});
});
