import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/lib/items";
import { sendReply, addReaction, markAsRead } from "@/lib/integrations/slack";
import { getDb } from "@/lib/db";

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
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
