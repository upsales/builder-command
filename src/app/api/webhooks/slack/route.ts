import { NextRequest, NextResponse } from "next/server";
import { getProfile, upsertItem } from "@/lib/items";
import { notifyChange } from "@/lib/changeNotifier";
import { getDb } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Slack URL verification challenge
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  // Events API
  if (body.type === "event_callback") {
    const event = body.event;
    const profile = getProfile();
    if (!profile?.slack_user_id) {
      return NextResponse.json({ ok: true });
    }

    if (event?.type === "message") {
      const channelId = event.channel;
      const ts = event.ts;
      const threadTs = event.thread_ts;
      const text = (event.text ?? "").substring(0, 200);
      const sender = event.user ?? "unknown";
      const mentionsUser = text.includes(`<@${profile.slack_user_id}>`);
      const isDmToUser = event.channel_type === "im" && sender !== profile.slack_user_id;

      // If this is a thread reply, update the parent item's reply count
      if (threadTs && threadTs !== ts) {
        const db = getDb();
        const parentSourceId = `${channelId}-${threadTs}`;
        const existing = db.prepare(
          "SELECT raw_data FROM items WHERE source = 'slack' AND source_id = ?"
        ).get(parentSourceId) as { raw_data: string | null } | undefined;

        if (existing?.raw_data) {
          try {
            const raw = JSON.parse(existing.raw_data);
            raw.replyCount = (raw.replyCount ?? 0) + 1;
            // Add reply user name to list if not already there
            if (!raw.replyUserNames) raw.replyUserNames = [];
            if (sender && !raw.replyUserNames.includes(sender)) {
              raw.replyUserNames.push(sender);
            }
            db.prepare(
              "UPDATE items SET raw_data = ? WHERE source = 'slack' AND source_id = ?"
            ).run(JSON.stringify(raw), parentSourceId);
            notifyChange();
          } catch { /* ignore parse errors */ }
        }
      }

      // New mention or DM — insert as new item
      if (mentionsUser || isDmToUser) {
        upsertItem({
          source: "slack",
          source_id: `${channelId}-${ts}`,
          title: `#${channelId} — ${sender}: ${text.substring(0, 100)}`,
          url: `https://slack.com/archives/${channelId}/p${ts.replace(".", "")}`,
          raw_data: JSON.stringify({
            channel: channelId,
            channelName: channelId, // Will be resolved on next full sync
            text,
            sender,
            senderName: sender, // Will be resolved on next full sync
            threadTs: threadTs ?? null,
            timestamp: ts,
            isUnread: true,
          }),
        });
        notifyChange();
      }

      // Message in a watched channel (not a mention/DM) — still update items for that channel
      if (!mentionsUser && !isDmToUser) {
        const db = getDb();
        // Check if this channel has any tracked items
        const hasTracked = db.prepare(
          "SELECT 1 FROM items WHERE source = 'slack' AND source_id LIKE ? LIMIT 1"
        ).get(`${channelId}-%`);
        if (hasTracked) {
          notifyChange();
        }
      }
    }

    // Handle reaction events (user reacted = mark as attended)
    if (event?.type === "reaction_added" && event.user === profile.slack_user_id) {
      notifyChange();
    }
  }

  return NextResponse.json({ ok: true });
}
