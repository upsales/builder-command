import Anthropic from "@anthropic-ai/sdk";
import { getItems } from "@/lib/items";
import { getDb } from "@/lib/db";

const client = new Anthropic();

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const hiddenCalendars = new Set<string>(body.hiddenCalendars ?? []);
  const hiddenStates = new Set<string>(body.hiddenStates ?? []);
  const hiddenRepos = new Set<string>(body.hiddenRepos ?? []);
  const hideDrafts: boolean = body.hideDrafts ?? false;

  const allItems = getItems();

  // Apply user's filters
  const items = allItems.filter((i) => {
    const r = JSON.parse(i.raw_data ?? "{}");
    if (i.source === "calendar" && hiddenCalendars.has(r.calendarName)) return false;
    if (i.source === "linear" && hiddenStates.has(r.state)) return false;
    if (i.source === "github" && hiddenRepos.has(r.repo)) return false;
    if (i.source === "github" && hideDrafts && r.draft) return false;
    return true;
  });

  const db = getDb();

  // Get today's XP actions for "what you did"
  const todayStart = new Date().toISOString().slice(0, 10) + " 00:00:00";
  const todayActions = db.prepare(
    "SELECT action, source, xp, label, created_at FROM xp_log WHERE created_at >= ? ORDER BY created_at DESC"
  ).all(todayStart) as { action: string; source: string | null; xp: number; label: string | null; created_at: string }[];

  // Get yesterday's dismissed items for "what happened"
  const yesterdayStart = new Date(Date.now() - 86400000).toISOString().slice(0, 10) + " 00:00:00";
  const recentDismissed = db.prepare(
    "SELECT source, source_id, dismissed_at FROM dismissed WHERE dismissed_at >= ? ORDER BY dismissed_at DESC LIMIT 30"
  ).all(yesterdayStart) as { source: string; source_id: string; dismissed_at: string }[];

  // Get daily todos
  const todayDate = new Date().toISOString().slice(0, 10);
  const todos = db.prepare(
    "SELECT text, done FROM daily_todos WHERE date = ? OR date IS NULL ORDER BY done, sort_order"
  ).all(todayDate) as { text: string; done: number }[];

  const linearItems = items.filter((i) => i.source === "linear").map((i) => {
    const r = JSON.parse(i.raw_data ?? "{}");
    return `- [${r.identifier}] ${r.title} — ${r.state}, priority: ${["None", "Urgent", "High", "Medium", "Low"][r.priority ?? 0]}`;
  }).join("\n");

  const githubItems = items.filter((i) => i.source === "github").map((i) => {
    const r = JSON.parse(i.raw_data ?? "{}");
    const type = i.source_id.startsWith("review-") ? "Review" : "My PR";
    const checks = r.checks ?? [];
    const failing = checks.filter((c: { conclusion: string }) => c.conclusion === "failure").length;
    return `- [${type}] ${r.title} (${r.repo}#${r.id})${r.draft ? " DRAFT" : ""}${r.mergeable ? " READY" : ""}${failing > 0 ? ` ${failing} FAILING` : ""}${r.mergeableState === "dirty" ? " CONFLICTS" : ""}`;
  }).join("\n");

  const slackItems = items.filter((i) => i.source === "slack").map((i) => {
    const r = JSON.parse(i.raw_data ?? "{}");
    return `- #${r.channelName} — ${r.senderName}: ${r.text?.slice(0, 80)}${r.isUnread ? " [UNREAD]" : ""}`;
  }).join("\n");

  const calendarItems = items.filter((i) => i.source === "calendar").map((i) => {
    const r = JSON.parse(i.raw_data ?? "{}");
    const time = r.allDay ? "All day" : new Date(r.start).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `- ${time} ${r.title}${r.responseStatus === "needsAction" ? " [NEEDS RSVP]" : ""}`;
  }).join("\n");

  const prompt = `Generate a concise daily standup briefing. Current time: ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}.

## Today's Calendar
${calendarItems || "No events"}

## Linear Issues
${linearItems || "No issues"}

## GitHub PRs
${githubItems || "No PRs"}

## Slack (unread/active)
${slackItems || "No messages"}

## Already Done Today
${todayActions.length > 0 ? todayActions.map((a) => `- ${a.label} (+${a.xp} XP)`).join("\n") : "Nothing yet"}

## Recently Cleared (last 24h)
${recentDismissed.length} items dismissed

## My Todo List
${todos.length > 0 ? todos.map((t) => `- [${t.done ? "x" : " "}] ${t.text}`).join("\n") : "No todos"}

## Format
Write a brief standup using these sections:
1. **Schedule** — upcoming meetings today (times, who, where)
2. **Blockers** — things blocking you or others (conflicts, failing checks, awaiting review)
3. **Focus areas** — what to work on and in what order, with concrete next steps
4. **Quick wins** — things you can knock out in < 5 min (merge ready PRs, RSVPs, quick replies)

Keep each section to 2-4 bullet points max. Be direct and actionable. Skip empty sections.`;

  const stream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
