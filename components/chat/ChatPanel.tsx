"use client";

import { BrainCircuit, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { ContextChatState } from "@/lib/types";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { ContextSummary } from "./ContextSummary";
import { MessageList } from "./MessageList";
import { SuggestionChips } from "./SuggestionChips";

interface ChatPanelProps {
	state: ContextChatState;
	onClose: () => void;
	onSendMessage: (message: string) => void;
	onRegenerateLast: () => void;
	onClearError: () => void;
	onStop: () => void;
}

export function ChatPanel({
	state,
	onClose,
	onSendMessage,
	onRegenerateLast,
	onClearError,
	onStop,
}: ChatPanelProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const previouslyFocusedRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		if (!state.open) return;
		previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
		const focusTimer = window.setTimeout(() => {
			panelRef.current?.querySelector<HTMLElement>("textarea")?.focus();
		}, 50);

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				onClose();
				return;
			}
			if (event.key !== "Tab" || !panelRef.current) return;

			const focusable = Array.from(
				panelRef.current.querySelectorAll<HTMLElement>(
					'button:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]',
				),
			).filter((element) => element.offsetParent !== null);
			const first = focusable[0];
			const last = focusable.at(-1);
			if (!first || !last) return;
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => {
			window.clearTimeout(focusTimer);
			document.removeEventListener("keydown", handleKeyDown);
			previouslyFocusedRef.current?.focus();
		};
	}, [onClose, state.open]);

	if (!state.open) return null;
	const hasUserMessages = state.messages.some((message) => message.role === "user");

	return (
		<>
			<button
				type="button"
				className="fixed inset-0 z-40 cursor-default bg-background/35 backdrop-blur-[2px] md:bg-background/15"
				onClick={onClose}
				aria-label="Close analyst"
			/>
			<div
				ref={panelRef}
				className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] min-h-[68dvh] flex-col overflow-hidden rounded-t-[1.6rem] border border-border/80 bg-card shadow-[0_-28px_90px_-35px_rgba(0,0,0,0.85)] md:inset-x-auto md:bottom-4 md:right-4 md:h-[min(780px,calc(100dvh-2rem))] md:min-h-0 md:w-[480px] md:rounded-[1.6rem]"
				role="dialog"
				aria-labelledby="chat-title"
				aria-describedby="chat-source-note"
				aria-modal="true"
			>
				<div className="border-b border-border/70 bg-primary/[0.045] px-4 pb-4 pt-4 sm:px-5">
					<div className="flex items-start justify-between gap-4">
						<div className="flex items-start gap-3">
							<span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
								<BrainCircuit className="size-4" />
							</span>
							<ChatHeader
								triggerMetric={state.triggerMetric}
								companySymbol={state.initialContext?.symbol}
							/>
						</div>
						<Button
							variant="ghost"
							size="icon"
							onClick={onClose}
							className="size-8 rounded-full"
							aria-label="Close analyst"
						>
							<X className="size-4" />
						</Button>
					</div>
					<div
						id="chat-source-note"
						className="mt-3 flex items-center gap-2 text-[10px] leading-4 text-muted-foreground"
					>
						<ShieldCheck className="size-3.5 shrink-0 text-primary" />
						Based on the company fundamentals and chart points supplied by this page.
					</div>
					<ContextSummary context={state.initialContext} />
				</div>

				<MessageList
					messages={state.messages}
					sending={state.sending}
					error={state.error}
					onRegenerateLast={onRegenerateLast}
					onClearError={onClearError}
					hasUserMessages={hasUserMessages}
				/>

				{!hasUserMessages && (
					<div className="px-4 pb-3 sm:px-5">
						<SuggestionChips
							triggerMetric={state.triggerMetric?.label}
							onSendMessage={onSendMessage}
						/>
					</div>
				)}

				<ChatInput onSendMessage={onSendMessage} sending={state.sending} onStop={onStop} />
				<p className="border-t border-border/60 px-4 py-2 text-center text-[9px] leading-4 text-muted-foreground sm:px-5">
					Educational interpretation only. Verify material decisions against primary filings.
				</p>
			</div>
		</>
	);
}
