import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getItems } from "@/lib/items";

const client = new Anthropic();

export async function POST() {
  const items = getItems();

  const linearItems = items.filter((i) => i.source === "linear").map((i) => {
    const r = JSON.parse(i.raw_data ?? "{}");
    return { id: i.id, source: "linear", identifier: r.identifier, title: r.title, state: r.state, priority: r.priority, assignee: r.assignee, labels: r.labels, updatedAt: r.updatedAt };
  });

  const githubItems = items.filter((i) => i.source === "github").map((i) => {
    const r = JSON.parse(i.raw_data ?? "{}");
    const checks = r.checks ?? [];
    return {
      id: i.id, source: "github", title: r.title, repo: r.repo, prNumber: r.id,
      isReviewRequest: i.source_id.startsWith("review-"),
      mergeable: r.mergeable, hasConflicts: r.mergeableState === "dirty",
      failingChecks: checks.filter((c: { conclusion: string }) => c.conclusion === "failure").length,
      reviewers: r.reviewers, draft: r.draft, updatedAt: r.updatedAt,
    };
  });

  const slackItems = items.filter((i) => i.source === "slack").map((i) => {
    const r = JSON.parse(i.raw_data ?? "{}");
    return { id: i.id, source: "slack", channel: r.channelName, sender: r.senderName, text: r.text?.slice(0, 100), isUnread: r.isUnread, isDm: r.channelName?.startsWith("DM:") };
  });

  const calendarItems = items.filter((i) => i.source === "calendar").map((i) => {
    const r = JSON.parse(i.raw_data ?? "{}");
    return { id: i.id, source: "calendar", title: r.title, start: r.start, end: r.end, allDay: r.allDay, responseStatus: r.responseStatus, attendees: r.attendees?.length ?? 0 };
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: `You are a work prioritization assistant. Analyze these work items and return a prioritized action plan.

## Items
Calendar: ${JSON.stringify(calendarItems)}
Linear: ${JSON.stringify(linearItems)}
GitHub: ${JSON.stringify(githubItems)}
Slack: ${JSON.stringify(slackItems)}

## Rules
- Return a JSON array of objects: [{"id": "item_id", "priority": 1-10, "reason": "short reason", "action": "what to do"}]
- Priority 1 = most urgent. Consider:
  - Meetings starting soon or needing RSVP (highest urgency)
  - Unread DMs from people waiting on you
  - PRs where you're blocking others (review requests)
  - PRs with conflicts/failing checks (your own)
  - High-priority Linear issues in progress
  - Channel messages can usually wait
- Only include items that need action. Skip done/resolved items.
- Maximum 15 items.
- Return ONLY the JSON array, no other text.`,
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "[]";
  try {
    // Extract JSON from potential markdown code blocks
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const priorities = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    return NextResponse.json(priorities);
  } catch {
    return NextResponse.json([]);
  }
}
