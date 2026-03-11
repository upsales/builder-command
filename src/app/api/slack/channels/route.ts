import { NextResponse } from "next/server";
import { getProfile } from "@/lib/items";
import { listUserChannels } from "@/lib/integrations/slack";

export async function GET() {
  const profile = getProfile();
  if (!profile?.slack_token) {
    return NextResponse.json({ error: "Slack not connected" }, { status: 400 });
  }

  const channels = await listUserChannels(profile.slack_token);
  return NextResponse.json(channels);
}
