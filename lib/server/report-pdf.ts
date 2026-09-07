import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "pdf-lib";
import { parseReportContent } from "@/lib/report-content";
import { parseReportDocumentContent, type ReportDocument } from "@/lib/report-document";

export interface PdfReport {
	symbol: string;
	companyName: string;
	content: string;
	createdAt: string;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const TEXT_COLOR = rgb(0.12, 0.14, 0.18);
const MUTED_COLOR = rgb(0.38, 0.42, 0.48);
const ACCENT_COLOR = rgb(0.09, 0.45, 0.35);

function printableText(value: string): string {
	return value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[\u2018\u2019]/g, "'")
		.replace(/[\u201c\u201d]/g, '"')
		.replace(/[\u2013\u2014]/g, "-")
		.replace(/£/g, "GBP ")
		.replace(/€/g, "EUR ")
		.replace(/¥/g, "JPY ")
		.replace(/[^\x20-\x7E\n]/g, "?");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
	const lines: string[] = [];
	for (const paragraph of printableText(text).split("\n")) {
		const words = paragraph.trim().split(/\s+/).filter(Boolean);
		if (words.length === 0) {
			lines.push("");
			continue;
		}

		let line = "";
		for (const word of words) {
			const candidate = line ? `${line} ${word}` : word;
			if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
				line = candidate;
				continue;
			}

			if (line) lines.push(line);
			line = "";
			let fragment = "";
			for (const character of word) {
				if (font.widthOfTextAtSize(fragment + character, size) <= maxWidth) {
					fragment += character;
				} else {
					if (fragment) lines.push(fragment);
					fragment = character;
				}
			}
			line = fragment;
		}
		if (line) lines.push(line);
	}
	return lines;
}

