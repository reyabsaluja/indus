import { logger } from "@/lib/observability/logger";
import { executeWithRetry, TimeoutError } from "@/lib/reliability/async";

export interface GeminiMessage {
	role: "user" | "model" | "system";
	parts: { text: string }[];
}

interface GeminiStreamChunk {
	candidates?: Array<{
		content?: {
			parts?: Array<{ text?: string; thought?: boolean }>;
		};
		finishReason?: string;
	}>;
}

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
export const GEMINI_MODEL = "gemini-3.8-flash";
const GENERATION_CONFIG = {
	maxOutputTokens: 4096,
	thinkingConfig: { thinkingLevel: "low" as const },
};

export interface GeminiGenerationConfig {
	maxOutputTokens?: number;
	responseMimeType?: "application/json" | "text/plain";
	responseJsonSchema?: Record<string, unknown>;
	thinkingConfig?: { thinkingLevel: "low" | "medium" | "high" };
}

interface GeminiClientOptions {
	attempts?: number;
	timeoutMs?: number;
}

interface GeminiRequestOptions {
	attempts?: number;
	signal?: AbortSignal;
	requestId?: string;
}

export function createGeminiRequestBody(
	messages: GeminiMessage[],
	generationConfig: GeminiGenerationConfig = {},
) {
	const systemParts = messages
		.filter((message) => message.role === "system")
		.flatMap((message) => message.parts);
	const contents = messages
		.filter((message) => message.role !== "system")
		.map((message) => ({ role: message.role, parts: message.parts }));

	return {
		contents,
		...(systemParts.length > 0 ? { systemInstruction: { parts: systemParts } } : {}),
		generationConfig: { ...GENERATION_CONFIG, ...generationConfig },
	};
}

export interface ParsedSseBuffer {
	texts: string[];
	remainder: string;
}

export class GeminiApiError extends Error {
	constructor(
		public readonly status: number,
		statusText: string,
	) {
		super(`Gemini request failed with ${status} ${statusText}`);
		this.name = "GeminiApiError";
	}
}

export class GeminiIncompleteResponseError extends Error {
	constructor(public readonly finishReason: string) {
		super(`Gemini response ended with ${finishReason}`);
		this.name = "GeminiIncompleteResponseError";
	}
}

function getCandidateText(candidate: NonNullable<GeminiStreamChunk["candidates"]>[number]): string {
	return (candidate.content?.parts ?? [])
		.filter((part) => !part.thought)
		.map((part) => part.text ?? "")
		.join("");
}

export class GeminiClient {
	private readonly apiKey: string;
	private readonly attempts: number;
	private readonly timeoutMs: number;

	constructor(apiKey: string, options: GeminiClientOptions = {}) {
		this.apiKey = apiKey;
		this.attempts = options.attempts ?? 2;
		this.timeoutMs = options.timeoutMs ?? 10_000;
	}

	async generateStreamingContent(
		messages: GeminiMessage[],
		options: GeminiRequestOptions = {},
	): Promise<ReadableStream<Uint8Array>> {
		const url = `${BASE_URL}/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`;

		return executeWithRetry(
			async ({ signal }) => {
				const response = await fetch(url, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-goog-api-key": this.apiKey,
					},
					body: JSON.stringify({
						...createGeminiRequestBody(messages),
						safetySettings: [
							{
								category: "HARM_CATEGORY_HARASSMENT",
								threshold: "BLOCK_MEDIUM_AND_ABOVE",
							},
							{
								category: "HARM_CATEGORY_HATE_SPEECH",
								threshold: "BLOCK_MEDIUM_AND_ABOVE",
							},
							{
								category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
								threshold: "BLOCK_MEDIUM_AND_ABOVE",
							},
							{
								category: "HARM_CATEGORY_DANGEROUS_CONTENT",
								threshold: "BLOCK_MEDIUM_AND_ABOVE",
							},
						],
					}),
					signal,
				});

				if (!response.ok) {
					throw new GeminiApiError(response.status, response.statusText);
				}

				if (!response.body) {
					throw new Error("Gemini returned an empty response body");
				}

				return response.body;
			},
			this.retryOptions("gemini.stream", options),
		);
	}

	async generateContent(
		messages: GeminiMessage[],
		generationConfig: GeminiGenerationConfig = {},
		options: GeminiRequestOptions = {},
	): Promise<string> {
		const url = `${BASE_URL}/models/${GEMINI_MODEL}:generateContent`;

		return executeWithRetry(
			async ({ signal }) => {
				const response = await fetch(url, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-goog-api-key": this.apiKey,
					},
					body: JSON.stringify(createGeminiRequestBody(messages, generationConfig)),
					signal,
				});

				if (!response.ok) {
					throw new GeminiApiError(response.status, response.statusText);
				}

				const data = (await response.json()) as GeminiStreamChunk;
				const candidate = data.candidates?.[0];
				if (candidate?.finishReason && candidate.finishReason !== "STOP") {
					throw new GeminiIncompleteResponseError(candidate.finishReason);
				}

				const text = candidate ? getCandidateText(candidate) : "";
				if (text) {
					return text;
				}

				throw new Error("No content generated by Gemini");
			},
			this.retryOptions("gemini.generate", options),
		);
	}

	private retryOptions(operation: string, options: GeminiRequestOptions) {
		return {
			operation,
			attempts: options.attempts ?? this.attempts,
			timeoutMs: this.timeoutMs,
			signal: options.signal,
			onRetry: (error: unknown, nextAttempt: number) => {
				logger.warn("provider.retry_scheduled", {
					provider: "gemini",
					operation,
					requestId: options.requestId,
					nextAttempt,
					errorName: error instanceof Error ? error.name : "UnknownError",
					errorMessage: error instanceof Error ? error.message : String(error),
				});
			},
		};
	}

	static parseStreamChunk(chunk: string): string | null {
		try {
			const data: GeminiStreamChunk = JSON.parse(chunk);
			const candidate = data.candidates?.[0];
			return candidate ? getCandidateText(candidate) || null : null;
		} catch {
			return null;
		}
	}

	static parseSseBuffer(buffer: string, flush = false): ParsedSseBuffer {
		const normalized = buffer.replace(/\r\n/g, "\n");
		const events = normalized.split("\n\n");
		const remainder = flush ? "" : (events.pop() ?? "");
		const texts: string[] = [];

		for (const event of events) {
			const payload = event
				.split("\n")
				.filter((line) => line.startsWith("data:"))
				.map((line) => line.slice(5).trimStart())
				.join("\n");

			if (!payload || payload === "[DONE]") {
				continue;
			}

			const text = GeminiClient.parseStreamChunk(payload);
			if (text) {
				texts.push(text);
			}
		}

		return { texts, remainder };
	}
}

export function isGeminiStreamingFallbackEligible(error: unknown, signal?: AbortSignal): boolean {
	if (signal?.aborted || error instanceof GeminiApiError) {
		return false;
	}

	if (error instanceof DOMException && error.name === "AbortError") {
		return false;
	}

	return error instanceof Error;
}

export function getGeminiResponseStatus(error: unknown): number {
	if (error instanceof GeminiApiError && error.status === 429) {
		return 429;
	}
	if (error instanceof TimeoutError) {
		return 504;
	}
	return 502;
}
