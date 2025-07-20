import { NextRequest, NextResponse } from "next/server";
import { GeminiClient } from "@/lib/ai/geminiClient";
import { GEMINI_SYSTEM_PROMPT } from "@/lib/ai/geminiSystemPrompt";
import { PageContext, ChatMessage } from "@/lib/types";

interface RequestBody {
  context: PageContext;
  messages: ChatMessage[];
  newMessage: string;
}

// Helper function to sanitize user input against prompt injection
function sanitizeInput(input: string): string {
  const suspiciousPatterns = [
    /ignore\s+(?:previous|all)\s+instructions?/i,
    /forget\s+(?:previous|all)\s+instructions?/i,
    /you\s+are\s+now/i,
    /pretend\s+(?:to\s+be|you\s+are)/i,
    /act\s+as\s+(?:if|though)/i,
    /roleplay/i,
    /system\s*:/i,
    /assistant\s*:/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(input)) {
      return `[User question about financial data]: ${input}`;
    }
  }

  return input;
}

// Helper function to validate request body
function validateRequest(body: unknown): RequestBody | null {
  if (!body || typeof body !== 'object') return null;
  const bodyObj = body as Record<string, unknown>;
  if (!bodyObj.context || typeof bodyObj.context !== 'object') return null;
  if (!bodyObj.newMessage || typeof bodyObj.newMessage !== 'string') return null;
  if (!Array.isArray(bodyObj.messages)) return null;

  return {
    context: bodyObj.context as PageContext,
    messages: bodyObj.messages as ChatMessage[],
    newMessage: bodyObj.newMessage.trim(),
  };
}

export async function POST(request: NextRequest) {
  try {
    // Validate environment
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY not configured');
      return NextResponse.json(
        { error: 'error' },
        { status: 500 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validatedRequest = validateRequest(body);
    if (!validatedRequest) {
      return NextResponse.json(
        { error: 'error' },
        { status: 400 }
      );
    }

    const { context, messages, newMessage } = validatedRequest;

    // Sanitize user input
    const sanitizedMessage = sanitizeInput(newMessage);

    // Log context size in development only
    if (process.env.NODE_ENV !== 'production') {
      const contextSize = JSON.stringify(context).length;
      console.log(`Context size: ${(contextSize / 1024).toFixed(1)}KB`);
    }

    // Build conversation for Gemini
    const geminiClient = new GeminiClient(apiKey);
    
    // Create system message with context
    const systemMessage = {
      role: 'system' as const,
      parts: [{ text: GEMINI_SYSTEM_PROMPT }]
    };

    // Convert previous messages to Gemini format
    const conversationMessages = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: msg.content }]
    }));

    // Add new user message with context
    const contextBlob = JSON.stringify(context);
    const userMessage = {
      role: 'user' as const,
      parts: [{ text: `Context: ${contextBlob}\n\nUser Question: ${sanitizedMessage}` }]
    };

    const allMessages = [systemMessage, ...conversationMessages, userMessage];

    // Determine if we should stream based on Accept header
    const acceptHeader = request.headers.get('accept') || '';
    const preferStreaming = acceptHeader.includes('text/event-stream');

    if (preferStreaming) {
      // Streaming response
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const geminiStream = await geminiClient.generateStreamingContent(allMessages);
            const reader = geminiStream.getReader();
            const decoder = new TextDecoder();

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.trim()) {
                  try {
                    const data = JSON.parse(line);
                    const text = GeminiClient.parseStreamChunk(line);
                    if (text) {
                      const sseData = `data: ${JSON.stringify({ delta: text })}\n\n`;
                      controller.enqueue(encoder.encode(sseData));
                    }
                  } catch (e) {
                    // Skip malformed JSON
                  }
                }
              }
            }

            // Send completion signal
            const doneData = `data: ${JSON.stringify({ done: true })}\n\n`;
            controller.enqueue(encoder.encode(doneData));
            controller.close();
          } catch (error) {
            console.error('Streaming error:', error);
            const errorData = `data: ${JSON.stringify({ error: 'error' })}\n\n`;
            controller.enqueue(encoder.encode(errorData));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Non-streaming response
      const response = await geminiClient.generateContent(allMessages);
      return NextResponse.json({ response });
    }
  } catch (error: any) {
    console.error('Context chat API error:', error);
    
    // Return appropriate error based on type
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      return NextResponse.json(
        { error: 'error' },
        { status: 429 }
      );
    }
    
    if (error.message?.includes('401') || error.message?.includes('403')) {
      return NextResponse.json(
        { error: 'error' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'error' },
      { status: 500 }
    );
  }
} 