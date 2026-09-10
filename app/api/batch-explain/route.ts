import { NextResponse } from "next/server";
import { GeminiApiError, GeminiClient, getGeminiResponseStatus } from "@/lib/ai/geminiClient";
import { env } from "@/lib/env";
import {
	createMetricExplanationFallback,
	fillMissingMetricExplanations,
	parseMetricExplanationResponse,
} from "@/lib/metric-explanations";
import { logger } from "@/lib/observability/logger";
import { finishRequestLog, getRequestHeaders, startRequestLog } from "@/lib/observability/request";
import { type Item, makeBatchPrompt } from "@/lib/prompts";
import { batchExplainSchema } from "@/lib/schemas/api";
import { type AiAccessClient, checkAiAccess, getAiQuotaHeaders } from "@/lib/security/ai-access";
import { createClient } from "@/lib/supabase/server";
import { VALUE_ANALYSIS_SYSTEM_PROMPT } from "@/lib/system-prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
	const requestLog = startRequestLog(req, "/api/batch-explain");
	try {
		const body = await req.json().catch(() => null);
		const parsed = batchExplainSchema.safeParse(body);

		if (!parsed.success) {
			finishRequestLog(requestLog, 400);
			return NextResponse.json(
				{ error: "Invalid input." },
				{ status: 400, headers: getRequestHeaders(requestLog) },
			);
		}

		const supabase = await createClient();
		const access = await checkAiAccess(supabase as unknown as AiAccessClient, "batch-explain");
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

		const items: Item[] = parsed.data;
		const prompt = makeBatchPrompt(items);
		const geminiClient = new GeminiClient(env.GEMINI_API_KEY, { attempts: 1, timeoutMs: 6_000 });
		let explanations: Record<string, string>;
		try {
			const rawText = await geminiClient.generateContent(
				[
					{ role: "system", parts: [{ text: VALUE_ANALYSIS_SYSTEM_PROMPT }] },
					{ role: "user", parts: [{ text: prompt }] },
				],
				{ responseMimeType: "application/json", maxOutputTokens: 8192 },
				{ signal: req.signal, requestId: requestLog.requestId },
			);
			explanations = fillMissingMetricExplanations(
				parseMetricExplanationResponse(rawText, items),
				items,
			);
		} catch (error) {
			if (req.signal.aborted) throw error;
			logger.warn("batch_explain.provider_fallback", {
				requestId: requestLog.requestId,
				errorName: error instanceof Error ? error.name : "UnknownError",
				providerStatus: error instanceof GeminiApiError ? error.status : undefined,
			});
			explanations = Object.fromEntries(
				items.map((item) => [
					`${item.symbol}_${item.metric}`,
					createMetricExplanationFallback(item),
				]),
			);
		}
		finishRequestLog(requestLog, 200, { itemCount: items.length });
		return NextResponse.json(
			{ explanations },
			{
				headers: {
					"Cache-Control": "private, no-store",
					...getRequestHeaders(requestLog),
					...getAiQuotaHeaders(access),
				},
			},
		);
	} catch (error) {
		logger.error("batch_explain.request_failed", error, { requestId: requestLog.requestId });
		const status = getGeminiResponseStatus(error);
		const message =
			status === 429
				? "The explanation service is temporarily rate limited."
				: "Unable to generate explanations.";
		finishRequestLog(requestLog, status);
		return NextResponse.json(
			{ error: message },
			{ status, headers: getRequestHeaders(requestLog) },
		);
	}
}
