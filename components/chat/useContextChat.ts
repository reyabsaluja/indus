"use client";

import { useState, useCallback, useRef } from "react";
import { ContextChatState, ChatMessage, PageContext } from "@/lib/types";
import { buildPageContext, trimContextIfNeeded } from "@/lib/context/buildPageContext";

// Get the current financial data from the page context
// This will be passed in when the hook is used
interface UseContextChatParams {
  getFinancialData: () => any;
  getChartData?: () => any;
}

export function useContextChat({ getFinancialData, getChartData }: UseContextChatParams) {
  const [state, setState] = useState<ContextChatState>({
    open: false,
    messages: [],
    sending: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Rate limiting state
  const requestCountRef = useRef(0);
  const lastRequestWindowRef = useRef(Date.now());

  const openWithMetric = useCallback((metricKey: string, metricLabel: string, value: number | string) => {
    try {
      const financialData = getFinancialData();
      const chartData = getChartData?.();
      
      if (!financialData) {
        setState(prev => ({ ...prev, error: "error" }));
        return;
      }

      const initialContext = buildPageContext({
        financialData,
        chartData,
        triggerMetric: { metricKey, metricLabel, value }
      });

      const trimmedContext = trimContextIfNeeded(initialContext);

      setState(prev => ({
        ...prev,
        open: true,
        initialContext: trimmedContext,
        triggerMetric: { metricKey, label: metricLabel, value },
        error: null,
        messages: [] // Reset messages for new metric
      }));
    } catch (error) {
      console.error("Error opening chat:", error);
      setState(prev => ({ 
        ...prev, 
        error: "error" 
      }));
    }
  }, [getFinancialData, getChartData]);

  const close = useCallback(() => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setState(prev => ({
      ...prev,
      open: false,
      sending: false,
    }));
  }, []);

  const checkRateLimit = useCallback(() => {
    const now = Date.now();
    const windowDuration = 30000; // 30 seconds
    
    // Reset window if needed
    if (now - lastRequestWindowRef.current > windowDuration) {
      requestCountRef.current = 0;
      lastRequestWindowRef.current = now;
    }
    
    if (requestCountRef.current >= 5) {
      return false; // Rate limited
    }
    
    requestCountRef.current++;
    return true;
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    const trimmedContent = content.trim();
    if (!trimmedContent || state.sending || !state.initialContext) return;

    // Check rate limit
    if (!checkRateLimit()) {
      setState(prev => ({ 
        ...prev, 
        error: "error" 
      }));
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedContent,
      createdAt: Date.now(),
    };

    // Add placeholder assistant message for streaming
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      streaming: true,
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage, assistantMessage],
      sending: true,
      error: null,
    }));

    try {
      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/context-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context: state.initialContext,
          messages: state.messages,
          newMessage: trimmedContent,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const isStreaming = response.headers.get('content-type')?.includes('text/event-stream');

      if (isStreaming) {
        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let accumulatedContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.delta) {
                  accumulatedContent += data.delta;
                  setState(prev => ({
                    ...prev,
                    messages: prev.messages.map(msg =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: accumulatedContent, streaming: true }
                        : msg
                    ),
                  }));
                } else if (data.done) {
                  setState(prev => ({
                    ...prev,
                    messages: prev.messages.map(msg =>
                      msg.id === assistantMessageId
                        ? { ...msg, streaming: false }
                        : msg
                    ),
                    sending: false,
                  }));
                  return;
                }
              } catch (e) {
                // Skip malformed JSON
              }
            }
          }
        }
      } else {
        // Handle non-streaming response
        const data = await response.json();
        setState(prev => ({
          ...prev,
          messages: prev.messages.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: data.response || 'No response', streaming: false }
              : msg
          ),
          sending: false,
        }));
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return; // Request was cancelled
      }

      console.error('Chat error:', error);
      setState(prev => ({
        ...prev,
        messages: prev.messages.filter(msg => msg.id !== assistantMessageId),
        sending: false,
        error: 'error',
      }));
    } finally {
      abortControllerRef.current = null;
    }
  }, [state.sending, state.initialContext, state.messages, checkRateLimit]);

  const regenerateLast = useCallback(async () => {
    if (state.messages.length < 2 || state.sending) return;

    // Find the last user message
    let lastUserMessage: ChatMessage | null = null;
    for (let i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i].role === 'user') {
        lastUserMessage = state.messages[i];
        break;
      }
    }

    if (!lastUserMessage) return;

    // Remove the last assistant message and resend
    const messagesWithoutLastAssistant = state.messages.filter(msg => 
      !(msg.role === 'assistant' && msg.createdAt > lastUserMessage!.createdAt)
    );

    setState(prev => ({
      ...prev,
      messages: messagesWithoutLastAssistant,
    }));

    // Resend the last user message
    await sendMessage(lastUserMessage.content);
  }, [state.messages, state.sending, sendMessage]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    openWithMetric,
    close,
    sendMessage,
    regenerateLast,
    clearError,
  };
} 