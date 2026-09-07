import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { createReportPdf, reportPdfFilename } from "@/lib/server/report-pdf";

const baseReport = {
	symbol: "AAPL",
	companyName: "Apple Inc.",
	createdAt: "2026-09-03T12:00:00.000Z",
	content: JSON.stringify({
		version: 1,
		executiveSummary:
			"The supplied snapshot contains current company metrics. It provides a concise view without unsupported conclusions.",
		financialSnapshot: [
			{
				label: "Market capitalization",
				value: "$4.75T",
				analysis: "Market capitalization measures the supplied equity value.",
			},
		],
		dataLimitations: ["No peer comparison was supplied."],
	}),
};

describe("report PDF", () => {
	it("creates a valid PDF with document metadata", async () => {
		const bytes = await createReportPdf(baseReport);
		expect(new TextDecoder().decode(bytes.slice(0, 8))).toContain("%PDF-");
		const pdf = await PDFDocument.load(bytes);
		expect(pdf.getTitle()).toBe("AAPL Research Report");
		expect(pdf.getAuthor()).toBe("Indus");
		expect(pdf.getPageCount()).toBeGreaterThan(0);
	});

	it("paginates long reports instead of clipping them", async () => {
		const content = JSON.parse(baseReport.content);
		content.financialSnapshot = Array.from({ length: 12 }, (_, index) => ({
			label: `Metric ${index + 1}`,
			value: String(index + 1),
			analysis: "A detailed explanation of the supplied metric and its interpretation. ".repeat(8),
		}));
		const pdf = await PDFDocument.load(
			await createReportPdf({ ...baseReport, content: JSON.stringify(content) }),
		);
		expect(pdf.getPageCount()).toBeGreaterThan(1);
	});

	it("renders analysis and recent-news sections in current reports", async () => {
		const current = JSON.parse(baseReport.content);
		current.version = 2;
		current.analysisAndWatchpoints = ["Track future margin and growth updates together."];
		current.recentNews = [
			{
				headline: "Apple announces a product update",
				publisher: "Example News",
				publishedAt: "2026-09-02T10:00:00.000Z",
				url: "https://example.test/apple-update",
				impact: "The headline may affect expectations, but the direction remains uncertain.",
			},
		];
		const pdf = await PDFDocument.load(
			await createReportPdf({ ...baseReport, content: JSON.stringify(current) }),
		);
		expect(pdf.getPageCount()).toBeGreaterThan(0);
	});

	it("creates a predictable filesystem-safe filename", () => {
		expect(reportPdfFilename("BTC/USD", baseReport.createdAt)).toBe(
			"BTC-USD-research-report-2026-09-03.pdf",
		);
	});
});
