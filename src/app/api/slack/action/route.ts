import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/lib/items";
import { sendReply, addReaction, markAsRead } from "@/lib/integrations/slack";
import { getDb } from "@/lib/db";
import { notifyChange } from "@/lib/changeNotifier";

function markChannelItemsAsRead(channelId: string) {
  const db = getDb();
  const items = db.prepare(
    "SELECT id, raw_data FROM items WHERE source = 'slack' AND raw_data LIKE ?"
  ).all(`%"channel":"${channelId}"%`) as { id: string; raw_data: string | null }[];
  for (const item of items) {
    if (!item.raw_data) continue;
    try {
      const raw = JSON.parse(item.raw_data);
      if (raw.isUnread) {
        raw.isUnread = false;
        db.prepare("UPDATE items SET raw_data = ? WHERE id = ?").run(JSON.stringify(raw), item.id);
      }
    } catch { /* ignore */ }
  }
  if (items.length > 0) notifyChange();
}

export async function POST(request: NextRequest) {
  const profile = getProfile();
  if (!profile?.slack_token) {
    return NextResponse.json({ error: "Slack not connected" }, { status: 400 });
  }

  const { action, channel, text, threadTs, timestamp, reaction } = await request.json();

  if (action === "reply") {
    const newTs = await sendReply(profile.slack_token, channel, text, threadTs);
    // Auto-mark channel as read using the new message's timestamp (latest point)
    const markTs = newTs ?? timestamp ?? String(Date.now() / 1000);
    await markAsRead(profile.slack_token, channel, markTs);
    // Mark all items in this channel as read in our DB
    markChannelItemsAsRead(channel);
    const db = getDb();
    db.prepare("INSERT INTO xp_log (action, source, xp, label) VALUES (?, ?, ?, ?)").run(
      "reply_slack", "slack", 10, `Replied in Slack`
    );
    return NextResponse.json({ ok: true });
  }

  if (action === "react") {
    await addReaction(profile.slack_token, channel, timestamp, reaction);
    // Auto-mark channel as read after reacting
    await markAsRead(profile.slack_token, channel, timestamp);
    // Mark this item as read in our DB
    markChannelItemsAsRead(channel);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
