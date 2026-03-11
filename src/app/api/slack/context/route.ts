import { NextRequest, NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import { getProfile } from "@/lib/items";

export async function GET(request: NextRequest) {
  const channel = request.nextUrl.searchParams.get("channel");
  const ts = request.nextUrl.searchParams.get("ts");
  const direction = request.nextUrl.searchParams.get("direction") ?? "around"; // "before", "after", "around"

  if (!channel || !ts) {
    return NextResponse.json({ error: "channel and ts required" }, { status: 400 });
  }

  const profile = getProfile();
  if (!profile?.slack_token) {
    return NextResponse.json({ error: "Slack not connected" }, { status: 400 });
  }

  const client = new WebClient(profile.slack_token);

  const userCache = new Map<string, string>();
  const resolveUser = async (uid: string): Promise<string> => {
    if (userCache.has(uid)) return userCache.get(uid)!;
    try {
      const info = await client.users.info({ user: uid });
      const name = info.user?.profile?.display_name || info.user?.real_name || info.user?.name || uid;
      userCache.set(uid, name);
      return name;
    } catch {
      return uid;
    }
  };

  try {
    const messages: { sender: string; senderName: string; text: string; timestamp: string }[] = [];
    const limit = 5;

    if (direction === "before" || direction === "around") {
      const res = await client.conversations.history({
        channel,
        latest: ts,
        limit: limit + 1, // +1 because latest is inclusive
        inclusive: false,
      });
      for (const msg of (res.messages ?? []).reverse()) {
        const senderName = msg.user ? await resolveUser(msg.user) : "bot";
        messages.push({
          sender: msg.user ?? "",
          senderName,
          text: msg.text ?? "",
          timestamp: msg.ts ?? "",
        });
      }
    }

    if (direction === "after" || direction === "around") {
      const res = await client.conversations.history({
        channel,
        oldest: ts,
        limit: limit + 1,
        inclusive: false,
      });
      const afterMsgs = (res.messages ?? []).reverse(); // API returns newest first
      for (const msg of afterMsgs) {
        const senderName = msg.user ? await resolveUser(msg.user) : "bot";
        messages.push({
          sender: msg.user ?? "",
          senderName,
          text: msg.text ?? "",
          timestamp: msg.ts ?? "",
        });
      }
    }

    return NextResponse.json(messages);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
