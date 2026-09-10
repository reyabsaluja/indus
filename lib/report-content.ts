import { parseReportDocumentContent } from "@/lib/report-document";

export type ReportBlock =
	| { kind: "heading"; level: 1 | 2 | 3; text: string }
	| { kind: "paragraph"; text: string }
	| { kind: "list"; items: string[] };

const REPORT_DISCLAIMER = "This report is educational and is not investment advice.";
export const MAX_REPORT_CONTENT_LENGTH = 100_000;

const REQUIRED_REPORT_HEADINGS = [
	"Executive Summary",
	"Available Financial Snapshot",
	"Data Limitations",
] as const;

export function isCompleteReportContent(reportContent: string): boolean {
	if (reportContent.length > MAX_REPORT_CONTENT_LENGTH) return false;
	if (parseReportDocumentContent(reportContent)) return true;

	let previousHeadingIndex = -1;
	for (const heading of REQUIRED_REPORT_HEADINGS) {
		const headingIndex = reportContent.search(new RegExp(`^##\\s+${heading}\\s*$`, "im"));
		if (headingIndex <= previousHeadingIndex) return false;
		previousHeadingIndex = headingIndex;
	}

	return reportContent.trimEnd().endsWith(REPORT_DISCLAIMER);
}

export function parseReportContent(content: string): ReportBlock[] {
	const blocks: ReportBlock[] = [];
	const paragraph: string[] = [];
	let list: string[] = [];

	const flushParagraph = () => {
		const text = paragraph.join(" ").trim();
		if (text) blocks.push({ kind: "paragraph", text });
		paragraph.length = 0;
	};
	const flushList = () => {
		if (list.length > 0) blocks.push({ kind: "list", items: list });
		list = [];
	};

	for (const rawLine of content.replace(/\r\n?/g, "\n").split("\n")) {
		const line = rawLine.trim();
		if (!line) {
			flushParagraph();
			flushList();
			continue;
		}

		const heading = line.match(/^(#{1,3})\s+(.+)$/);
		if (heading) {
			flushParagraph();
			flushList();
			blocks.push({
				kind: "heading",
				level: heading[1].length as 1 | 2 | 3,
				text: heading[2],
			});
			continue;
		}

		const listItem = line.match(/^[-*•]\s+(.+)$/);
		if (listItem) {
			flushParagraph();
			list.push(listItem[1]);
			continue;
		}

		flushList();
		paragraph.push(line);
	}

	flushParagraph();
	flushList();
	return blocks;
}
