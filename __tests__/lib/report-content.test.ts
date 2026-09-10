import { describe, expect, it } from "vitest";
import {
	isCompleteReportContent,
	MAX_REPORT_CONTENT_LENGTH,
	parseReportContent,
} from "@/lib/report-content";

describe("report content", () => {
	it("keeps adjacent headings, paragraphs, and lists as complete blocks", () => {
		expect(
			parseReportContent(
				"# AAPL Research Report\n## Overview\nApple produces consumer devices.\nRevenue remains durable.\n- Strong margins\n- Large cash balance\n## Risks\nDemand may slow.",
			),
		).toEqual([
			{ kind: "heading", level: 1, text: "AAPL Research Report" },
			{ kind: "heading", level: 2, text: "Overview" },
			{ kind: "paragraph", text: "Apple produces consumer devices. Revenue remains durable." },
			{ kind: "list", items: ["Strong margins", "Large cash balance"] },
			{ kind: "heading", level: 2, text: "Risks" },
			{ kind: "paragraph", text: "Demand may slow." },
		]);
	});

	const completeReport = `## Executive Summary
Summary.
## Available Financial Snapshot
Figures.
## Data Limitations
Limitations.
This report is educational and is not investment advice.`;

	it("recognizes all required sections followed by the disclaimer", () => {
		expect(isCompleteReportContent(completeReport)).toBe(true);
	});

	it.each([
		["mid-sentence output", "## Executive Summary\nApple has a market capitalization of 4,"],
		["missing section", completeReport.replace("## Data Limitations\nLimitations.\n", "")],
		["wrong section order", completeReport.replace("## Executive Summary", "## Data Limitations")],
		["missing disclaimer", completeReport.replace(/This report.*$/, "")],
	])("rejects %s", (_case, content) => {
		expect(isCompleteReportContent(content)).toBe(false);
	});

	it("rejects oversized legacy content before PDF rendering", () => {
		const oversized = completeReport.replace("Summary.", "A".repeat(MAX_REPORT_CONTENT_LENGTH));
		expect(isCompleteReportContent(oversized)).toBe(false);
	});
});