export async function createReportPdf(report: PdfReport): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	const regular = await pdf.embedFont(StandardFonts.Helvetica);
	const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
	const pages: PDFPage[] = [];
	let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
	pages.push(page);
	page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(1, 1, 1) });
	let y = PAGE_HEIGHT - MARGIN;

	const addPage = () => {
		page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
		pages.push(page);
		page.drawRectangle({
			x: 0,
			y: 0,
			width: PAGE_WIDTH,
			height: PAGE_HEIGHT,
			color: rgb(1, 1, 1),
		});
		y = PAGE_HEIGHT - MARGIN;
	};
	const ensureSpace = (height: number) => {
		if (y - height < MARGIN + 22) addPage();
	};
	const drawLines = (
		text: string,
		options: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; gap?: number } = {},
	) => {
		const font = options.font ?? regular;
		const size = options.size ?? 10.5;
		const lineHeight = size * 1.48;
		const lines = wrapText(text, font, size, CONTENT_WIDTH);
		for (const line of lines) {
			ensureSpace(lineHeight);
			page.drawText(line, {
				x: MARGIN,
				y,
				font,
				size,
				color: options.color ?? TEXT_COLOR,
			});
			y -= lineHeight;
		}
		y -= options.gap ?? 8;
	};
	const drawHeading = (text: string) => {
		ensureSpace(40);
		y -= 7;
		page.drawText(printableText(text), {
			x: MARGIN,
			y,
			font: bold,
			size: 15,
			color: TEXT_COLOR,
		});
		y -= 8;
		page.drawLine({
			start: { x: MARGIN, y },
			end: { x: PAGE_WIDTH - MARGIN, y },
			thickness: 0.7,
			color: rgb(0.82, 0.84, 0.87),
		});
		y -= 18;
	};

	page.drawText("INDUS RESEARCH", {
		x: MARGIN,
		y,
		font: bold,
		size: 9,
		color: ACCENT_COLOR,
	});
	y -= 34;
	drawLines(`${report.symbol.toUpperCase()} Research Report`, { font: bold, size: 24, gap: 4 });
	drawLines(report.companyName, { size: 12, color: MUTED_COLOR, gap: 2 });
	const generatedDate = new Intl.DateTimeFormat("en-US", {
		dateStyle: "long",
		timeZone: "UTC",
	}).format(new Date(report.createdAt));
	drawLines(`Generated ${generatedDate}`, { size: 9, color: MUTED_COLOR, gap: 20 });

	const document = parseReportDocumentContent(report.content);
	if (document) {
		drawStructuredDocument(document);
	} else {
		drawLegacyDocument();
	}

	for (const [index, currentPage] of pages.entries()) {
		const footer = `Indus  |  ${report.symbol.toUpperCase()}  |  ${index + 1} of ${pages.length}`;
		currentPage.drawText(footer, {
			x: MARGIN,
			y: 28,
			font: regular,
			size: 8,
			color: MUTED_COLOR,
		});
	}

	pdf.setTitle(`${report.symbol.toUpperCase()} Research Report`);
	pdf.setAuthor("Indus");
	pdf.setSubject("Financial research report");
	pdf.setCreationDate(new Date(report.createdAt));
	return pdf.save();

	function drawStructuredDocument(document: ReportDocument) {
		drawHeading("Executive Summary");
		drawLines(document.executiveSummary);
		drawHeading("Financial Snapshot");

		for (const metric of document.financialSnapshot) {
			ensureSpace(82);
			const label = printableText(metric.label);
			const value = printableText(metric.value);
			const labelWidth = bold.widthOfTextAtSize(label, 11);
			const valueWidth = bold.widthOfTextAtSize(value, 11);
			page.drawText(label, {
				x: MARGIN,
				y,
				font: bold,
				size: 11,
				color: TEXT_COLOR,
			});
			if (labelWidth + valueWidth <= CONTENT_WIDTH - 24 && valueWidth <= 220) {
				page.drawText(value, {
					x: PAGE_WIDTH - MARGIN - valueWidth,
					y,
					font: bold,
					size: 11,
					color: ACCENT_COLOR,
				});
				y -= 18;
			} else {
				y -= 18;
				drawLines(value, { font: bold, size: 11, color: ACCENT_COLOR, gap: 4 });
			}
			drawLines(metric.analysis, { size: 9.8, color: MUTED_COLOR, gap: 8 });
		}

		if (document.version === 2) {
			drawHeading("Analysis and Watchpoints");
			for (const observation of document.analysisAndWatchpoints) {
				drawLines(`- ${observation}`, { gap: 5 });
			}

			drawHeading("Recent News and Potential Impact");
			if (document.recentNews.length === 0) {
				drawLines("No recent company news was available from the report data provider.");
			} else {
				for (const article of document.recentNews) {
					ensureSpace(100);
					drawLines(article.headline, { font: bold, size: 11, gap: 3 });
					const published = new Intl.DateTimeFormat("en-US", {
						dateStyle: "medium",
						timeZone: "UTC",
					}).format(new Date(article.publishedAt));
					drawLines(`${article.publisher} | ${published}`, {
						size: 8.5,
						color: MUTED_COLOR,
						gap: 4,
					});
					drawLines(article.impact, { size: 9.8, gap: 3 });
					drawLines(article.url, { size: 7.5, color: ACCENT_COLOR, gap: 12 });
				}
			}
		}

		ensureSpace(140);
		drawHeading("Data Limitations");
		for (const limitation of document.dataLimitations) {
			drawLines(`- ${limitation}`, { gap: 5 });
		}
		y -= 10;
		drawLines("This report is educational and is not investment advice.", {
			size: 9,
			color: MUTED_COLOR,
		});
	}

	function drawLegacyDocument() {
		for (const block of parseReportContent(report.content)) {
			if (block.kind === "heading") {
				drawHeading(block.text);
			} else if (block.kind === "list") {
				for (const item of block.items) drawLines(`- ${item}`, { gap: 4 });
			} else {
				drawLines(block.text);
			}
		}
	}
}

export function reportPdfFilename(symbol: string, createdAt: string): string {
	const safeSymbol =
		symbol
			.toUpperCase()
			.replace(/[^A-Z0-9_-]/g, "-")
			.slice(0, 20) || "REPORT";
	const date = new Date(createdAt).toISOString().slice(0, 10);
	return `${safeSymbol}-research-report-${date}.pdf`;
}
