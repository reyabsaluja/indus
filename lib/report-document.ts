import { z } from "zod/v4";

const financialMetricSchema = z
	.object({
		label: z.string().trim().min(1).max(80),
		value: z.string().trim().min(1).max(120),
		analysis: z.string().trim().min(1).max(900),
	})
	.strict();

const reportNewsSchema = z
	.object({
		headline: z.string().trim().min(1).max(300),
		publisher: z.string().trim().min(1).max(120),
		publishedAt: z.iso.datetime({ offset: true }),
		url: z
			.url()
			.max(2_048)
			.refine((value) => ["http:", "https:"].includes(new URL(value).protocol)),
		impact: z.string().trim().min(1).max(900),
	})
	.strict();

const commonReportFields = {
	executiveSummary: z.string().trim().min(80).max(4_500),
	financialSnapshot: z.array(financialMetricSchema).min(1).max(12),
	dataLimitations: z.array(z.string().trim().min(1).max(500)).min(1).max(8),
};

const reportDocumentV1Schema = z.object({ version: z.literal(1), ...commonReportFields }).strict();
const reportDocumentV2Schema = z
	.object({
		version: z.literal(2),
		...commonReportFields,
		analysisAndWatchpoints: z.array(z.string().trim().min(1).max(900)).min(1).max(6),
		recentNews: z.array(reportNewsSchema).max(5),
	})
	.strict();

export const reportDocumentSchema = z.discriminatedUnion("version", [
	reportDocumentV1Schema,
	reportDocumentV2Schema,
]);

export type ReportDocument = z.infer<typeof reportDocumentSchema>;

export const REPORT_DOCUMENT_JSON_SCHEMA = {
	type: "object",
	properties: {
		version: { type: "integer", enum: [2] },
		executiveSummary: {
			type: "string",
			description: "A concise, neutral summary based only on the supplied snapshot.",
		},
		financialSnapshot: {
			type: "array",
			items: {
				type: "object",
				properties: {
					label: { type: "string", description: "A human-readable metric name." },
					value: { type: "string", description: "The exact supplied value with its unit." },
					analysis: {
						type: "string",
						description: "What the metric measures and what follows from the supplied data.",
					},
				},
				required: ["label", "value", "analysis"],
				additionalProperties: false,
			},
		},
		analysisAndWatchpoints: {
			type: "array",
			items: { type: "string" },
			description:
				"Evidence-bound relationships, uncertainties, and concrete metrics or events to monitor.",
		},
		recentNews: {
			type: "array",
			items: {
				type: "object",
				properties: {
					headline: { type: "string" },
					publisher: { type: "string" },
					publishedAt: { type: "string" },
					url: { type: "string" },
					impact: {
						type: "string",
						description:
							"A cautious potential-impact analysis based only on the supplied headline and financial snapshot.",
					},
				},
				required: ["headline", "publisher", "publishedAt", "url", "impact"],
				additionalProperties: false,
			},
		},
		dataLimitations: {
			type: "array",
			items: { type: "string" },
			description: "Material limits in the supplied data that constrain interpretation.",
		},
	},
	required: [
		"version",
		"executiveSummary",
		"financialSnapshot",
		"analysisAndWatchpoints",
		"recentNews",
		"dataLimitations",
	],
	additionalProperties: false,
} as const;

export function parseReportDocumentContent(content: string): ReportDocument | null {
	try {
		return reportDocumentSchema.parse(JSON.parse(content));
	} catch {
		return null;
	}
}

export function serializeReportDocument(document: ReportDocument): string {
	return JSON.stringify(reportDocumentSchema.parse(document));
}
