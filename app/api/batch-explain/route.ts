import { NextResponse } from "next/server";
import { makeBatchPrompt, Item } from "@/lib/prompts";
import { VALUE_ANALYSIS_SYSTEM_PROMPT } from "@/lib/system-prompts";

// UPDATED: Using gemini-2.5-flash which is the current stable release (June 2025)
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export async function POST(req: Request) {
  try {
    const items: Item[] = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing Gemini API key." },
        { status: 500 },
      );
    }

    const prompt = makeBatchPrompt(items);
    const fullPrompt = `${VALUE_ANALYSIS_SYSTEM_PROMPT}\n\n${prompt}`;

    // UPDATED: Passing key in URL and using the updated model URL
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Gemini batch error:", {
        status: res.status,
        errorText,
        headers: Object.fromEntries(res.headers.entries()),
      });

      // UPDATED: Return 429 explicitly if quota is hit
      if (res.status === 429) {
        return NextResponse.json(
          { error: "Gemini API Rate Limit Exceeded. Please try again later." },
          { status: 429 },
        );
      }

      return NextResponse.json(
        { error: `Gemini error: ${res.status}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Try to parse the response as JSON first
    try {
      // Extract JSON from the response (handle cases where it's wrapped in code blocks)
      const jsonMatch =
        rawText.match(/```json\s*([\s\S]*?)\s*```/) ||
        rawText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[1] || jsonMatch[0] : rawText;
      const parsedResponse = JSON.parse(jsonText);

      // Convert the structured response to our format
      const result: Record<string, string> = {};
      items.forEach((item, idx) => {
        const key = `${item.symbol}_${item.metric}`;
        const itemKey = (idx + 1).toString();
        const structuredData = parsedResponse[itemKey];

        if (structuredData) {
          result[key] = JSON.stringify(structuredData);
        } else {
          result[key] = "No explanation available.";
        }
      });

      return NextResponse.json({ explanations: result });
    } catch (parseError) {
      console.error(
        "Failed to parse structured response, falling back to text parsing:",
        parseError,
      );

      // Fallback to the old text parsing method
      const lines = rawText
        .split(/\n+/)
        .map((l: string) => l.trim())
        .filter(Boolean);

      const fallbackExplanations: string[] = [];

      for (const line of lines) {
        const match = line.match(/^\d+\.\s*(.+)$/);
        if (match) {
          fallbackExplanations.push(match[1].trim());
        }
      }

      if (fallbackExplanations.length === 0) {
        const fallbackParts = rawText
          .split(/(?:\n\s*[-•*]\s*|\n\s*\d+\.\s*)/)
          .filter(Boolean);
        fallbackExplanations.push(...fallbackParts.slice(0, items.length));
      }

      const result: Record<string, string> = {};
      items.forEach((item, idx) => {
        const key = `${item.symbol}_${item.metric}`;
        result[key] = fallbackExplanations[idx] || "No explanation available.";
      });

      return NextResponse.json({ explanations: result });
    }
  } catch (err) {
    console.error("Batch explain error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
