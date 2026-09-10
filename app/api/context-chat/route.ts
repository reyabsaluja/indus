import { type NextRequest, NextResponse } from "next/server";
import {
	GeminiClient,
	type GeminiMessage,
	getGeminiResponseStatus,
	isGeminiStreamingFallbackEligible,
} from "@/lib/ai/geminiClient";
import { GEMINI_SYSTEM_PROMPT } from "@/lib/ai/geminiSystemPrompt";
import { env } from "@/lib/env";
import { logger } from "@/lib/observability/logger";
import { finishRequestLog, getRequestHeaders, startRequestLog } from "@/lib/observability/request";
import { contextChatSchema } from "@/lib/schemas/api";
import { type AiAccessClient, checkAiAccess, getAiQuotaHeaders } from "@/lib/security/ai-access";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const encoder = new TextEncoder();
const STREAM_IDLE_TIMEOUT_MS = 10_000;

function buildConversation(
	context: unknown,
	messages: Array<{ role: "user" | "assistant"; content: string }>,
	newMessage: string,
): GeminiMessage[] {
	return [
		{ role: "system", parts: [{ text: GEMINI_SYSTEM_PROMPT }] },
		...messages.map<GeminiMessage>((message) => ({
			role: message.role === "user" ? "user" : "model",
			parts: [{ text: message.content }],
		})),
		{
			role: "user",
			parts: [
				{
					text: `<page_context>${JSON.stringify(context)}</page_context>\n<question>${newMessage}</question>`,
				},
			],
		},
	];
}

function createStreamingResponse(
	geminiClient: GeminiClient,
	messages: GeminiMessage[],
	requestSignal: AbortSignal,
	requestId: string,
	onFinished: (status: number, context: { streamOutcome: string; fallbackUsed: boolean }) => void,
): ReadableStream<Uint8Array> {
	let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
	let cancelled = false;
	let fallbackUsed = false;
	let streamOutcome = "completed";
	let completionStatus = 200;
	let finished = false;
	const lifetimeController = new AbortController();

	const finish = () => {
		if (finished) return;
		finished = true;
		requestSignal.removeEventListener("abort", onRequestAbort);
		onFinished(completionStatus, { streamOutcome, fallbackUsed });
	};

	const onRequestAbort = () => {
		cancelled = true;
		streamOutcome = "cancelled";
		completionStatus = 499;
		lifetimeController.abort(requestSignal.reason);
		void reader?.cancel().catch(() => undefined);
	};

	if (requestSignal.aborted) {
		onRequestAbort();
	} else {
		requestSignal.addEventListener("abort", onRequestAbort, { once: true });
	}

	return new ReadableStream({
		async start(controller) {
			let emittedText = false;
			try {
				const geminiStream = await geminiClient.generateStreamingContent(messages, {
					signal: lifetimeController.signal,
					requestId,
				});
				if (cancelled) {
					await geminiStream.cancel();
					return;
				}
				reader = geminiStream.getReader();
				const decoder = new TextDecoder();
				let buffer = "";

				while (true) {
					let timeoutId: ReturnType<typeof setTimeout> | undefined;
					const { done, value } = await Promise.race([
						reader.read(),
						new Promise<never>((_, reject) => {
							timeoutId = setTimeout(
								() => reject(new Error("Gemini stream became idle")),
								STREAM_IDLE_TIMEOUT_MS,
							);
						}),
					]).finally(() => {
						if (timeoutId) clearTimeout(timeoutId);
					});
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const parsed = GeminiClient.parseSseBuffer(buffer);
					buffer = parsed.remainder;
					for (const text of parsed.texts) {
						if (cancelled) return;
						emittedText = true;
						controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: text })}\n\n`));
					}
				}

				buffer += decoder.decode();
				for (const text of GeminiClient.parseSseBuffer(buffer, true).texts) {
					if (cancelled) return;
					emittedText = true;
					controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: text })}\n\n`));
				}

				if (cancelled) return;
				controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
			} catch (error) {
				if (cancelled) return;
				logger.error("context_chat.stream_failed", error, { requestId });
				await reader?.cancel().catch(() => undefined);
				if (!emittedText && isGeminiStreamingFallbackEligible(error, lifetimeController.signal)) {
					try {
						const fallback = await geminiClient.generateContent(
							messages,
							{},
							{
								attempts: 1,
								signal: lifetimeController.signal,
								requestId,
							},
						);
						if (cancelled) return;
						fallbackUsed = true;
						streamOutcome = "fallback";
						logger.warn("context_chat.streaming_fallback_used", {
							provider: "gemini",
							requestId,
						});
						controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: fallback })}\n\n`));
						controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
					} catch (fallbackError) {
						if (lifetimeController.signal.aborted) return;
						streamOutcome = "failed";
						logger.error("context_chat.streaming_fallback_failed", fallbackError, { requestId });
						controller.enqueue(
							encoder.encode(
								`data: ${JSON.stringify({ error: "Unable to complete the response" })}\n\n`,
							),
						);
					}
				} else {
					streamOutcome = "failed";
					controller.enqueue(
						encoder.encode(
							`data: ${JSON.stringify({ error: "Unable to complete the response" })}\n\n`,
						),
					);
				}
			} finally {
				if (!cancelled) {
					controller.close();
				}
				finish();
			}
		},
		async cancel() {
			cancelled = true;
			streamOutcome = "cancelled";
			completionStatus = 499;
			lifetimeController.abort(new DOMException("Response stream cancelled", "AbortError"));
			await reader?.cancel().catch(() => undefined);
			finish();
		},
	});
}

export async function POST(request: NextRequest) {
	const requestLog = startRequestLog(request, "/api/context-chat");
	try {
		const body = await request.json().catch(() => null);
		const parsed = contextChatSchema.safeParse(body);
		if (!parsed.success) {
			finishRequestLog(requestLog, 400);
			return NextResponse.json(
				{ error: "Invalid request body" },
				{ status: 400, headers: getRequestHeaders(requestLog) },
			);
		}

		const supabase = await createClient();
		const access = await checkAiAccess(supabase as unknown as AiAccessClient, "context-chat");
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

		const { context, messages, newMessage } = parsed.data;
		const geminiClient = new GeminiClient(env.GEMINI_API_KEY);
		const conversation = buildConversation(context, messages, newMessage);
		const preferStreaming = request.headers.get("accept")?.includes("text/event-stream") ?? false;

		if (preferStreaming) {
			return new Response(
				createStreamingResponse(
					geminiClient,
					conversation,
					request.signal,
					requestLog.requestId,
					(status, context) => finishRequestLog(requestLog, status, context),
				),
				{
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "private, no-store, no-transform",
						Connection: "keep-alive",
						...getRequestHeaders(requestLog),
						...getAiQuotaHeaders(access),
					},
				},
			);
		}

		const response = await geminiClient.generateContent(
			conversation,
			{},
			{
				signal: request.signal,
				requestId: requestLog.requestId,
			},
		);
		finishRequestLog(requestLog, 200);
		return NextResponse.json(
			{ response },
			{
				headers: {
					"Cache-Control": "private, no-store",
					...getRequestHeaders(requestLog),
					...getAiQuotaHeaders(access),
				},
			},
		);
	} catch (error: unknown) {
		logger.error("context_chat.request_failed", error, { requestId: requestLog.requestId });
		const status = getGeminiResponseStatus(error);
		finishRequestLog(requestLog, status);
		return NextResponse.json(
			{ error: "Unable to generate a response" },
			{ status, headers: getRequestHeaders(requestLog) },
		);
	}
}
