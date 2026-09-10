"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { prepareRegeneration } from "@/lib/chat/messages";
import { buildPageContext, trimContextIfNeeded } from "@/lib/context/buildPageContext";
import type { ChatMessage, ContextChatState, FinancialData, PageChartData } from "@/lib/types";

interface UseContextChatParams {
	getFinancialData: () => FinancialData | null;
	getChartData?: () => PageChartData | undefined;
}

interface StreamPayload {
	delta?: string;
	done?: boolean;
	error?: string;
}

const RATE_LIMIT_WINDOW_MS = 30_000;
const MAX_REQUESTS_PER_WINDOW = 5;

function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === "AbortError";
}

function parseStreamPayload(line: string): StreamPayload | null {
	if (!line.startsWith("data: ")) {
		return null;
	}

	try {
		const value: unknown = JSON.parse(line.slice(6));
		return value && typeof value === "object" ? (value as StreamPayload) : null;
	} catch {
		return null;
	}
}

function readTextResponse(value: unknown): string {
	if (value && typeof value === "object" && "response" in value) {
		const response = (value as { response?: unknown }).response;
		if (typeof response === "string") {
			return response;
		}
	}

	return "No response received.";
}

async function readErrorResponse(response: Response): Promise<string> {
	const body: unknown = await response.json().catch(() => null);
	const providerMessage =
		body && typeof body === "object" && "error" in body && typeof body.error === "string"
			? body.error
			: null;

	if (response.status === 401) return "Your session has expired. Sign in again to use the analyst.";
	if (response.status === 429)
		return providerMessage ?? "The analyst is at its request limit. Try again shortly.";
	if (response.status >= 500)
		return "The analyst is temporarily unavailable. Your research view is still intact.";
	return providerMessage ?? "The analyst could not complete that request.";
}

