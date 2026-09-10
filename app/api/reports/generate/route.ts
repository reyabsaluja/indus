import { NextResponse } from "next/server";
import { GeminiApiError, GeminiClient, getGeminiResponseStatus } from "@/lib/ai/geminiClient";
import {
	createFallbackReport,
	createReportMessages,
	extractReportSummary,
	parseGeneratedReport,
	REPORT_GENERATION_CONFIG,
} from "@/lib/ai/report";
import { env } from "@/lib/env";
import { logger } from "@/lib/observability/logger";
import { finishRequestLog, getRequestHeaders, startRequestLog } from "@/lib/observability/request";
import { serializeReportDocument } from "@/lib/report-document";
import { generateReportSchema } from "@/lib/schemas/api";
import { type AiAccessClient, checkAiAccess, getAiQuotaHeaders } from "@/lib/security/ai-access";
import { loadReportStockData } from "@/lib/server/report-stock-data";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
	const requestLog = startRequestLog(request, "/api/reports/generate");
	let reportId: string | null = null;
	let reportUserId: string | null = null;
	let supabase: Awaited<ReturnType<typeof createClient>> | null = null;

	try {
		const body = await request.json().catch(() => null);
		const parsed = generateReportSchema.safeParse(body);
		if (!parsed.success) {
			finishRequestLog(requestLog, 400);
			return NextResponse.json(
				{ error: "Symbol is required" },
				{ status: 400, headers: getRequestHeaders(requestLog) },
			);
		}

		const { symbol } = parsed.data;
		supabase = await createClient();
		const access = await checkAiAccess(supabase as unknown as AiAccessClient, "generate-report");
		if (!access.allowed) {
			finishRequestLog(requestLog, access.status);
			return NextResponse.json(
				{ error: access.error },
				{
					status: access.status,
					headers: { ...getRequestHeaders(requestLog), ...getAiQuotaHeaders(access) },
				},
			);
		}

		reportUserId = access.userId;
		const stockData = await loadReportStockData(symbol, {
			requestId: requestLog.requestId,
			signal: request.signal,
		});
		const { data: report, error: insertError } = await supabase
			.from("reports")
			.insert({
				user_id: access.userId,
				symbol,
				company_name: stockData?.longName || stockData?.shortName || symbol,
				status: "generating",
				summary: `Financial snapshot for ${symbol}`,
				report_content: "",
			})
			.select()
			.single();

		if (insertError) {
			logger.error("report.create_failed", insertError, {
				symbol,
				userId: access.userId,
				requestId: requestLog.requestId,
			});
			finishRequestLog(requestLog, 500, { symbol });
			return NextResponse.json(
				{ error: "Failed to create report" },
				{ status: 500, headers: getRequestHeaders(requestLog) },
			);
		}

		reportId = report.id;
		const geminiClient = new GeminiClient(env.GEMINI_API_KEY);
		let reportDocument: ReturnType<typeof createFallbackReport>;
		try {
			const generatedContent = await geminiClient.generateContent(
				createReportMessages(symbol, stockData),
				REPORT_GENERATION_CONFIG,
				{ signal: request.signal, requestId: requestLog.requestId },
			);
			reportDocument = parseGeneratedReport(generatedContent, stockData?.recentNews);
		} catch (error) {
			if (request.signal.aborted) throw error;
			logger.warn("report.provider_fallback", {
				reportId,
				requestId: requestLog.requestId,
				errorName: error instanceof Error ? error.name : "UnknownError",
				providerStatus: error instanceof GeminiApiError ? error.status : undefined,
			});
			reportDocument = createFallbackReport(symbol, stockData);
		}
		const reportContent = serializeReportDocument(reportDocument);
		const summary = extractReportSummary(reportDocument, symbol);

		const { data: completedReport, error: updateError } = await supabase
			.from("reports")
			.update({ report_content: reportContent, summary, status: "completed" })
			.eq("id", report.id)
			.eq("user_id", access.userId)
			.select()
			.single();

		if (updateError) {
			throw updateError;
		}

		finishRequestLog(requestLog, 200, { symbol, reportId });
		return NextResponse.json(
			{ report: completedReport, message: "Report generation completed" },
			{
				headers: {
					"Cache-Control": "private, no-store",
					...getRequestHeaders(requestLog),
					...getAiQuotaHeaders(access),
				},
			},
		);
	} catch (error) {
		logger.error("report.generation_failed", error, {
			reportId,
			requestId: requestLog.requestId,
		});
		if (supabase && reportId && reportUserId) {
			await supabase
				.from("reports")
				.update({ status: "error" })
				.eq("id", reportId)
				.eq("user_id", reportUserId);
		}

		const status = getGeminiResponseStatus(error);
		finishRequestLog(requestLog, status, { reportId });
		return NextResponse.json(
			{ error: "Unable to generate report" },
			{ status, headers: getRequestHeaders(requestLog) },
		);
	}
}
