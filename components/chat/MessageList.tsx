"use client";

import { Check, Copy, RefreshCw, RotateCcw, Sparkles, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/lib/types";

interface MessageListProps {
	messages: ChatMessage[];
	sending: boolean;
	error?: string | null;
	onRegenerateLast: () => void;
	onClearError: () => void;
	hasUserMessages: boolean;
}

const SEED_MESSAGE: ChatMessage = {
	id: "seed",
	role: "assistant",
	content: "Ask about the company’s valuation, profitability, growth, debt, or price history.",
	createdAt: 0,
};

export function MessageList({
	messages,
	sending,
	error,
	onRegenerateLast,
	onClearError,
	hasUserMessages,
}: MessageListProps) {
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
	const latestContent = messages.at(-1)?.content;

	useEffect(() => {
		if (latestContent === undefined && !sending) return;
		const container = scrollContainerRef.current;
		if (container) container.scrollTop = container.scrollHeight;
	}, [latestContent, sending]);

	const copyToClipboard = async (message: ChatMessage) => {
		try {
			await navigator.clipboard.writeText(message.content);
			setCopiedMessageId(message.id);
			window.setTimeout(() => setCopiedMessageId(null), 1600);
		} catch {
			setCopiedMessageId(null);
		}
	};

	const allMessages = !hasUserMessages && messages.length === 0 ? [SEED_MESSAGE] : messages;

	return (
		<div
			ref={scrollContainerRef}
			className="scrollbar-none flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5"
			aria-live="polite"
		>
			{error && (
				<div
					className="rounded-xl border border-destructive/25 bg-destructive/[0.07] p-3"
					role="alert"
				>
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-xs font-semibold text-destructive">The analyst hit a problem</p>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">{error}</p>
						</div>
						<Button
							variant="ghost"
							size="icon"
							onClick={onClearError}
							className="size-6 shrink-0 rounded-full"
							aria-label="Dismiss analyst error"
						>
							<span aria-hidden="true">×</span>
						</Button>
					</div>
					{hasUserMessages && !sending && (
						<button
							type="button"
							onClick={onRegenerateLast}
							className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold text-destructive hover:underline"
						>
							<RefreshCw className="size-3" />
							Try the last question again
						</button>
					)}
				</div>
			)}

			{allMessages.map((message) => {
				const isUser = message.role === "user";
				const isStreaming = Boolean(message.streaming && !isUser);
				const isLastAssistant = !isUser && message.id === messages.at(-1)?.id;

				return (
					<div
						key={message.id}
						className={`group flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}
					>
						<span
							className={`flex size-7 shrink-0 items-center justify-center rounded-full ${isUser ? "bg-foreground text-background" : "bg-primary/12 text-primary"}`}
						>
							{isUser ? <UserRound className="size-3.5" /> : <Sparkles className="size-3.5" />}
						</span>
						<div
							className={`relative max-w-[85%] rounded-2xl px-3.5 py-3 text-sm leading-6 ${isUser ? "rounded-tr-sm bg-foreground text-background" : "rounded-tl-sm border border-border/70 bg-background/65 text-foreground"}`}
						>
							<p className="whitespace-pre-wrap tabular-nums">
								{message.content}
								{isStreaming && (
									<span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-primary align-baseline" />
								)}
							</p>

							{!isUser && !isStreaming && message.content && message.id !== "seed" && (
								<div className="mt-2 flex items-center gap-1 border-t border-border/50 pt-2">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => void copyToClipboard(message)}
										className="h-7 rounded-full px-2 text-[9px] text-muted-foreground"
										aria-label="Copy answer"
									>
										{copiedMessageId === message.id ? (
											<Check className="size-3" />
										) : (
											<Copy className="size-3" />
										)}
										{copiedMessageId === message.id ? "Copied" : "Copy"}
									</Button>
									{isLastAssistant && (
										<Button
											variant="ghost"
											size="sm"
											onClick={onRegenerateLast}
											disabled={sending}
											className="h-7 rounded-full px-2 text-[9px] text-muted-foreground"
											aria-label="Regenerate answer"
										>
											<RotateCcw className="size-3" />
											Regenerate
										</Button>
									)}
								</div>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}