export function useContextChat({ getFinancialData, getChartData }: UseContextChatParams) {
	const [state, setState] = useState<ContextChatState>({
		open: false,
		messages: [],
		sending: false,
		error: null,
	});

	const abortControllerRef = useRef<AbortController | null>(null);
	const conversationSymbolRef = useRef<string | null>(null);
	const pendingQuestionRef = useRef<string | null>(null);

	const requestCountRef = useRef(0);
	const lastRequestWindowRef = useRef(Date.now());

	const openWithMetric = useCallback(
		(metricKey: string, metricLabel: string, value: number | string, initialQuestion?: string) => {
			try {
				const financialData = getFinancialData();
				const chartData = getChartData?.();

				if (!financialData) {
					setState((prev) => ({
						...prev,
						error: "The company context is still loading. Try again in a moment.",
					}));
					return;
				}

				const initialContext = buildPageContext({
					financialData,
					chartData,
					triggerMetric: { metricKey, metricLabel, value },
				});

				const trimmedContext = trimContextIfNeeded(initialContext);
				const isSameCompany = conversationSymbolRef.current === trimmedContext.symbol;
				conversationSymbolRef.current = trimmedContext.symbol;
				pendingQuestionRef.current = initialQuestion?.trim() || null;

				setState((prev) => ({
					...prev,
					open: true,
					initialContext: trimmedContext,
					triggerMetric: { metricKey, label: metricLabel, value },
					error: null,
					messages: isSameCompany ? prev.messages : [],
				}));
			} catch {
				setState((prev) => ({
					...prev,
					error: "The analyst could not prepare this company context.",
				}));
			}
		},
		[getFinancialData, getChartData],
	);

	const close = useCallback(() => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}

		setState((prev) => ({
			...prev,
			open: false,
			sending: false,
		}));
	}, []);

	const reset = useCallback(() => {
		abortControllerRef.current?.abort();
		abortControllerRef.current = null;
		conversationSymbolRef.current = null;
		pendingQuestionRef.current = null;
		setState({ open: false, messages: [], sending: false, error: null });
	}, []);

	const toggle = useCallback(() => {
		if (state.open) {
			close();
			return;
		}

		setState((prev) => (prev.initialContext ? { ...prev, open: true, error: null } : prev));
	}, [close, state.open]);

	const checkRateLimit = useCallback(() => {
		const now = Date.now();

		if (now - lastRequestWindowRef.current > RATE_LIMIT_WINDOW_MS) {
			requestCountRef.current = 0;
			lastRequestWindowRef.current = now;
		}

		if (requestCountRef.current >= MAX_REQUESTS_PER_WINDOW) {
			return false;
		}

		requestCountRef.current++;
		return true;
	}, []);

	const sendMessage = useCallback(
		async (content: string, historyOverride?: ChatMessage[]) => {
			const trimmedContent = content.trim();
			if (!trimmedContent || state.sending || !state.initialContext) return;
			const conversationHistory = historyOverride ?? state.messages;

			if (!checkRateLimit()) {
				setState((prev) => ({
					...prev,
					error: "You’re moving quickly. Wait a few seconds before asking another question.",
				}));
				return;
			}

			const userMessage: ChatMessage = {
				id: `user-${Date.now()}`,
				role: "user",
				content: trimmedContent,
				createdAt: Date.now(),
			};

			const assistantMessageId = `assistant-${Date.now()}`;
			const assistantMessage: ChatMessage = {
				id: assistantMessageId,
				role: "assistant",
				content: "",
				createdAt: Date.now(),
				streaming: true,
			};

			setState((prev) => ({
				...prev,
				messages: [...conversationHistory, userMessage, assistantMessage],
				sending: true,
				error: null,
			}));

			const controller = new AbortController();
			try {
				abortControllerRef.current = controller;

				const response = await fetch("/api/context-chat", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "text/event-stream",
					},
					body: JSON.stringify({
						context: state.initialContext,
						messages: conversationHistory,
						newMessage: trimmedContent,
					}),
					signal: controller.signal,
				});

				if (!response.ok) {
					throw new Error(await readErrorResponse(response));
				}

				const isStreaming = response.headers.get("content-type")?.includes("text/event-stream");

				if (isStreaming) {
					const reader = response.body?.getReader();
					if (!reader) throw new Error("No response body");

					const decoder = new TextDecoder();
					let accumulatedContent = "";
					let bufferedContent = "";

					const applyPayload = (payload: StreamPayload | null) => {
						if (payload?.error)
							throw new Error(
								"The analyst lost its connection before finishing. Try regenerating the answer.",
							);
						if (!payload?.delta) return;
						accumulatedContent += payload.delta;
						setState((prev) => ({
							...prev,
							messages: prev.messages.map((message) =>
								message.id === assistantMessageId
									? { ...message, content: accumulatedContent, streaming: true }
									: message,
							),
						}));
					};

					while (true) {
						const { done, value } = await reader.read();
						if (done) break;

						bufferedContent += decoder.decode(value, { stream: true });
						const lines = bufferedContent.split("\n");
						bufferedContent = lines.pop() ?? "";

						for (const line of lines) applyPayload(parseStreamPayload(line));
					}
					bufferedContent += decoder.decode();
					for (const line of bufferedContent.split("\n")) applyPayload(parseStreamPayload(line));
					if (!accumulatedContent.trim()) {
						throw new Error("The analyst returned an empty answer. Try regenerating it.");
					}

					setState((prev) => ({
						...prev,
						messages: prev.messages.map((message) =>
							message.id === assistantMessageId ? { ...message, streaming: false } : message,
						),
						sending: false,
					}));
				} else {
					const data: unknown = await response.json();
					setState((prev) => ({
						...prev,
						messages: prev.messages.map((message) =>
							message.id === assistantMessageId
								? { ...message, content: readTextResponse(data), streaming: false }
								: message,
						),
						sending: false,
					}));
				}
			} catch (error: unknown) {
				if (isAbortError(error)) {
					return;
				}

				setState((prev) => ({
					...prev,
					messages: prev.messages.filter((msg) => msg.id !== assistantMessageId),
					sending: false,
					error:
						error instanceof Error ? error.message : "The analyst could not complete that request.",
				}));
			} finally {
				if (abortControllerRef.current === controller) abortControllerRef.current = null;
			}
		},
		[state.sending, state.initialContext, state.messages, checkRateLimit],
	);

	const regenerateLast = useCallback(async () => {
		if (state.messages.length < 2 || state.sending) return;
		const regeneration = prepareRegeneration(state.messages);
		if (!regeneration) return;

		await sendMessage(regeneration.content, regeneration.history);
	}, [state.messages, state.sending, sendMessage]);

	useEffect(() => {
		const question = pendingQuestionRef.current;
		if (!question || !state.initialContext || state.sending) return;

		pendingQuestionRef.current = null;
		void sendMessage(question);
	}, [sendMessage, state.initialContext, state.sending]);

	const clearError = useCallback(() => {
		setState((prev) => ({ ...prev, error: null }));
	}, []);

	const stop = useCallback(() => {
		abortControllerRef.current?.abort();
		abortControllerRef.current = null;
		setState((prev) => ({
			...prev,
			sending: false,
			messages: prev.messages
				.filter((message) => !message.streaming || message.content.trim().length > 0)
				.map((message) => (message.streaming ? { ...message, streaming: false } : message)),
		}));
	}, []);

	return {
		...state,
		openWithMetric,
		close,
		reset,
		toggle,
		sendMessage,
		regenerateLast,
		clearError,
		stop,
	};
}
