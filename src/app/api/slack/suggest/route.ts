import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getProfile } from "@/lib/items";

const client = new Anthropic();

export async function POST(request: NextRequest) {
  const { channelName, senderName, messageText, conversationContext } = await request.json();

  const profile = getProfile();
  const myUserId = profile?.slack_user_id;

  const db = getDb();

  // Get user's own messages from the persistent style table
  const myMsgsThisChannel = db.prepare(
    `SELECT text FROM slack_style WHERE channel = ? ORDER BY timestamp DESC LIMIT 30`
  ).all(channelName) as { text: string }[];

  const myMsgsGlobal = db.prepare(
    `SELECT text FROM slack_style ORDER BY timestamp DESC LIMIT 100`
  ).all() as { text: string }[];

  // Get recent conversation in this channel from items table
  const channelRows = db.prepare(
    `SELECT raw_data FROM items WHERE source = 'slack' AND json_extract(raw_data, '$.channelName') = ? ORDER BY created_at DESC LIMIT 20`
  ).all(channelName) as { raw_data: string | null }[];

  const conversationWithPerson: { sender: string; text: string; isMe: boolean }[] = [];
  for (const row of channelRows) {
    if (!row.raw_data) continue;
    try {
      const raw = JSON.parse(row.raw_data);
      conversationWithPerson.push({
        sender: raw.sender === myUserId ? "ME" : (raw.senderName ?? "them"),
        text: raw.text ?? "",
        isMe: raw.sender === myUserId,
      });
    } catch { /* skip */ }
  }
  conversationWithPerson.reverse();

  // Build style samples: prioritize this channel, then global
  const styleSamples: string[] = [];
  const seen = new Set<string>();
  for (const row of myMsgsThisChannel) {
    if (seen.has(row.text)) continue;
    seen.add(row.text);
    styleSamples.push(row.text);
  }
  for (const row of myMsgsGlobal) {
    if (styleSamples.length >= 30) break;
    if (seen.has(row.text)) continue;
    seen.add(row.text);
    styleSamples.push(row.text);
  }

  const styleBlock = styleSamples.length > 0
    ? styleSamples.map((m) => `  "${m.length > 150 ? m.slice(0, 150) + "..." : m}"`).join("\n")
    : "No previous messages found";

  // Recent conversation in this channel (last 15 messages for context)
  const recentConvo = conversationWithPerson.slice(-15).map((m) =>
    `  ${m.sender}: ${m.text.length > 150 ? m.text.slice(0, 150) + "..." : m.text}`
  ).join("\n");

  const prompt = `You are helping draft a Slack reply. Generate 2-3 short suggested replies the user might send.

## Message to reply to
${senderName}: "${messageText}"

${conversationContext ? `## Thread context\n${conversationContext}\n` : ""}
## Recent conversation in this channel
${recentConvo || "No previous conversation"}

## User's OWN writing style (${styleSamples.length} samples${myMsgsThisChannel.length > 0 ? `, ${myMsgsThisChannel.length} from this specific channel` : ""})
${styleBlock}

## Critical rules
- You MUST match the user's writing style exactly. Study their samples above carefully.
- Copy their patterns: sentence length, capitalization (or lack of), punctuation habits, emoji usage, slang, language
- If they write short lowercase messages, do the same. If they use "haha", "lol", specific phrases — use those.
- If they tend to be brief (just a few words), keep suggestions equally brief.
- If they write in a language other than English, reply in that same language.
- Return ONLY the suggestions, one per line, prefixed with a dash. No explanations.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const suggestions = text.split("\n")
    .map((l) => l.replace(/^[-•]\s*/, "").trim())
    .filter((l) => l.length > 0 && l.length < 200);

  return NextResponse.json(suggestions);
}
