"use client";

import React, { useEffect, useRef } from "react";
import { Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "@/lib/types";

interface MessageListProps {
  messages: ChatMessage[];
  sending: boolean;
  error?: string | null;
  onRegenerateLast: () => void;
  onClearError: () => void;
  hasUserMessages: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  sending,
  error,
  onRegenerateLast,
  onClearError,
  hasUserMessages,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === "user";
    const isStreaming = message.streaming && !isUser;
    
    return (
      <div
        key={message.id}
        className={`group relative ${
          isUser 
            ? "bg-emerald-600/25 border border-emerald-500/30 border-l-2 border-l-emerald-500/70 rounded-lg px-3 py-2 text-sm leading-relaxed text-emerald-200 w-fit ml-auto"
            : "bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm leading-relaxed text-zinc-200 w-fit max-w-[52ch]"
        }`}
        aria-live={isStreaming ? "polite" : undefined}
      >
        <div className="whitespace-pre-wrap tabular-nums">
          {message.content}
          {isStreaming && (
            <span className="inline-block w-2 h-3 bg-zinc-500/60 rounded animate-pulse ml-1 align-baseline"></span>
          )}
        </div>

        {/* Copy and Regenerate buttons for assistant messages */}
        {!isUser && !isStreaming && message.content && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(message.content)}
              className="h-6 w-6 p-0 text-zinc-500 hover:text-zinc-300"
              aria-label="Copy answer"
            >
              <Copy className="h-3 w-3" />
            </Button>
            
            {message.id === messages[messages.length - 1]?.id && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRegenerateLast}
                disabled={sending}
                className="h-6 w-6 p-0 text-zinc-500 hover:text-zinc-300"
                aria-label="Regenerate answer"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Seed message for first-time users
  const seedMessage: ChatMessage = {
    id: "seed",
    role: "assistant",
    content: "Hi — I can interpret any metric here (valuation, margins, growth, leverage). Ask a question to begin.",
    createdAt: Date.now(),
  };

  const allMessages = !hasUserMessages && messages.length === 0 
    ? [seedMessage] 
    : messages;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-none">
      {/* Error display */}
      {error && (
        <div className="flex items-center justify-between px-3 py-2 bg-red-900/20 border border-red-800/40 rounded-lg">
          <span className="text-xs text-red-400">error</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearError}
            className="h-4 w-4 p-0 text-red-400 hover:text-red-300"
          >
            ×
          </Button>
        </div>
      )}

      {/* Messages */}
      {allMessages.map(renderMessage)}
      
      <div ref={messagesEndRef} />
    </div>
  );
}; 