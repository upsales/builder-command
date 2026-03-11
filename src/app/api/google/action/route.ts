import { NextRequest, NextResponse } from "next/server";
import { respondToEvent } from "@/lib/integrations/google-calendar";
import { getProfile } from "@/lib/items";

export async function POST(request: NextRequest) {
  const profile = getProfile();
  if (!profile?.google_refresh_token) {
    return NextResponse.json({ error: "Google not connected" }, { status: 400 });
  }

  const { action, eventId, response, calendarId } = await request.json();

  if (action === "respond" && eventId && response) {
    await respondToEvent(profile.google_refresh_token, eventId, response, calendarId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
