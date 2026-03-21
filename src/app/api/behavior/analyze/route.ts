import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildBehaviorSummary, saveLearnedPatterns, getBehaviorStats } from "@/lib/behavior";

// POST /api/behavior/analyze — analyze behavior log and extract patterns
export async function POST() {
  const stats = getBehaviorStats();

  if (stats.total < 5) {
    return NextResponse.json({
      patterns: [],
      message: `Need more data — only ${stats.total} actions recorded so far. Keep using the app and patterns will emerge.`,
    });
  }

  const summary = buildBehaviorSummary();

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are analyzing a user's work management behavior to extract patterns and preferences.

Here is their behavior log:

${summary}

Analyze this data and extract behavioral patterns. For each pattern:
1. Describe it as a clear, specific rule (e.g., "Always dismisses Slack threads from #random within minutes")
2. Categorize it: dismiss, snooze, prioritize, review, communicate, schedule
3. Rate confidence 0.0-1.0 based on consistency and evidence count
4. Count how many data points support it

Focus on ACTIONABLE patterns — things that could predict future behavior or automate decisions.

Respond with ONLY a JSON array, no markdown fences:
[{"pattern": "...", "category": "...", "confidence": 0.8, "evidence_count": 12}]

If there aren't enough clear patterns yet, return fewer items. Quality over quantity.`,
      },
    ],
  });

  try {
    const text = (response.content[0] as { type: "text"; text: string }).text;
    const patterns = JSON.parse(text) as {
      pattern: string;
      category: string;
      confidence: number;
      evidence_count: number;
    }[];

    saveLearnedPatterns(patterns);

    return NextResponse.json({ patterns, stats });
  } catch (e) {
    console.error("[behavior/analyze] Failed to parse patterns:", e);
    return NextResponse.json(
      { error: "Failed to parse pattern analysis", raw: (response.content[0] as { text: string }).text },
      { status: 500 }
    );
  }
}
