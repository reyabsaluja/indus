"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContextChatState } from "@/lib/types";
import { ChatHeader } from "./ChatHeader";
import { ContextSummary } from "./ContextSummary";
import { MessageList } from "./MessageList";
import { SuggestionChips } from "./SuggestionChips";
import { ChatInput } from "./ChatInput";

interface ChatPanelProps {
  state: ContextChatState;
  onClose: () => void;
  onSendMessage: (message: string) => void;
  onRegenerateLast: () => void;
  onClearError: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  state,
  onClose,
  onSendMessage,
  onRegenerateLast,
  onClearError,
}) => {
  // Focus trap and keyboard handling
  useEffect(() => {
    if (!state.open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        const focusableElements = document.querySelectorAll(
          '[role="dialog"] button, [role="dialog"] textarea, [role="dialog"] [tabindex="0"]'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        } else if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("keydown", handleFocusTrap);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("keydown", handleFocusTrap);
    };
  }, [state.open, onClose]);

  if (!state.open) return null;

  const hasUserMessages = state.messages.some(m => m.role === "user");

  return (
    <div 
      className="fixed right-0 top-0 md:top-auto md:bottom-4 md:right-4 z-50 w-full md:w-[460px] max-h-full md:max-h-[70vh] flex flex-col rounded-none md:rounded-2xl bg-zinc-950/98 backdrop-blur-lg border-l-2 md:border-2 border-emerald-500/30 md:border-zinc-700/50 shadow-2xl shadow-black/80 md:shadow-emerald-500/10"
      role="dialog"
      aria-labelledby="chat-title"
      aria-modal="true"
      style={{
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(16, 185, 129, 0.1), 0 0 20px rgba(16, 185, 129, 0.05)"
      }}
    >
      {/* Header */}
      <div className="relative px-4 pt-4 pb-2 border-b border-zinc-800">
        <ChatHeader 
          triggerMetric={state.triggerMetric}
          companySymbol={state.initialContext?.symbol}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute right-3 top-3 h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Origin Metric Tag */}
      <div className="px-4">
        {state.triggerMetric && (
          <span className="mt-1 inline-block text-[10px] tracking-wide text-zinc-500">
            Origin: {state.triggerMetric.label}
          </span>
        )}
        
        {/* Context Summary */}
        <ContextSummary context={state.initialContext} />
      </div>

      {/* Message List */}
      <MessageList 
        messages={state.messages}
        sending={state.sending}
        error={state.error}
        onRegenerateLast={onRegenerateLast}
        onClearError={onClearError}
        hasUserMessages={hasUserMessages}
      />

      {/* Suggestion Chips (only shown before first user message) */}
      {!hasUserMessages && (
        <div className="px-4 pb-2">
          <SuggestionChips onSendMessage={onSendMessage} />
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[10px] text-zinc-500 text-center px-3 py-1 border-t border-zinc-800">
        Educational information only. Not investment advice.
      </p>

      {/* Input */}
      <ChatInput 
        onSendMessage={onSendMessage}
        sending={state.sending}
      />
    </div>
  );
}; 