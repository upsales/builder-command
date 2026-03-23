import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getLearnedPatterns, getBehaviorStats } from "@/lib/behavior";
import { getItems } from "@/lib/items";

export interface Prediction {
  source: string;
  source_id: string;
  predicted_action: "dismiss" | "snooze" | "focus" | "act";
  confidence: number;
  reason: string;
}

// POST /api/behavior/predict — predict user actions on current items
export async function POST() {
  const patterns = getLearnedPatterns(0.4);
  const stats = getBehaviorStats();

  if (patterns.length === 0 || stats.total < 10) {
    return NextResponse.json({
      predictions: [],
      message: stats.total < 10
        ? `Need more data (${stats.total}/10 actions). Keep using the app.`
        : "No strong patterns detected yet. Run analysis first.",
    });
  }

  const items = getItems();
  if (items.length === 0) {
    return NextResponse.json({ predictions: [], message: "No active items." });
  }

  // Build a compact representation of current items
  const itemSummaries = items.slice(0, 40).map((item) => {
    const raw = item.raw_data ? JSON.parse(item.raw_data) : {};
    const ctx: Record<string, unknown> = { source: item.source, title: item.title };

    if (item.source === "github") {
      ctx.author = raw.author;
      ctx.repo = raw.repo;
      ctx.draft = raw.draft;
      ctx.mergeable = raw.mergeable;
      ctx.reviewRequested = raw.reviewRequested;
      ctx.checks = (raw.checks ?? []).length;
      ctx.failingChecks = (raw.checks ?? []).filter((c: { conclusion: string }) => c.conclusion === "failure").length;
    } else if (item.source === "slack") {
      ctx.channel = raw.channelName;
      ctx.sender = raw.senderName;
      ctx.isDM = (raw.channelName ?? "").startsWith("DM:");
    } else if (item.source === "linear") {
      ctx.state = raw.state;
      ctx.priority = raw.priority;
      ctx.project = raw.project;
    } else if (item.source === "calendar") {
      ctx.responseStatus = raw.responseStatus;
      ctx.attendeeCount = (raw.attendees ?? []).length;
    }

    return { source: item.source, source_id: item.source_id, ...ctx };
  });

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You have learned these behavioral patterns about a user:

${patterns.map((p) => `- [${p.category}] (confidence: ${p.confidence.toFixed(2)}) ${p.pattern}`).join("\n")}

Here are their current work items:

${JSON.stringify(itemSummaries, null, 2)}

For each item, predict what the user would likely do based on the patterns above.
Only include items where you have moderate-to-high confidence (>= 0.5) in a prediction.

Respond with ONLY a JSON array, no markdown fences:
[{"source": "...", "source_id": "...", "predicted_action": "dismiss|snooze|focus|act", "confidence": 0.8, "reason": "Brief explanation based on which pattern"}]

"act" means the user would take immediate action (merge, reply, review, etc.).
Keep reasons under 80 characters. Return an empty array if no strong predictions.`,
      },
    ],
  });

  try {
    const text = (response.content[0] as { type: "text"; text: string }).text;
    const predictions = JSON.parse(text) as Prediction[];

    return NextResponse.json({ predictions });
  } catch (e) {
    console.error("[behavior/predict] Failed to parse predictions:", e);
    return NextResponse.json(
      { error: "Failed to parse predictions", raw: (response.content[0] as { text: string }).text },
      { status: 500 }
    );
  }
}
