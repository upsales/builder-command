import { NextResponse } from "next/server";
import { getProfile } from "@/lib/items";
import { listCalendars } from "@/lib/integrations/google-calendar";

export async function GET() {
  const profile = getProfile();
  if (!profile?.google_refresh_token) {
    return NextResponse.json([]);
  }
  try {
    const calendars = await listCalendars(profile.google_refresh_token);
    return NextResponse.json(calendars);
  } catch {
    return NextResponse.json([]);
  }
}
