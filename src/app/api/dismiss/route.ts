import { NextRequest, NextResponse } from "next/server";
import { dismissItem, undismissItem, getRecentlyDismissed, getProfile } from "@/lib/items";
import { getDb } from "@/lib/db";
import { markAsRead } from "@/lib/integrations/slack";

const XP_BY_SOURCE: Record<string, number> = {
  slack: 5,
  github: 15,
  linear: 10,
  calendar: 5,
};

export async function GET() {
  const dismissed = getRecentlyDismissed();
  return NextResponse.json(dismissed);
}

export async function POST(request: NextRequest) {
  const { source, source_id } = await request.json();
  if (!source || !source_id) {
    return NextResponse.json({ error: "source and source_id required" }, { status: 400 });
  }

  // Mark Slack messages as read in the actual Slack app
  if (source === "slack") {
    const profile = getProfile();
    if (profile?.slack_token) {
      const db = getDb();
      const item = db.prepare("SELECT raw_data FROM items WHERE source = ? AND source_id = ?").get(source, source_id) as { raw_data: string | null } | undefined;
      if (item?.raw_data) {
        const raw = JSON.parse(item.raw_data);
        if (raw.channel) {
          // Find the latest message timestamp in this channel to mark the whole channel as read
          const allInChannel = db.prepare(
            "SELECT json_extract(raw_data, '$.timestamp') as ts FROM items WHERE source = 'slack' AND json_extract(raw_data, '$.channel') = ? ORDER BY ts DESC LIMIT 1"
          ).get(raw.channel) as { ts: string } | undefined;
          const latestTs = allInChannel?.ts ?? raw.timestamp;
          if (latestTs) {
            markAsRead(profile.slack_token, raw.channel, latestTs).catch((e) => {
              console.error(`[dismiss] Failed to mark ${raw.channel} as read:`, e);
            });
          }
        }
      }
    }
  }

  dismissItem(source, source_id);

  // Award XP for clearing items
  const xp = XP_BY_SOURCE[source] ?? 5;
  const db = getDb();
  db.prepare(
    "INSERT INTO xp_log (action, source, xp, label) VALUES (?, ?, ?, ?)"
  ).run("dismiss", source, xp, `Cleared ${source} item`);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { source, source_id } = await request.json();
  if (!source || !source_id) {
    return NextResponse.json({ error: "source and source_id required" }, { status: 400 });
  }
  undismissItem(source, source_id);
  return NextResponse.json({ ok: true });
}
