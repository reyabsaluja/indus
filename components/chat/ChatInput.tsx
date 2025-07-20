"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  sending: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  sending,
}) => {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 6 * 24; // 6 lines * 24px line height
      textarea.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    }
  }, [message]);

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !sending) {
      onSendMessage(trimmedMessage);
      setMessage("");
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
    <div className="border-t border-zinc-800 px-3 pt-3 pb-2 flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this metric or any other financial data..."
          className="flex-1 resize-none bg-zinc-900/70 border border-zinc-800 focus-visible:ring-1 focus-visible:ring-emerald-500/60 focus-visible:border-emerald-500/60 rounded-md px-3 py-2 text-sm leading-snug max-h-40 overflow-auto text-zinc-200 placeholder:text-zinc-500 scrollbar-none"
          disabled={sending}
          rows={1}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        />
        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={!message.trim() || sending}
          className="h-10 w-10 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}; 