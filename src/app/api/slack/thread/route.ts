import { NextRequest, NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import { getProfile } from "@/lib/items";

export async function GET(request: NextRequest) {
  const channel = request.nextUrl.searchParams.get("channel");
  const ts = request.nextUrl.searchParams.get("ts");

  if (!channel || !ts) {
    return NextResponse.json({ error: "channel and ts required" }, { status: 400 });
  }

  const profile = getProfile();
  if (!profile?.slack_token) {
    return NextResponse.json({ error: "Slack not connected" }, { status: 400 });
  }

  const client = new WebClient(profile.slack_token);

  // Cache for user resolution
  const userCache = new Map<string, string>();
  const resolveUser = async (uid: string): Promise<string> => {
    if (userCache.has(uid)) return userCache.get(uid)!;
    try {
      const info = await client.users.info({ user: uid });
      const name = info.user?.real_name ?? info.user?.name ?? uid;
      userCache.set(uid, name);
      return name;
    } catch {
      return uid;
    }
  };

  const cleanText = async (text: string): Promise<string> => {
    const mentionRegex = /<@([A-Z0-9]+)(?:\|[^>]*)?>/g;
    const matches = [...text.matchAll(mentionRegex)];
    let cleaned = text;
    for (const match of matches) {
      const name = await resolveUser(match[1]);
      cleaned = cleaned.replace(match[0], `@${name}`);
    }
    cleaned = cleaned.replace(/<#[A-Z0-9]+\|([^>]+)>/g, "#$1");
    cleaned = cleaned.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, "$2");
    cleaned = cleaned.replace(/<(https?:\/\/[^>]+)>/g, "$1");
    return cleaned;
  };

  try {
    const thread = await client.conversations.replies({
      channel,
      ts,
      limit: 50,
    });

    const replies = [];
    for (const reply of (thread.messages ?? []).slice(1)) {
      const senderName = reply.user ? await resolveUser(reply.user) : "unknown";
      const text = await cleanText(reply.text ?? "");
      replies.push({
        sender: reply.user ?? "",
        senderName,
        text,
        timestamp: reply.ts ?? "",
      });
    }

    return NextResponse.json(replies);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
