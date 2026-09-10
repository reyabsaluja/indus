"use client";

import { Send, Square } from "lucide-react";
import type React from "react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
	onSendMessage: (message: string) => void;
	sending: boolean;
	onStop: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, sending, onStop }) => {
	const [message, setMessage] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const resizeTextarea = useCallback(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = "auto";
			const scrollHeight = textarea.scrollHeight;
			const maxHeight = 6 * 24; // 6 lines * 24px line height
			textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
		}
	}, []);

	useLayoutEffect(resizeTextarea, [resizeTextarea]);

	const handleSend = () => {
		const trimmedMessage = message.trim();
		if (trimmedMessage && !sending) {
			onSendMessage(trimmedMessage);
			setMessage("");
			requestAnimationFrame(resizeTextarea);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			const isCtrlOrCmd = e.ctrlKey || e.metaKey;

			if (isCtrlOrCmd) {
				// Ctrl+Enter or Cmd+Enter to send
				e.preventDefault();
				handleSend();
			} else if (!e.shiftKey) {
				// Enter without shift to send (shift+enter for new line)
				e.preventDefault();
				handleSend();
			}
		}
	};

	return (
		<div className="border-t border-border/70 px-4 pb-3 pt-3 sm:px-5">
			<div className="flex items-end gap-2">
				<textarea
					ref={textareaRef}
					value={message}
					onChange={(e) => {
						setMessage(e.target.value);
						requestAnimationFrame(resizeTextarea);
					}}
					onKeyDown={handleKeyDown}
					placeholder="Ask a question about this company…"
					className="scrollbar-none max-h-40 min-h-11 flex-1 resize-none overflow-auto rounded-xl border border-border bg-background/70 px-3 py-3 text-sm leading-snug text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15"
					rows={1}
					style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
				/>
				<Button
					type="button"
					size="icon"
					onClick={handleSend}
					disabled={!message.trim() || sending}
					className="size-11 rounded-xl"
					aria-label="Send question"
				>
					<Send className="size-4" />
				</Button>
			</div>
			{sending && (
				<button
					type="button"
					onClick={onStop}
					className="mx-auto mt-2 inline-flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground"
				>
					<Square className="size-2.5 fill-current" />
					Stop generating
				</button>
			)}
		</div>
	);
};
